import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

export interface ContractusStackProps extends cdk.StackProps {
  /** Nombre del ambiente, usado como sufijo de los recursos (ej. "pilot", "staging", "prod"). */
  environmentName: string;
  /**
   * Dominio propio (ej. "contractus360.miEntidad.gov.co"). Opcional: si se
   * omite, el sistema queda expuesto por la URL pública del Load Balancer
   * sobre HTTP, sin certificado. Requiere que el dominio ya tenga una
   * Hosted Zone en Route 53 en la misma cuenta.
   */
  domainName?: string;
}

/**
 * Infraestructura piloto/bajo-costo de CONTRACTUS 360 en AWS.
 *
 * Decisiones para mantener el costo mínimo (ver docs/ARCHITECTURE.md y
 * docs/ROADMAP.md — Fase 4):
 * - Sin NAT Gateway: las tareas de ECS corren en subredes públicas con IP
 *   pública propia (más barato que un NAT Gateway para un piloto de bajo
 *   tráfico). RDS permanece en subredes aisladas, sin salida a internet.
 * - RDS de una sola AZ (db.t4g.micro) en vez de Multi-AZ.
 * - Sin CloudFront ni WAF en esta fase (se documentan como mejora futura).
 * - El backend NO es accesible públicamente: solo el frontend recibe
 *   tráfico de internet (vía el Load Balancer); el frontend llama al
 *   backend por la red interna usando ECS Service Connect.
 *
 * Antes de usar esto en producción real revisar explícitamente: Multi-AZ,
 * deletionProtection, removalPolicy (aquí es DESTROY para poder desechar
 * el piloto sin fricción), WAF, CloudFront, y escalado automático.
 */
export class ContractusStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ContractusStackProps) {
    super(scope, id, props);

    const { environmentName, domainName } = props;
    const resourceName = (name: string) => `contractus360-${environmentName}-${name}`;

    // -------------------------------------------------------------------
    // Red
    // -------------------------------------------------------------------
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: resourceName('vpc'),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    const albSg = new ec2.SecurityGroup(this, 'AlbSg', {
      vpc,
      description: 'CONTRACTUS 360 - Load Balancer',
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP público');
    if (domainName) {
      albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS público');
    }

    const frontendSg = new ec2.SecurityGroup(this, 'FrontendSg', {
      vpc,
      description: 'CONTRACTUS 360 - servicio frontend (Next.js)',
      allowAllOutbound: true,
    });
    frontendSg.addIngressRule(albSg, ec2.Port.tcp(3000), 'Solo desde el Load Balancer');

    const backendSg = new ec2.SecurityGroup(this, 'BackendSg', {
      vpc,
      description: 'CONTRACTUS 360 - servicio backend (NestJS API)',
      allowAllOutbound: true,
    });
    backendSg.addIngressRule(frontendSg, ec2.Port.tcp(3001), 'Solo desde el frontend, vía Service Connect');

    const dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc,
      description: 'CONTRACTUS 360 - PostgreSQL (RDS)',
      allowAllOutbound: false,
    });
    dbSg.addIngressRule(backendSg, ec2.Port.tcp(5432), 'Solo desde el backend');

    // -------------------------------------------------------------------
    // Base de datos (RDS PostgreSQL)
    // -------------------------------------------------------------------
    const dbCredentials = new rds.DatabaseSecret(this, 'DbCredentials', {
      username: 'contractus',
      secretName: resourceName('db-credentials'),
    });

    const databaseName = 'contractus360';

