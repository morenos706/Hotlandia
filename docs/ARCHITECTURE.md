# CONTRACTUS 360 — Arquitectura (Fase 1)

## Alcance de esta versión

A partir de la definición del alcance con el usuario, esta plataforma está
diseñada **exclusivamente para el contratista que ejecuta el contrato**. No
incluye flujo de aprobación/rechazo por parte de un supervisor: lo que el
contratista registra (actividades, ejecución, evidencias) queda como el
registro oficial del sistema, con trazabilidad de auditoría inmutable.

Esto simplifica el modelo de roles frente a la propuesta original (no hay
SUPERVISOR, INTERVENTOR, FINANCIERO, AUDITOR como actores activos del
sistema en esta fase), pero conserva:

- Modelo de datos preparado para escalar a esos roles más adelante (el
  campo `status` de actividades/evidencias ya contempla estados de revisión,
  y el `AuditLog` es de solo-inserción), sin necesidad de reconstruir el
  esquema.
- Cálculo automático de ejecución física, financiera y temporal.
- Evidencias, fotografías y documentos por contrato.
- Alertas automáticas configurables.
- Indicadores y dashboard.
- Generación de informes PDF y exportación a Excel.

No se implementa: RBAC multi-rol, multi-tenant entre entidades, motor de
IA/Bedrock/Textract, firma electrónica, PWA offline, ni el pipeline de
CI/CD hacia AWS. Se documentan como Fase 2 en `docs/ROADMAP.md`.

## Stack tecnológico

| Capa | Tecnología | Motivo |
|---|---|---|
| Backend | NestJS + TypeScript | Modular, DI, guards/interceptors nativos para auditoría |
| ORM / DB | Prisma + PostgreSQL | Tipado fuerte, migraciones, `Decimal` nativo para dinero |
| Auth | JWT (passport-jwt) + bcrypt | Simple, extensible a RBAC completo después |
| Archivos | Adaptador de almacenamiento (`StorageService`) con driver local (dev) y driver S3 (prod) | Evita acoplar el código a S3 en esta fase sin infra AWS real |
| PDF | `pdfkit` | Generación de informes en servidor, sin dependencias nativas pesadas |
| Excel | `exceljs` | Exportación estructurada con formato |
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | SSR/CSR híbrido, responsive, listo para PWA en Fase 2 |
| Contenedores | Docker + docker-compose (dev) | Backend, frontend y Postgres orquestados localmente |

## Estructura del monorepo

```
Hotlandia/
├── backend/                 # API NestJS
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── auth/
│       ├── users/
│       ├── contracts/
│       ├── contract-modifications/
│       ├── obligations/
│       ├── activities/
│       ├── execution/
│       ├── evidences/
│       ├── documents/
│       ├── indicators/
│       ├── alerts/
│       ├── reports/
│       ├── dashboard/
│       ├── audit/
│       ├── storage/
│       ├── common/
│       └── prisma/
├── frontend/                # Next.js app del contratista
│   └── src/
│       ├── app/
│       ├── components/
│       └── lib/
├── docs/
└── docker-compose.yml
```

## Motor de cálculo contractual

Implementado en `backend/src/execution/execution-calculator.service.ts`.
Reglas:

- Todo valor monetario y porcentual usa `Prisma.Decimal` (nunca `number`
  de punto flotante) para evitar errores de redondeo en sumas de dinero.
- **Ejecución física** = Σ(cantidad ejecutada) / Σ(cantidad programada) ×
  100, ponderada por el peso porcentual (`weightPercentage`) de cada
  actividad dentro de su obligación.
- **Ejecución financiera** = valor ejecutado acumulado / valor actual del
  contrato (valor inicial + adiciones − reducciones) × 100.
- **Ejecución temporal** = días transcurridos (excluyendo días en estado
  `SUSPENDED`) / plazo total en días × 100.
- **Desviación** = ejecución física − ejecución temporal. Se compara contra
  umbrales configurables por contrato (`toleranceYellow`, `toleranceRed`)
  para determinar el semáforo (`GREEN` / `YELLOW` / `RED`).

## Auditoría

`AuditInterceptor` + `AuditService` registran cada mutación relevante
(crear/actualizar actividad, ejecución, evidencia, modificación
contractual) en la tabla `audit_logs`, guardando `previousValue` /
`newValue` en JSON. No existe endpoint ni permiso para borrar registros de
auditoría (no hay `DELETE` expuesto sobre ese recurso).

## Almacenamiento de archivos

`StorageService` define una interfaz única (`upload`, `getSignedUrl`,
`delete`) con dos implementaciones:

- `LocalStorageDriver`: guarda en disco bajo `uploads/`, usado en
  desarrollo y en esta entrega (no requiere credenciales AWS).
- `S3StorageDriver`: implementación lista para producción usando
  `@aws-sdk/client-s3` — solo requiere configurar `AWS_S3_BUCKET` y
  credenciales; el resto del código no cambia.

La base de datos solo almacena metadata (`key`, `mimeType`, `size`,
`checksum`), nunca el archivo binario.

## Seguridad aplicada en esta fase

- Contraseñas con `bcrypt` (12 rounds).
- JWT con expiración corta + refresh token.
- Validación de entrada con `class-validator` en todos los DTO.
- `helmet` + rate limiting (`@nestjs/throttler`) en el API.
- Restricción de tipo y tamaño de archivo en carga de evidencias.
- Todo query de contratos se filtra por `contractorId` del usuario
  autenticado (un contratista nunca puede leer contratos ajenos), aplicado
  vía `ContractOwnershipGuard`.

**Deuda técnica conocida:** `npm audit` en `frontend/` reporta CVEs de
Next.js (varias son DoS/SSRF/cache-poisoning en Server Actions y
Middleware) cuyo fix definitivo solo existe en Next 16, una migración de
versión mayor que no se hizo en esta entrega por el riesgo de romper el
App Router recién construido sin tiempo de regresión completo. Antes de
exponer este sistema a tráfico no confiable en producción, se debe evaluar
y ejecutar esa migración (o mitigar en el WAF/CloudFront de la Fase 4).

## Aviso normativo

Este sistema es una herramienta de **gestión y seguimiento interno**. No
reemplaza SECOP II ni las publicaciones y obligaciones legales de
contratación pública (Ley 80/1993, Ley 1150/2007, Decreto 1082/2015,
lineamientos de Colombia Compra Eficiente). Los campos `secopId` /
`secopUrl` en el contrato son referencias informativas, no una integración
oficial con SECOP II. Cuando una funcionalidad futura (firma electrónica,
interventoría, RBAC multi-actor) tenga implicaciones jurídicas, debe
validarse con la oficina jurídica de la entidad antes de habilitarla como
mecanismo con efectos legales.
