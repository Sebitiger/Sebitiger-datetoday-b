/**
 * TRENDING TOPIC INJECTOR
 *
 * Finds historical parallels to current trending topics
 * Posts timely content to ride viral waves
 */

import { openai } from '../openaiCommon.js';
import axios from 'axios';

// Google Trends API alternative: Use Twitter's own trending API
const TRENDING_CHECK_INTERVAL = 2 * 60 * 60 * 1000; // Check every 2 hours

/**
 * Get current trending topics (Twitter API or fallback)
 */
export async function getTrendingTopics() {
  // Method 1: Twitter Trends API (if available)
  // Note: Requires Twitter API v1.1 access
  try {
    // For now, use a simpler approach: check common trending patterns
    // In production, integrate with Twitter Trends or Google Trends
    return await getTrendingFromContext();
  } catch (error) {
    console.error('[Trending] Failed to fetch trends:', error.message);
    return [];
  }
}

/**
 * Get trending from current context (backup method)
 */
async function getTrendingFromContext() {
  // Common evergreen trending topics in history context
  return [
    {
      title: 'AI and regulation',
      category: 'technology',
      volume: 'high'
    },
    {
      title: 'Climate change policy',
      category: 'politics',
      volume: 'medium'
    },
    {
      title: 'Economic uncertainty',
      category: 'economics',
      volume: 'high'
    }
  ];
}

/**
 * Find historical parallel for trending topic
 */
export async function findHistoricalParallel(trendingTopic) {
  const prompt = `Current trending topic: "${trendingTopic}"

Find a compelling historical parallel, precedent, or connection.

Examples:
- If "AI regulation" → Luddites destroying machines (1811-1816)
- If "Supreme Court ruling" → Dred Scott decision (1857)
- If "Mars exploration" → Age of Exploration (1400s-1600s)
- If "Pandemic response" → 1918 Spanish Flu, Black Death
- If "Economic crisis" → 1929 Great Depression, Tulip Mania

Return JSON:
{
  "event": "specific historical event",
  "year": year or range,
  "connection": "how it relates",
  "hook": "viral tweet hook (40 words max)",
  "relevance": 0-100
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);

    // Only return if relevance is high
    if (result.relevance && result.relevance >= 70) {
      return result;
    }

    return null;
  } catch (error) {
    console.error('[Trending] Failed to find parallel:', error.message);
    return null;
  }
}

/**
 * Generate trending-optimized tweet
 */
export async function generateTrendingTweet(topic, connection) {
  const prompt = `Trending now: "${topic.title}"
Historical parallel: ${connection.event} (${connection.year})

Generate viral tweet connecting trending topic to history:
- Start with hook about trending topic
- Reveal historical parallel
- Draw connection (not preachy)
- Max 280 chars
- NO hashtags except trending topic hashtag

Example:
"Everyone's talking about AI regulation. 1811: English workers destroyed textile machines to protect jobs. The Luddites lost. Technology always wins. #AI"

Return just the tweet text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 150
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('[Trending] Tweet generation failed:', error.message);
    return null;
  }
}

/**
 * Check for trending opportunities and generate content
 */
export async function scanForTrendingOpportunities() {
  console.log('[Trending] Scanning for viral opportunities...');

  const trending = await getTrendingTopics();

  const opportunities = [];

  for (const topic of trending.slice(0, 5)) {
    const connection = await findHistoricalParallel(topic.title);

    if (connection) {
      const tweet = await generateTrendingTweet(topic, connection);

      if (tweet) {
        opportunities.push({
          topic: topic.title,
          connection: connection.event,
          tweet,
          relevance: connection.relevance,
          urgency: 'high', // Trending = post ASAP
          expiresAt: Date.now() + (6 * 60 * 60 * 1000) // 6 hour window
        });

        console.log(`🔥 [Trending] Found opportunity: ${topic.title} → ${connection.event}`);
      }
    }

    // Rate limit
    await sleep(2000);
  }

  return opportunities;
}

/**
 * Start background trending scanner
 */
export async function startTrendingScanner() {
  console.log('[Trending] Starting background scanner...');

  const scanOnce = async () => {
    const opportunities = await scanForTrendingOpportunities();

    if (opportunities.length > 0) {
      // Save to queue for priority posting
      await queueTrendingContent(opportunities);
    }
  };

  // Scan immediately
  await scanOnce();

  // Then scan every 2 hours
  setInterval(scanOnce, TRENDING_CHECK_INTERVAL);
}

/**
 * Queue trending content for priority posting
 */
async function queueTrendingContent(opportunities) {
  const fs = await import('fs/promises');
  const path = await import('path');

  const queueFile = path.join(process.cwd(), 'data', 'trending-queue.json');

  let queue = { items: [] };

  try {
    const content = await fs.readFile(queueFile, 'utf-8');
    queue = JSON.parse(content);
  } catch (e) {
    // File doesn't exist
  }

  // Add new opportunities
  for (const opp of opportunities) {
    queue.items.push({
      ...opp,
      queuedAt: Date.now(),
      posted: false
    });
  }

  // Remove expired items
  queue.items = queue.items.filter(item =>
    !item.posted && item.expiresAt > Date.now()
  );

  await fs.writeFile(queueFile, JSON.stringify(queue, null, 2));

  console.log(`[Trending] Queued ${opportunities.length} trending opportunities`);
}

/**
 * Get next trending content to post
 */
export async function getNextTrendingContent() {
  const fs = await import('fs/promises');
  const path = await import('path');

  const queueFile = path.join(process.cwd(), 'data', 'trending-queue.json');

  try {
    const content = await fs.readFile(queueFile, 'utf-8');
    const queue = JSON.parse(content);

    // Get highest relevance unposted item
    const next = queue.items
      .filter(item => !item.posted && item.expiresAt > Date.now())
      .sort((a, b) => b.relevance - a.relevance)[0];

    return next || null;
  } catch (error) {
    return null;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  getTrendingTopics,
  findHistoricalParallel,
  generateTrendingTweet,
  scanForTrendingOpportunities,
  startTrendingScanner,
  getNextTrendingContent
};
