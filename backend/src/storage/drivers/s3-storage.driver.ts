import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageDriver, StoredFile } from '../storage.types';

/**
 * Driver de producción sobre Amazon S3. Requiere AWS_S3_BUCKET, AWS_REGION
 * y credenciales (variables de entorno o el rol de la tarea ECS). No se
 * ejecuta en esta entrega por no contar con infraestructura AWS real, pero
 * implementa la misma interfaz que LocalStorageDriver.
 */
@Injectable()
export class S3StorageDriver implements StorageDriver {
  private readonly client = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1' });
  private readonly bucket = process.env.AWS_S3_BUCKET ?? '';

  async upload(
    buffer: Buffer,
    originalFileName: string,
    mimeType: string,
    folder: string,
  ): Promise<StoredFile> {
    const extension = path.extname(originalFileName);
    const key = path.posix.join(folder, `${randomUUID()}${extension}`);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ServerSideEncryption: 'aws:kms',
      }),
    );

    return { key, sizeBytes: buffer.length, mimeType };
  }

  async getUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 900 },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
