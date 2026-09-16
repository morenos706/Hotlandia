import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExecutionRecordsService } from './execution-records.service';
import { ExecutionCalculatorService } from './execution-calculator.service';

function buildActivity(overrides: Partial<any> = {}) {
  return {
    id: 'activity-1',
    plannedQuantity: new Prisma.Decimal(12),
    assignedValue: new Prisma.Decimal(400_000_000),
    obligation: { contractId: 'contract-1' },
    deletedAt: null,
    ...overrides,
  };
}

describe('ExecutionRecordsService', () => {
  let prisma: any;
  let audit: any;
  let service: ExecutionRecordsService;

  beforeEach(() => {
    prisma = {
      activity: { findFirst: jest.fn(), update: jest.fn() },
      executionPeriod: { findFirst: jest.fn() },
      executionRecord: { aggregate: jest.fn(), create: jest.fn() },
      $transaction: jest.fn((operations: Promise<any>[]) => Promise.all(operations)),
    };
    audit = { record: jest.fn() };
    service = new ExecutionRecordsService(prisma, audit, new ExecutionCalculatorService());
  });

  it('rechaza registrar ejecución fuera del rango del periodo', async () => {
    prisma.activity.findFirst.mockResolvedValue(buildActivity());
    prisma.executionPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      label: 'Agosto 2026',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
    });

    await expect(
      service.create('activity-1', 'contractor-1', {
        periodId: 'period-1',
        executedQuantity: 1,
        executedValue: 1_000_000,
        executionDate: '2026-09-15',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza cuando la cantidad acumulada superaría la meta programada', async () => {
    prisma.activity.findFirst.mockResolvedValue(buildActivity());
    prisma.executionPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      label: 'Agosto 2026',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
    });
    prisma.executionRecord.aggregate.mockResolvedValue({
      _sum: { executedQuantity: new Prisma.Decimal(11), executedValue: new Prisma.Decimal(0) },
    });

    await expect(
      service.create('activity-1', 'contractor-1', {
        periodId: 'period-1',
        executedQuantity: 5, // 11 + 5 = 16 > meta de 12
        executedValue: 1_000_000,
        executionDate: '2026-08-15',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marca la actividad como EJECUTADA cuando se alcanza el 100% acumulado', async () => {
    const activity = buildActivity();
    prisma.activity.findFirst.mockResolvedValue(activity);
    prisma.executionPeriod.findFirst.mockResolvedValue({
      id: 'period-1',
      label: 'Diciembre 2026',
      startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-31'),
    });
    prisma.executionRecord.aggregate.mockResolvedValue({
      _sum: { executedQuantity: new Prisma.Decimal(11), executedValue: new Prisma.Decimal(366_666_667) },
    });
    prisma.executionRecord.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'rec-1', ...data }));
    prisma.activity.update.mockImplementation(({ data }: any) => Promise.resolve({ ...activity, ...data }));

    await service.create('activity-1', 'contractor-1', {
      periodId: 'period-1',
      executedQuantity: 1,
      executedValue: 33_333_333,
      executionDate: '2026-12-15',
    });

    const updateCall = prisma.activity.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('EJECUTADA');
  });

  it('lanza NotFoundException si la actividad no pertenece al contratista', async () => {
    prisma.activity.findFirst.mockResolvedValue(null);

    await expect(
      service.create('activity-x', 'contractor-1', {
        periodId: 'period-1',
        executedQuantity: 1,
        executedValue: 1,
        executionDate: '2026-08-15',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
