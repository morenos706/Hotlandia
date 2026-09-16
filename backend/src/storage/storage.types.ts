export interface StoredFile {
  key: string;
  sizeBytes: number;
  mimeType: string;
}

export interface StorageDriver {
  upload(buffer: Buffer, originalFileName: string, mimeType: string, folder: string): Promise<StoredFile>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
