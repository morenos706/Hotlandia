import { Injectable } from '@nestjs/common';
import { LocalStorageDriver } from './drivers/local-storage.driver';
import { S3StorageDriver } from './drivers/s3-storage.driver';
import { StorageDriver } from './storage.types';

@Injectable()
export class StorageService implements StorageDriver {
  private readonly driver: StorageDriver;

  constructor(local: LocalStorageDriver, s3: S3StorageDriver) {
    this.driver = process.env.STORAGE_DRIVER === 's3' ? s3 : local;
  }

  upload(buffer: Buffer, originalFileName: string, mimeType: string, folder: string) {
    return this.driver.upload(buffer, originalFileName, mimeType, folder);
  }

  getUrl(key: string) {
    return this.driver.getUrl(key);
  }

  download(key: string) {
    return this.driver.download(key);
  }

  delete(key: string) {
    return this.driver.delete(key);
  }
}
