/**
 * Run a single post if current time matches schedule
 * WITH VERIFIED IMAGES
 */

import { generateVerifiedTweet, generateVerifiedThread } from "./verification/verifiedGenerator.js";
import { fetchVerifiedImage } from "./verification/imageVerifier.js";
import { getRandomEvent } from "./fetchEvents.js";
import { client as twitterClient, postTweetWithImage } from "./twitterClient.js";
import { info, error, warn } from "./logger.js";
import { getQueueStats } from "./verification/reviewQueue.js";

// Check current UTC time
const now = new Date();
const currentHour = now.getUTCHours();
const currentDay = now.getUTCDay();

console.log(`[Scheduler] Current UTC time: ${currentHour}:00`);
console.log(`[Scheduler] Current day: ${currentDay} (0=Sun, 1=Mon, etc.)`);

// VERIFIED POSTING FUNCTION WITH IMAGES
async function postVerifiedTweet(jobName, contentType = "single") {
  console.log(`[Verified] 🎯 Starting ${jobName}...`);
  
  try {
    const event = await getRandomEvent();
    
    const result = contentType === "thread" 
      ? await generateVerifiedThread(event, {
          targetConfidence: 90,
          minConfidence: 85,
          maxAttempts: 3,
          queueMedium: true
        })
      : await generateVerifiedTweet(event, {
          targetConfidence: 90,
          minConfidence: 85,
          maxAttempts: 3,
          queueMedium: true
        });
    
    if (result.status === 'APPROVED') {
      info(`[Verified] ✅ ${jobName} APPROVED (${result.verification.confidence}% confidence)`);
      
      // Fetch and verify image
      console.log('[Verified] 🖼️  Fetching verified image...');
      const imageBuffer = await fetchVerifiedImage(event, result.content, 70);
      
      if (imageBuffer) {
        console.log('[Verified] ✅ Image verified and approved');
      } else {
        console.log('[Verified] ⚠️  No verified image - posting text-only');
      }
      
      if (contentType === "thread") {
        const tweets = result.content.split('\n\n').filter(t => t.trim());
        let previousTweetId = null;
        
        for (let i = 0; i < tweets.length; i++) {
          const tweet = tweets[i];
          const tweetText = tweet.replace(/^\d+\.\s*/, '');
          
          // Only add image to first tweet if we have one
          if (i === 0 && imageBuffer) {
            const tweetResponse = await twitterClient.v2.tweet({
              text: tweetText,
              media: { 
                media_ids: [await twitterClient.v1.uploadMedia(imageBuffer)] 
              }
            });
            previousTweetId = tweetResponse.data.id;
          } else {
            const tweetResponse = await twitterClient.v2.tweet({
              text: tweetText,
              reply: previousTweetId ? { in_reply_to_tweet_id: previousTweetId } : undefined
            });
            previousTweetId = tweetResponse.data.id;
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        info(`[Verified] 📱 Posted verified thread with ${tweets.length} tweets`);
      } else {
        // Single tweet with image
        if (imageBuffer) {
          // Upload image first
          const mediaId = await twitterClient.v1.uploadMedia(imageBuffer);
          
          // Post with image
          const tweetResponse = await twitterClient.v2.tweet({
            text: result.content,
            media: { media_ids: [mediaId] }
          });
          
          info(`[Verified] 📱 Posted verified tweet WITH IMAGE: ${tweetResponse.data.id}`);
        } else {
          // Post text-only
          const tweetResponse = await twitterClient.v2.tweet({ 
            text: result.content 
          });
          
          info(`[Verified] 📱 Posted verified tweet (text-only): ${tweetResponse.data.id}`);
        }
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
    
    const stats = await getQueueStats();
    info(`[Verification] 📊 Queue: ${stats.pending} pending`);
    
    let posted = false;
    
    switch (currentHour) {
      case 9:
        info("[Scheduler] 🌅 09:00 UTC - Daily Main Tweet");
        posted = await postVerifiedTweet("Daily Main Tweet");
        break;
      case 12:
        info("[Scheduler] ☀️  12:00 UTC - Mid-day Fact");
        posted = await postVerifiedTweet("Mid-day Fact");
        break;
      case 15:
        info("[Scheduler] 🌤  15:00 UTC - Afternoon Fact");
        posted = await postVerifiedTweet("Afternoon Fact");
        break;
      case 18:
        info("[Scheduler] 🌆 18:00 UTC - Evening Fact");
        posted = await postVerifiedTweet("Evening Fact");
        break;
      case 21:
        info("[Scheduler] 🌙 21:00 UTC - Night Fact");
        posted = await postVerifiedTweet("Night Fact");
        break;
      case 16:
        if (currentDay === 0) { // Sunday
          info("[Scheduler] 📚 Sunday 16:00 UTC - Weekly Thread");
          posted = await postVerifiedTweet("Weekly Deep Dive Thread", "thread");
        }
        break;
      default:
        info(`[Scheduler] ⏸️  No post scheduled for ${currentHour}:00 UTC`);
    }
    
    if (posted) {
      info("[Scheduler] ✅ Post completed");
    }
    
    process.exit(0);
    
  } catch (err) {
    error("[Scheduler] 💥 Fatal error:", err);
    process.exit(1);
  }
})();
