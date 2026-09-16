import { BadRequestException } from '@nestjs/common';
import { Prisma, ModificationType } from '@prisma/client';
import { ContractModificationsService } from './contract-modifications.service';

function buildContract(overrides: Partial<any> = {}) {
  return {
    id: 'contract-1',
    contractorId: 'contractor-1',
    currentValue: new Prisma.Decimal('500000000'),
    endDate: new Date('2026-12-31'),
    termDays: 300,
    deletedAt: null,
    ...overrides,
  };
}

describe('ContractModificationsService', () => {
  let prisma: any;
  let audit: any;
  let service: ContractModificationsService;

  beforeEach(() => {
    prisma = {
      contract: { findFirst: jest.fn(), update: jest.fn() },
      contractModification: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((operations: Promise<any>[]) => Promise.all(operations)),
    };
    audit = { record: jest.fn() };
    service = new ContractModificationsService(prisma, audit);
  });

  it('suma correctamente una adición al valor actual del contrato', async () => {
    const contract = buildContract();
    prisma.contract.findFirst.mockResolvedValue(contract);
    prisma.contractModification.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'mod-1', ...data }));
    prisma.contract.update.mockImplementation(({ data }: any) => Promise.resolve({ ...contract, ...data }));

    await service.create('contract-1', 'contractor-1', {
      type: ModificationType.ADICION,
      description: 'Adición de recursos',
      valueDelta: 100_000_000,
      effectiveDate: '2026-06-01',
    });

    const updateCall = prisma.contract.update.mock.calls[0][0];
    expect(updateCall.data.currentValue.toString()).toBe('600000000');
  });

  it('resta correctamente una reducción y rechaza si deja el valor en negativo', async () => {
    const contract = buildContract({ currentValue: new Prisma.Decimal('50000000') });
    prisma.contract.findFirst.mockResolvedValue(contract);

    await expect(
      service.create('contract-1', 'contractor-1', {
        type: ModificationType.REDUCCION,
        description: 'Reducción excesiva',
        valueDelta: 100_000_000,
        effectiveDate: '2026-06-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('extiende la fecha de terminación y el plazo en una prórroga', async () => {
    const contract = buildContract();
    prisma.contract.findFirst.mockResolvedValue(contract);
    prisma.contractModification.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'mod-2', ...data }));
    prisma.contract.update.mockImplementation(({ data }: any) => Promise.resolve({ ...contract, ...data }));

    await service.create('contract-1', 'contractor-1', {
      type: ModificationType.PRORROGA,
      description: 'Prórroga de 30 días',
      daysDelta: 30,
      effectiveDate: '2026-12-01',
    });

    const updateCall = prisma.contract.update.mock.calls[0][0];
    expect(updateCall.data.termDays).toBe(330);
    expect(new Date(updateCall.data.endDate).getTime()).toBe(new Date('2027-01-30').getTime());
  });

  it('marca el contrato como SUSPENDIDO ante una suspensión', async () => {
    const contract = buildContract();
    prisma.contract.findFirst.mockResolvedValue(contract);
    prisma.contractModification.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'mod-3', ...data }));
    prisma.contract.update.mockImplementation(({ data }: any) => Promise.resolve({ ...contract, ...data }));

    await service.create('contract-1', 'contractor-1', {
      type: ModificationType.SUSPENSION,
      description: 'Suspensión por temporada de lluvias',
      effectiveDate: '2026-06-01',
    });

    const updateCall = prisma.contract.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('SUSPENDIDO');
  });

  it('rechaza una adición sin valor', async () => {
    prisma.contract.findFirst.mockResolvedValue(buildContract());

    await expect(
      service.create('contract-1', 'contractor-1', {
        type: ModificationType.ADICION,
        description: 'Adición inválida',
        effectiveDate: '2026-06-01',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
