import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionCalculatorService } from '../execution/execution-calculator.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: ExecutionCalculatorService,
  ) {}

  async getContractDashboard(contractId: string, contractorId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, contractorId, deletedAt: null },
      include: {
        obligations: {
          where: { deletedAt: null },
          include: { activities: { where: { deletedAt: null } } },
        },
      },
    });
    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }

    const activities = contract.obligations.flatMap((o) => o.activities);

    const executedQuantityByActivity = await this.prisma.executionRecord.groupBy({
      by: ['activityId'],
      where: { activityId: { in: activities.map((a) => a.id) } },
      _sum: { executedQuantity: true },
    });
    const executedQuantityMap = new Map(
      executedQuantityByActivity.map((row) => [row.activityId, row._sum.executedQuantity ?? new Prisma.Decimal(0)]),
    );

    // Ejecución física: promedio ponderado de actividades dentro de su
    // obligación, y de obligaciones dentro del contrato.
    const obligationExecutions = contract.obligations.map((obligation) => {
      const activityItems = obligation.activities.map((activity) => ({
        weightPercentage: activity.weightPercentage,
        percentageExecuted: this.calculator.percentage(
          executedQuantityMap.get(activity.id) ?? new Prisma.Decimal(0),
          activity.plannedQuantity,
        ),
      }));
      return {
        weightPercentage: obligation.weightPercentage,
        percentageExecuted: this.calculator.weightedAverage(activityItems),
      };
    });

    const executedValue = await this.getExecutedValue(contractId);
    const physicalExecution = this.calculator.weightedAverage(obligationExecutions);
    const financialExecution = this.calculator.financialExecution(executedValue, contract.currentValue);
    const temporal = this.calculator.temporalExecution(
      contract.startDate,
      contract.endDate,
      new Date(),
      0,
    );
    const deviation = this.calculator.deviation(physicalExecution, temporal.percentage);
    const semaphore = this.calculator.semaphore(deviation, contract.toleranceYellow, contract.toleranceRed);

    const [evidenceCount, unresolvedAlerts, paymentsPending] = await Promise.all([
      this.prisma.evidence.count({ where: { contractId } }),
      this.prisma.alert.count({ where: { contractId, isResolved: false } }),
      this.prisma.payment.count({ where: { contractId, status: { in: ['PENDIENTE', 'RADICADO', 'EN_REVISION'] } } }),
    ]);

    const activityCounts = {
      total: activities.length,
      pendientes: activities.filter((a) => a.status === ActivityStatus.PENDIENTE).length,
      enProceso: activities.filter((a) => a.status === ActivityStatus.EN_PROCESO).length,
      ejecutadas: activities.filter((a) => a.status === ActivityStatus.EJECUTADA).length,
    };

    const sCurve = await this.buildSCurve(contract.id, contract.startDate, contract.endDate, contract.currentValue);

    return {
      contract: {
        id: contract.id,
        contractNumber: contract.contractNumber,
        purpose: contract.purpose,
        status: contract.status,
        initialValue: contract.initialValue,
        currentValue: contract.currentValue,
        startDate: contract.startDate,
        endDate: contract.endDate,
        termDays: contract.termDays,
      },
      execution: {
        physicalPercentage: physicalExecution,
        financialPercentage: financialExecution,
        temporalPercentage: temporal.percentage,
        elapsedDays: temporal.elapsedDays,
        totalDays: temporal.totalDays,
        deviation,
        semaphore,
        executedValue,
        balance: new Prisma.Decimal(contract.currentValue).sub(executedValue),
      },
      obligations: {
        total: contract.obligations.length,
      },
      activities: activityCounts,
      evidenceCount,
      unresolvedAlerts,
      paymentsPending,
      sCurve,
    };
  }

  async getGlobalDashboard(contractorId: string) {
    const contracts = await this.prisma.contract.findMany({
      where: { contractorId, deletedAt: null },
    });

    const totalValue = contracts.reduce(
      (acc, c) => acc.add(c.currentValue),
      new Prisma.Decimal(0),
    );

    const executedByContract = await Promise.all(
      contracts.map(async (c) => ({
        contract: c,
        executedValue: await this.getExecutedValue(c.id),
      })),
    );

    const physicalAverages = await Promise.all(
      contracts.map((c) => this.getContractDashboard(c.id, contractorId).then((d) => d.execution.physicalPercentage)),
    );
    const avgPhysical = physicalAverages.length
      ? physicalAverages.reduce((acc, v) => acc.add(v), new Prisma.Decimal(0)).div(physicalAverages.length).toDecimalPlaces(2)
      : new Prisma.Decimal(0);

    const totalExecuted = executedByContract.reduce(
      (acc, c) => acc.add(c.executedValue),
      new Prisma.Decimal(0),
    );

    const today = new Date();
    const warningDays = Number(process.env.CONTRACT_EXPIRY_WARNING_DAYS ?? 30);
    const nearExpiry = contracts.filter((c) => {
      const daysRemaining = Math.ceil((c.endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return c.status === 'EN_EJECUCION' && daysRemaining >= 0 && daysRemaining <= warningDays;
    }).length;

    const [pendingActivities, evidenceCount, unresolvedAlerts] = await Promise.all([
      this.prisma.activity.count({
        where: {
          obligation: { contract: { contractorId, deletedAt: null } },
          status: { in: [ActivityStatus.PENDIENTE, ActivityStatus.EN_PROCESO] },
        },
      }),
      this.prisma.evidence.count({ where: { contract: { contractorId, deletedAt: null } } }),
      this.prisma.alert.count({ where: { contract: { contractorId, deletedAt: null }, isResolved: false } }),
    ]);

    return {
      totalContracts: contracts.length,
      totalValue,
      totalExecutedValue: totalExecuted,
      averagePhysicalExecution: avgPhysical,
      contractsNearExpiry: nearExpiry,
      pendingActivities,
      evidenceCount,
      unresolvedAlerts,
      contractsByStatus: countByStatus(contracts),
    };
  }

  private async getExecutedValue(contractId: string) {
    const result = await this.prisma.executionRecord.aggregate({
      where: { activity: { obligation: { contractId } } },
      _sum: { executedValue: true },
    });
    return result._sum.executedValue ?? new Prisma.Decimal(0);
  }

  private async buildSCurve(
    contractId: string,
    startDate: Date,
    endDate: Date,
    currentValue: Prisma.Decimal,
  ) {
    const periods = await this.prisma.executionPeriod.findMany({
      where: { contractId },
      orderBy: { endDate: 'asc' },
    });

    const totalDays = Math.max(daysBetween(startDate, endDate), 1);

    const points: Array<{
      periodLabel: string;
      date: Date;
      plannedPercentage: Prisma.Decimal;
      executedPercentage: Prisma.Decimal;
      executedValue: Prisma.Decimal;
    }> = [];
    for (const period of periods) {
      const executedToDate = await this.prisma.executionRecord.aggregate({
        where: { activity: { obligation: { contractId } }, executionDate: { lte: period.endDate } },
        _sum: { executedValue: true },
      });
      const elapsedDays = Math.min(daysBetween(startDate, period.endDate), totalDays);
      const plannedPercentage = new Prisma.Decimal(elapsedDays).div(totalDays).mul(100).toDecimalPlaces(2);
      const executedValue = executedToDate._sum.executedValue ?? new Prisma.Decimal(0);
      const executedPercentage = this.calculator.percentage(executedValue, currentValue);

      points.push({
        periodLabel: period.label,
        date: period.endDate,
        plannedPercentage,
        executedPercentage,
        executedValue,
      });
    }
    return points;
  }
}

function daysBetween(start: Date, end: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.max(Math.round((end.getTime() - start.getTime()) / MS_PER_DAY), 0);
}

function countByStatus(contracts: { status: string }[]) {
  return contracts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
}
