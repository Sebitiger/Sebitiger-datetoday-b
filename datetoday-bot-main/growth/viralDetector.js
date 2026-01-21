/**
 * VIRAL CONTENT DETECTOR
 *
 * Automatically identifies viral posts and analyzes what made them successful
 * Generates variations of viral content to replicate success
 */

import { getMetrics, getAverageMetrics } from './realtimeMetrics.js';
import { openai } from '../openaiCommon.js';
import fs from 'fs/promises';
import path from 'path';

const VIRAL_PATTERNS_FILE = path.join(process.cwd(), 'data', 'viral-patterns.json');
const VIRAL_THRESHOLD = 3.0; // 3x average engagement = viral

/**
 * Identify viral posts from recent tweets
 */
export async function identifyViralPosts() {
  try {
    const avgMetrics = await getAverageMetrics();

    if (avgMetrics.sampleSize < 10) {
      console.log('[Viral] Not enough data yet (need 10+ tweets)');
      return [];
    }

    const metricsFile = path.join(process.cwd(), 'data', 'engagement-metrics.json');

    // Check if file exists and initialize if needed
    let data;
    try {
      const fileContent = await fs.readFile(metricsFile, 'utf-8');
      data = JSON.parse(fileContent);
    } catch (error) {
      console.log('[Viral] No engagement data yet - initializing metrics file');
      data = { tweets: {}, averages: {} };
      await fs.writeFile(metricsFile, JSON.stringify(data, null, 2));
      return [];
    }

    const tweets = Object.values(data.tweets || {});

    if (tweets.length === 0) {
      console.log('[Viral] No tweets tracked yet');
      return [];
    }

    const viralThreshold = avgMetrics.avgEngagement * VIRAL_THRESHOLD;

    const viralPosts = tweets.filter(t =>
      t.calculated?.totalEngagement >= viralThreshold
    );

    if (viralPosts.length > 0) {
      console.log(`🔥 [Viral] Found ${viralPosts.length} viral posts!`);
      console.log(`   Threshold: ${viralThreshold.toFixed(0)} engagements`);

      // Analyze patterns
      const patterns = await analyzeViralPatterns(viralPosts);
      await saveViralPatterns(patterns);

      // Generate recommendations
      await generateViralRecommendations(patterns);

      return viralPosts;
    }

    return [];
  } catch (error) {
    console.error('[Viral] Error identifying viral posts:', error.message);
    return [];
  }
}

/**
 * Analyze what made viral posts successful
 */
async function analyzeViralPatterns(viralPosts) {
  const analysis = {
    count: viralPosts.length,
    timestamp: Date.now(),
    patterns: {}
  };

  // Extract common traits
  const lengths = viralPosts.map(p => p.content?.length || 0);
  const wordCounts = viralPosts.map(p => (p.content || '').split(' ').length);
  const hours = viralPosts.map(p => new Date(p.timestamp).getUTCHours());

  analysis.patterns.avgLength = average(lengths);
  analysis.patterns.avgWordCount = average(wordCounts);
  analysis.patterns.bestHours = mode(hours);

  // Content analysis
  const contents = viralPosts.map(p => p.content || '').filter(Boolean);

  analysis.patterns.startsWithNumber = contents.filter(c => /^\d/.test(c)).length / contents.length;
  analysis.patterns.hasQuestion = contents.filter(c => /\?/.test(c)).length / contents.length;
  analysis.patterns.hasQuotes = contents.filter(c => /["']/.test(c)).length / contents.length;
  analysis.patterns.hasNumbers = contents.filter(c => /\d+/.test(c)).length / contents.length;

  // Category analysis
  const categories = viralPosts.map(p => p.metadata?.category).filter(Boolean);
  analysis.patterns.topCategories = frequency(categories);

  // Extract common words (excluding common stopwords)
  analysis.patterns.commonWords = await extractCommonWords(contents);

  // AI-powered pattern analysis
  analysis.patterns.aiInsights = await getAIInsights(viralPosts);

  return analysis;
}

/**
 * Get AI insights on viral patterns
 */
async function getAIInsights(viralPosts) {
  const contents = viralPosts.slice(0, 5).map(p => p.content).join('\n---\n');

  const prompt = `Analyze these viral history tweets (3x+ normal engagement):

${contents}

What patterns make them viral? Identify:
1. Opening hooks used
2. Content structure
3. Emotional triggers
4. Word choices
5. Length/pacing

Be specific and actionable.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('[Viral] AI analysis failed:', error.message);
    return null;
  }
}

/**
 * Generate recommendations based on viral patterns
 */
async function generateViralRecommendations(patterns) {
  console.log('\n🔥 VIRAL CONTENT RECOMMENDATIONS:\n');

  console.log(`📊 Optimal Length: ${Math.round(patterns.patterns.avgLength)} characters`);
  console.log(`⏰ Best Posting Hours: ${patterns.patterns.bestHours.join(', ')} UTC`);
  console.log(`📈 Top Categories: ${Object.keys(patterns.patterns.topCategories).slice(0, 3).join(', ')}`);

  if (patterns.patterns.startsWithNumber > 0.5) {
    console.log('✅ Number-led hooks work well');
  }

  if (patterns.patterns.hasQuestion > 0.3) {
    console.log('✅ Questions drive engagement');
  }

  if (patterns.patterns.commonWords.length > 0) {
    console.log(`🔤 Power words: ${patterns.patterns.commonWords.slice(0, 5).join(', ')}`);
  }

  if (patterns.patterns.aiInsights) {
    console.log('\n🤖 AI Insights:');
    console.log(patterns.patterns.aiInsights);
  }

  console.log('\n');
}

/**
 * Generate variations of viral content
 */
export async function generateViralVariations(viralPost) {
  const prompt = `This tweet went viral (3x+ normal engagement):

"${viralPost.content}"

Generate 3 variations that maintain the viral formula but with different topics/events:
1. Same structure, different event
2. Same hook style, different facts
3. Same emotional trigger, different story

Each variation max 280 chars. Return as JSON array.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.variations || [];
  } catch (error) {
    console.error('[Viral] Variation generation failed:', error.message);
    return [];
  }
}

/**
 * Extract common words from viral content
 */
function extractCommonWords(contents) {
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their']);

  const allWords = contents
    .join(' ')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopwords.has(word));

  const wordFreq = frequency(allWords);
  return Object.keys(wordFreq)
    .sort((a, b) => wordFreq[b] - wordFreq[a])
    .slice(0, 20);
}

/**
 * Save viral patterns to file
 */
async function saveViralPatterns(patterns) {
  try {
    let history = { patterns: [] };

    try {
      const content = await fs.readFile(VIRAL_PATTERNS_FILE, 'utf-8');
      history = JSON.parse(content);
    } catch (e) {
      // File doesn't exist yet
    }

    history.patterns.unshift(patterns);
    history.patterns = history.patterns.slice(0, 50); // Keep last 50

    await fs.writeFile(VIRAL_PATTERNS_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    console.error('[Viral] Failed to save patterns:', error.message);
  }
}

/**
 * Get latest viral patterns
 */
export async function getLatestViralPatterns() {
  try {
    const content = await fs.readFile(VIRAL_PATTERNS_FILE, 'utf-8');
    const history = JSON.parse(content);
    return history.patterns[0] || null;
  } catch (error) {
    return null;
  }
}

// Utility functions
function average(arr) {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function mode(arr) {
  const freq = frequency(arr);
  return Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 3);
}

function frequency(arr) {
  return arr.reduce((acc, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

export default {
  identifyViralPosts,
  generateViralVariations,
  getLatestViralPatterns
};
