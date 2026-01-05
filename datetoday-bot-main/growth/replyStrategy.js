/**
 * STRATEGIC REPLY SYSTEM
 *
 * Intelligently replies to big accounts to gain exposure
 * Adds value, not spam - builds credibility and followers
 */

import { client as twitterClient } from '../twitterClient.js';
import { openai } from '../openaiCommon.js';
import fs from 'fs/promises';
import path from 'path';

const REPLY_LOG_FILE = path.join(process.cwd(), 'data', 'reply-log.json');

/**
 * Big history/education accounts to reply to
 */
export const TARGET_ACCOUNTS = [
  { handle: 'HistoryInPics', followers: 2_800_000, maxReplies: 3 },
  { handle: 'HistoryInPix', followers: 1_500_000, maxReplies: 3 },
  { handle: 'Inter estingSTEM', followers: 980_000, maxReplies: 2 },
  { handle: 'HistoricalPics', followers: 750_000, maxReplies: 2 },
  { handle: 'factsweird', followers: 650_000, maxReplies: 2 }
];

/**
 * Check if we should reply to an account today
 */
async function canReplyToAccount(handle) {
  const log = await loadReplyLog();
  const today = new Date().toISOString().split('T')[0];

  const todayReplies = (log.replies || []).filter(r =>
    r.handle === handle &&
    r.date === today
  );

  const limit = TARGET_ACCOUNTS.find(a => a.handle === handle)?.maxReplies || 2;

  return todayReplies.length < limit;
}

/**
 * Find reply opportunities from big accounts
 */
export async function findReplyOpportunities() {
  const opportunities = [];

  for (const account of TARGET_ACCOUNTS) {
    if (!(await canReplyToAccount(account.handle))) {
      continue;
    }

    try {
      // Get latest tweets from this account
      const user = await twitterClient.v2.userByUsername(account.handle);
      const tweets = await twitterClient.v2.userTimeline(user.data.id, {
        max_results: 5,
        'tweet.fields': ['created_at', 'public_metrics']
      });

      for (const tweet of tweets.data.data || []) {
        // Only reply to history-related tweets
        if (isHistoryRelated(tweet.text)) {
          opportunities.push({
            handle: account.handle,
            tweetId: tweet.id,
            tweetText: tweet.text,
            followers: account.followers
          });
        }
      }
    } catch (error) {
      console.error(`[Reply] Failed to fetch tweets from @${account.handle}:`, error.message);
    }

    // Rate limit
    await sleep(2000);
  }

  return opportunities;
}

/**
 * Check if tweet is history-related
 */
function isHistoryRelated(text) {
  const keywords = ['history', 'historical', 'ago', 'century', 'war', 'ancient', 'medieval', 'year', '19', '18'];
  return keywords.some(kw => text.toLowerCase().includes(kw));
}

/**
 * Generate value-adding reply
 */
export async function generateValueAddReply(tweet) {
  const prompt = `Big account tweet: "${tweet.text}"

Generate a VALUE-ADDING reply (NOT generic praise):

GOOD replies:
- Add lesser-known context or detail
- Connect to another historical event
- Ask thought-provoking question
- Share surprising statistic
- Correct common misconception (politely)

BAD replies:
- "Great post!"
- "Interesting!"
- "Thanks for sharing"
- Self-promotion

Requirements:
- 2-3 sentences max
- Max 280 chars
- Conversational tone
- Factually accurate

Return just the reply text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 120
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('[Reply] Generation failed:', error.message);
    return null;
  }
}

/**
 * Post reply and log it
 */
export async function postStrategicReply(opportunity) {
  const reply = await generateValueAddReply({
    text: opportunity.tweetText
  });

  if (!reply) {
    return false;
  }

  try {
    await twitterClient.v2.tweet({
      text: reply,
      reply: { in_reply_to_tweet_id: opportunity.tweetId }
    });

    // Log reply
    await logReply({
      handle: opportunity.handle,
      tweetId: opportunity.tweetId,
      reply,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0]
    });

    console.log(`💬 [Reply] Replied to @${opportunity.handle} (${opportunity.followers.toLocaleString()} followers)`);

    return true;
  } catch (error) {
    console.error('[Reply] Failed to post:', error.message);
    return false;
  }
}

/**
 * Run strategic reply campaign
 */
export async function runReplyCampaign(maxReplies = 5) {
  console.log('[Reply] Starting reply campaign...');

  const opportunities = await findReplyOpportunities();

  let repliesPosted = 0;

  for (const opp of opportunities.slice(0, maxReplies)) {
    const success = await postStrategicReply(opp);

    if (success) {
      repliesPosted++;

      // Rate limit: 1 reply per minute
      await sleep(60 * 1000);
    }
  }

  console.log(`[Reply] Campaign complete: ${repliesPosted} replies posted`);

  return repliesPosted;
}

async function logReply(reply) {
  const log = await loadReplyLog();

  if (!log.replies) log.replies = [];

  log.replies.push(reply);

  // Keep last 500
  log.replies = log.replies.slice(-500);

  await fs.writeFile(REPLY_LOG_FILE, JSON.stringify(log, null, 2));
}

async function loadReplyLog() {
  try {
    const content = await fs.readFile(REPLY_LOG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { replies: [] };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  findReplyOpportunities,
  postStrategicReply,
  runReplyCampaign
};
