// engagement.js
// Handles user engagement: mentions, replies, and interactions

import { client } from "./twitterClient.js";
import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { postTweet } from "./twitterClient.js";
import { withTimeout, retryWithBackoff } from "./utils.js";
import { getEventForDate } from "./fetchEvents.js";

const OPENAI_TIMEOUT = 30000;
const MAX_REPLIES_PER_HOUR = 20;
const REPLY_DELAY_MS = 3000; // 3 seconds between replies

// Store processed mentions to avoid duplicates
const processedMentions = new Set();
let replyCount = 0;
let lastResetTime = Date.now();

/**
 * Reset reply counter hourly
 */
function resetReplyCounter() {
  const now = Date.now();
  if (now - lastResetTime > 3600000) { // 1 hour
    replyCount = 0;
    lastResetTime = now;
  }
}

/**
 * Check if we can reply (rate limiting)
 */
function canReply() {
  resetReplyCounter();
  return replyCount < MAX_REPLIES_PER_HOUR;
}

/**
 * Generate a contextual, friendly reply to a mention
 */
async function generateReplyToMention(mentionText, originalTweetText = "", username = "") {
  const userPrompt = `
You are DateToday, a friendly, curious historian bot with personality.

A user (@${username}) mentioned you or asked a question:
"${mentionText}"

${originalTweetText ? `They were responding to this tweet: "${originalTweetText}"` : ""}

Generate a helpful, engaging reply that:
- Answers their question if they asked one
- Is friendly and conversational (but not overly casual)
- Shows your personality: curious, passionate about history, witty when appropriate
- Keeps it under 240 characters
- If they asked about a specific date, provide that date's historical event
- If they asked "what happened on [date]", fetch and share that event
- Use 1-2 emojis max if appropriate
- End with a question or invitation to engage more

Examples of good replies:
- "Great question! On [date], [event]. What fascinates you most about this period?"
- "I love this topic! [Brief answer]. Want me to dive deeper in a thread?"
- "Thanks for asking! [Answer]. Have you read about [related topic]?"

Generate the reply now:
`;

  try {
    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + "\n\nYou are engaging and conversational. You remember that you're a historian bot." },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
        OPENAI_TIMEOUT
      );
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply || reply.length > 240) {
      // Fallback
      return `Thanks for the mention! I'm DateToday, your friendly historian bot. Ask me about any date in history, and I'll share what happened! 📚`;
    }
    return reply;
  } catch (err) {
    console.error("[Engagement] Error generating reply:", err.message);
    return null;
  }
}

/**
 * Handle date-specific requests (e.g., "what happened on January 15?")
 */
async function handleDateRequest(dateText) {
  try {
    // Simple date parsing (can be enhanced)
    const dateMatch = dateText.match(/(\w+)\s+(\d+)/i);
    if (!dateMatch) return null;

    // This is simplified - you'd want better date parsing
    const event = await getEventForDate();
    return `On this date: ${event.description} (${event.year})`;
  } catch (err) {
    console.error("[Engagement] Error fetching date event:", err.message);
    return null;
  }
}

/**
 * Process and reply to a mention
 */
export async function processMention(mention) {
  try {
    if (!canReply()) {
      console.log("[Engagement] Rate limit reached, skipping reply");
      return;
    }

    const mentionId = mention.id;
    if (processedMentions.has(mentionId)) {
      console.log("[Engagement] Already processed mention:", mentionId);
      return;
    }

    const mentionText = mention.text || "";
    const username = mention.author_id || "user";
    const originalTweetId = mention.in_reply_to_user_id ? mention.conversation_id : null;

    console.log(`[Engagement] Processing mention from @${username}:`, mentionText.slice(0, 100));

    // Check if it's a date request
    if (mentionText.toLowerCase().includes("what happened on") || 
        mentionText.toLowerCase().includes("on this day")) {
      const dateResponse = await handleDateRequest(mentionText);
      if (dateResponse) {
        await postTweet(dateResponse, mentionId);
        processedMentions.add(mentionId);
        replyCount++;
        return;
      }
    }

    // Generate AI reply
    const reply = await generateReplyToMention(mentionText, "", username);
    if (reply) {
      await new Promise(resolve => setTimeout(resolve, REPLY_DELAY_MS));
      await postTweet(reply, mentionId);
      processedMentions.add(mentionId);
      replyCount++;
      console.log(`[Engagement] Replied to @${username}`);
    }

  } catch (err) {
    console.error("[Engagement] Error processing mention:", err.message);
  }
}

/**
 * Monitor mentions and process them
 */
export async function monitorMentions() {
  try {
    console.log("[Engagement] Checking for new mentions...");
    
    // Get recent mentions (last 20)
    const mentions = await client.v2.search({
      query: `@${process.env.BOT_USERNAME || "DateToday"} -is:retweet`,
      max_results: 20,
      'tweet.fields': ['conversation_id', 'author_id', 'created_at']
    });

    if (!mentions.data?.data) {
      console.log("[Engagement] No new mentions");
      return;
    }

    // Process each mention
    for (const mention of mentions.data.data) {
      await processMention(mention);
      // Small delay between processing
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (err) {
    console.error("[Engagement] Error monitoring mentions:", err.message);
  }
}

/**
 * Quote tweet interesting historical connections
 */
export async function quoteTweetConnection(tweetId, historicalContext) {
  try {
    if (!canReply()) return;

    const quoteText = `📚 Historical context: ${historicalContext}`;
    
    // Note: Quote tweeting requires Twitter API v2 with proper permissions
    // This is a placeholder - implement based on your API access level
    console.log("[Engagement] Would quote tweet:", quoteText);
    
  } catch (err) {
    console.error("[Engagement] Error quote tweeting:", err.message);
  }
}

