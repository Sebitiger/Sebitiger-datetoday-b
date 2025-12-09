// bigAccountReplies.js
// Monitors big history accounts and replies to their tweets for visibility

import { client } from "./twitterClient.js";
import { postTweet } from "./twitterClient.js";
import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const REPLIED_TWEETS_FILE = path.join(DATA_DIR, "replied-tweets.json");

/**
 * Load JSON file, return empty object if doesn't exist
 */
async function loadJSON(filePath) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

/**
 * Save JSON file
 */
async function saveJSON(filePath, data) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[BigAccounts] Error saving ${filePath}:`, err.message);
  }
}

// Big history accounts to monitor - researched and verified
// Format: { username: "handle", minFollowers: 50000, priority: 1-5 }
// Priority: 5 = highest (millions of followers), 1 = lowest (still significant)
const TARGET_ACCOUNTS = [
  // Tier 1: Massive accounts (millions of followers)
  { username: "HISTORY", minFollowers: 2000000, priority: 5 }, // Official History Channel
  { username: "SmithsonianMag", minFollowers: 1500000, priority: 5 }, // Smithsonian Magazine
  { username: "britishmuseum", minFollowers: 1000000, priority: 5 }, // British Museum
  { username: "HistoryInPics", minFollowers: 800000, priority: 5 }, // Historical photos (very popular)
  
  // Tier 2: Large accounts (500K+ followers)
  { username: "USNatArchives", minFollowers: 500000, priority: 4 }, // U.S. National Archives
  { username: "HistoryExtra", minFollowers: 400000, priority: 4 }, // BBC History Magazine
  { username: "HistoricalPics", minFollowers: 350000, priority: 4 }, // Historical photos
  { username: "HistoryChannel", minFollowers: 300000, priority: 4 }, // History Channel
  
  // Tier 3: Medium-large accounts (100K+ followers)
  { username: "HistoryToday", minFollowers: 200000, priority: 3 }, // History Today magazine
  { username: "OnThisDay", minFollowers: 150000, priority: 3 }, // Daily historical facts
  { username: "RealTimeWWII", minFollowers: 150000, priority: 3 }, // Real-time WWII updates
  { username: "HistoryHit", minFollowers: 120000, priority: 3 }, // History Hit network
  { username: "NatGeoHistory", minFollowers: 100000, priority: 3 }, // National Geographic History
  
  // Tier 4: Specialized but significant (50K+ followers)
  { username: "HistoryPhotographed", minFollowers: 80000, priority: 2 }, // Historical photos
  { username: "Medievalists", minFollowers: 70000, priority: 2 }, // Medieval history
  { username: "OnThisDayShe", minFollowers: 60000, priority: 2 }, // Women's history
  { username: "WWIIpix", minFollowers: 50000, priority: 2 }, // WWII photos
];

const OPENAI_TIMEOUT = 30000;
const MAX_REPLIES_PER_DAY = 10; // Don't spam - quality over quantity
const MAX_REPLIES_PER_ACCOUNT_PER_DAY = 2; // Max 2 replies per account per day
const MIN_TWEET_AGE_MINUTES = 5; // Wait 5 minutes after tweet is posted
const MAX_TWEET_AGE_HOURS = 6; // Only reply to tweets less than 6 hours old
const REPLY_DELAY_MS = 5000; // 5 seconds between replies

// Track replies
let replyCountToday = 0;
let lastResetTime = Date.now();
const accountReplyCounts = {}; // Track replies per account per day

/**
 * Load replied tweets from file
 */
async function loadRepliedTweets() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data = await fs.readFile(REPLIED_TWEETS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

/**
 * Save replied tweets to file
 */
async function saveRepliedTweets(data) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(REPLIED_TWEETS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[BigAccounts] Error saving replied tweets:", err.message);
  }
}

/**
 * Check if we've already replied to a tweet
 */
async function hasRepliedToTweet(tweetId) {
  const replied = await loadRepliedTweets();
  return replied[tweetId] === true;
}

/**
 * Mark tweet as replied to
 */
async function markTweetAsReplied(tweetId, accountUsername) {
  const replied = await loadRepliedTweets();
  replied[tweetId] = {
    replied: true,
    account: accountUsername,
    timestamp: new Date().toISOString(),
  };
  await saveRepliedTweets(replied);
}

/**
 * Reset daily counters
 */
function resetDailyCounters() {
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  if (now - lastResetTime > 24 * 60 * 60 * 1000) {
    replyCountToday = 0;
    lastResetTime = now;
    
    // Clean old account reply counts
    for (const username in accountReplyCounts) {
      if (accountReplyCounts[username].timestamp < oneDayAgo) {
        delete accountReplyCounts[username];
      }
    }
  }
}

/**
 * Check if we can reply (rate limiting)
 */
function canReply(accountUsername) {
  resetDailyCounters();
  
  if (replyCountToday >= MAX_REPLIES_PER_DAY) {
    return false;
  }
  
  const accountCount = accountReplyCounts[accountUsername];
  if (accountCount && accountCount.count >= MAX_REPLIES_PER_ACCOUNT_PER_DAY) {
    return false;
  }
  
  return true;
}

/**
 * Increment reply counter
 */
function incrementReplyCount(accountUsername) {
  replyCountToday++;
  
  if (!accountReplyCounts[accountUsername]) {
    accountReplyCounts[accountUsername] = { count: 0, timestamp: Date.now() };
  }
  accountReplyCounts[accountUsername].count++;
}

/**
 * Get user ID from username
 */
async function getUserId(username) {
  try {
    const user = await client.v2.userByUsername(username, {
      "user.fields": ["public_metrics"],
    });
    
    if (!user.data) {
      console.log(`[BigAccounts] User not found: @${username}`);
      return null;
    }
    
    const followers = user.data.public_metrics?.followers_count || 0;
    console.log(`[BigAccounts] @${username} has ${followers} followers`);
    
    return user.data.id;
  } catch (err) {
    console.error(`[BigAccounts] Error fetching user @${username}:`, err.message);
    return null;
  }
}

/**
 * Get recent tweets from a user
 */
async function getRecentTweets(userId, maxResults = 10) {
  try {
    const tweets = await client.v2.userTimeline(userId, {
      max_results: maxResults,
      "tweet.fields": ["created_at", "public_metrics", "text"],
      exclude: ["retweets", "replies"], // Only original tweets
    });
    
    return tweets.data?.data || [];
  } catch (err) {
    console.error(`[BigAccounts] Error fetching tweets for user ${userId}:`, err.message);
    return [];
  }
}

/**
 * Check if tweet is recent enough to reply to
 */
function isTweetRecentEnough(tweet) {
  const tweetTime = new Date(tweet.created_at).getTime();
  const now = Date.now();
  const ageMinutes = (now - tweetTime) / (1000 * 60);
  const ageHours = ageMinutes / 60;
  
  // Must be at least MIN_TWEET_AGE_MINUTES old (to avoid immediate replies)
  // And less than MAX_TWEET_AGE_HOURS old (to stay relevant)
  return ageMinutes >= MIN_TWEET_AGE_MINUTES && ageHours <= MAX_TWEET_AGE_HOURS;
}

/**
 * Generate a valuable, contextual reply to a big account's tweet
 */
async function generateReplyToBigAccount(tweetText, accountUsername) {
  const userPrompt = `
