import cron from "node-cron";
import dotenv from "dotenv";
import { generateVerifiedTweet, generateVerifiedThread } from "./verification/verifiedGenerator.js";
import { getRandomEvent } from "./fetchEvents.js";
import { twitterClient } from "./twitterClient.js";
import { monitorMentions } from "./engagement.js";
import { monitorBigAccounts } from "./bigAccountReplies.js";
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

info("[DateToday] Bot starting with FULL VERIFICATION enabled...");
info("[DateToday] All posts will be fact-checked before posting!");

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
  console.log(`[Verified] Starting ${jobName}...`);
  
  try {
    const event = await getRandomEvent();
    
    // Generate with verification
    const result = contentType === "thread" 
      ? await generateVerifiedThread(event, {
          minConfidence: 90,
          maxRetries: 3,
          queueMedium: true
        })
      : await generateVerifiedTweet(event, {
          minConfidence: 90,
          maxRetries: 3,
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
        
        info(`[Verified] Posted verified thread with ${tweets.length} tweets`);
      } else {
        // Post single tweet
        const tweetResponse = await twitterClient.v2.tweet(result.content);
        info(`[Verified] Posted verified tweet: ${tweetResponse.data.id}`);
      }
      
      return true;
    } else if (result.status === 'QUEUED') {
      // MEDIUM CONFIDENCE - Queued for review
      warn(`[Verified] ⚠️ ${jobName} QUEUED (${result.verification.confidence}% confidence)`);
      warn(`[Verified] Queue ID: ${result.queueId}`);
      warn(`[Verified] Review with: node verification/reviewCLI.js show ${result.queueId}`);
      
      return false;
    } else {
      // REJECTED
      error(`[Verified] ❌ ${jobName} REJECTED (${result.verification.confidence}% confidence)`);
      if (result.verification.concerns) {
        error(`[Verified] Concerns: ${result.verification.concerns.join(', ')}`);
      }
      
      return false;
    }
  } catch (err) {
    error(`[Verified] ${jobName} failed:`, err.message || err);
    return false;
  }
}

// Display queue stats at startup
(async () => {
  try {
    const stats = await getQueueStats();
    info(`[Verification] Queue Stats: ${stats.pending} pending, ${stats.approved} approved, ${stats.rejected} rejected`);
  } catch (err) {
    warn("[Verification] Could not load queue stats:", err.message);
  }
})();

// ============================================================
// VERIFIED POSTING SCHEDULES
// ============================================================

// 09:00 UTC - Main daily tweet (VERIFIED)
cron.schedule("0 9 * * *", async () => {
  await postVerifiedTweet("Daily Main Tweet (09:00 UTC)");
}, { timezone: "UTC" });

// 10:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 10 * * *", async () => {
  await postVerifiedTweet("Quick Fact (10:00 UTC)");
}, { timezone: "UTC" });

// 11:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 11 * * *", async () => {
  await postVerifiedTweet("Quick Fact (11:00 UTC)");
}, { timezone: "UTC" });

// 13:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 13 * * *", async () => {
  await postVerifiedTweet("Quick Fact (13:00 UTC)");
}, { timezone: "UTC" });

// 15:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 15 * * *", async () => {
  await postVerifiedTweet("Quick Fact (15:00 UTC)");
}, { timezone: "UTC" });

// 16:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 16 * * *", async () => {
  await postVerifiedTweet("Quick Fact (16:00 UTC)");
}, { timezone: "UTC" });

// 17:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 17 * * *", async () => {
  await postVerifiedTweet("Quick Fact (17:00 UTC)");
}, { timezone: "UTC" });

// 18:00 UTC - Evening fact (VERIFIED)
cron.schedule("0 18 * * *", async () => {
  await postVerifiedTweet("Evening Fact (18:00 UTC)");
}, { timezone: "UTC" });

// 19:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 19 * * *", async () => {
  await postVerifiedTweet("Quick Fact (19:00 UTC)");
}, { timezone: "UTC" });

// 20:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 20 * * *", async () => {
  await postVerifiedTweet("Quick Fact (20:00 UTC)");
}, { timezone: "UTC" });

