import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(contractId: string, contractorId: string) {
    await this.assertOwnership(contractId, contractorId);
    return this.prisma.payment.findMany({ where: { contractId }, orderBy: { createdAt: 'desc' } });
  }

  async create(contractId: string, contractorId: string, dto: CreatePaymentDto) {
    await this.assertOwnership(contractId, contractorId);
    const payment = await this.prisma.payment.create({ data: { ...dto, contractId } });

    await this.audit.record({
      userId: contractorId,
      action: 'CREATE_PAYMENT',
      module: 'payments',
      entityId: payment.id,
      newValue: payment,
    });

    return payment;
  }

  async update(id: string, contractorId: string, dto: UpdatePaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, contract: { contractorId, deletedAt: null } },
    });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        ...dto,
        submittedDate: dto.submittedDate ? new Date(dto.submittedDate) : undefined,
        paidDate: dto.paidDate ? new Date(dto.paidDate) : undefined,
      },
    });

    await this.audit.record({
      userId: contractorId,
      action: 'UPDATE_PAYMENT',
      module: 'payments',
      entityId: id,
      previousValue: payment,
      newValue: updated,
    });

    return updated;
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
