import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE_BYTES } from './documents.constants';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async list(contractId: string, contractorId: string) {
    await this.assertContractOwnership(contractId, contractorId);
    const documents = await this.prisma.document.findMany({
      where: { contractId },
      orderBy: [{ folder: 'asc' }, { uploadedAt: 'desc' }],
    });

    const grouped: Record<string, typeof documents> = {};
    for (const doc of documents) {
      grouped[doc.folder] = grouped[doc.folder] ?? [];
      grouped[doc.folder].push(doc);
    }
    return grouped;
  }

  async upload(
    contractId: string,
    contractorId: string,
    dto: CreateDocumentDto,
    file: Express.Multer.File,
  ) {
    await this.assertContractOwnership(contractId, contractorId);

    if (!file) {
      throw new BadRequestException('Debe adjuntar un archivo');
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`);
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException('El archivo supera el tamaño máximo permitido (25 MB)');
    }

    const stored = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      `contracts/${contractId}/documents/${dto.folder}`,
    );

    const document = await this.prisma.document.create({
      data: {
        contractId,
        folder: dto.folder,
        name: dto.name,
        storageKey: stored.key,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        uploadedById: contractorId,
      },
    });

    await this.audit.record({
      userId: contractorId,
      action: 'UPLOAD_DOCUMENT',
      module: 'documents',
      entityId: document.id,
      newValue: { folder: document.folder, name: document.name },
    });

    return { ...document, url: await this.storage.getUrl(document.storageKey) };
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
