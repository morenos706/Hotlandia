import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageDriver, StoredFile } from '../storage.types';

/**
 * Driver de almacenamiento en disco local. Uso previsto: desarrollo y
 * esta entrega sin credenciales de AWS. En producción se reemplaza por
 * S3StorageDriver sin tocar el resto del código (misma interfaz).
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly basePath = process.env.LOCAL_STORAGE_PATH ?? './uploads';

  async upload(
    buffer: Buffer,
    originalFileName: string,
    mimeType: string,
    folder: string,
  ): Promise<StoredFile> {
    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '');
    const extension = path.extname(originalFileName);
    const key = path.posix.join(safeFolder, `${randomUUID()}${extension}`);
    const fullPath = path.join(this.basePath, key);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    return { key, sizeBytes: buffer.length, mimeType };
  }

  async getUrl(key: string): Promise<string> {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key);
    await fs.rm(fullPath, { force: true });
  }
}
