/**
 * COMMUNITY MANAGER
 *
 * Tracks user interactions, identifies superfans, personalizes engagement
 * Builds loyal community by remembering and rewarding active followers
 */

import fs from 'fs/promises';
import path from 'path';
import { openai } from '../openaiCommon.js';

const COMMUNITY_FILE = path.join(process.cwd(), 'data', 'community.json');

/**
 * User tier thresholds
 */
const TIERS = {
  superfan: { minInteractions: 50, color: '🌟' },
  engaged: { minInteractions: 20, color: '⭐' },
  active: { minInteractions: 5, color: '✨' },
  new: { minInteractions: 0, color: '👋' }
};

/**
 * Track user interaction
 */
export async function trackUser(username, interaction) {
  const data = await loadCommunityData();

  let user = data.users[username];

  if (!user) {
    user = {
      username,
      firstSeen: Date.now(),
      interactions: [],
      interests: [],
      sentiment: 'neutral',
      tier: 'new',
      lastRewarded: null
    };
  }

  // Add interaction
  user.interactions.push({
    type: interaction.type, // 'reply', 'like', 'retweet', 'mention'
    postId: interaction.postId,
    topic: interaction.topic,
    content: interaction.content,
    timestamp: Date.now()
  });

  // Update interests from interaction patterns
  user.interests = extractInterests(user.interactions);

  // Update sentiment
  user.sentiment = calculateSentiment(user.interactions);

  // Update tier
  const previousTier = user.tier;
  user.tier = calculateTier(user.interactions.length);

  // Save
  data.users[username] = user;
  await saveCommunityData(data);

  // Reward if tier upgraded
  if (previousTier !== user.tier && user.tier === 'superfan') {
    await rewardSuperfan(user);
  }

  console.log(`[Community] ${TIERS[user.tier].color} @${username} - ${user.interactions.length} interactions (${user.tier})`);

  return user;
}

/**
 * Calculate user tier based on interactions
 */
function calculateTier(interactionCount) {
  if (interactionCount >= TIERS.superfan.minInteractions) return 'superfan';
  if (interactionCount >= TIERS.engaged.minInteractions) return 'engaged';
  if (interactionCount >= TIERS.active.minInteractions) return 'active';
  return 'new';
}

/**
 * Extract user interests from their interaction history
 */
function extractInterests(interactions) {
  const topics = interactions
    .map(i => i.topic)
    .filter(Boolean);

  const topicFreq = topics.reduce((acc, topic) => {
    acc[topic] = (acc[topic] || 0) + 1;
    return acc;
  }, {});

  return Object.keys(topicFreq)
    .sort((a, b) => topicFreq[b] - topicFreq[a])
    .slice(0, 5);
}

/**
 * Calculate sentiment from interactions
 */
function calculateSentiment(interactions) {
  // Simple heuristic: more engagement = more positive
  const recentInteractions = interactions.slice(-10);

  const positiveTypes = ['like', 'retweet'];
  const neutralTypes = ['reply', 'mention'];

  const positiveCount = recentInteractions.filter(i => positiveTypes.includes(i.type)).length;
  const neutralCount = recentInteractions.filter(i => neutralTypes.includes(i.type)).length;

  if (positiveCount > neutralCount) return 'positive';
  if (neutralCount > positiveCount * 2) return 'neutral';
  return 'positive'; // Default to positive
}

/**
 * Reward superfan with personalized content
 */
async function rewardSuperfan(user) {
  // Prevent rewarding same user too frequently
  if (user.lastRewarded && Date.now() - user.lastRewarded < 30 * 24 * 60 * 60 * 1000) {
    return; // Last rewarded less than 30 days ago
  }

  console.log(`🎉 [Community] Rewarding superfan @${user.username}!`);

  // Generate personalized tweet based on their interests
  const personalizedTweet = await generatePersonalizedTweet(user);

  // Queue this for posting (with attribution)
  const data = await loadCommunityData();
  if (!data.rewardQueue) data.rewardQueue = [];

  data.rewardQueue.push({
    user: user.username,
    tweet: personalizedTweet,
    queued: Date.now(),
    posted: false
  });

  user.lastRewarded = Date.now();
  await saveCommunityData(data);

  console.log(`   Queued personalized content for @${user.username}`);
}

/**
 * Generate personalized tweet for superfan
 */
async function generatePersonalizedTweet(user) {
  const interests = user.interests.join(', ') || 'history';

  const prompt = `Generate a viral history tweet for a superfan interested in: ${interests}

Requirements:
- Max 280 characters
- 2-3 sentences
- Shocking/bizarre fact
- Related to their interests

Return just the tweet text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 100
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    return null;
  }
}

/**
 * Get next superfan reward to post
 */
export async function getNextSuperfanReward() {
  const data = await loadCommunityData();

  const pending = (data.rewardQueue || []).find(r => !r.posted);

  if (pending) {
    return {
      username: pending.user,
      tweet: `${pending.tweet}\n\n(h/t @${pending.user} for the inspiration!)`,
      rewardId: pending.queued
    };
  }

  return null;
}

/**
 * Mark reward as posted
 */
export async function markRewardPosted(rewardId) {
  const data = await loadCommunityData();

  const reward = (data.rewardQueue || []).find(r => r.queued === rewardId);
  if (reward) {
    reward.posted = true;
    reward.postedAt = Date.now();
  }

  await saveCommunityData(data);
}

/**
 * Generate personalized reply for user
 */
export async function generatePersonalizedReply(username, mention) {
  const data = await loadCommunityData();
  const user = data.users[username];

  if (!user || user.interactions.length < 3) {
    // New user - standard reply
    return await generateStandardReply(mention);
  }

  // Personalized reply
  const prompt = `User @${username} mentioned us: "${mention}"

Their interests: ${user.interests.join(', ') || 'general history'}
Interaction count: ${user.interactions.length}
Tier: ${user.tier}

Generate a personalized, friendly reply that:
- Acknowledges they're a valued follower
- Relates to their interests
- Answers their question/mention
- Max 280 chars

Return just the reply text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 100
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    return await generateStandardReply(mention);
  }
}

/**
 * Generate standard reply for new users
 */
async function generateStandardReply(mention) {
  const prompt = `User mentioned us: "${mention}"

Generate a helpful, friendly reply that answers their question.
Max 280 chars. Return just the reply text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 100
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    return "Thanks for the mention! We're here to share fascinating history every day. 📜";
  }
}

/**
 * Get community stats
 */
export async function getCommunityStats() {
  const data = await loadCommunityData();
  const users = Object.values(data.users);

  const tierCounts = users.reduce((acc, user) => {
    acc[user.tier] = (acc[user.tier] || 0) + 1;
    return acc;
  }, {});

  return {
    totalUsers: users.length,
    superfans: tierCounts.superfan || 0,
    engaged: tierCounts.engaged || 0,
    active: tierCounts.active || 0,
    new: tierCounts.new || 0,
    pendingRewards: (data.rewardQueue || []).filter(r => !r.posted).length
  };
}

/**
 * Load community data
 */
async function loadCommunityData() {
  try {
    const content = await fs.readFile(COMMUNITY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { users: {}, rewardQueue: [] };
  }
}

/**
 * Save community data
 */
async function saveCommunityData(data) {
  await fs.writeFile(COMMUNITY_FILE, JSON.stringify(data, null, 2));
}

export default {
  trackUser,
  generatePersonalizedReply,
  getNextSuperfanReward,
  markRewardPosted,
  getCommunityStats
};
