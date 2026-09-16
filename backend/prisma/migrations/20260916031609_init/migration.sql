-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CONTRATISTA', 'ADMIN');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('EN_PREPARACION', 'EN_EJECUCION', 'SUSPENDIDO', 'REINICIADO', 'PROXIMO_A_VENCER', 'TERMINADO', 'LIQUIDADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PRESTACION_SERVICIOS', 'OBRA', 'SUMINISTRO', 'CONSULTORIA', 'INTERVENTORIA', 'COMPRAVENTA', 'ARRENDAMIENTO', 'CONVENIO', 'OTRO');

-- CreateEnum
CREATE TYPE "ModificationType" AS ENUM ('ADICION', 'REDUCCION', 'PRORROGA', 'SUSPENSION', 'REINICIO', 'OTROSI', 'CESION');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'EJECUTADA', 'SUBMITTED', 'APPROVED', 'REJECTED', 'NEEDS_CORRECTION');

-- CreateEnum
CREATE TYPE "Periodicity" AS ENUM ('SEMANAL', 'QUINCENAL', 'MENSUAL', 'TRIMESTRAL', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('FOTOGRAFIA', 'PDF', 'WORD', 'EXCEL', 'ACTA', 'CERTIFICADO', 'VIDEO', 'OTRO');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('CARGADA', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDIENTE', 'RADICADO', 'EN_REVISION', 'APROBADO', 'PAGADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "IndicatorCategory" AS ENUM ('GESTION', 'FINANCIERO', 'TEMPORAL', 'RESULTADOS', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('CONTRATO_PROXIMO_A_VENCER', 'ACTIVIDAD_ATRASADA', 'EVIDENCIA_FALTANTE', 'INFORME_PENDIENTE', 'EJECUCION_INFERIOR_A_PROGRAMACION', 'SALDO_PROXIMO_A_AGOTARSE', 'MODIFICACION_CONTRACTUAL', 'PERIODO_PENDIENTE', 'DOCUMENTO_FALTANTE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "identification" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CONTRATISTA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "modality" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "legalRepresentative" TEXT,
    "dependency" TEXT,
    "project" TEXT,
    "fundingSource" TEXT,
    "budgetLine" TEXT,
    "cdp" TEXT,
    "rp" TEXT,
    "secopId" TEXT,
    "secopUrl" TEXT,
    "initialValue" DECIMAL(18,2) NOT NULL,
    "currentValue" DECIMAL(18,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "originalEndDate" TIMESTAMP(3) NOT NULL,
    "termDays" INTEGER NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'EN_PREPARACION',
    "observations" TEXT,
    "toleranceYellow" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "toleranceRed" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_modifications" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "ModificationType" NOT NULL,
    "description" TEXT NOT NULL,
    "valueDelta" DECIMAL(18,2),
    "daysDelta" INTEGER,
    "previousValue" DECIMAL(18,2) NOT NULL,
    "newValue" DECIMAL(18,2) NOT NULL,
    "previousEndDate" TIMESTAMP(3) NOT NULL,
    "newEndDate" TIMESTAMP(3) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_modifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "obligations" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT,
    "weightPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "goal" TEXT,
    "indicator" TEXT,
    "unitOfMeasure" TEXT,
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "goal" TEXT,
    "unitOfMeasure" TEXT NOT NULL,
    "plannedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "assignedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "weightPercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "periodicity" "Periodicity" NOT NULL DEFAULT 'MENSUAL',
    "responsibleId" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDIENTE',
    "expectedResult" TEXT,
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_periods" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_records" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "executedQuantity" DECIMAL(18,4) NOT NULL,
    "executedValue" DECIMAL(18,2) NOT NULL,
    "physicalPercentage" DECIMAL(5,2) NOT NULL,
    "result" TEXT,
    "observations" TEXT,
    "executionDate" TIMESTAMP(3) NOT NULL,
    "registeredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidences" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "activityId" TEXT,
    "executionRecordId" TEXT,
    "type" "EvidenceType" NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'CARGADA',
    "description" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observations" TEXT,

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "accountNumber" TEXT,
    "value" DECIMAL(18,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "submittedDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicators" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "IndicatorCategory" NOT NULL,
    "unit" TEXT,
    "formulaHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicator_results" (
    "id" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicator_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contractNumber_key" ON "contracts"("contractNumber");

-- CreateIndex
CREATE INDEX "contracts_contractorId_idx" ON "contracts"("contractorId");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contract_modifications_contractId_idx" ON "contract_modifications"("contractId");

-- CreateIndex
CREATE INDEX "obligations_contractId_idx" ON "obligations"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "obligations_contractId_code_key" ON "obligations"("contractId", "code");

-- CreateIndex
CREATE INDEX "activities_obligationId_idx" ON "activities"("obligationId");

-- CreateIndex
CREATE INDEX "activities_status_idx" ON "activities"("status");

-- CreateIndex
CREATE UNIQUE INDEX "activities_obligationId_code_key" ON "activities"("obligationId", "code");

-- CreateIndex
CREATE INDEX "execution_periods_contractId_idx" ON "execution_periods"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "execution_periods_contractId_startDate_endDate_key" ON "execution_periods"("contractId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "execution_records_activityId_idx" ON "execution_records"("activityId");

-- CreateIndex
CREATE INDEX "execution_records_periodId_idx" ON "execution_records"("periodId");

-- CreateIndex
CREATE INDEX "evidences_contractId_idx" ON "evidences"("contractId");

-- CreateIndex
CREATE INDEX "evidences_activityId_idx" ON "evidences"("activityId");

-- CreateIndex
CREATE INDEX "documents_contractId_idx" ON "documents"("contractId");

-- CreateIndex
CREATE INDEX "documents_folder_idx" ON "documents"("folder");

-- CreateIndex
CREATE INDEX "payments_contractId_idx" ON "payments"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "indicators_code_key" ON "indicators"("code");

-- CreateIndex
CREATE INDEX "indicator_results_contractId_idx" ON "indicator_results"("contractId");

-- CreateIndex
CREATE INDEX "indicator_results_indicatorId_idx" ON "indicator_results"("indicatorId");

-- CreateIndex
CREATE INDEX "alerts_contractId_idx" ON "alerts"("contractId");

-- CreateIndex
CREATE INDEX "alerts_isResolved_idx" ON "alerts"("isResolved");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_module_idx" ON "audit_logs"("module");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "audit_logs"("entityId");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_modifications" ADD CONSTRAINT "contract_modifications_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "obligations" ADD CONSTRAINT "obligations_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "obligations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_periods" ADD CONSTRAINT "execution_periods_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_records" ADD CONSTRAINT "execution_records_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_records" ADD CONSTRAINT "execution_records_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "execution_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_records" ADD CONSTRAINT "execution_records_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_executionRecordId_fkey" FOREIGN KEY ("executionRecordId") REFERENCES "execution_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_results" ADD CONSTRAINT "indicator_results_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "indicators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicator_results" ADD CONSTRAINT "indicator_results_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
