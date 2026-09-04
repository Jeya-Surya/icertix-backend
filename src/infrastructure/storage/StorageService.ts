/**
 * iCertiX - Storage Service Abstraction
 * 
 * Provides an abstract interface for persisting certificate PDF and image artifacts.
 * Uses a mock/local storage implementation for development, ready for AWS S3.
 */

export interface StorageMetadata {
  provider: 'local' | 's3' | 'gcs';
  key: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  url: string;
}

export interface IStorageService {
  save(key: string, data: Buffer | string, mimeType: string): Promise<StorageMetadata>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

export class LocalStorageService implements IStorageService {
  private inMemoryStore = new Map<string, { data: Buffer; mimeType: string; timestamp: string }>();

  async save(key: string, data: Buffer | string, mimeType: string): Promise<StorageMetadata> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    this.inMemoryStore.set(key, { data: buffer, mimeType, timestamp: new Date().toISOString() });
    
    return {
      provider: 'local',
      key,
      mimeType,
      sizeBytes: buffer.length,
      checksum: `sha256-${buffer.length}`,
      url: `/api/certificates/artifacts/${encodeURIComponent(key)}`
    };
  }

  async get(key: string): Promise<Buffer | null> {
    const item = this.inMemoryStore.get(key);
    return item ? item.data : null;
  }

  async delete(key: string): Promise<boolean> {
    return this.inMemoryStore.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.inMemoryStore.has(key);
  }

  async getSignedUrl(key: string): Promise<string> {
    return `/api/certificates/artifacts/${encodeURIComponent(key)}`;
  }
}

export const storageService = new LocalStorageService();
