/**
 * IMAGE CACHING SYSTEM
 * Caches successfully verified images to avoid re-verification
 * and speed up image fetching for similar events
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, '../data/image-cache.json');
const MAX_CACHE_AGE_DAYS = 90; // Cache entries older than 90 days are removed
const MAX_CACHE_ENTRIES = 500; // Maximum number of cached entries

/**
 * Generate a cache key from event details
 * @param {Object} event - Event object
 * @returns {string} - Cache key
 */
function generateCacheKey(event) {
  // Create key from year + normalized description
  const normalizedDesc = event.description
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 8)
    .join('_');

  return `${event.year}_${normalizedDesc}`;
}

/**
 * Load cache from file
 * @returns {Promise<Object>} - Cache object
 */
async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Cache file doesn't exist or is invalid, return empty cache
    return {};
  }
}

/**
 * Save cache to file
 * @param {Object} cache - Cache object
 */
async function saveCache(cache) {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    console.error('[ImageCache] Error saving cache:', error.message);
  }
}

/**
 * Clean old cache entries
 * @param {Object} cache - Cache object
 * @returns {Object} - Cleaned cache
 */
function cleanCache(cache) {
  const now = Date.now();
  const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;

  const entries = Object.entries(cache);

  // Remove old entries
  const validEntries = entries.filter(([key, value]) => {
    const age = now - new Date(value.cachedAt).getTime();
    return age < maxAge;
  });

  // If still too many, keep only the most recently used
  if (validEntries.length > MAX_CACHE_ENTRIES) {
    validEntries.sort((a, b) => {
      return new Date(b[1].lastUsed).getTime() - new Date(a[1].lastUsed).getTime();
    });
    validEntries.splice(MAX_CACHE_ENTRIES);
  }

  return Object.fromEntries(validEntries);
}

/**
 * Get cached image info for an event
 * @param {Object} event - Event object
 * @returns {Promise<Object|null>} - Cached image info or null
 */
export async function getCachedImage(event) {
  try {
    const cache = await loadCache();
    const key = generateCacheKey(event);
    const cached = cache[key];

    if (!cached) {
      return null;
    }

    // Update last used timestamp
    cached.lastUsed = new Date().toISOString();
    cached.useCount = (cached.useCount || 0) + 1;
    await saveCache(cache);

    console.log(`[ImageCache] ✅ Cache hit for "${key}" (used ${cached.useCount} times, confidence: ${cached.confidence}%)`);

    return cached;
  } catch (error) {
    console.error('[ImageCache] Error reading cache:', error.message);
    return null;
  }
}

/**
 * Cache an image result
 * @param {Object} event - Event object
 * @param {Object} imageInfo - Image information to cache
 */
export async function cacheImage(event, imageInfo) {
  try {
    let cache = await loadCache();

    // Clean cache periodically
    if (Object.keys(cache).length > MAX_CACHE_ENTRIES * 1.1) {
      cache = cleanCache(cache);
    }

    const key = generateCacheKey(event);

    cache[key] = {
      ...imageInfo,
      cachedAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      useCount: 1,
      eventYear: event.year,
      eventDescription: event.description.slice(0, 100)
    };

    await saveCache(cache);
    console.log(`[ImageCache] 💾 Cached image for "${key}" (confidence: ${imageInfo.confidence}%)`);
  } catch (error) {
    console.error('[ImageCache] Error caching image:', error.message);
  }
}

/**
 * Clear the entire cache
 */
export async function clearCache() {
  try {
    await fs.writeFile(CACHE_FILE, '{}', 'utf8');
    console.log('[ImageCache] Cache cleared');
  } catch (error) {
    console.error('[ImageCache] Error clearing cache:', error.message);
  }
}

/**
 * Get cache statistics
 * @returns {Promise<Object>} - Cache stats
 */
export async function getCacheStats() {
  try {
    const cache = await loadCache();
    const entries = Object.values(cache);

    return {
      totalEntries: entries.length,
      totalUses: entries.reduce((sum, e) => sum + (e.useCount || 0), 0),
      avgConfidence: entries.length > 0
        ? (entries.reduce((sum, e) => sum + (e.confidence || 0), 0) / entries.length).toFixed(1)
        : 0,
      oldestEntry: entries.length > 0
        ? entries.reduce((oldest, e) => {
            const date = new Date(e.cachedAt);
            return !oldest || date < oldest ? date : oldest;
          }, null)
        : null
    };
  } catch (error) {
    return { totalEntries: 0, totalUses: 0, avgConfidence: 0, oldestEntry: null };
  }
}
