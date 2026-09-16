# Roadmap — Fases futuras

Esta entrega (Fase 1) cubre el flujo completo del contratista. Lo
siguiente queda **documentado pero no implementado**, para no generar
código a medias que aparente estar terminado:

## Fase 2 — Multi-actor
- Roles SUPERVISOR / INTERVENTOR / FINANCIERO / AUDITOR con RBAC real
  (`permissions` table ya prevista en el modelo conceptual).
- Flujo de aprobación/rechazo/corrección sobre actividades y evidencias
  (los estados `SUBMITTED`, `APPROVED`, `REJECTED`, `NEEDS_CORRECTION` ya
  existen en el enum `ActivityStatus` para no requerir migración
  disruptiva).

## Fase 3 — Multi-tenant
- Tabla `entities` (entidad pública/privada) y `entityId` en `users` /
  `contracts` para aislar datos entre entidades (SaaS).

## Fase 4 — Infraestructura AWS real

**Piloto implementado** en `infra/` (AWS CDK en TypeScript): VPC sin NAT
Gateway, RDS PostgreSQL, S3, dos repositorios ECR, cluster ECS Fargate
(backend privado vía Service Connect + frontend público vía ALB),
Secrets Manager para credenciales, dominio/HTTPS opcional vía Route 53 +
ACM. Ver `infra/README.md` para el paso a paso de despliegue. Un workflow
de CI (`\.github/workflows/ci.yml`) valida build/tests/`cdk synth` en
cada push, y un workflow de despliegue manual
(`.github/workflows/deploy-aws.yml`, deshabilitado por defecto —
requiere secrets propios) automatiza build+push+deploy cuando se decida
usarlo.

Pendiente para una escala de producción real (no incluido en el piloto
por costo/complejidad, ver comentarios `// cambiar ... antes de
producción real` en `infra/lib/contractus-stack.ts`):
- RDS Multi-AZ, `deletionProtection: true`, `removalPolicy: RETAIN`.
- CloudFront + WAF delante del ALB.
- Auto-scaling de los servicios ECS (hoy `desiredCount: 1` fijo).
- Amazon SES para correo (no incluido en el piloto; el sistema no envía
  correos todavía).
- AWS Backup como capa adicional sobre los backups nativos de RDS/S3.
- Ambientes separados (dev/staging/prod) como stacks distintos de CDK
  (`environmentName` ya es un parámetro del stack, listo para eso).

## Fase 5 — IA y OCR
- Integración Amazon Bedrock para asistencia en generación de informes y
  detección de inconsistencias.
- Amazon Textract para extracción de obligaciones desde el PDF del
  contrato al crearlo.
- La IA se documenta expresamente como herramienta de apoyo, nunca como
  autoridad jurídica o de aprobación automática.

## Fase 6 — PWA / offline
- Manifest + service worker para registro de evidencias sin conexión en
  campo, con sincronización posterior.

## Fase 7 — Firma electrónica
- Integración con proveedor certificado de firma electrónica/digital
  (no se implementa un mecanismo propio que se presente como firma digital
  certificada, por implicaciones jurídicas).
