/**
 * A/B TESTING ENGINE
 *
 * Automatically tests multiple content variations to find winners
 * Learns from results and optimizes future content
 */

import { openai } from '../openaiCommon.js';
import { getMetrics } from './realtimeMetrics.js';
import fs from 'fs/promises';
import path from 'path';

const EXPERIMENTS_FILE = path.join(process.cwd(), 'data', 'experiments.json');

/**
 * Create A/B test with multiple variants
 */
export async function createABTest(event, variantCount = 3) {
  const testId = `test_${Date.now()}`;

  console.log(`[A/B] Creating test with ${variantCount} variants`);

  // Generate variants
  const variants = await generateVariants(event, variantCount);

  const experiment = {
    id: testId,
    event,
    variants,
    results: [],
    status: 'pending',
    createdAt: Date.now(),
    winner: null
  };

  await saveExperiment(experiment);

  return experiment;
}

/**
 * Generate content variants
 */
async function generateVariants(event, count) {
  const styles = [
    'shocking-stat',
    'you-know-you-dont-know',
    'timeline-comparison',
    'human-drama',
    'question-hook'
  ];

  const variants = [];

  for (let i = 0; i < count; i++) {
    const style = styles[i % styles.length];

    const prompt = `Event: ${event.description} (${event.year})

Generate viral tweet in "${style}" style:

STYLES:
- shocking-stat: Lead with surprising number
- you-know-you-dont-know: "You know X. You don't know Y."
- timeline-comparison: Compare timelines (like Cleopatra/iPhone)
- human-drama: Focus on one person's story
- question-hook: Start with provocative question

Max 280 chars. Return just the tweet.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 150
      });

      variants.push({
        id: `variant_${i}`,
        style,
        content: response.choices[0].message.content.trim(),
        posted: false,
        tweetId: null
      });
    } catch (error) {
      console.error(`[A/B] Variant ${i} generation failed:`, error.message);
    }
  }

  return variants;
}

/**
 * Post next variant and wait for results
 */
export async function postVariantAndMeasure(experimentId, variantId, twitterClient) {
  const experiment = await loadExperiment(experimentId);
  const variant = experiment.variants.find(v => v.id === variantId);

  if (!variant || variant.posted) {
    return null;
  }

  // Post variant
  const response = await twitterClient.v2.tweet({ text: variant.content });
  variant.tweetId = response.data.id;
  variant.posted = true;
  variant.postedAt = Date.now();

  await saveExperiment(experiment);

  console.log(`[A/B] Posted variant ${variantId}: ${variant.style}`);

  // Schedule measurement in 6 hours
  setTimeout(async () => {
    await measureVariantPerformance(experimentId, variantId);
  }, 6 * 60 * 60 * 1000);

  return variant.tweetId;
}

/**
 * Measure variant performance
 */
async function measureVariantPerformance(experimentId, variantId) {
  const experiment = await loadExperiment(experimentId);
  const variant = experiment.variants.find(v => v.id === variantId);

  if (!variant || !variant.tweetId) {
    return;
  }

  // Get metrics
  const metrics = await getMetrics(variant.tweetId);

  if (!metrics) {
    console.log(`[A/B] No metrics yet for ${variantId}`);
    return;
  }

  variant.metrics = metrics.metrics;
  variant.engagement = metrics.calculated.totalEngagement;
  variant.engagementRate = metrics.calculated.engagementRate;

  // Update experiment
  experiment.results.push({
    variantId,
    engagement: variant.engagement,
    rate: variant.engagementRate,
    measuredAt: Date.now()
  });

  // Check if all variants measured
  const allMeasured = experiment.variants.every(v => v.metrics);

  if (allMeasured) {
    // Declare winner
    const winner = experiment.variants.reduce((best, v) =>
      v.engagement > best.engagement ? v : best
    );

    experiment.winner = winner.id;
    experiment.status = 'completed';

    console.log(`🏆 [A/B] Experiment ${experimentId} complete!`);
    console.log(`   Winner: ${winner.style} (${winner.engagement} engagements)`);

    // Learn from winner
    await learnFromWinner(winner);
  }

  await saveExperiment(experiment);
}

/**
 * Learn patterns from winning variant
 */
async function learnFromWinner(winner) {
  const data = await loadExperimentsData();

  if (!data.winningPatterns) data.winningPatterns = [];

  data.winningPatterns.push({
    style: winner.style,
    length: winner.content.length,
    startsWithNumber: /^\d/.test(winner.content),
    hasQuestion: /\?/.test(winner.content),
    engagement: winner.engagement,
    timestamp: Date.now()
  });

  // Keep last 100
  data.winningPatterns = data.winningPatterns.slice(-100);

  await fs.writeFile(EXPERIMENTS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Get recommended style based on past winners
 */
export async function getRecommendedStyle() {
  const data = await loadExperimentsData();
  const patterns = data.winningPatterns || [];

  if (patterns.length < 5) {
    return 'shocking-stat'; // Default
  }

  // Find most common winning style
  const styleCounts = patterns.reduce((acc, p) => {
    acc[p.style] = (acc[p.style] || 0) + 1;
    return acc;
  }, {});

  const topStyle = Object.keys(styleCounts)
    .sort((a, b) => styleCounts[b] - styleCounts[a])[0];

  return topStyle;
}

async function saveExperiment(experiment) {
  const data = await loadExperimentsData();
  if (!data.experiments) data.experiments = {};
  data.experiments[experiment.id] = experiment;
  await fs.writeFile(EXPERIMENTS_FILE, JSON.stringify(data, null, 2));
}

async function loadExperiment(id) {
  const data = await loadExperimentsData();
  return data.experiments?.[id];
}

async function loadExperimentsData() {
  try {
    const content = await fs.readFile(EXPERIMENTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { experiments: {}, winningPatterns: [] };
  }
}

export default {
  createABTest,
  postVariantAndMeasure,
  getRecommendedStyle
};
