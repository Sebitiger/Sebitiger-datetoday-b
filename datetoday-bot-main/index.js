import cron from "node-cron";
import dotenv from "dotenv";
import { generateVerifiedTweet, generateVerifiedThread } from "./verification/verifiedGenerator.js";
import { getRandomEvent } from "./fetchEvents.js";
import { client as twitterClient } from "./twitterClient.js";
import { info, error, warn } from "./logger.js";
import { runHealthChecks } from "./health.js";
import { cleanOldLogs } from "./logger.js";
import { getQueueStats } from "./verification/reviewQueue.js";

dotenv.config();

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

// Ensure required credentials exist
["API_KEY", "API_SECRET", "ACCESS_TOKEN", "ACCESS_SECRET", "OPENAI_KEY"].forEach(requireEnv);

info("[DateToday] 🚀 Bot starting with FULL VERIFICATION");
info("[DateToday] ✅ All posts fact-checked before posting");
info("[DateToday] 📊 Optimized schedule: 6 posts/day for max engagement");

// Enhanced global error logging
process.on("unhandledRejection", (reason) => {
  error("[UnhandledRejection]", { reason: reason?.message || reason });
});

process.on("uncaughtException", (err) => {
  error("[UncaughtException]", { error: err.message, stack: err.stack });
  process.exit(1);
});

// Run initial health check
runHealthChecks().catch(err => {
  warn("Initial health check failed", { error: err.message });
});

// Clean old logs daily
cron.schedule("0 2 * * *", async () => {
  await cleanOldLogs();
}, { timezone: "UTC" });

// Run health checks every hour
cron.schedule("0 * * * *", async () => {
  await runHealthChecks();
}, { timezone: "UTC" });

// VERIFIED POSTING FUNCTION
async function postVerifiedTweet(jobName, contentType = "single") {
  console.log(`[Verified] 🎯 Starting ${jobName}...`);
  
  try {
    const event = await getRandomEvent();
    
    // Generate with verification
    const result = contentType === "thread" 
      ? await generateVerifiedThread(event, {
          targetConfidence: 95,
          minConfidence: 90,
          maxAttempts: 3,
          queueMedium: true
        })
      : await generateVerifiedTweet(event, {
          targetConfidence: 95,
          minConfidence: 90,
          maxAttempts: 3,
          queueMedium: true
        });
    
    if (result.status === 'APPROVED') {
      // HIGH CONFIDENCE - Post it!
      info(`[Verified] ✅ ${jobName} APPROVED (${result.verification.confidence}% confidence)`);
      
      if (contentType === "thread") {
        // Post as thread
        const tweets = result.content.split('\n\n').filter(t => t.trim());
        let previousTweetId = null;
        
        for (const tweet of tweets) {
          const tweetText = tweet.replace(/^\d+\.\s*/, ''); // Remove numbering
          const tweetResponse = await twitterClient.v2.tweet({
            text: tweetText,
            reply: previousTweetId ? { in_reply_to_tweet_id: previousTweetId } : undefined
          });
          previousTweetId = tweetResponse.data.id;
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between tweets
        }
        
        info(`[Verified] 📱 Posted verified thread with ${tweets.length} tweets`);
      } else {
        // Post single tweet
        const tweetResponse = await twitterClient.v2.tweet(result.content);
        info(`[Verified] 📱 Posted verified tweet: ${tweetResponse.data.id}`);
      }
      
      return true;
    } else if (result.status === 'QUEUED') {
      // MEDIUM CONFIDENCE - Queued for review
      warn(`[Verified] ⚠️  ${jobName} QUEUED (${result.verification.confidence}% confidence)`);
      warn(`[Verified] 📝 Queue ID: ${result.queueId}`);
      warn(`[Verified] 👉 Review: node verification/reviewCLI.js show ${result.queueId}`);
      
      return false;
    } else {
      // REJECTED
      error(`[Verified] ❌ ${jobName} REJECTED (${result.verification.confidence}% confidence)`);
      if (result.verification.concerns) {
        error(`[Verified] ⚠️  Concerns: ${result.verification.concerns.join(', ')}`);
      }
      
      return false;
    }
  } catch (err) {
    error(`[Verified] 💥 ${jobName} failed:`, err.message || err);
    return false;
  }
}

// Display queue stats at startup
(async () => {
  try {
    const stats = await getQueueStats();
    info(`[Verification] 📊 Queue: ${stats.pending} pending | ${stats.approved} approved | ${stats.rejected} rejected`);
  } catch (err) {
    warn("[Verification] Could not load queue stats:", err.message);
  }
})();

