/**
 * ENGAGEMENT TRACKING FOR A/B TESTING
 * Tracks which image types/styles get the best engagement
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENGAGEMENT_FILE = path.join(__dirname, '../data/image-engagement.json');

/**
 * Track a post with image metadata for later engagement analysis
 * @param {string} tweetId - Tweet ID
 * @param {Object} imageInfo - Image metadata
 */
export async function trackImagePost(tweetId, imageInfo) {
  try {
    let data = { posts: [] };

    try {
      const fileData = await fs.readFile(ENGAGEMENT_FILE, 'utf8');
      data = JSON.parse(fileData);
    } catch (error) {
      // File doesn't exist, use default
    }

    data.posts.push({
      tweetId,
      timestamp: new Date().toISOString(),
      imageSource: imageInfo.source || 'unknown',
      imageConfidence: imageInfo.confidence || 0,
      imageVerdict: imageInfo.verdict || 'unknown',
      hasImage: true,
      // Engagement will be filled in later
      likes: null,
      retweets: null,
      replies: null,
      impressions: null
    });

    // Keep only last 100 posts
    if (data.posts.length > 100) {
      data.posts = data.posts.slice(-100);
    }

    await fs.writeFile(ENGAGEMENT_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[Engagement] Tracked post ${tweetId} with image (${imageInfo.source}, ${imageInfo.confidence}%)`);
  } catch (error) {
    console.error('[Engagement] Error tracking post:', error.message);
  }
}

/**
 * Update engagement metrics for a post
 * @param {string} tweetId - Tweet ID
 * @param {Object} metrics - Engagement metrics
 */
export async function updateEngagement(tweetId, metrics) {
  try {
    const fileData = await fs.readFile(ENGAGEMENT_FILE, 'utf8');
    const data = JSON.parse(fileData);

    const post = data.posts.find(p => p.tweetId === tweetId);
    if (post) {
      post.likes = metrics.likes || 0;
      post.retweets = metrics.retweets || 0;
      post.replies = metrics.replies || 0;
      post.impressions = metrics.impressions || 0;
      post.updatedAt = new Date().toISOString();

      await fs.writeFile(ENGAGEMENT_FILE, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[Engagement] Updated metrics for ${tweetId}`);
    }
  } catch (error) {
    console.error('[Engagement] Error updating engagement:', error.message);
  }
}

/**
 * Get engagement statistics
 * @returns {Promise<Object>} - Engagement stats
 */
export async function getEngagementStats() {
  try {
    const fileData = await fs.readFile(ENGAGEMENT_FILE, 'utf8');
    const data = JSON.parse(fileData);

    const postsWithMetrics = data.posts.filter(p => p.likes !== null);

    if (postsWithMetrics.length === 0) {
      return {
        totalPosts: data.posts.length,
        postsWithMetrics: 0,
        avgLikes: 0,
        avgRetweets: 0,
        avgEngagement: 0
      };
    }

    const avgLikes = postsWithMetrics.reduce((sum, p) => sum + p.likes, 0) / postsWithMetrics.length;
    const avgRetweets = postsWithMetrics.reduce((sum, p) => sum + p.retweets, 0) / postsWithMetrics.length;
    const avgReplies = postsWithMetrics.reduce((sum, p) => sum + p.replies, 0) / postsWithMetrics.length;

    return {
      totalPosts: data.posts.length,
      postsWithMetrics: postsWithMetrics.length,
      avgLikes: avgLikes.toFixed(1),
      avgRetweets: avgRetweets.toFixed(1),
      avgReplies: avgReplies.toFixed(1),
      avgEngagement: (avgLikes + avgRetweets + avgReplies).toFixed(1)
    };
  } catch (error) {
    return {
      totalPosts: 0,
      postsWithMetrics: 0,
      avgLikes: 0,
      avgRetweets: 0,
      avgEngagement: 0
    };
  }
}
