// trending.js
// Monitor trending topics and connect them to historical events

import axios from "axios";
import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff } from "./utils.js";
import { postTweet } from "./twitterClient.js";

const OPENAI_TIMEOUT = 30000;

/**
 * Get trending topics (simplified - Twitter API v2 doesn't have easy trending endpoint)
 * In production, you'd use Twitter's trends API or a third-party service
 */
async function getTrendingTopics() {
  try {
    // Note: Twitter API v2 doesn't have a simple trending endpoint
    // You'd need to use Twitter API v1.1 or a service like Trends24
    // This is a placeholder structure
    
    // For now, return empty - implement based on your API access
    return [];
  } catch (err) {
    console.error("[Trending] Error fetching trends:", err.message);
    return [];
  }
}

/**
 * Find historical connection to a trending topic
 */
async function findHistoricalConnection(trendingTopic) {
  const userPrompt = `
Find a meaningful historical connection to this current trending topic:

Trending Topic: "${trendingTopic}"

Your task:
1. Think of a historical event, person, or period that relates to this topic
2. Create a connection that's insightful, not forced
3. Write a tweet (under 260 characters) that:
   - Mentions the trending topic naturally
   - Connects it to a specific historical event/date
   - Shows why the connection matters
   - Uses 1-2 emojis max
   - Ends with a thought-provoking question or statement

Example:
Trending: "AI breakthrough"
Connection: "1950: Alan Turing published 'Computing Machinery and Intelligence' - asking 'Can machines think?' Today's AI breakthroughs trace back to this moment. History doesn't repeat, but it sure rhymes. 🤖 What do you think: are we closer to answering Turing's question?"

Rules:
- Connection must be genuine and meaningful
- Don't force connections that don't make sense
- Be respectful and accurate
- Make it shareable and thought-provoking

Generate the tweet now:
`;

  try {
    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 250,
        }),
        OPENAI_TIMEOUT
      );
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text || text.length > 280) {
      return null;
    }
    return text;
  } catch (err) {
    console.error("[Trending] Error finding connection:", err.message);
    return null;
  }
}

/**
 * Monitor trends and post connections (max 2 per day)
 */
let dailyTrendPosts = 0;
let lastTrendReset = Date.now();

function resetTrendCounter() {
  const now = Date.now();
  if (now - lastTrendReset > 86400000) { // 24 hours
    dailyTrendPosts = 0;
    lastTrendReset = now;
  }
}

export async function postTrendingConnection() {
  try {
    resetTrendCounter();
    
    if (dailyTrendPosts >= 2) {
      console.log("[Trending] Daily trend post limit reached");
      return;
    }

    const trends = await getTrendingTopics();
    if (!trends || trends.length === 0) {
      console.log("[Trending] No trends available");
      return;
    }

    // Pick a random trend (or the most relevant one)
    const selectedTrend = trends[Math.floor(Math.random() * trends.length)];
    
    console.log(`[Trending] Finding connection for: ${selectedTrend}`);
    const connection = await findHistoricalConnection(selectedTrend);

    if (connection) {
      await postTweet(connection);
      dailyTrendPosts++;
      console.log("[Trending] Posted trending connection");
    }

  } catch (err) {
    console.error("[Trending] Error posting connection:", err.message);
  }
}

/**
 * Check if a topic is worth connecting to history
 */
function isWorthConnecting(topic) {
  // Filter out topics that don't make sense for historical connections
  const skipPatterns = [
    /^#/i, // Hashtags only
    /kpop|celebrity|gossip/i, // Pop culture (usually)
    /meme|viral|trending/i, // Meta topics
  ];

  return !skipPatterns.some(pattern => pattern.test(topic));
}


