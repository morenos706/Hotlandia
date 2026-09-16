import { Injectable, NotFoundException } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(contractorId: string, dto: CreateContractDto) {
    const contract = await this.prisma.contract.create({
      data: {
        contractNumber: dto.contractNumber,
        vigencia: dto.vigencia,
        contractType: dto.contractType,
        modality: dto.modality,
        purpose: dto.purpose,
        contractorId,
        legalRepresentative: dto.legalRepresentative,
        dependency: dto.dependency,
        project: dto.project,
        fundingSource: dto.fundingSource,
        budgetLine: dto.budgetLine,
        cdp: dto.cdp,
        rp: dto.rp,
        secopId: dto.secopId,
        secopUrl: dto.secopUrl,
        initialValue: dto.initialValue,
        currentValue: dto.initialValue,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        originalEndDate: new Date(dto.endDate),
        termDays: dto.termDays,
        observations: dto.observations,
      },
    });

    await this.audit.record({
      userId: contractorId,
      action: 'CREATE_CONTRACT',
      module: 'contracts',
      entityId: contract.id,
      newValue: contract,
    });

    return contract;
  }

  /** Un contratista solo puede ver sus propios contratos. */
  async findAllForContractor(contractorId: string) {
    return this.prisma.contract.findMany({
      where: { contractorId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForContractor(id: string, contractorId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, contractorId, deletedAt: null },
      include: {
        obligations: { where: { deletedAt: null }, include: { activities: { where: { deletedAt: null } } } },
        modifications: { orderBy: { effectiveDate: 'desc' } },
      },
    });
    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }
    return contract;
  }

  async update(id: string, contractorId: string, dto: UpdateContractDto) {
    const existing = await this.findOneForContractor(id, contractorId);

    const contract = await this.prisma.contract.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.audit.record({
      userId: contractorId,
      action: 'UPDATE_CONTRACT',
      module: 'contracts',
      entityId: id,
      previousValue: existing,
      newValue: contract,
    });

    return contract;
  }

  async updateStatus(id: string, contractorId: string, status: ContractStatus) {
    await this.findOneForContractor(id, contractorId);
    return this.prisma.contract.update({ where: { id }, data: { status } });
  }
}
