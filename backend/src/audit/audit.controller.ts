import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts/:contractId/audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async findForContract(@Param('contractId') contractId: string, @CurrentUser() user: AuthenticatedUser) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, contractorId: user.id, deletedAt: null },
      include: {
        obligations: { include: { activities: true } },
        evidences: { select: { id: true } },
        modifications: { select: { id: true } },
      },
    });
    if (!contract) {
      throw new NotFoundException('Contrato no encontrado');
    }

    const entityIds = [
      contract.id,
      ...contract.obligations.map((o) => o.id),
      ...contract.obligations.flatMap((o) => o.activities.map((a) => a.id)),
      ...contract.evidences.map((e) => e.id),
      ...contract.modifications.map((m) => m.id),
    ];

    return this.auditService.findByEntityIds(entityIds);
  }
}
