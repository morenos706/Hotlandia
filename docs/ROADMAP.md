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
- Terraform/CDK para RDS Postgres, S3, CloudFront, ECS Fargate, SES, WAF,
  Route 53, CloudWatch, backups con AWS Backup.
- CI/CD (GitHub Actions) con ambientes dev/staging/prod.

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
