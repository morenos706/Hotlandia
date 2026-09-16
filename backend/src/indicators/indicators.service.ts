import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIndicatorDto } from './dto/create-indicator.dto';
import { RecordIndicatorResultDto } from './dto/record-indicator-result.dto';

@Injectable()
export class IndicatorsService {
  constructor(private readonly prisma: PrismaService) {}

  listCatalog() {
    return this.prisma.indicator.findMany({ orderBy: { code: 'asc' } });
  }

  createDefinition(dto: CreateIndicatorDto) {
    return this.prisma.indicator.create({ data: dto });
  }

  async recordResult(
    contractId: string,
    indicatorId: string,
    contractorId: string,
    dto: RecordIndicatorResultDto,
  ) {
    await this.assertOwnership(contractId, contractorId);
    const indicator = await this.prisma.indicator.findUnique({ where: { id: indicatorId } });
    if (!indicator) {
      throw new NotFoundException('Indicador no encontrado');
    }

    return this.prisma.indicatorResult.create({
      data: {
        indicatorId,
        contractId,
        periodLabel: dto.periodLabel,
        value: dto.value,
      },
    });
  }

  async listResults(contractId: string, contractorId: string) {
    await this.assertOwnership(contractId, contractorId);
    return this.prisma.indicatorResult.findMany({
      where: { contractId },
      include: { indicator: true },
      orderBy: { calculatedAt: 'desc' },
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
