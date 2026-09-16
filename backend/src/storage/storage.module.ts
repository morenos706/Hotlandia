import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageDriver } from './drivers/local-storage.driver';
import { S3StorageDriver } from './drivers/s3-storage.driver';

@Global()
@Module({
  providers: [LocalStorageDriver, S3StorageDriver, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
