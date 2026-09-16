import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string;
  action: string;
  module: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

/**
 * Registro de trazabilidad append-only. No expone ningún método de
 * actualización o borrado: una vez escrito, un audit log es inmutable.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        module: entry.module,
        entityId: entry.entityId,
        previousValue: toJson(entry.previousValue),
        newValue: toJson(entry.newValue),
        ipAddress: entry.ipAddress,
      },
    });
  }

  async findByEntity(entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }

  /** Trazabilidad de un conjunto de entidades relacionadas (ej. todas las actividades de un contrato). */
  async findByEntityIds(entityIds: string[]) {
    if (entityIds.length === 0) return [];
    return this.prisma.auditLog.findMany({
      where: { entityId: { in: entityIds } },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
  }
}

function toJson(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}