// Sunday 16:00 UTC - Weekly thread (VERIFIED)
cron.schedule("0 16 * * 0", async () => {
  await postVerifiedTweet("Weekly Deep Dive Thread (Sunday 16:00 UTC)", "thread");
}, { timezone: "UTC" });

// Tuesday & Thursday 14:00 UTC - Interactive content (VERIFIED)
cron.schedule("0 14 * * 2,4", async () => {
  await postVerifiedTweet("Interactive Post (Tuesday/Thursday 14:00 UTC)");
}, { timezone: "UTC" });

// Wednesday 12:00 UTC - "What If" content (VERIFIED)
cron.schedule("0 12 * * 3", async () => {
  await postVerifiedTweet("What If Wednesday (12:00 UTC)", "thread");
}, { timezone: "UTC" });

// Friday 15:00 UTC - Hidden Connections (VERIFIED)
cron.schedule("0 15 * * 5", async () => {
  await postVerifiedTweet("Hidden Connection Friday (15:00 UTC)");
}, { timezone: "UTC" });

// Monday 12:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 12 * * 1", async () => {
  await postVerifiedTweet("Monday Quick Fact (12:00 UTC)");
}, { timezone: "UTC" });

// Monday 15:00 UTC - History Debunk (VERIFIED)
cron.schedule("0 15 * * 1", async () => {
  await postVerifiedTweet("History Debunk Monday (15:00 UTC)");
}, { timezone: "UTC" });

// Tuesday 12:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 12 * * 2", async () => {
  await postVerifiedTweet("Tuesday Quick Fact (12:00 UTC)");
}, { timezone: "UTC" });

// Thursday 12:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 12 * * 4", async () => {
  await postVerifiedTweet("Thursday Quick Fact (12:00 UTC)");
}, { timezone: "UTC" });

// Friday 12:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 12 * * 5", async () => {
  await postVerifiedTweet("Friday Quick Fact (12:00 UTC)");
}, { timezone: "UTC" });

// Saturday 12:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 12 * * 6", async () => {
  await postVerifiedTweet("Saturday Quick Fact (12:00 UTC)");
}, { timezone: "UTC" });

// Sunday 12:00 UTC - Quick Fact (VERIFIED)
cron.schedule("0 12 * * 0", async () => {
  await postVerifiedTweet("Sunday Quick Fact (12:00 UTC)");
}, { timezone: "UTC" });

// ============================================================
// ENGAGEMENT & MONITORING (No verification needed)
// ============================================================

// Every 15 minutes - check for mentions and engage
cron.schedule("*/15 * * * *", async () => {
  console.log("[Cron] Checking for mentions...");
  try {
    await monitorMentions();
  } catch (err) {
    console.error("[Cron] Mention monitoring failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Every 2 hours - monitor big history accounts and reply strategically
cron.schedule("0 */2 * * *", async () => {
  console.log("[Cron] Monitoring big history accounts...");
  try {
    await monitorBigAccounts();
  } catch (err) {
    console.error("[Cron] Big account monitoring failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Daily queue stats report (06:00 UTC)
cron.schedule("0 6 * * *", async () => {
  console.log("[Verification] Daily queue stats report...");
  try {
    const stats = await getQueueStats();
    info(`[Verification] Daily Stats: ${stats.pending} pending, ${stats.approved} approved, ${stats.posted} posted, ${stats.rejected} rejected`);
    
    if (stats.pending > 10) {
      warn(`[Verification] ⚠️ Queue has ${stats.pending} items pending review!`);
      warn(`[Verification] Review with: node verification/reviewCLI.js list`);
    }
  } catch (err) {
    error("[Verification] Stats report failed:", err.message);
  }
}, { timezone: "UTC" });

info("[DateToday] ✅ VERIFIED schedules registered!");
info("[DateToday] All posts will be fact-checked (90%+ confidence auto-posts)");
info("[DateToday] Medium confidence (70-89%) goes to review queue");
info("[DateToday] Check queue with: node verification/reviewCLI.js list");
info("[DateToday] Engagement system active - monitoring mentions every 15 minutes");
info("[DateToday] Big account monitoring active - checking every 2 hours");
info("[DateToday] Health monitoring active - checks every hour");
info("[DateToday] Daily queue stats report at 06:00 UTC");
