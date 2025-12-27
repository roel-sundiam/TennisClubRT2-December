/**
 * Simple in-memory cache service with TTL and LRU eviction
 * Designed for caching weather API responses
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // Unix timestamp in milliseconds
}

class CacheService {
  private cache: Map<string, CacheEntry<any>>;
  private readonly MAX_ENTRIES: number;

  constructor() {
    this.cache = new Map();
    // Maximum entries to prevent excessive memory usage
    this.MAX_ENTRIES = parseInt(process.env.WEATHER_CACHE_MAX_ENTRIES || '50');
  }

  /**
   * Get cached data if it exists and hasn't expired
   * @param key Cache key
   * @returns Cached data or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (LRU: mark as recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  /**
   * Store data in cache with TTL
   * @param key Cache key
   * @param data Data to cache
   * @param ttlSeconds Time-to-live in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    // LRU eviction: remove oldest entry if at capacity
    if (this.cache.size >= this.MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Remove specific key from cache
   * @param key Cache key to remove
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   * @returns Number of cached entries
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  getStats(): { size: number; maxEntries: number } {
    return {
      size: this.cache.size,
      maxEntries: this.MAX_ENTRIES
    };
  }
}

// Export singleton instance
export default new CacheService();
