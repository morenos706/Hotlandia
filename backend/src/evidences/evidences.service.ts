import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { ALLOWED_EVIDENCE_MIME_TYPES, MAX_EVIDENCE_SIZE_BYTES } from './evidences.constants';

@Injectable()
export class EvidencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async list(contractId: string, contractorId: string) {
    await this.assertContractOwnership(contractId, contractorId);
    return this.prisma.evidence.findMany({
      where: { contractId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async listByActivity(activityId: string, contractorId: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, obligation: { contract: { contractorId, deletedAt: null } } },
    });
    if (!activity) {
      throw new NotFoundException('Actividad no encontrada');
    }
    return this.prisma.evidence.findMany({
      where: { activityId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async upload(
    contractId: string,
    contractorId: string,
    dto: CreateEvidenceDto,
    file: Express.Multer.File,
  ) {
    await this.assertContractOwnership(contractId, contractorId);
    this.validateFile(file);

    if (dto.activityId) {
      const activity = await this.prisma.activity.findFirst({
        where: { id: dto.activityId, obligation: { contractId } },
      });
      if (!activity) {
        throw new BadRequestException('La actividad indicada no pertenece a este contrato');
      }
    }

    const stored = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      `contracts/${contractId}/evidences`,
    );

    const evidence = await this.prisma.evidence.create({
      data: {
        contractId,
        activityId: dto.activityId,
        executionRecordId: dto.executionRecordId,
        type: dto.type,
        description: dto.description,
        storageKey: stored.key,
        originalFileName: file.originalname,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : undefined,
        latitude: dto.latitude,
        longitude: dto.longitude,
        uploadedById: contractorId,
        observations: dto.observations,
      },
    });

    await this.audit.record({
      userId: contractorId,
      action: 'UPLOAD_EVIDENCE',
      module: 'evidences',
      entityId: evidence.id,
      newValue: { type: evidence.type, activityId: evidence.activityId, fileName: evidence.originalFileName },
    });

    return { ...evidence, url: await this.storage.getUrl(evidence.storageKey) };
  }

  async getSignedUrl(id: string, contractorId: string) {
    const evidence = await this.prisma.evidence.findFirst({
      where: { id, contract: { contractorId, deletedAt: null } },
    });
    if (!evidence) {
      throw new NotFoundException('Evidencia no encontrada');
    }
    return { url: await this.storage.getUrl(evidence.storageKey) };
  }

  private validateFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }
    if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`);
    }
    if (file.size > MAX_EVIDENCE_SIZE_BYTES) {
      throw new BadRequestException('El archivo supera el tamaño máximo permitido (25 MB)');
    }
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