// ============================================================
// OPTIMIZED POSTING SCHEDULE (6 posts/day for max engagement)
// ============================================================

// 09:00 UTC - Main daily tweet (VERIFIED)
cron.schedule("0 9 * * *", async () => {
  info("[Schedule] 🌅 09:00 UTC - Daily Main Tweet");
  await postVerifiedTweet("Daily Main Tweet");
}, { timezone: "UTC" });

// 12:00 UTC - Mid-day fact (VERIFIED)
cron.schedule("0 12 * * *", async () => {
  info("[Schedule] ☀️  12:00 UTC - Mid-day Fact");
  await postVerifiedTweet("Mid-day Fact");
}, { timezone: "UTC" });

// 15:00 UTC - Afternoon fact (VERIFIED)
cron.schedule("0 15 * * *", async () => {
  info("[Schedule] 🌤  15:00 UTC - Afternoon Fact");
  await postVerifiedTweet("Afternoon Fact");
}, { timezone: "UTC" });

// 18:00 UTC - Evening fact (VERIFIED)
cron.schedule("0 18 * * *", async () => {
  info("[Schedule] 🌆 18:00 UTC - Evening Fact");
  await postVerifiedTweet("Evening Fact");
}, { timezone: "UTC" });

// 21:00 UTC - Night fact (VERIFIED)
cron.schedule("0 21 * * *", async () => {
  info("[Schedule] 🌙 21:00 UTC - Night Fact");
  await postVerifiedTweet("Night Fact");
}, { timezone: "UTC" });

// Sunday 16:00 UTC - Weekly deep dive thread (VERIFIED)
cron.schedule("0 16 * * 0", async () => {
  info("[Schedule] 📚 Sunday 16:00 UTC - Weekly Deep Dive Thread");
  await postVerifiedTweet("Weekly Deep Dive Thread", "thread");
}, { timezone: "UTC" });

// ============================================================
// SPECIAL CONTENT (Replaces regular posts on specific days)
// ============================================================

// Monday 15:00 UTC - Myth-Busting Monday (replaces afternoon fact)
cron.schedule("0 15 * * 1", async () => {
  info("[Schedule] 🔍 Monday 15:00 UTC - Myth-Busting Monday");
  await postVerifiedTweet("Myth-Busting Monday");
}, { timezone: "UTC" });

// Wednesday 12:00 UTC - Pattern Recognition (replaces mid-day fact)
cron.schedule("0 12 * * 3", async () => {
  info("[Schedule] 🔄 Wednesday 12:00 UTC - Pattern Recognition");
  await postVerifiedTweet("Pattern Recognition Wednesday");
}, { timezone: "UTC" });

// Friday 15:00 UTC - Timeline Twist (replaces afternoon fact)
cron.schedule("0 15 * * 5", async () => {
  info("[Schedule] ⏰ Friday 15:00 UTC - Timeline Twist");
  await postVerifiedTweet("Timeline Twist Friday");
}, { timezone: "UTC" });

// ============================================================
// MONITORING & MAINTENANCE
// ============================================================

// Daily queue stats report (06:00 UTC)
cron.schedule("0 6 * * *", async () => {
  try {
    const stats = await getQueueStats();
    info(`[Verification] 📊 Daily Report: ${stats.pending} pending | ${stats.approved} approved | ${stats.posted} posted | ${stats.rejected} rejected`);
    
    if (stats.pending > 10) {
      warn(`[Verification] ⚠️  Queue has ${stats.pending} items - review soon!`);
      warn(`[Verification] 👉 Command: node verification/reviewCLI.js list`);
    }
  } catch (err) {
    error("[Verification] Stats report failed:", err.message);
  }
}, { timezone: "UTC" });

info("[DateToday] ✅ Verified schedules registered!");
info("[DateToday] 📅 Daily posts: 09:00, 12:00, 15:00, 18:00, 21:00 UTC");
info("[DateToday] 🎯 Sunday: Deep dive thread at 16:00 UTC");
info("[DateToday] 🔍 Special: Mon/Wed/Fri themed posts");
info("[DateToday] 📊 All posts fact-checked (90%+ auto-posts)");
info("[DateToday] ⚠️  Medium confidence (70-89%) queued for review");
info("[DateToday] 👉 Review queue: node verification/reviewCLI.js list");
