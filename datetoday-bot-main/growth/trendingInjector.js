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

CRITICAL REQUIREMENTS:
- Event MUST be from OUTSIDE the United States (Asia, Europe, Africa, Middle East, Oceania, Latin America)
- Event MUST be globally significant (not regional politics)
- Event MUST stand alone WITHOUT needing current events context
- Event MUST NOT be US regulatory, political, or governmental history
- Focus on timeless historical moments, not modern parallels

ACCEPTABLE Examples:
- Technology/Innovation → Printing press (Gutenberg, 1440s Germany)
- Power struggles → Fall of Roman Empire (476 CE)
- Pandemic → Black Death (1347-1353 Europe/Asia)
- Economic collapse → Tulip Mania (1637 Netherlands)
- Exploration → Zheng He's voyages (1405-1433 China)

REJECT:
- Any US regulatory/political events (Radio Act, Supreme Court, Constitutional amendments)
- Any events requiring knowledge of current debates
- Any regional conflicts or battles
- Any modern era political parallels

Return JSON:
{
  "event": "specific historical event",
  "year": year or range,
  "region": "geographic region (NOT Americas-US)",
  "connection": "how it relates",
  "hook": "viral tweet hook (40 words max)",
  "relevance": 0-100,
  "isGloballySignificant": true/false,
  "requiresCurrentContext": true/false
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

    // STRICT FILTERING FOR GLOBAL NON-US CONTENT

    // Filter 1: Reject if not globally significant
    if (!result.isGloballySignificant) {
      console.log('[Trending] ❌ Rejected: Not globally significant');
      return null;
    }

    // Filter 2: Reject if requires current context
    if (result.requiresCurrentContext) {
      console.log('[Trending] ❌ Rejected: Requires current events context');
      return null;
    }

    // Filter 3: Reject US content
    if (result.region && result.region.includes('US')) {
      console.log('[Trending] ❌ Rejected: US content');
      return null;
    }

    // Filter 4: Detect US content in event description (backup check)
    const eventLower = (result.event || '').toLowerCase();
    const usKeywords = [
      'america', 'united states', 'u.s.', 'usa', 'congress', 'senate',
      'president', 'washington', 'lincoln', 'roosevelt', 'supreme court',
      'constitutional', 'fbi', 'cia', 'nasa', 'pentagon'
    ];

    if (usKeywords.some(keyword => eventLower.includes(keyword))) {
      console.log('[Trending] ❌ Rejected: US keywords detected');
      return null;
    }

    // Filter 5: Only return if relevance is high AND quality criteria met
    if (result.relevance && result.relevance >= 80) {
      console.log(`[Trending] ✅ Accepted: ${result.event} (${result.region}, relevance: ${result.relevance})`);
      return result;
    }

    console.log('[Trending] ❌ Rejected: Relevance too low (<80)');
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
Region: ${connection.region}

Generate viral tweet connecting trending topic to history.

CRITICAL RULES:
- AUTHORITATIVE reference account tone
- NO rhetorical questions ("Debating X?", "Everyone's talking about X?")
- Start with HISTORICAL FACT directly
- Use declarative statements only
- NO hashtags whatsoever
- Max 280 characters
- Make the connection subtle, not preachy

STRUCTURE:
1. Lead with historical event and date
2. Brief context/significance
3. Optional: Subtle connection to modern parallel (one phrase maximum)

GOOD Example:
"1440. Gutenberg's printing press mechanized knowledge distribution. Within 50 years, 20 million books existed. Information monopolies collapsed across Europe."

BAD Examples (NEVER use these patterns):
"Debating AI regulation? Look back to 1811..." ❌ (rhetorical question)
"Everyone's talking about X..." ❌ (contemporary framing)
"Just like today's debate about..." ❌ (heavy-handed parallel)
"Technology always wins. #AI" ❌ (hashtag)

Return just the tweet text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 150
    });

    let tweet = response.choices[0].message.content.trim();

    // CRITICAL POST-PROCESSING

    // Remove any hashtags
    tweet = tweet.replace(/#\w+/g, '').trim();

    // Remove double spaces
    tweet = tweet.replace(/\s+/g, ' ').trim();

    // Reject if it contains rhetorical questions
    if (tweet.match(/^(debating|everyone's talking|what if|did you know|imagine|picture this)/i)) {
      console.log('[Trending] ❌ Rejected tweet: Contains rhetorical framing');
      return null;
    }

    // Reject if it has question marks (no questions allowed)
    if (tweet.includes('?')) {
      console.log('[Trending] ❌ Rejected tweet: Contains questions');
      return null;
    }

    console.log('[Trending] ✅ Generated tweet passes all filters');
    return tweet;
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