    const database = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: resourceName('db'),
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_4 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(dbCredentials),
      databaseName,
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      multiAz: false,
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: false, // cambiar a true antes de producción real
      removalPolicy: cdk.RemovalPolicy.DESTROY, // cambiar a RETAIN antes de producción real
    });

    // -------------------------------------------------------------------
    // Almacenamiento de archivos (evidencias, documentos)
    // -------------------------------------------------------------------
    const evidencesBucket = new s3.Bucket(this, 'EvidencesBucket', {
      bucketName: resourceName('evidencias').toLowerCase(),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // cambiar a RETAIN antes de producción real
      autoDeleteObjects: true, // solo apto para piloto; quitar en producción real
      lifecycleRules: [
        {
          id: 'abort-incomplete-multipart-uploads',
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    // -------------------------------------------------------------------
    // Repositorios de imágenes (ECR)
    // -------------------------------------------------------------------
    const backendRepo = new ecr.Repository(this, 'BackendRepo', {
      repositoryName: resourceName('backend'),
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [{ maxImageCount: 10, description: 'Conservar solo las 10 imágenes más recientes' }],
    });

    const frontendRepo = new ecr.Repository(this, 'FrontendRepo', {
      repositoryName: resourceName('frontend'),
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [{ maxImageCount: 10, description: 'Conservar solo las 10 imágenes más recientes' }],
    });

    // -------------------------------------------------------------------
    // Secretos de aplicación (JWT)
    // -------------------------------------------------------------------
    const jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: resourceName('jwt-secret'),
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
    });
    const jwtRefreshSecret = new secretsmanager.Secret(this, 'JwtRefreshSecret', {
      secretName: resourceName('jwt-refresh-secret'),
      generateSecretString: { excludePunctuation: true, passwordLength: 48 },
    });

    // -------------------------------------------------------------------
    // Cluster ECS Fargate + Service Connect (red interna backend<->frontend)
    // -------------------------------------------------------------------
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: resourceName('cluster'),
      vpc,
      containerInsightsV2: ecs.ContainerInsights.DISABLED, // costo adicional; activar en producción real
      defaultCloudMapNamespace: {
        name: 'contractus.local',
        type: servicediscovery.NamespaceType.DNS_PRIVATE,
      },
    });

    // --- Backend (API NestJS) — privado, expuesto solo vía Service Connect
    const backendTaskDef = new ecs.FargateTaskDefinition(this, 'BackendTaskDef', {
      family: resourceName('backend'),
      cpu: 256,
      memoryLimitMiB: 512,
    });

    evidencesBucket.grantReadWrite(backendTaskDef.taskRole);

    backendTaskDef.addContainer('backend', {
      image: ecs.ContainerImage.fromEcrRepository(backendRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'backend',
        logRetention: logs.RetentionDays.TWO_WEEKS,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3001',
        // El origen real del frontend se debe ajustar tras el primer deploy
        // (ver README de infra/) una vez se conozca la URL/dominio pública.
        CORS_ORIGIN: domainName ? `https://${domainName}` : '*',
        STORAGE_DRIVER: 's3',
        AWS_S3_BUCKET: evidencesBucket.bucketName,
        AWS_REGION: this.region,
        DB_HOST: database.dbInstanceEndpointAddress,
        DB_PORT: database.dbInstanceEndpointPort,
        DB_NAME: databaseName,
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
        CONTRACT_EXPIRY_WARNING_DAYS: '30',
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
        JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
        JWT_REFRESH_SECRET: ecs.Secret.fromSecretsManager(jwtRefreshSecret),
      },
      // DATABASE_URL se construye en arranque a partir de las partes
      // anteriores porque ECS no permite concatenar secretos de Secrets
      // Manager directamente en una sola variable de entorno.
      command: [
        'sh',
        '-c',
        'export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?schema=public" && node dist/main.js',
      ],
      portMappings: [{ name: 'backend', containerPort: 3001, appProtocol: ecs.AppProtocol.http }],
    });

    const backendService = new ecs.FargateService(this, 'BackendService', {
      serviceName: resourceName('backend'),
      cluster,
      taskDefinition: backendTaskDef,
      desiredCount: 1,
      assignPublicIp: true, // sin NAT: necesita salida a internet para ECR/CloudWatch
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [backendSg],
      circuitBreaker: { rollback: true },
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      serviceConnectConfiguration: {
        namespace: 'contractus.local',
        services: [{ portMappingName: 'backend', dnsName: 'backend', port: 3001 }],
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'service-connect-backend' }),
      },
    });

    // --- Frontend (Next.js) — público, vía Load Balancer
    const frontendTaskDef = new ecs.FargateTaskDefinition(this, 'FrontendTaskDef', {
      family: resourceName('frontend'),
      cpu: 256,
      memoryLimitMiB: 512,
    });

    frontendTaskDef.addContainer('frontend', {
      image: ecs.ContainerImage.fromEcrRepository(frontendRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'frontend',
        logRetention: logs.RetentionDays.TWO_WEEKS,
      }),
      environment: {
        NODE_ENV: 'production',
        PORT: '3000',
        // DNS interno de Service Connect: solo resoluble dentro del cluster.
        NEXT_PUBLIC_API_URL: 'http://backend:3001',
      },
      portMappings: [{ name: 'frontend', containerPort: 3000, appProtocol: ecs.AppProtocol.http }],
    });

    const frontendService = new ecs.FargateService(this, 'FrontendService', {
      serviceName: resourceName('frontend'),
      cluster,
      taskDefinition: frontendTaskDef,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [frontendSg],
      circuitBreaker: { rollback: true },
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
    });
    // Garantiza que el backend (con su DNS de Service Connect) exista antes
    // de que el frontend intente resolverlo en su primer healthcheck.
    frontendService.node.addDependency(backendService);

    // -------------------------------------------------------------------
    // Load Balancer (único punto de entrada público, solo al frontend)
    // -------------------------------------------------------------------
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      loadBalancerName: resourceName('alb'),
      vpc,
      internetFacing: true,
      securityGroup: albSg,
    });

    const healthCheck: elbv2.HealthCheck = {
      path: '/login',
      interval: cdk.Duration.seconds(30),
      healthyHttpCodes: '200',
    };

    const httpListener = alb.addListener('HttpListener', { port: 80, open: true });

    if (domainName) {
      const zone = route53.HostedZone.fromLookup(this, 'HostedZone', { domainName });

      const certificate = new acm.Certificate(this, 'Certificate', {
        domainName,
        validation: acm.CertificateValidation.fromDns(zone),
      });

      const httpsListener = alb.addListener('HttpsListener', {
        port: 443,
        certificates: [certificate],
        open: true,
      });
      httpsListener.addTargets('FrontendTargetHttps', {
        port: 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [frontendService],
        healthCheck,
      });

      httpListener.addAction('RedirectToHttps', {
        action: elbv2.ListenerAction.redirect({ protocol: 'HTTPS', port: '443', permanent: true }),
      });

      new route53.ARecord(this, 'AliasRecord', {
        zone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new route53targets.LoadBalancerTarget(alb)),
      });
    } else {
      httpListener.addTargets('FrontendTarget', {
        port: 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targets: [frontendService],
        healthCheck,
      });
    }

    // -------------------------------------------------------------------
    // Salidas
    // -------------------------------------------------------------------
    new cdk.CfnOutput(this, 'AppUrl', {
      value: domainName ? `https://${domainName}` : `http://${alb.loadBalancerDnsName}`,
      description: 'URL pública de la aplicación (frontend)',
    });
    new cdk.CfnOutput(this, 'BackendRepoUri', { value: backendRepo.repositoryUri });
    new cdk.CfnOutput(this, 'FrontendRepoUri', { value: frontendRepo.repositoryUri });
    new cdk.CfnOutput(this, 'DatabaseEndpoint', { value: database.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'DbCredentialsSecretArn', { value: dbCredentials.secretArn });
    new cdk.CfnOutput(this, 'EvidencesBucketName', { value: evidencesBucket.bucketName });
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'BackendServiceName', { value: backendService.serviceName });
    new cdk.CfnOutput(this, 'FrontendServiceName', { value: frontendService.serviceName });
  }
}
