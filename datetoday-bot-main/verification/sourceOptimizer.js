/**
 * SOURCE OPTIMIZER - LEARNS WHICH IMAGE SOURCES GET BEST ENGAGEMENT
 * Uses engagement data to prefer high-performing sources
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENGAGEMENT_FILE = path.join(__dirname, '../data/image-engagement.json');

/**
 * Calculate engagement score for each source
 * @returns {Promise<Object>} - Source rankings { sourceName: avgScore }
 */
export async function getSourcePerformance() {
  try {
    const fileData = await fs.readFile(ENGAGEMENT_FILE, 'utf8');
    const data = JSON.parse(fileData);

    // Group posts by source
    const bySource = {};

    for (const post of data.posts) {
      if (post.likes === null) continue; // Skip posts without engagement data

      const source = post.imageSource || 'unknown';
      if (!bySource[source]) {
        bySource[source] = {
          posts: [],
          totalEngagement: 0,
          count: 0
        };
      }

      const engagement = (post.likes || 0) + (post.retweets || 0) * 2 + (post.replies || 0) * 1.5;
      bySource[source].posts.push(post);
      bySource[source].totalEngagement += engagement;
      bySource[source].count++;
    }

    // Calculate average engagement per source
    const rankings = {};
    for (const [source, stats] of Object.entries(bySource)) {
      rankings[source] = {
        avgEngagement: stats.totalEngagement / stats.count,
        count: stats.count,
        confidence: stats.count >= 5 ? 'high' : stats.count >= 2 ? 'medium' : 'low'
      };
    }

    return rankings;
  } catch (error) {
    console.error('[SourceOptimizer] Error calculating source performance:', error.message);
    return {};
  }
}

/**
 * Get ranked list of sources by performance
 * @returns {Promise<Array>} - Array of sources sorted by performance
 */
export async function getRankedSources() {
  const performance = await getSourcePerformance();

  const ranked = Object.entries(performance)
    .map(([source, stats]) => ({
      source,
      ...stats
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);

  return ranked;
}

/**
 * Should we try this source? (Based on performance and variety)
 * @param {string} sourceName - Source to check
 * @param {Array} recentSources - Recently used sources
 * @returns {Promise<number>} - Priority score (higher = try first)
 */
export async function getSourcePriority(sourceName, recentSources = []) {
  const performance = await getSourcePerformance();
  const sourceStats = performance[sourceName];

  let priority = 50; // Default priority

  // Boost based on historical performance
  if (sourceStats) {
    if (sourceStats.confidence === 'high') {
      // We have good data, use it
      priority = sourceStats.avgEngagement * 10; // Scale to 0-100 range
    } else if (sourceStats.confidence === 'medium') {
      // Some data, but not conclusive
      priority = sourceStats.avgEngagement * 10 * 0.7; // Reduce confidence
    }
    // Low confidence: use default
  }

  // Penalize if used recently (encourage variety)
  const recentUseCount = recentSources.filter(s => s === sourceName).length;
  if (recentUseCount > 0) {
    priority *= Math.pow(0.8, recentUseCount); // 20% penalty per recent use
  }

  return Math.max(0, Math.min(100, priority)); // Clamp to 0-100
}

/**
 * Get optimal source order for fetching
 * @param {Array} recentSources - Recently used sources (last 5-10 posts)
 * @returns {Promise<Array>} - Ordered array of source names
 */
export async function getOptimalSourceOrder(recentSources = []) {
  const allSources = [
    'Wikipedia Primary',
    'Wikimedia Commons',
    'Library of Congress',
    'Smithsonian',
    'Unsplash',
    'Pexels'
  ];

  const sourcesWithPriority = await Promise.all(
    allSources.map(async source => ({
      source,
      priority: await getSourcePriority(source, recentSources)
    }))
  );

  // Sort by priority (highest first)
  sourcesWithPriority.sort((a, b) => b.priority - a.priority);

  console.log('[SourceOptimizer] Optimal source order:',
    sourcesWithPriority.map(s => `${s.source} (${s.priority.toFixed(1)})`).join(', ')
  );

  return sourcesWithPriority.map(s => s.source);
}

/**
 * Get recent sources from engagement log
 * @param {number} limit - How many recent posts to check
 * @returns {Promise<Array>} - Array of source names
 */
export async function getRecentSources(limit = 5) {
  try {
    const fileData = await fs.readFile(ENGAGEMENT_FILE, 'utf8');
    const data = JSON.parse(fileData);

    return data.posts
      .slice(-limit)
      .map(p => p.imageSource)
      .filter(s => s);
  } catch (error) {
    return [];
  }
}

/**
 * Log source statistics
 */
export async function logSourceStats() {
  const ranked = await getRankedSources();

  console.log('\n[SourceOptimizer] 📊 Source Performance:');
  for (const { source, avgEngagement, count, confidence } of ranked) {
    console.log(`  ${source}: ${avgEngagement.toFixed(1)} avg engagement (${count} posts, ${confidence} confidence)`);
  }
  console.log('');
}
