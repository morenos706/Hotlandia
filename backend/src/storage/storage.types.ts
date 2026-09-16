export interface StoredFile {
  key: string;
  sizeBytes: number;
  mimeType: string;
}

export interface StorageDriver {
  upload(buffer: Buffer, originalFileName: string, mimeType: string, folder: string): Promise<StoredFile>;
  getUrl(key: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
