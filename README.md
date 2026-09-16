# CONTRACTUS 360

Sistema de gestión y seguimiento contractual **para el contratista que
ejecuta el contrato**. Permite registrar obligaciones, actividades,
ejecución física y financiera, evidencias, documentos y generar informes
PDF/Excel, con trazabilidad de auditoría.

> Ver `docs/ARCHITECTURE.md` para el detalle de arquitectura y alcance, y
> `docs/ROADMAP.md` para lo que queda documentado como fases futuras
> (multi-actor con supervisor, multi-tenant, IA, PWA, infraestructura AWS
> real, CI/CD).

## Estructura

```
backend/    API NestJS + Prisma + PostgreSQL
frontend/   Next.js (App Router) + Tailwind CSS
docs/       Arquitectura, modelo de datos, roadmap
```

## Arranque rápido con Docker

```bash
docker compose up --build
```

- Backend: http://localhost:3001/api (Swagger en `/api/docs`)
- Frontend: http://localhost:3000

Al primer arranque, ejecuta las migraciones y el seed de datos de
demostración dentro del contenedor del backend:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed
```

Usuario de demostración: `contratista.demo@contractus360.local` / `Demo1234!`

## Arranque en local sin Docker

### Backend

```bash
cd backend
cp .env.example .env   # ajusta DATABASE_URL si no usas Docker para Postgres
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Pruebas

```bash
cd backend
npm test
```

Cubre especialmente el motor de cálculo contractual (porcentajes,
ejecución ponderada, ejecución temporal, semáforo) y las reglas de negocio
de modificaciones contractuales y registro de ejecución (ver
`docs/ARCHITECTURE.md`).

## Aviso

Este sistema es una herramienta de gestión y seguimiento interno. No
reemplaza SECOP II ni las obligaciones legales de publicación de la
contratación pública en Colombia.
