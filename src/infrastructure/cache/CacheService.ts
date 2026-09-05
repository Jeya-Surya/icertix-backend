/**
 * iCertiX - High-Throughput Verification & Standards Cache Service
 * 
 * Provides an in-memory / Redis-ready LRU cache for public verification lookups,
 * W3C Verifiable Credentials, and Open Badges.
 * Automatically invalidates cache entries when a credential is revoked.
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRatio: number;
  totalKeys: number;
  invalidations: number;
}

export class CacheService {
  private store = new Map<string, CacheEntry<any>>();
  private hits = 0;
  private misses = 0;
  private invalidations = 0;
  private defaultTtlMs = 5 * 60 * 1000; // 5 minutes default TTL

  constructor(defaultTtlSeconds = 300) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  /**
   * Retrieves a cached item if exists and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Sets a cached item with optional TTL
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.store.set(key, {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Deletes a specific cache key
   */
  delete(key: string): boolean {
    const deleted = this.store.delete(key);
    if (deleted) this.invalidations++;
    return deleted;
  }

  /**
   * Invalidates all cache entries related to a credential ID
   */
  invalidateCredential(credentialId: string): number {
    const cleanId = credentialId.trim().toUpperCase();
    let count = 0;

    for (const key of this.store.keys()) {
      if (key.toUpperCase().includes(cleanId)) {
        this.store.delete(key);
        count++;
      }
    }

    this.invalidations += count;
    return count;
  }

  /**
   * Clears the entire cache store
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Returns cache metrics and hit ratio
   */
  getMetrics(): CacheMetrics {
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests === 0 ? 0 : Number((this.hits / totalRequests).toFixed(4));

    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio,
      totalKeys: this.store.size,
      invalidations: this.invalidations,
    };
  }
}

export const cacheService = new CacheService();
