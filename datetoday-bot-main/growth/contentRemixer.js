/**
 * CONTENT REMIXER
 *
 * Takes top-performing content and remixes it in different formats
 * Extends content lifespan and extracts maximum value
 */

import { openai } from '../openaiCommon.js';
import { getMetrics } from './realtimeMetrics.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Find top-performing posts from last 90 days
 */
export async function getTopPosts(limit = 10) {
  const metricsFile = path.join(process.cwd(), 'data', 'engagement-metrics.json');

  try {
    const content = await fs.readFile(metricsFile, 'utf-8');
    const data = JSON.parse(content);

    const tweets = Object.values(data.tweets || {});
    const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);

    return tweets
      .filter(t => t.timestamp > ninetyDaysAgo && t.calculated?.totalEngagement)
      .sort((a, b) => b.calculated.totalEngagement - a.calculated.totalEngagement)
      .slice(0, limit);
  } catch (error) {
    return [];
  }
}

/**
 * Remix top content into different formats
 */
export async function remixTopContent() {
  const topPosts = await getTopPosts(5);

  const remixes = [];

  for (const post of topPosts) {
    const variations = await generateRemixes(post);
    remixes.push(...variations);
  }

  // Schedule remixes for future posting (60-90 days out)
  await scheduleRemixes(remixes);

  console.log(`[Remix] Created ${remixes.length} remixes from ${topPosts.length} top posts`);

  return remixes;
}

/**
 * Generate remix variations
 */
async function generateRemixes(post) {
  const content = post.content;

  const remixes = [];

  // 1. Thread expansion
  const thread = await remixAsThread(content);
  if (thread) remixes.push({ type: 'thread', content: thread, originalId: post.tweetId });

  // 2. Different hook
  const newHook = await remixWithDifferentHook(content);
  if (newHook) remixes.push({ type: 'remix-hook', content: newHook, originalId: post.tweetId });

  // 3. Question format
  const question = await remixAsQuestion(content);
  if (question) remixes.push({ type: 'question', content: question, originalId: post.tweetId });

  return remixes;
}

/**
 * Expand viral tweet into thread
 */
async function remixAsThread(tweetText) {
  const prompt = `Viral tweet: "${tweetText}"

Expand into 4-tweet thread:
1. Original hook (modified slightly)
2. Additional context/backstory
3. Lesser-known related fact
4. Thought-provoking conclusion

Each tweet max 280 chars. Return JSON array.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.thread || result.parts || [];
  } catch (error) {
    return null;
  }
}

/**
 * Remix with different opening hook
 */
async function remixWithDifferentHook(tweetText) {
  const prompt = `Original viral tweet: "${tweetText}"

Generate new version with different opening hook but same core facts.
Max 280 chars. Return just the new tweet.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 150
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Convert to question format
 */
async function remixAsQuestion(tweetText) {
  const prompt = `Viral tweet: "${tweetText}"

Convert to question/poll format:
"Which is older: [A] or [B]?"
or
"True or false: [surprising claim]?"

Max 280 chars. Make it thought-provoking.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 100
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Schedule remixes for future posting
 */
async function scheduleRemixes(remixes) {
  const scheduleFile = path.join(process.cwd(), 'data', 'remix-schedule.json');

  let schedule = { items: [] };

  try {
    const content = await fs.readFile(scheduleFile, 'utf-8');
    schedule = JSON.parse(content);
  } catch (e) {
    // File doesn't exist
  }

  const now = Date.now();
  const sixtyDays = 60 * 24 * 60 * 60 * 1000;
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;

  for (const remix of remixes) {
    // Random date 60-90 days from now
    const scheduledFor = now + sixtyDays + Math.random() * (ninetyDays - sixtyDays);

    schedule.items.push({
      ...remix,
      scheduledFor,
      posted: false
    });
  }

  await fs.writeFile(scheduleFile, JSON.stringify(schedule, null, 2));
}

export default {
  getTopPosts,
  remixTopContent
};
