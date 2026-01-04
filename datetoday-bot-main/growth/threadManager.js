/**
 * THREAD COMPLETION MANAGER
 *
 * Creates complete multi-part threads with cliffhangers
 * Ensures threads maintain momentum and audience comes back
 */

import { openai } from '../openaiCommon.js';
import fs from 'fs/promises';
import path from 'path';

const THREADS_FILE = path.join(process.cwd(), 'data', 'threads.json');

/**
 * Create complete thread upfront (all parts)
 */
export async function createThread(topic, parts = 5) {
  const threadId = `thread_${Date.now()}`;

  console.log(`[Thread] Creating ${parts}-part thread on: ${topic}`);

  // Generate ALL parts at once
  const allParts = await generateCompleteThread(topic, parts);

  if (!allParts || allParts.length === 0) {
    throw new Error('Failed to generate thread');
  }

  // Add cliffhangers between parts
  const partsWithCliffhangers = addCliffhangers(allParts);

  // Save thread
  await saveThread({
    id: threadId,
    topic,
    parts: partsWithCliffhangers,
    totalParts: parts,
    currentPart: 0,
    status: 'pending',
    createdAt: Date.now(),
    postedParts: []
  });

  console.log(`[Thread] ✅ Created thread ${threadId}`);

  return threadId;
}

/**
 * Generate complete thread using GPT-4
 */
async function generateCompleteThread(topic, parts) {
  const prompt = `Create a ${parts}-part Twitter thread about: ${topic}

REQUIREMENTS:
- Each part: 250-280 characters (leave room for "Part X/Y")
- Part 1: HOOK - shocking/surprising fact
- Middle parts: Build story, add context
- Final part: Conclusion with thought-provoking question

STRUCTURE:
- Chronological OR thematic
- Each part standalone but connected
- Progressive revelation (don't front-load everything)
- Facts-first, no fluff

Return JSON array of parts:
["Part 1 text", "Part 2 text", ...]`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.parts || result.thread || [];
  } catch (error) {
    console.error('[Thread] Generation failed:', error.message);
    return null;
  }
}

/**
 * Add cliffhangers to thread parts
 */
function addCliffhangers(parts) {
  return parts.map((part, i) => {
    if (i < parts.length - 1) {
      // Add teaser for next part
      const teasers = [
        '\n\n🧵 But wait...',
        '\n\n🧵 Here\'s where it gets interesting...',
        '\n\n🧵 The twist...',
        '\n\n🧵 Then everything changed...',
        '\n\n🧵 Next: the shocking truth...'
      ];

      const teaser = teasers[i % teasers.length];

      // Only add if it fits in 280 chars
      const withHeader = `🧵 ${i + 1}/${parts.length}\n\n${part}`;
      if ((withHeader + teaser).length <= 280) {
        return `${part}${teaser}`;
      }
    }

    return part;
  });
}

/**
 * Post next part of thread
 */
export async function postNextThreadPart(threadId, twitterClient) {
  const thread = await loadThread(threadId);

  if (!thread) {
    throw new Error(`Thread ${threadId} not found`);
  }

  if (thread.currentPart >= thread.totalParts) {
    console.log(`[Thread] ${threadId} already complete`);
    return null;
  }

  const partIndex = thread.currentPart;
  const partText = thread.parts[partIndex];

  // Format with part number
  const tweetText = `🧵 ${partIndex + 1}/${thread.totalParts}\n\n${partText}`;

  let tweetId;

  if (partIndex === 0) {
    // First tweet - standalone
    const response = await twitterClient.v2.tweet({ text: tweetText });
    tweetId = response.data.id;
  } else {
    // Reply to previous part
    const previousTweetId = thread.postedParts[partIndex - 1];
    const response = await twitterClient.v2.tweet({
      text: tweetText,
      reply: { in_reply_to_tweet_id: previousTweetId }
    });
    tweetId = response.data.id;
  }

  // Update thread
  thread.postedParts.push(tweetId);
  thread.currentPart++;

  if (thread.currentPart >= thread.totalParts) {
    thread.status = 'completed';
  }

  await saveThread(thread);

  console.log(`[Thread] Posted part ${partIndex + 1}/${thread.totalParts} of ${threadId}`);

  return tweetId;
}

/**
 * Get active threads
 */
export async function getActiveThreads() {
  const data = await loadThreadsData();
  return Object.values(data.threads || {})
    .filter(t => t.status === 'pending');
}

/**
 * Save thread
 */
async function saveThread(thread) {
  const data = await loadThreadsData();

  if (!data.threads) data.threads = {};
  data.threads[thread.id] = thread;

  await fs.writeFile(THREADS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Load specific thread
 */
async function loadThread(threadId) {
  const data = await loadThreadsData();
  return data.threads?.[threadId] || null;
}

/**
 * Load threads data
 */
async function loadThreadsData() {
  try {
    const content = await fs.readFile(THREADS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { threads: {} };
  }
}

export default {
  createThread,
  postNextThreadPart,
  getActiveThreads
};
