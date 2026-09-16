import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExecutionCalculatorService } from './execution-calculator.service';
import { CreateExecutionRecordDto } from './dto/create-execution-record.dto';

@Injectable()
export class ExecutionRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly calculator: ExecutionCalculatorService,
  ) {}

  async list(activityId: string, contractorId: string) {
    await this.findActivityOwned(activityId, contractorId);
    return this.prisma.executionRecord.findMany({
      where: { activityId },
      orderBy: { executionDate: 'desc' },
      include: { period: true, evidences: true },
    });
  }

  async create(activityId: string, contractorId: string, dto: CreateExecutionRecordDto) {
    const activity = await this.findActivityOwned(activityId, contractorId);

    const period = await this.prisma.executionPeriod.findFirst({
      where: { id: dto.periodId, contractId: activity.obligation.contractId },
    });
    if (!period) {
      throw new NotFoundException('Periodo no encontrado para este contrato');
    }

    const executionDate = new Date(dto.executionDate);
    if (executionDate < period.startDate || executionDate > period.endDate) {
      throw new BadRequestException(
        `La fecha de ejecución debe estar dentro del periodo ${period.label} (${period.startDate.toISOString().slice(0, 10)} a ${period.endDate.toISOString().slice(0, 10)})`,
      );
    }

    const previousTotals = await this.prisma.executionRecord.aggregate({
      where: { activityId },
      _sum: { executedQuantity: true, executedValue: true },
    });
    const previousQuantity = previousTotals._sum.executedQuantity ?? new Prisma.Decimal(0);
    const previousValue = previousTotals._sum.executedValue ?? new Prisma.Decimal(0);

    const newQuantityTotal = previousQuantity.add(dto.executedQuantity);
    const newValueTotal = previousValue.add(dto.executedValue);

    if (newQuantityTotal.gt(activity.plannedQuantity)) {
      throw new BadRequestException(
        `La cantidad ejecutada acumulada (${newQuantityTotal}) superaría la meta programada (${activity.plannedQuantity}) de la actividad`,
      );
    }
    if (newValueTotal.gt(activity.assignedValue)) {
      throw new BadRequestException(
        `El valor ejecutado acumulado (${newValueTotal}) superaría el valor asignado (${activity.assignedValue}) de la actividad`,
      );
    }

    const physicalPercentage = this.calculator.percentage(dto.executedQuantity, activity.plannedQuantity);
    const cumulativePercentage = this.calculator.percentage(newQuantityTotal, activity.plannedQuantity);
    const newStatus: ActivityStatus = cumulativePercentage.gte(100)
      ? ActivityStatus.EJECUTADA
      : ActivityStatus.EN_PROCESO;

    const [record] = await this.prisma.$transaction([
      this.prisma.executionRecord.create({
        data: {
          activityId,
          periodId: dto.periodId,
          executedQuantity: dto.executedQuantity,
          executedValue: dto.executedValue,
          physicalPercentage,
          result: dto.result,
          observations: dto.observations,
          executionDate,
          registeredById: contractorId,
        },
      }),
      this.prisma.activity.update({
        where: { id: activityId },
        data: { status: newStatus },
      }),
    ]);

    await this.audit.record({
      userId: contractorId,
      action: 'REGISTER_EXECUTION',
      module: 'execution',
      entityId: activityId,
      previousValue: { executedQuantity: previousQuantity, executedValue: previousValue },
      newValue: { executedQuantity: newQuantityTotal, executedValue: newValueTotal },
    });

    return record;
  }

  private async findActivityOwned(activityId: string, contractorId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        deletedAt: null,
        obligation: { contract: { contractorId, deletedAt: null } },
      },
      include: { obligation: true },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada');
    }
    return activity;
  }
}