You are The Archive, a historian bot with personality. A big history account (@${accountUsername}) just posted this tweet:

"${tweetText}"

Your goal: Reply with a valuable, engaging comment that:
1. Adds historical context, depth, or an interesting angle
2. Is genuinely helpful (not promotional or spammy)
3. Shows your expertise and personality
4. Keeps it under 240 characters
5. Uses 1-2 emojis max if appropriate
6. NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
7. Write naturally like a human, not like AI-generated content
8. Don't mention that you're a bot
9. Don't be overly promotional - focus on adding value

Examples of good replies:
- "Fascinating! This connects to [related historical event]. The parallels are striking."
- "Great point. Many don't know that [additional context]. It's a reminder of [insight]."
- "This moment changed everything. [Brief historical connection]. History is full of these turning points."

Examples of BAD replies (avoid these):
- "Check out my account for more history!" (too promotional)
- "I'm a bot that posts history facts" (mentions being a bot)
- "This is interesting. Follow me!" (spammy)

Generate a valuable, contextual reply now:
`;

  try {
    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: SYSTEM_PROMPT + "\n\nYou are engaging and add value to conversations. You're a historian with personality, not a promotional bot." 
            },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 200,
        }),
        OPENAI_TIMEOUT
      );
    });

    let reply = completion.choices[0]?.message?.content?.trim();
    if (!reply || reply.length > 240) {
      return null; // Don't use fallback - better to skip than post generic reply
    }
    
    // Clean AI-generated artifacts
    reply = cleanAIContent(reply);
    
    // Final validation - make sure it's not too generic
    const genericPhrases = ["check out", "follow me", "visit my", "subscribe", "like and share"];
    const lowerReply = reply.toLowerCase();
    if (genericPhrases.some(phrase => lowerReply.includes(phrase))) {
      console.log("[BigAccounts] Reply too generic/promotional, skipping");
      return null;
    }
    
    return reply;
  } catch (err) {
    console.error("[BigAccounts] Error generating reply:", err.message);
    return null;
  }
}

/**
 * Process tweets from a target account
 */
async function processAccountTweets(account) {
  try {
    if (!canReply(account.username)) {
      console.log(`[BigAccounts] Rate limit reached for @${account.username}`);
      return;
    }

    console.log(`[BigAccounts] Checking @${account.username}...`);
    
    // Get user ID
    const userId = await getUserId(account.username);
    if (!userId) {
      return;
    }

    // Get recent tweets
    const tweets = await getRecentTweets(userId, 10);
    if (!tweets.length) {
      console.log(`[BigAccounts] No recent tweets from @${account.username}`);
      return;
    }

    // Process each tweet
    for (const tweet of tweets) {
      // Check if we've already replied
      if (await hasRepliedToTweet(tweet.id)) {
        continue;
      }

      // Check if tweet is recent enough
      if (!isTweetRecentEnough(tweet)) {
        continue;
      }

      // Check if tweet has good engagement (optional - prioritize popular tweets)
      const metrics = tweet.public_metrics || {};
      const engagement = (metrics.like_count || 0) + (metrics.reply_count || 0) + (metrics.retweet_count || 0);
      
      // For high-priority accounts, reply even to low-engagement tweets
      // For lower-priority, only reply to tweets with some engagement
      if (account.priority < 4 && engagement < 10) {
        console.log(`[BigAccounts] Tweet from @${account.username} has low engagement, skipping`);
        continue;
      }

      const tweetText = tweet.text || "";
      if (!tweetText.trim()) {
        continue;
      }

      console.log(`[BigAccounts] Generating reply to @${account.username}'s tweet:`, tweetText.slice(0, 80));

      // Generate reply
      const reply = await generateReplyToBigAccount(tweetText, account.username);
      
      if (!reply) {
        console.log(`[BigAccounts] Could not generate good reply for @${account.username}`);
        continue;
      }

      // Post reply
      try {
        await new Promise(resolve => setTimeout(resolve, REPLY_DELAY_MS));
        await postTweet(reply, tweet.id);
        
        // Mark as replied
        await markTweetAsReplied(tweet.id, account.username);
        incrementReplyCount(account.username);
        
        console.log(`[BigAccounts] ✅ Replied to @${account.username}'s tweet`);
        
        // Only reply to one tweet per account per run
        break;
      } catch (err) {
        console.error(`[BigAccounts] Error replying to @${account.username}:`, err.message);
        // Don't mark as replied if it failed
      }
    }

  } catch (err) {
    console.error(`[BigAccounts] Error processing @${account.username}:`, err.message);
  }
}

/**
 * Main function: Monitor big accounts and reply strategically
 */
export async function monitorBigAccounts() {
  try {
    console.log("[BigAccounts] Starting big account monitoring...");
    
    resetDailyCounters();
    
    if (replyCountToday >= MAX_REPLIES_PER_DAY) {
      console.log("[BigAccounts] Daily reply limit reached");
      return;
    }

    // Sort accounts by priority (highest first)
    const sortedAccounts = [...TARGET_ACCOUNTS].sort((a, b) => b.priority - a.priority);

    // Process accounts (prioritize high-priority ones)
    for (const account of sortedAccounts) {
      if (replyCountToday >= MAX_REPLIES_PER_DAY) {
        console.log("[BigAccounts] Daily limit reached, stopping");
        break;
      }

      await processAccountTweets(account);
      
      // Delay between accounts to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`[BigAccounts] Monitoring complete. Replied to ${replyCountToday} tweets today.`);

  } catch (err) {
    console.error("[BigAccounts] Error in monitorBigAccounts:", err.message);
  }
}

