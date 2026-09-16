import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateObligationDto } from './dto/create-obligation.dto';
import { UpdateObligationDto } from './dto/update-obligation.dto';

@Injectable()
export class ObligationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(contractId: string, contractorId: string) {
    await this.assertContractOwnership(contractId, contractorId);
    return this.prisma.obligation.findMany({
      where: { contractId, deletedAt: null },
      include: { activities: { where: { deletedAt: null } } },
      orderBy: { code: 'asc' },
    });
  }

  async create(contractId: string, contractorId: string, dto: CreateObligationDto) {
    await this.assertContractOwnership(contractId, contractorId);

    const duplicate = await this.prisma.obligation.findUnique({
      where: { contractId_code: { contractId, code: dto.code } },
    });
    if (duplicate) {
      throw new ConflictException(`Ya existe la obligación con código ${dto.code}`);
    }

    const obligation = await this.prisma.obligation.create({
      data: { ...dto, contractId },
    });

    await this.audit.record({
      userId: contractorId,
      action: 'CREATE_OBLIGATION',
      module: 'obligations',
      entityId: obligation.id,
      newValue: obligation,
    });

    return obligation;
  }

  async update(id: string, contractorId: string, dto: UpdateObligationDto) {
    const obligation = await this.findOneOwned(id, contractorId);

    const updated = await this.prisma.obligation.update({
      where: { id },
      data: dto,
    });

    await this.audit.record({
      userId: contractorId,
      action: 'UPDATE_OBLIGATION',
      module: 'obligations',
      entityId: id,
      previousValue: obligation,
      newValue: updated,
    });

    return updated;
  }

  async findOneOwned(id: string, contractorId: string) {
    const obligation = await this.prisma.obligation.findFirst({
      where: { id, deletedAt: null, contract: { contractorId, deletedAt: null } },
      include: { contract: true },
    });
    if (!obligation) {
      throw new NotFoundException('Obligación no encontrada');
    }
    return obligation;
  }

  private async assertContractOwnership(contractId: string, contractorId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, contractorId, deletedAt: null },
    });
    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }
    return contract;
  }
}
