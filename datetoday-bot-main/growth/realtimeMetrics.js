/**
 * REAL-TIME ENGAGEMENT METRICS
 *
 * Polls Twitter API to fetch actual engagement metrics for posted tweets
 * This is the foundation for viral detection, A/B testing, and optimization
 */

import { client as twitterClient } from '../twitterClient.js';
import fs from 'fs/promises';
import path from 'path';

const METRICS_FILE = path.join(process.cwd(), 'data', 'engagement-metrics.json');
const POLL_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Fetch metrics for a single tweet
 */
export async function pollTweetMetrics(tweetId) {
  try {
    const tweet = await twitterClient.v2.singleTweet(tweetId, {
      'tweet.fields': ['public_metrics', 'created_at'],
      expansions: ['author_id']
    });

    const metrics = tweet.data.public_metrics;

    const engagementRate = calculateEngagementRate(metrics);
    const viralScore = calculateViralScore(metrics);

    return {
      tweetId,
      timestamp: new Date(tweet.data.created_at).getTime(),
      metrics: {
        likes: metrics.like_count,
        retweets: metrics.retweet_count,
        replies: metrics.reply_count,
        quotes: metrics.quote_count,
        impressions: metrics.impression_count || null,
        bookmarks: metrics.bookmark_count || 0
      },
      calculated: {
        totalEngagement: metrics.like_count + metrics.retweet_count + metrics.reply_count + metrics.quote_count,
        engagementRate,
        viralScore,
        isViral: viralScore > 3.0 // 3x average = viral
      },
      pulledAt: Date.now()
    };
  } catch (error) {
    console.error(`[Metrics] Failed to fetch metrics for ${tweetId}:`, error.message);
    return null;
  }
}

/**
 * Calculate engagement rate
 */
function calculateEngagementRate(metrics) {
  const total = metrics.like_count + metrics.retweet_count + metrics.reply_count + metrics.quote_count;
  const impressions = metrics.impression_count || 1;
  return (total / impressions) * 100;
}

/**
 * Calculate viral score (compared to baseline)
 */
function calculateViralScore(metrics) {
  // Baseline: average post gets ~30 engagements
  const baseline = 30;
  const total = metrics.like_count + metrics.retweet_count + metrics.reply_count + metrics.quote_count;
  return total / baseline;
}

/**
 * Poll metrics for multiple tweets
 */
export async function pollMultipleTweets(tweetIds) {
  const results = [];

  for (const tweetId of tweetIds) {
    const metrics = await pollTweetMetrics(tweetId);
    if (metrics) {
      results.push(metrics);
      await saveMetrics(metrics);
    }

    // Rate limit protection
    await sleep(1000);
  }

  return results;
}

/**
 * Get recent tweets that need metric updates
 */
export async function getRecentTweetsNeedingUpdate() {
  try {
    const metricsData = await loadMetricsData();
    const now = Date.now();
    const sixHoursAgo = now - (6 * 60 * 60 * 1000);

    // Get tweets posted in last 7 days that haven't been polled in 6 hours
    const needUpdate = Object.entries(metricsData.tweets || {})
      .filter(([id, data]) => {
        const age = now - data.timestamp;
        const lastPoll = data.lastPolledAt || 0;
        const timeSinceLastPoll = now - lastPoll;

        return age < 7 * 24 * 60 * 60 * 1000 && // Posted in last 7 days
               timeSinceLastPoll > sixHoursAgo; // Not polled in 6 hours
      })
      .map(([id]) => id);

    return needUpdate;
  } catch (error) {
    return [];
  }
}

/**
 * Background polling job (call this from scheduler)
 */
export async function startMetricsPolling() {
  console.log('[Metrics] Starting background polling...');

  const pollOnce = async () => {
    const tweetsToUpdate = await getRecentTweetsNeedingUpdate();

    if (tweetsToUpdate.length > 0) {
      console.log(`[Metrics] Polling ${tweetsToUpdate.length} tweets...`);
      await pollMultipleTweets(tweetsToUpdate);
    }
  };

  // Poll immediately
  await pollOnce();

  // Then poll every 6 hours
  setInterval(pollOnce, POLL_INTERVAL);
}

/**
 * Save metrics to database
 */
async function saveMetrics(metrics) {
  const data = await loadMetricsData();

  if (!data.tweets) data.tweets = {};

  data.tweets[metrics.tweetId] = {
    ...metrics,
    lastPolledAt: Date.now()
  };

  // Keep only last 1000 tweets
  const tweets = Object.entries(data.tweets)
    .sort((a, b) => b[1].timestamp - a[1].timestamp)
    .slice(0, 1000);

  data.tweets = Object.fromEntries(tweets);

  await fs.writeFile(METRICS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Load metrics data
 */
async function loadMetricsData() {
  try {
    const content = await fs.readFile(METRICS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { tweets: {}, averages: {} };
  }
}

/**
 * Get metrics for a specific tweet
 */
export async function getMetrics(tweetId) {
  const data = await loadMetricsData();
  return data.tweets?.[tweetId] || null;
}

/**
 * Get average metrics (for comparison)
 */
export async function getAverageMetrics() {
  const data = await loadMetricsData();
  const tweets = Object.values(data.tweets || {});

  if (tweets.length === 0) {
    return {
      avgLikes: 0,
      avgRetweets: 0,
      avgReplies: 0,
      avgEngagement: 0,
      avgEngagementRate: 0
    };
  }

  const sum = tweets.reduce((acc, t) => ({
    likes: acc.likes + t.metrics.likes,
    retweets: acc.retweets + t.metrics.retweets,
    replies: acc.replies + t.metrics.replies,
    engagement: acc.engagement + t.calculated.totalEngagement,
    engagementRate: acc.engagementRate + t.calculated.engagementRate
  }), { likes: 0, retweets: 0, replies: 0, engagement: 0, engagementRate: 0 });

  return {
    avgLikes: sum.likes / tweets.length,
    avgRetweets: sum.retweets / tweets.length,
    avgReplies: sum.replies / tweets.length,
    avgEngagement: sum.engagement / tweets.length,
    avgEngagementRate: sum.engagementRate / tweets.length,
    sampleSize: tweets.length
  };
}

/**
 * Track tweet when posted
 */
export async function trackNewTweet(tweetId, content, metadata = {}) {
  const data = await loadMetricsData();

  if (!data.tweets) data.tweets = {};

  data.tweets[tweetId] = {
    tweetId,
    content,
    metadata,
    timestamp: Date.now(),
    metrics: null, // Will be filled on first poll
    lastPolledAt: null
  };

  await fs.writeFile(METRICS_FILE, JSON.stringify(data, null, 2));

  console.log(`[Metrics] Tracking new tweet: ${tweetId}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  pollTweetMetrics,
  pollMultipleTweets,
  startMetricsPolling,
  getMetrics,
  getAverageMetrics,
  trackNewTweet
};
