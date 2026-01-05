/**
 * Run a single post if current time matches schedule
 * WITH VERIFIED IMAGES + GROWTH ENGINE
 */

import { generateVerifiedTweet, generateVerifiedThread } from "./verification/verifiedGenerator.js";
import { generateEnhancedTweet, generateEnhancedThread } from "./verification/enhancedContentGenerator.js";
import { fetchVerifiedImage } from "./verification/enhancedImageVerifier.js";
import { getRandomEvent } from "./fetchEvents.js";
import { client as twitterClient, postTweetWithImage } from "./twitterClient.js";
import { info, error, warn } from "./logger.js";
import { getQueueStats } from "./verification/reviewQueue.js";

// GROWTH ENGINE
import {
  initializeGrowthEngine,
  getNextOptimizedPost,
  trackInteraction
} from "./growth/growthEngine.js";
import { trackNewTweet } from "./growth/realtimeMetrics.js";
import { recordPostTime } from "./growth/predictiveScheduler.js";
import { getNextTrendingContent } from "./growth/trendingInjector.js";
import { getNextSuperfanReward } from "./growth/communityManager.js";
import { getActiveThreads, postNextThreadPart } from "./growth/threadManager.js";

// Check current UTC time
const now = new Date();
const currentHour = now.getUTCHours();
const currentMinute = now.getUTCMinutes();
const currentDay = now.getUTCDay();

// Check if this is a forced manual post
const forcePost = process.env.FORCE_POST === 'true';

