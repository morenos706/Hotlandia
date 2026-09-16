import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertSeverity, AlertType, ActivityStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionCalculatorService } from '../execution/execution-calculator.service';

const CONTRACT_EXPIRY_WARNING_DAYS = Number(process.env.CONTRACT_EXPIRY_WARNING_DAYS ?? 30);
const FINANCIAL_BALANCE_WARNING_THRESHOLD = 90; // % ejecutado a partir del cual se advierte saldo por agotarse

interface AlertCandidate {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: ExecutionCalculatorService,
  ) {}

  async list(contractId: string, contractorId: string) {
    await this.assertOwnership(contractId, contractorId);
    return this.prisma.alert.findMany({
      where: { contractId },
      orderBy: [{ isResolved: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async resolve(id: string, contractorId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: { id, contract: { contractorId, deletedAt: null } },
    });
    if (!alert) {
      throw new NotFoundException('Alerta no encontrada');
    }
    return this.prisma.alert.update({
      where: { id },
      data: { isResolved: true, resolvedAt: new Date() },
    });
  }

  /**
   * Evalúa las reglas de alerta para un contrato y crea las que aún no
   * existan como no resueltas (evita duplicar la misma alerta activa).
   * Se invoca al consultar el dashboard del contrato.
   */
  async evaluateContract(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        obligations: {
          where: { deletedAt: null },
          include: { activities: { where: { deletedAt: null }, include: { evidences: true } } },
        },
      },
    });
    if (!contract) return;

    const candidates: AlertCandidate[] = [];
    const today = new Date();

    const daysRemaining = Math.ceil(
      (contract.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (
      daysRemaining >= 0 &&
      daysRemaining <= CONTRACT_EXPIRY_WARNING_DAYS &&
      contract.status === 'EN_EJECUCION'
    ) {
      candidates.push({
        type: 'CONTRATO_PROXIMO_A_VENCER',
        severity: daysRemaining <= 7 ? 'CRITICAL' : 'WARNING',
        message: `El contrato ${contract.contractNumber} vence en ${daysRemaining} día(s) (${contract.endDate.toISOString().slice(0, 10)})`,
      });
    }

    const financialPct = this.calculator.financialExecution(
      await this.getExecutedValue(contractId),
      contract.currentValue,
    );
    if (financialPct.gte(FINANCIAL_BALANCE_WARNING_THRESHOLD)) {
      candidates.push({
        type: 'SALDO_PROXIMO_A_AGOTARSE',
        severity: financialPct.gte(98) ? 'CRITICAL' : 'WARNING',
        message: `La ejecución financiera alcanzó ${financialPct}% del valor actual del contrato`,
      });
    }

    for (const obligation of contract.obligations) {
      for (const activity of obligation.activities) {
        const overdue =
          activity.endDate < today &&
          activity.status !== ActivityStatus.EJECUTADA &&
          activity.status !== ActivityStatus.APPROVED;
        if (overdue) {
          candidates.push({
            type: 'ACTIVIDAD_ATRASADA',
            severity: 'WARNING',
            message: `La actividad ${activity.code} - ${activity.name} está atrasada (venció ${activity.endDate.toISOString().slice(0, 10)})`,
          });
        }

        if (
          activity.requiresEvidence &&
          activity.status === ActivityStatus.EJECUTADA &&
          activity.evidences.length === 0
        ) {
          candidates.push({
            type: 'EVIDENCIA_FALTANTE',
            severity: 'WARNING',
            message: `La actividad ${activity.code} - ${activity.name} está marcada como ejecutada pero no tiene evidencias cargadas`,
          });
        }
      }
    }

    await this.persistNewAlerts(contractId, candidates);
  }

  private async getExecutedValue(contractId: string) {
    const result = await this.prisma.executionRecord.aggregate({
      where: { activity: { obligation: { contractId } } },
      _sum: { executedValue: true },
    });
    return result._sum.executedValue ?? 0;
  }

  private async persistNewAlerts(contractId: string, candidates: AlertCandidate[]) {
    const existingUnresolved = await this.prisma.alert.findMany({
      where: { contractId, isResolved: false },
      select: { type: true, message: true },
    });
    const existingKeys = new Set(existingUnresolved.map((a) => `${a.type}:${a.message}`));

    const toCreate = candidates.filter((c) => !existingKeys.has(`${c.type}:${c.message}`));
    if (toCreate.length === 0) return;

    await this.prisma.alert.createMany({
      data: toCreate.map((c) => ({ contractId, ...c })),
    });
  }

  private async assertOwnership(contractId: string, contractorId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, contractorId, deletedAt: null },
    });
    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }
    return contract;
  }
}
