import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePeriodDto } from './dto/create-period.dto';

@Injectable()
export class ExecutionPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(contractId: string, contractorId: string) {
    await this.assertContractOwnership(contractId, contractorId);
    return this.prisma.executionPeriod.findMany({
      where: { contractId },
      orderBy: { startDate: 'desc' },
    });
  }

  async create(contractId: string, contractorId: string, dto: CreatePeriodDto) {
    await this.assertContractOwnership(contractId, contractorId);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('La fecha final del periodo debe ser posterior a la inicial');
    }

    return this.prisma.executionPeriod.create({
      data: { contractId, label: dto.label, startDate, endDate },
    });
  }

  async findOneOwned(id: string, contractorId: string) {
    const period = await this.prisma.executionPeriod.findFirst({
      where: { id, contract: { contractorId, deletedAt: null } },
    });
    if (!period) {
      throw new NotFoundException('Periodo no encontrado');
    }
    return period;
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