if (forcePost) {
  console.log('[Scheduler] 🚀 MANUAL TRIGGER - Force posting immediately!');
} else {
  console.log(`[Scheduler] Current UTC time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
  console.log(`[Scheduler] Current day: ${currentDay} (0=Sun, 1=Mon, etc.)`);
}

// Check if we should post for this hour
// Accept posts if we're within the hour window (00-59 minutes)
const scheduledHours = [9, 12, 15, 18, 21];
const shouldPost = scheduledHours.includes(currentHour);
const isSundayThreadTime = currentDay === 0 && currentHour === 16;

if (!shouldPost && !isSundayThreadTime) {
  console.log(`[Scheduler] ⏸️  No post scheduled for ${currentHour}:00 UTC`);
  console.log(`[Scheduler] Next posts: 09:00, 12:00, 15:00, 18:00, 21:00 UTC (and 16:00 Sunday)`);
}

// VERIFIED POSTING FUNCTION WITH IMAGES + GROWTH ENGINE
async function postVerifiedTweet(jobName, contentType = "single") {
  console.log(`[Verified] 🎯 Starting ${jobName}...`);

  try {
    const event = await getRandomEvent();

    // GROWTH ENGINE: Get optimized posting recommendations
    console.log('[Growth] 🚀 Checking for priority content...');
    const recommendations = await getNextOptimizedPost(event);

    // PRIORITY 1: Trending opportunity (HIGHEST PRIORITY)
    if (recommendations.useTrending && recommendations.trendingContent) {
      console.log('🔥 [Growth] TRENDING OPPORTUNITY - Posting viral content!');
      const trendingTweet = recommendations.trendingContent.tweet;

      // Fetch image for trending content
      const imageBuffer = await fetchVerifiedImage(event, trendingTweet);

      let tweetResponse;
      if (imageBuffer) {
        const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
          mimeType: 'image/jpeg'
        });
        tweetResponse = await twitterClient.v2.tweet({
          text: trendingTweet,
          media: { media_ids: [mediaId] }
        });
      } else {
        tweetResponse = await twitterClient.v2.tweet({
          text: trendingTweet
        });
      }

      // Track post for metrics
      await trackNewTweet(tweetResponse.data.id, trendingTweet, {
        type: 'trending',
        event: recommendations.trendingContent.event,
        trend: recommendations.trendingContent.trendingTopic
      });

      info(`[Growth] 📱 Posted TRENDING tweet: ${tweetResponse.data.id}`);
      return true;
    }

    // PRIORITY 2: Superfan reward
    if (recommendations.useSuperfanReward && recommendations.rewardContent) {
      console.log('🎉 [Growth] SUPERFAN REWARD - Posting personalized content!');
      const rewardTweet = recommendations.rewardContent.tweet;

      const imageBuffer = await fetchVerifiedImage(event, rewardTweet);

      let tweetResponse;
      if (imageBuffer) {
        const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
          mimeType: 'image/jpeg'
        });
        tweetResponse = await twitterClient.v2.tweet({
          text: rewardTweet,
          media: { media_ids: [mediaId] }
        });
      } else {
        tweetResponse = await twitterClient.v2.tweet({
          text: rewardTweet
        });
      }

      await trackNewTweet(tweetResponse.data.id, rewardTweet, {
        type: 'superfan-reward',
        user: recommendations.rewardContent.user
      });

      info(`[Growth] 📱 Posted SUPERFAN REWARD: ${tweetResponse.data.id}`);
      return true;
    }

    // PRIORITY 3: Thread continuation
    if (recommendations.useThreadContinuation && recommendations.thread) {
      console.log('🧵 [Growth] THREAD CONTINUATION - Posting next thread part!');
      const posted = await postNextThreadPart(recommendations.thread.id, twitterClient);

      if (posted) {
        info(`[Growth] 📱 Posted THREAD PART: ${recommendations.thread.id}`);
        return true;
      }
    }

    // NORMAL POST: Use ENHANCED generator with recommended style
    console.log(`[Growth] 📝 Normal post with recommended style: ${recommendations.recommendedStyle || 'default'}`);

    const result = contentType === "thread"
      ? await generateEnhancedThread(event, {
          targetConfidence: 90,
          minConfidence: 85,
          minEngagement: 75,
          maxAttempts: 3,
          queueMedium: true,
          style: recommendations.recommendedStyle // GROWTH ENGINE STYLE
        })
      : await generateEnhancedTweet(event, {
          targetConfidence: 90,
          minConfidence: 85,
          minEngagement: 75,
          maxAttempts: 3,
          queueMedium: true,
          style: recommendations.recommendedStyle // GROWTH ENGINE STYLE
        });
    
    if (result.status === 'APPROVED') {
      const engagementInfo = result.engagement
        ? ` | Engagement: ${result.engagement.total}/100 (${result.engagement.strongPoint})`
        : '';
      info(`[Verified] ✅ ${jobName} APPROVED (${result.verification.confidence}% confidence${engagementInfo})`);
      
      // Fetch and verify image (STRICT mode - only APPROVED 85%+)
      console.log('[Verified] 🖼️  Fetching verified image...');
      const imageBuffer = await fetchVerifiedImage(event, result.content);
      
      if (imageBuffer) {
        console.log('[Verified] ✅ Image verified and approved');
      } else {
        console.log('[Verified] ⚠️  No verified image - posting text-only');
      }
      
      if (contentType === "thread") {
        const tweets = result.content.split('\n\n').filter(t => t.trim());
        let previousTweetId = null;
        let firstTweetId = null;

        for (let i = 0; i < tweets.length; i++) {
          const tweet = tweets[i];
          const tweetText = tweet.replace(/^\d+\.\s*/, '');

          // Only add image to first tweet if we have one
          if (i === 0 && imageBuffer) {
            const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
              mimeType: 'image/jpeg'
            });
            const tweetResponse = await twitterClient.v2.tweet({
              text: tweetText,
              media: { media_ids: [mediaId] }
            });
            previousTweetId = tweetResponse.data.id;
            firstTweetId = tweetResponse.data.id;
          } else {
            const tweetResponse = await twitterClient.v2.tweet({
              text: tweetText,
              reply: previousTweetId ? { in_reply_to_tweet_id: previousTweetId } : undefined
            });
            previousTweetId = tweetResponse.data.id;
            if (i === 0) firstTweetId = tweetResponse.data.id;
          }

          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // GROWTH ENGINE: Track thread post
        await trackNewTweet(firstTweetId, result.content, {
          type: 'thread',
          category: event.category || 'general',
          event: event.description,
          style: recommendations.recommendedStyle
        });

        // Record posting time for learning
        const hour = now.getUTCHours();
        await recordPostTime(hour, event.category || 'general', 0); // Engagement added later by metrics polling

        info(`[Verified] 📱 Posted verified thread with ${tweets.length} tweets`);
      } else {
        // Single tweet with image
        let tweetResponse;

        if (imageBuffer) {
          // Upload image first with proper type
          const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, {
            mimeType: 'image/jpeg'
          });

          // Post with image
          tweetResponse = await twitterClient.v2.tweet({
            text: result.content,
            media: { media_ids: [mediaId] }
          });

          info(`[Verified] 📱 Posted verified tweet WITH IMAGE: ${tweetResponse.data.id}`);
        } else {
          // Post text-only
          tweetResponse = await twitterClient.v2.tweet({
            text: result.content
          });

          info(`[Verified] 📱 Posted verified tweet (text-only): ${tweetResponse.data.id}`);
        }

        // GROWTH ENGINE: Track post for metrics
        await trackNewTweet(tweetResponse.data.id, result.content, {
          type: contentType,
          category: event.category || 'general',
          event: event.description,
          style: recommendations.recommendedStyle,
          hasImage: !!imageBuffer
        });

        // Record posting time for learning
        const hour = now.getUTCHours();
        await recordPostTime(hour, event.category || 'general', 0); // Engagement added later by metrics polling
      }
      
      return true;
    } else if (result.status === 'QUEUED') {
      warn(`[Verified] ⚠️  ${jobName} QUEUED (${result.verification.confidence}% confidence)`);
      warn(`[Verified] 📝 Queue ID: ${result.queueId}`);
      return false;
    } else {
      error(`[Verified] ❌ ${jobName} REJECTED (${result.verification.confidence}% confidence)`);
      return false;
    }
  } catch (err) {
    error(`[Verified] 💥 ${jobName} failed:`, err.message || err);
    return false;
  }
}

// Main execution
(async () => {
  try {
    info("[Scheduler] Checking if post is due...");

    // GROWTH ENGINE: Initialize on startup
    console.log('[Growth] 🚀 Initializing Growth Engine...');
    try {
      await initializeGrowthEngine();
      console.log('[Growth] ✅ Growth Engine initialized');
    } catch (err) {
      warn('[Growth] ⚠️  Growth Engine initialization failed (non-fatal):', err.message);
      // Continue even if growth engine fails - it's enhancement, not critical
    }

    const stats = await getQueueStats();
    info(`[Verification] 📊 Queue: ${stats.pending} pending`);

    // Early exit if not a posting hour (unless forced)
    if (!forcePost && !shouldPost && !isSundayThreadTime) {
      info(`[Scheduler] ⏸️  Not a posting hour - exiting`);
      process.exit(0);
    }
    
    let posted = false;
    
    // If forced, always post a test tweet
    if (forcePost) {
      info("[Scheduler] 🧪 MANUAL TEST POST - Posting now!");
      posted = await postVerifiedTweet("Manual Test Post");
    }
    // Post based on current hour
    else if (currentHour === 9) {
      info("[Scheduler] 🌅 09:00 UTC - Daily Main Tweet");
      posted = await postVerifiedTweet("Daily Main Tweet");
    } else if (currentHour === 12) {
      info("[Scheduler] ☀️  12:00 UTC - Mid-day Fact");
      posted = await postVerifiedTweet("Mid-day Fact");
    } else if (currentHour === 15) {
      info("[Scheduler] 🌤  15:00 UTC - Afternoon Fact");
      posted = await postVerifiedTweet("Afternoon Fact");
    } else if (currentHour === 18) {
      info("[Scheduler] 🌆 18:00 UTC - Evening Fact");
      posted = await postVerifiedTweet("Evening Fact");
    } else if (currentHour === 21) {
      info("[Scheduler] 🌙 21:00 UTC - Night Fact");
      posted = await postVerifiedTweet("Night Fact");
    } else if (isSundayThreadTime) {
      info("[Scheduler] 📚 Sunday 16:00 UTC - Weekly Thread");
      posted = await postVerifiedTweet("Weekly Deep Dive Thread", "thread");
    }
    
    if (posted) {
      info("[Scheduler] ✅ Post completed");
    } else {
      info("[Scheduler] ⚠️  Post was queued or rejected");
    }
    
    process.exit(0);
    
  } catch (err) {
    error("[Scheduler] 💥 Fatal error:", err);
    process.exit(1);
  }
})();
