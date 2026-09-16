import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateModificationDto } from './dto/create-modification.dto';

@Injectable()
export class ContractModificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(contractId: string, contractorId: string) {
    await this.assertOwnership(contractId, contractorId);
    return this.prisma.contractModification.findMany({
      where: { contractId },
      orderBy: { effectiveDate: 'desc' },
    });
  }

  async create(contractId: string, contractorId: string, dto: CreateModificationDto) {
    const contract = await this.assertOwnership(contractId, contractorId);

    const { newValue, newEndDate, newStatus, newTermDays } = this.applyModification(
      contract.currentValue,
      contract.endDate,
      contract.termDays,
      dto,
    );

    const [modification] = await this.prisma.$transaction([
      this.prisma.contractModification.create({
        data: {
          contractId,
          type: dto.type,
          description: dto.description,
          valueDelta: dto.valueDelta,
          daysDelta: dto.daysDelta,
          previousValue: contract.currentValue,
          newValue,
          previousEndDate: contract.endDate,
          newEndDate,
          effectiveDate: new Date(dto.effectiveDate),
        },
      }),
      this.prisma.contract.update({
        where: { id: contractId },
        data: {
          currentValue: newValue,
          endDate: newEndDate,
          termDays: newTermDays,
          ...(newStatus ? { status: newStatus } : {}),
        },
      }),
    ]);

    await this.audit.record({
      userId: contractorId,
      action: `MODIFICATION_${dto.type}`,
      module: 'contract-modifications',
      entityId: contractId,
      previousValue: { value: contract.currentValue, endDate: contract.endDate },
      newValue: { value: newValue, endDate: newEndDate },
    });

    return modification;
  }

  private applyModification(
    currentValue: Prisma.Decimal,
    currentEndDate: Date,
    currentTermDays: number,
    dto: CreateModificationDto,
  ) {
    let newValue = currentValue;
    let newEndDate = currentEndDate;
    let newTermDays = currentTermDays;
    let newStatus: 'SUSPENDIDO' | 'REINICIADO' | undefined;

    switch (dto.type) {
      case ModificationType.ADICION: {
        if (!dto.valueDelta || dto.valueDelta <= 0) {
          throw new BadRequestException('La adición requiere un valor positivo');
        }
        newValue = currentValue.add(dto.valueDelta);
        break;
      }
      case ModificationType.REDUCCION: {
        if (!dto.valueDelta || dto.valueDelta <= 0) {
          throw new BadRequestException('La reducción requiere un valor positivo (se restará del valor actual)');
        }
        newValue = currentValue.sub(dto.valueDelta);
        if (newValue.isNegative()) {
          throw new BadRequestException('La reducción no puede dejar el valor del contrato en negativo');
        }
        break;
      }
      case ModificationType.PRORROGA: {
        if (!dto.daysDelta || dto.daysDelta <= 0) {
          throw new BadRequestException('La prórroga requiere días positivos');
        }
        newEndDate = addDays(currentEndDate, dto.daysDelta);
        newTermDays = currentTermDays + dto.daysDelta;
        break;
      }
      case ModificationType.SUSPENSION: {
        newStatus = 'SUSPENDIDO';
        break;
      }
      case ModificationType.REINICIO: {
        newStatus = 'REINICIADO';
        if (dto.daysDelta && dto.daysDelta > 0) {
          newEndDate = addDays(currentEndDate, dto.daysDelta);
          newTermDays = currentTermDays + dto.daysDelta;
        }
        break;
      }
      case ModificationType.OTROSI:
      case ModificationType.CESION:
        // Modificaciones sin recálculo numérico automático: quedan registradas
        // para trazabilidad e historial, sin alterar valor ni plazo.
        break;
    }

    return { newValue, newEndDate, newStatus, newTermDays };
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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
