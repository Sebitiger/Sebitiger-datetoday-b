/**
 * MASTER GROWTH ENGINE
 *
 * Integrates all growth systems into a unified engine
 * Call this from your main scheduler to activate growth features
 */

import { startMetricsPolling, trackNewTweet } from './realtimeMetrics.js';
import { identifyViralPosts, generateViralVariations } from './viralDetector.js';
import { trackUser, getCommunityStats, getNextSuperfanReward } from './communityManager.js';
import { startTrendingScanner, getNextTrendingContent } from './trendingInjector.js';
import { getActiveThreads, postNextThreadPart } from './threadManager.js';
import { createABTest, getRecommendedStyle } from './abTesting.js';
import { runReplyCampaign } from './replyStrategy.js';
import { remixTopContent } from './contentRemixer.js';
import { getOptimalPostTime, recordPostTime } from './predictiveScheduler.js';

/**
 * Initialize all growth systems
 */
export async function initializeGrowthEngine() {
  console.log('\n🚀 INITIALIZING GROWTH ENGINE...\n');

  // Ensure data files exist
  await ensureDataFilesExist();

  // Start background jobs
  await startMetricsPolling();      // Poll engagement every 6 hours
  // DISABLED: Trending scanner conflicts with reference account positioning
  // await startTrendingScanner();     // Scan for trending topics every 2 hours

  // Run initial analysis
  await identifyViralPosts();       // Identify what's working
  await remixTopContent();           // Remix top content

  // Show stats
  const communityStats = await getCommunityStats();
  console.log('📊 COMMUNITY STATS:');
  console.log(`   Superfans: ${communityStats.superfans}`);
  console.log(`   Engaged: ${communityStats.engaged}`);
  console.log(`   Active: ${communityStats.active}`);
  console.log(`   Total: ${communityStats.totalUsers}`);

  console.log('\n✅ Growth engine initialized!\n');
}

/**
 * Ensure all required data files exist with proper structure
 */
async function ensureDataFilesExist() {
  const fs = await import('fs/promises');
  const path = await import('path');

  const dataDir = path.join(process.cwd(), 'data');

  // Required data files with their default structures
  const requiredFiles = {
    'engagement-metrics.json': { tweets: {}, averages: {} },
    'viral-patterns.json': { patterns: [] },
    'community-data.json': { users: {} },
    'ab-tests.json': { tests: [], results: [] }
  };

  for (const [filename, defaultContent] of Object.entries(requiredFiles)) {
    const filePath = path.join(dataDir, filename);
    try {
      await fs.access(filePath);
    } catch (error) {
      // File doesn't exist, create it
      console.log(`[Growth] Initializing ${filename}...`);
      await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
    }
  }
}

/**
 * Get next optimized post (considering all systems)
 */
export async function getNextOptimizedPost(event, options = {}) {
  const recommendations = {
    useTrending: false,
    useSuperfanReward: false,
    useThreadContinuation: false,
    useABTest: false,
    optimalTime: null,
    recommendedStyle: null
  };

  // 1. DISABLED: Trending conflicts with reference account positioning
  // Reference accounts should post timeless content, not chase trending topics
  // const trending = await getNextTrendingContent();
  // if (trending && !trending.posted) {
  //   console.log('🔥 [Growth] Trending opportunity available!');
  //   recommendations.useTrending = true;
  //   recommendations.trendingContent = trending;
  //   return recommendations;
  // }

  // 2. Check for superfan reward
  const reward = await getNextSuperfanReward();
  if (reward) {
    console.log('🎉 [Growth] Superfan reward available!');
    recommendations.useSuperfanReward = true;
    recommendations.rewardContent = reward;
    return recommendations;
  }

  // 3. Check for active threads to continue
  const activeThreads = await getActiveThreads();
  if (activeThreads.length > 0) {
    console.log('🧵 [Growth] Active thread continuation available');
    recommendations.useThreadContinuation = true;
    recommendations.thread = activeThreads[0];
  }

  // 4. Get optimal posting time
  const optimalTime = await getOptimalPostTime(event.category || 'general');
  recommendations.optimalTime = optimalTime;

  // 5. Get recommended style from A/B test winners
  const recommendedStyle = await getRecommendedStyle();
  recommendations.recommendedStyle = recommendedStyle;

  // 6. Decide if we should A/B test this post
  const shouldABTest = Math.random() < 0.2; // 20% of posts
  if (shouldABTest) {
    console.log('🧪 [Growth] A/B test recommended');
    recommendations.useABTest = true;
  }

  return recommendations;
}

/**
 * Post with growth optimization
 */
export async function postWithGrowthOptimization(content, metadata, twitterClient) {
  console.log('[Growth] Posting with optimization...');

  // Track post
  const response = await twitterClient.v2.tweet({ text: content });
  const tweetId = response.data.id;

  // Track in metrics system
  await trackNewTweet(tweetId, content, metadata);

  // Record timing for learning
  const hour = new Date().getUTCHours();
  await recordPostTime(hour, metadata.category || 'general', 0); // Engagement added later

  console.log(`[Growth] ✅ Posted with tracking: ${tweetId}`);

  return tweetId;
}

/**
 * Track interaction for community building
 */
export async function trackInteraction(username, type, postId, content = null) {
  await trackUser(username, {
    type,
    postId,
    topic: extractTopic(content),
    content,
    timestamp: Date.now()
  });
}

/**
 * Run daily growth tasks
 */
export async function runDailyGrowthTasks() {
  console.log('\n📈 RUNNING DAILY GROWTH TASKS...\n');

  // 1. Identify viral posts
  const viralPosts = await identifyViralPosts();
  console.log(`   Found ${viralPosts.length} viral posts`);

  // 2. Run reply campaign
  const repliesPosted = await runReplyCampaign(5);
  console.log(`   Posted ${repliesPosted} strategic replies`);

  // 3. Remix top content
  await remixTopContent();
  console.log('   ✅ Remixed top content');

  // 4. Community stats
  const stats = await getCommunityStats();
  console.log(`   📊 Community: ${stats.superfans} superfans, ${stats.engaged} engaged`);

  console.log('\n✅ Daily tasks complete!\n');
}

/**
 * Get growth dashboard
 */
export async function getGrowthDashboard() {
  const communityStats = await getCommunityStats();
  const viralPosts = await identifyViralPosts();
  const activeThreads = await getActiveThreads();

  return {
    community: communityStats,
    viralPostsToday: viralPosts.length,
    activeThreads: activeThreads.length,
    trending: {
      opportunities: 0 // Would check trending queue
    },
    timestamp: Date.now()
  };
}

// Helper function
function extractTopic(content) {
  if (!content) return null;

  // Simple topic extraction - look for key historical terms
  const topics = {
    'war': /\b(war|battle|military|conflict)\b/i,
    'science': /\b(discovered|invention|theory|science)\b/i,
    'culture': /\b(art|music|literature|culture)\b/i,
    'politics': /\b(king|queen|president|government)\b/i,
    'ancient': /\b(ancient|egypt|rome|greece)\b/i
  };

  for (const [topic, regex] of Object.entries(topics)) {
    if (regex.test(content)) {
      return topic;
    }
  }

  return 'general';
}

export default {
  initializeGrowthEngine,
  getNextOptimizedPost,
  postWithGrowthOptimization,
  trackInteraction,
  runDailyGrowthTasks,
  getGrowthDashboard
};
