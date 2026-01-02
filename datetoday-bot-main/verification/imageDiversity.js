/**
 * Image Diversity Tracker
 * Prevents reusing the same images repeatedly
 * Tracks image hashes and URLs to ensure variety
 */

import fs from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIVERSITY_FILE = path.join(__dirname, '../data/image-diversity.json');
const MAX_RECENT_IMAGES = 100; // Track last 100 images
const REUSE_COOLDOWN_DAYS = 30; // Don't reuse same image for 30 days

/**
 * Load diversity tracking data
 */
async function loadDiversityData() {
  try {
    const data = await fs.readFile(DIVERSITY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {
      recentImages: [], // Array of {hash, url, source, usedAt, description}
    };
  }
}

/**
 * Save diversity tracking data
 */
async function saveDiversityData(data) {
  try {
    await fs.writeFile(DIVERSITY_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[ImageDiversity] Failed to save:', error.message);
  }
}

/**
 * Generate hash from image buffer
 */
function hashImageBuffer(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Check if image was recently used
 */
export async function wasImageRecentlyUsed(imageBuffer, imageUrl = null) {
  const data = await loadDiversityData();
  const imageHash = hashImageBuffer(imageBuffer);

  const now = Date.now();
  const cooldownMs = REUSE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

  // Check by hash (exact duplicate)
  const hashMatch = data.recentImages.find(img => img.hash === imageHash);
  if (hashMatch) {
    const daysSinceUsed = (now - hashMatch.usedAt) / (24 * 60 * 60 * 1000);
    if (daysSinceUsed < REUSE_COOLDOWN_DAYS) {
      console.log(`[ImageDiversity] ⚠️  Image hash already used ${daysSinceUsed.toFixed(1)} days ago`);
      console.log(`[ImageDiversity]    Previously used for: "${hashMatch.description?.slice(0, 60)}..."`);
      return true;
    }
  }

  // Check by URL (same source image)
  if (imageUrl) {
    const urlMatch = data.recentImages.find(img =>
      img.url === imageUrl && (now - img.usedAt) < cooldownMs
    );
    if (urlMatch) {
      const daysSinceUsed = (now - urlMatch.usedAt) / (24 * 60 * 60 * 1000);
      console.log(`[ImageDiversity] ⚠️  Image URL already used ${daysSinceUsed.toFixed(1)} days ago`);
      console.log(`[ImageDiversity]    Previously used for: "${urlMatch.description?.slice(0, 60)}..."`);
      return true;
    }
  }

  return false;
}

/**
 * Mark image as used
 */
export async function markImageAsUsed(imageBuffer, metadata, eventDescription) {
  const data = await loadDiversityData();
  const imageHash = hashImageBuffer(imageBuffer);

  const imageRecord = {
    hash: imageHash,
    url: metadata.url || metadata.imageUrl || null,
    source: metadata.source,
    usedAt: Date.now(),
    description: eventDescription,
    searchTerm: metadata.searchTerm || metadata.thematicTerm || null,
  };

  // Add to recent images
  data.recentImages.unshift(imageRecord);

  // Keep only last N images
  data.recentImages = data.recentImages.slice(0, MAX_RECENT_IMAGES);

  await saveDiversityData(data);

  console.log(`[ImageDiversity] ✅ Marked image as used (hash: ${imageHash.slice(0, 8)}...)`);
  console.log(`[ImageDiversity]    Source: ${metadata.source}, Tracking ${data.recentImages.length} recent images`);
}

/**
 * Get diversity stats
 */
export async function getDiversityStats() {
  const data = await loadDiversityData();

  const now = Date.now();
  const last7Days = data.recentImages.filter(img =>
    (now - img.usedAt) < (7 * 24 * 60 * 60 * 1000)
  );
  const last30Days = data.recentImages.filter(img =>
    (now - img.usedAt) < (30 * 24 * 60 * 60 * 1000)
  );

  const sourceBreakdown = {};
  last30Days.forEach(img => {
    sourceBreakdown[img.source] = (sourceBreakdown[img.source] || 0) + 1;
  });

  return {
    totalTracked: data.recentImages.length,
    last7Days: last7Days.length,
    last30Days: last30Days.length,
    sourceBreakdown,
  };
}

/**
 * Clean old entries (maintenance)
 */
export async function cleanOldEntries() {
  const data = await loadDiversityData();
  const now = Date.now();
  const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days

  const before = data.recentImages.length;
  data.recentImages = data.recentImages.filter(img =>
    (now - img.usedAt) < maxAge
  );
  const removed = before - data.recentImages.length;

  if (removed > 0) {
    await saveDiversityData(data);
    console.log(`[ImageDiversity] 🧹 Cleaned ${removed} old entries (>90 days)`);
  }

  return removed;
}
