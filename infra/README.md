# Infraestructura AWS — CONTRACTUS 360 (piloto)

Este directorio define, con **AWS CDK (TypeScript)**, la infraestructura
piloto/bajo-costo descrita en `docs/ARCHITECTURE.md` y `docs/ROADMAP.md`
(Fase 4). Aprovisiona:

- VPC (2 AZs, subredes públicas + aisladas, **sin NAT Gateway** para
  minimizar costo).
- RDS PostgreSQL 16 (`db.t4g.micro`, una sola AZ, cifrado, backups
  automáticos de 7 días).
- Bucket S3 privado para evidencias/documentos (cifrado, versionado,
  bloqueo total de acceso público).
- Dos repositorios ECR (backend y frontend).
- Cluster ECS Fargate con dos servicios:
  - **backend**: privado, solo accesible internamente vía ECS Service
    Connect (DNS interno `backend:3001`).
  - **frontend**: público, detrás de un Application Load Balancer.
- Secretos en Secrets Manager (credenciales de RDS, `JWT_SECRET`,
  `JWT_REFRESH_SECRET`), inyectados a los contenedores sin quedar nunca en
  texto plano en el código ni en las variables de CloudFormation.
- Dominio propio y HTTPS opcionales (si se provee `domainName` y ya existe
  una Hosted Zone en Route 53 en la misma cuenta).

**No incluido en el piloto** (documentado como Fase 4 avanzada / mejora
futura): Multi-AZ, WAF, CloudFront, auto-scaling, `containerInsights`
activo. Antes de usar esto para una entidad real en producción, revisar
explícitamente los comentarios `// cambiar ... antes de producción real`
en `lib/contractus-stack.ts`.

## Costo estimado (referencial, us-east-1, uso mínimo 24/7)

| Recurso | Aproximado / mes |
|---|---|
| RDS db.t4g.micro (20 GB gp3) | ~US$13 |
| ECS Fargate (2 tareas × 0.25 vCPU/0.5 GB) | ~US$18 |
| Application Load Balancer | ~US$16 |
| IP pública por tarea Fargate (2) | ~US$7 |
| S3, Secrets Manager, ECR, CloudWatch Logs | ~US$3–5 |
| **Total aproximado** | **~US$55–60/mes** |

Cifras de referencia, no una cotización — verifica con la
[calculadora de AWS](https://calculator.aws) para tu región y tráfico real.

## Requisitos previos

1. Cuenta de AWS con permisos de administrador (o un rol con permisos
   sobre VPC, RDS, S3, ECR, ECS, ELB, Secrets Manager, IAM, Route 53/ACM
   si usas dominio propio).
2. [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
   configurado (`aws configure`) con esas credenciales.
3. Node.js 20+ y Docker instalados localmente.
4. Este repo clonado.

## 1. Bootstrap de CDK (una sola vez por cuenta/región)

```bash
cd infra
npm install
npx cdk bootstrap aws://<ACCOUNT_ID>/<REGION>
```

## 2. Desplegar la infraestructura

Sin dominio propio (queda expuesto por la URL del Load Balancer, HTTP):

```bash
npx cdk deploy -c environmentName=pilot
```

Con dominio propio (requiere Hosted Zone ya creada en Route 53 en la
misma cuenta):

```bash
npx cdk deploy -c environmentName=pilot -c domainName=contractus360.tuentidad.gov.co
```

Al finalizar, `cdk deploy` imprime los **Outputs**: URL de la app, URIs de
ECR, endpoint de RDS, nombre del bucket S3, nombre del cluster y de los
servicios. Guárdalos — se usan en los pasos siguientes.

## 3. Construir y publicar las imágenes en ECR

```bash
ACCOUNT_ID=<tu-account-id>
REGION=<tu-region>
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Backend
docker build -t $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/contractus360-pilot-backend:latest ../backend
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/contractus360-pilot-backend:latest

# Frontend
docker build -t $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/contractus360-pilot-frontend:latest ../frontend
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/contractus360-pilot-frontend:latest
```

## 4. Forzar el primer despliegue de los servicios

Los servicios ECS se crean junto con la infraestructura, pero la primera
vez arrancan con la imagen `latest` que exista en ese momento en ECR (si
`cdk deploy` corrió antes de publicar imágenes, los servicios quedarán
sin tareas sanas hasta este paso):

```bash
aws ecs update-service --cluster contractus360-pilot-cluster --service contractus360-pilot-backend --force-new-deployment --region $REGION
aws ecs update-service --cluster contractus360-pilot-cluster --service contractus360-pilot-frontend --force-new-deployment --region $REGION
```

## 5. Ejecutar migraciones y seed contra la base de datos real

La base de datos RDS está en una subred aislada (sin acceso público). Las
formas más simples de correr las migraciones son:

**Opción A — desde una tarea ECS temporal (recomendado, no requiere abrir la red):**

```bash
aws ecs run-task \
  --cluster contractus360-pilot-cluster \
  --task-definition contractus360-pilot-backend \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-publica>],securityGroups=[<backend-sg>],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["sh","-c","export DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?schema=public\" && npx prisma migrate deploy && npm run prisma:seed"]}]}' \
  --region $REGION
```

**Opción B — vía túnel SSH/SSM** desde tu máquina si necesitas ejecutar
comandos Prisma interactivos (requiere una instancia bastión o
`aws ssm start-session` con port forwarding hacia el endpoint de RDS).

## 6. Ajustar CORS del backend tras conocer la URL pública

`CORS_ORIGIN` se configura en el stack a partir de `domainName` (si se
usó) o `*` (si no). Si desplegaste sin dominio y luego decides restringir
el origen a la URL real del Load Balancer, actualiza la variable de
entorno en `lib/contractus-stack.ts` y vuelve a correr `cdk deploy`.

## Actualizar una nueva versión

```bash
docker build -t $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/contractus360-pilot-backend:latest ../backend
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/contractus360-pilot-backend:latest
aws ecs update-service --cluster contractus360-pilot-cluster --service contractus360-pilot-backend --force-new-deployment --region $REGION
```

(Repetir para `frontend`.) El `circuitBreaker` con `rollback: true`
configurado en el servicio revierte automáticamente si la nueva tarea no
pasa el healthcheck.

## Destruir el piloto

```bash
npx cdk destroy -c environmentName=pilot
```

**Advertencia:** con la configuración actual (`removalPolicy: DESTROY`,
`autoDeleteObjects: true`, `deletionProtection: false`), esto borra
también la base de datos RDS y el contenido del bucket S3 sin posibilidad
de recuperación. Antes de usar esto en producción real, cambia esos
valores en `lib/contractus-stack.ts` (buscar los comentarios
`// cambiar ... antes de producción real`).

## Ver los cambios antes de aplicar

```bash
npx cdk diff -c environmentName=pilot
```

## Estructura

```
infra/
├── bin/infra.ts           # entry point: instancia el stack
├── lib/contractus-stack.ts # VPC, RDS, S3, ECR, ECS, ALB, Route53/ACM opcional
├── cdk.json
├── package.json
└── README.md               # este archivo
```
