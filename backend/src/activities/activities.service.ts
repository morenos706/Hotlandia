import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(obligationId: string, contractorId: string) {
    await this.assertObligationOwnership(obligationId, contractorId);
    return this.prisma.activity.findMany({
      where: { obligationId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
  }

  async create(obligationId: string, contractorId: string, dto: CreateActivityDto) {
    await this.assertObligationOwnership(obligationId, contractorId);

    const duplicate = await this.prisma.activity.findUnique({
      where: { obligationId_code: { obligationId, code: dto.code } },
    });
    if (duplicate) {
      throw new ConflictException(`Ya existe la actividad con código ${dto.code}`);
    }

    const activity = await this.prisma.activity.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        responsibleId: contractorId,
        obligationId,
      },
    });

    await this.audit.record({
      userId: contractorId,
      action: 'CREATE_ACTIVITY',
      module: 'activities',
      entityId: activity.id,
      newValue: activity,
    });

    return activity;
  }

  async update(id: string, contractorId: string, dto: UpdateActivityDto) {
    const activity = await this.findOneOwned(id, contractorId);

    const updated = await this.prisma.activity.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.audit.record({
      userId: contractorId,
      action: 'UPDATE_ACTIVITY',
      module: 'activities',
      entityId: id,
      previousValue: activity,
      newValue: updated,
    });

    return updated;
  }

  async findOneOwned(id: string, contractorId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: {
        id,
        deletedAt: null,
        obligation: { contract: { contractorId, deletedAt: null } },
      },
      include: { obligation: { include: { contract: true } } },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada');
    }
    return activity;
  }

  private async assertObligationOwnership(obligationId: string, contractorId: string) {
    const obligation = await this.prisma.obligation.findFirst({
      where: { id: obligationId, deletedAt: null, contract: { contractorId, deletedAt: null } },
    });
    if (!obligation) {
      throw new NotFoundException('Obligación no encontrada');
    }
    return obligation;
  }
}
