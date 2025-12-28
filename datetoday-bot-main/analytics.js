// analytics.js
// Performance tracking and analytics

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ANALYTICS_FILE = path.join(__dirname, "data", "analytics.json");

/**
 * Load analytics data
 */
async function loadAnalytics() {
  try {
    const data = await fs.readFile(ANALYTICS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return {
      posts: [],
      engagement: {},
      performance: {},
      trends: {},
    };
  }
}

/**
 * Save analytics data
 */
async function saveAnalytics(data) {
  try {
    await fs.mkdir(path.dirname(ANALYTICS_FILE), { recursive: true });
    await fs.writeFile(ANALYTICS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[Analytics] Error saving:", err.message);
  }
}

/**
 * Track a post
 */
export async function trackPost(postData) {
  const analytics = await loadAnalytics();
  
  const post = {
    id: postData.id || `post-${Date.now()}`,
    type: postData.type, // 'daily', 'evening', 'weekly', 'poll', 'whatIf', 'hiddenConnection'
    tweetId: postData.tweetId,
    content: postData.content?.slice(0, 100), // First 100 chars
    timestamp: new Date().toISOString(),
    engagement: {
      likes: 0,
      retweets: 0,
      replies: 0,
      views: 0,
    },
  };

  analytics.posts.push(post);
  
  // Keep only last 1000 posts
  if (analytics.posts.length > 1000) {
    analytics.posts = analytics.posts.slice(-1000);
  }

  await saveAnalytics(analytics);
  return post.id;
}

/**
 * Update post engagement metrics
 */
export async function updateEngagement(postId, metrics) {
  const analytics = await loadAnalytics();
  const post = analytics.posts.find(p => p.id === postId || p.tweetId === postId);
  
  if (post) {
    post.engagement = {
      ...post.engagement,
      ...metrics,
      lastUpdated: new Date().toISOString(),
    };
    await saveAnalytics(analytics);
  }
}

/**
 * Get performance statistics
 */
export async function getPerformanceStats(days = 7) {
  const analytics = await loadAnalytics();
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const recentPosts = analytics.posts.filter(
    p => new Date(p.timestamp) > cutoffDate
  );

  const stats = {
    totalPosts: recentPosts.length,
    byType: {},
    averageEngagement: {
      likes: 0,
      retweets: 0,
      replies: 0,
      views: 0,
    },
    topPosts: [],
    engagementRate: 0,
  };

  // Calculate by type
  recentPosts.forEach(post => {
    if (!stats.byType[post.type]) {
      stats.byType[post.type] = {
        count: 0,
        totalEngagement: { likes: 0, retweets: 0, replies: 0, views: 0 },
      };
    }
    stats.byType[post.type].count++;
    stats.byType[post.type].totalEngagement.likes += post.engagement.likes || 0;
    stats.byType[post.type].totalEngagement.retweets += post.engagement.retweets || 0;
    stats.byType[post.type].totalEngagement.replies += post.engagement.replies || 0;
    stats.byType[post.type].totalEngagement.views += post.engagement.views || 0;
  });

  // Calculate averages
  if (recentPosts.length > 0) {
    const totals = recentPosts.reduce((acc, post) => ({
      likes: acc.likes + (post.engagement.likes || 0),
      retweets: acc.retweets + (post.engagement.retweets || 0),
      replies: acc.replies + (post.engagement.replies || 0),
      views: acc.views + (post.engagement.views || 0),
    }), { likes: 0, retweets: 0, replies: 0, views: 0 });

    stats.averageEngagement = {
      likes: Math.round(totals.likes / recentPosts.length),
      retweets: Math.round(totals.retweets / recentPosts.length),
      replies: Math.round(totals.replies / recentPosts.length),
      views: Math.round(totals.views / recentPosts.length),
    };

    // Calculate engagement rate (likes + retweets + replies) / views
    if (totals.views > 0) {
      stats.engagementRate = ((totals.likes + totals.retweets + totals.replies) / totals.views * 100).toFixed(2);
    }
  }

  // Get top posts
  stats.topPosts = recentPosts
    .map(post => ({
      id: post.id,
      type: post.type,
      engagement: post.engagement,
      score: (post.engagement.likes || 0) + (post.engagement.retweets || 0) * 2 + (post.engagement.replies || 0) * 1.5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return stats;
}

/**
 * Track content type performance
 */
export async function trackContentType(type, engagement) {
  const analytics = await loadAnalytics();
  
  if (!analytics.performance[type]) {
    analytics.performance[type] = {
      count: 0,
      totalEngagement: { likes: 0, retweets: 0, replies: 0 },
      averageEngagement: { likes: 0, retweets: 0, replies: 0 },
    };
  }

  analytics.performance[type].count++;
  analytics.performance[type].totalEngagement.likes += engagement.likes || 0;
  analytics.performance[type].totalEngagement.retweets += engagement.retweets || 0;
  analytics.performance[type].totalEngagement.replies += engagement.replies || 0;

  // Update averages
  const perf = analytics.performance[type];
  perf.averageEngagement = {
    likes: Math.round(perf.totalEngagement.likes / perf.count),
    retweets: Math.round(perf.totalEngagement.retweets / perf.count),
    replies: Math.round(perf.totalEngagement.replies / perf.count),
  };

  await saveAnalytics(analytics);
}

/**
 * Get best performing content types
 */
export async function getBestContentTypes() {
  const analytics = await loadAnalytics();
  const performance = analytics.performance;

  return Object.entries(performance)
    .map(([type, data]) => ({
      type,
      averageScore: data.averageEngagement.likes + data.averageEngagement.retweets * 2,
      ...data,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
}

/**
 * Track trend (e.g., posting time, content style)
 */
export async function trackTrend(category, value, result) {
  const analytics = await loadAnalytics();
  
  if (!analytics.trends[category]) {
    analytics.trends[category] = {};
  }

  if (!analytics.trends[category][value]) {
    analytics.trends[category][value] = {
      count: 0,
      totalEngagement: 0,
      averageEngagement: 0,
    };
  }

  const trend = analytics.trends[category][value];
  trend.count++;
  trend.totalEngagement += result.engagement || 0;
  trend.averageEngagement = Math.round(trend.totalEngagement / trend.count);

  await saveAnalytics(analytics);
}

/**
 * Get analytics summary
 */
export async function getAnalyticsSummary() {
  const stats = await getPerformanceStats(30);
  const bestTypes = await getBestContentTypes();

  return {
    last30Days: stats,
    bestContentTypes: bestTypes.slice(0, 5),
    totalPosts: stats.totalPosts,
    averageEngagementRate: stats.engagementRate,
  };
}



