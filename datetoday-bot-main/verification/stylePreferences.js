/**
 * IMAGE STYLE PREFERENCES - LEARNS WHICH STYLES GET BEST ENGAGEMENT
 * Tracks photograph vs illustration vs painting, etc.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { openai } from '../openaiCommon.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIVERSITY_FILE = path.join(__dirname, '../data/image-diversity.json');
const ENGAGEMENT_FILE = path.join(__dirname, '../data/image-engagement.json');

/**
 * Analyze image style using GPT-4 Vision
 * @param {Buffer} imageBuffer - Image to analyze
 * @returns {Promise<Object>} - Style info { type, colors, composition }
 */
export async function analyzeImageStyle(imageBuffer) {
  try {
    const base64Image = imageBuffer.toString('base64');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this image's visual style. Respond in JSON:
{
  "type": "photograph" | "illustration" | "painting" | "engraving" | "map" | "document",
  "era": "modern" | "vintage" | "historical" | "ancient",
  "colorScheme": "color" | "black-and-white" | "sepia",
  "composition": "portrait" | "landscape" | "close-up" | "wide-shot",
  "subject": "person" | "building" | "landscape" | "event" | "artifact" | "diagram"
}`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
              detail: 'low' // Low detail is fine for style analysis
            }
          }
        ]
      }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('[StylePreferences] Error analyzing style:', error.message);
    return {
      type: 'unknown',
      era: 'unknown',
      colorScheme: 'unknown',
      composition: 'unknown',
      subject: 'unknown'
    };
  }
}

/**
 * Track image style for diversity
 * @param {Object} styleInfo - Style information
 * @param {string} tweetId - Tweet ID for reference
 */
export async function trackImageStyle(styleInfo, tweetId) {
  try {
    let data = {
      recentImageStyles: [],
      recentSources: [],
      stylePreferences: {}
    };

    try {
      const fileData = await fs.readFile(DIVERSITY_FILE, 'utf8');
      data = JSON.parse(fileData);
    } catch (error) {
      // File doesn't exist, use default
    }

    // Add to recent styles
    data.recentImageStyles.push({
      tweetId,
      timestamp: new Date().toISOString(),
      ...styleInfo
    });

    // Keep only last 20
    if (data.recentImageStyles.length > 20) {
      data.recentImageStyles = data.recentImageStyles.slice(-20);
    }

    // Update style preferences counters
    for (const [key, value] of Object.entries(styleInfo)) {
      if (!data.stylePreferences[key]) {
        data.stylePreferences[key] = {};
      }
      if (!data.stylePreferences[key][value]) {
        data.stylePreferences[key][value] = 0;
      }
      data.stylePreferences[key][value]++;
    }

    await fs.writeFile(DIVERSITY_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[StylePreferences] Tracked style: ${styleInfo.type} / ${styleInfo.era}`);
  } catch (error) {
    console.error('[StylePreferences] Error tracking style:', error.message);
  }
}

/**
 * Calculate style diversity score
 * Lower score = need more diversity (recent images too similar)
 * @returns {Promise<number>} - Diversity score 0-100
 */
export async function getStyleDiversityScore() {
  try {
    const fileData = await fs.readFile(DIVERSITY_FILE, 'utf8');
    const data = JSON.parse(fileData);

    const recent = data.recentImageStyles.slice(-5); // Last 5 images

    if (recent.length < 2) {
      return 100; // Not enough data, diversity is fine
    }

    // Count unique values for each dimension
    const uniqueTypes = new Set(recent.map(s => s.type)).size;
    const uniqueEras = new Set(recent.map(s => s.era)).size;
    const uniqueColors = new Set(recent.map(s => s.colorScheme)).size;
    const uniqueCompositions = new Set(recent.map(s => s.composition)).size;

    // Calculate diversity (more unique = better)
    const maxPossible = recent.length;
    const avgUnique = (uniqueTypes + uniqueEras + uniqueColors + uniqueCompositions) / 4;
    const diversityScore = (avgUnique / maxPossible) * 100;

    return Math.min(100, diversityScore);
  } catch (error) {
    return 100; // No data, assume diversity is fine
  }
}

/**
 * Get style performance from engagement data
 * @returns {Promise<Object>} - Style rankings { type: { photograph: avgScore, ... } }
 */
export async function getStylePerformance() {
  try {
    const engagementData = await fs.readFile(ENGAGEMENT_FILE, 'utf8');
    const engagement = JSON.parse(engagementData);

    const diversityData = await fs.readFile(DIVERSITY_FILE, 'utf8');
    const diversity = JSON.parse(diversityData);

    // Map tweet IDs to styles
    const styleMap = {};
    for (const style of diversity.recentImageStyles) {
      styleMap[style.tweetId] = style;
    }

    // Calculate engagement by style
    const byStyle = {
      type: {},
      era: {},
      colorScheme: {},
      composition: {},
      subject: {}
    };

    for (const post of engagement.posts) {
      if (post.likes === null || !styleMap[post.tweetId]) continue;

      const style = styleMap[post.tweetId];
      const engagementScore = (post.likes || 0) + (post.retweets || 0) * 2 + (post.replies || 0) * 1.5;

      for (const [dimension, value] of Object.entries(style)) {
        if (dimension === 'tweetId' || dimension === 'timestamp') continue;

        if (!byStyle[dimension]) byStyle[dimension] = {};
        if (!byStyle[dimension][value]) {
          byStyle[dimension][value] = { total: 0, count: 0 };
        }

        byStyle[dimension][value].total += engagementScore;
        byStyle[dimension][value].count++;
      }
    }

    // Calculate averages
    const rankings = {};
    for (const [dimension, styles] of Object.entries(byStyle)) {
      rankings[dimension] = {};
      for (const [style, stats] of Object.entries(styles)) {
        rankings[dimension][style] = {
          avgEngagement: stats.total / stats.count,
          count: stats.count
        };
      }
    }

    return rankings;
  } catch (error) {
    console.error('[StylePreferences] Error calculating style performance:', error.message);
    return {};
  }
}

/**
 * Should we prefer this style? (Based on performance and diversity)
 * @param {Object} styleInfo - Style to evaluate
 * @returns {Promise<number>} - Preference score 0-100
 */
export async function getStylePreferenceScore(styleInfo) {
  try {
    const performance = await getStylePerformance();
    const diversityScore = await getStyleDiversityScore();

    let score = 50; // Default

    // Boost based on historical performance
    let performanceBoost = 0;
    let dataPoints = 0;

    for (const [dimension, value] of Object.entries(styleInfo)) {
      if (dimension === 'tweetId' || dimension === 'timestamp') continue;

      const dimPerf = performance[dimension]?.[value];
      if (dimPerf && dimPerf.count >= 2) {
        performanceBoost += dimPerf.avgEngagement * 5; // Scale to contribute to 0-100
        dataPoints++;
      }
    }

    if (dataPoints > 0) {
      score = performanceBoost / dataPoints;
    }

    // If diversity is low, prefer DIFFERENT styles
    if (diversityScore < 50) {
      // Check if this style is overused recently
      const fileData = await fs.readFile(DIVERSITY_FILE, 'utf8');
      const data = JSON.parse(fileData);
      const recent = data.recentImageStyles.slice(-3);

      const recentTypes = recent.map(s => s.type);
      if (recentTypes.filter(t => t === styleInfo.type).length >= 2) {
        score *= 0.7; // Penalize overused styles
        console.log(`[StylePreferences] Penalizing ${styleInfo.type} - used too recently`);
      }
    }

    return Math.max(0, Math.min(100, score));
  } catch (error) {
    return 50; // Default
  }
}

/**
 * Log style statistics
 */
export async function logStyleStats() {
  const performance = await getStylePerformance();
  const diversityScore = await getStyleDiversityScore();

  console.log('\n[StylePreferences] 🎨 Style Performance:');
  console.log(`  Diversity Score: ${diversityScore.toFixed(1)}/100`);

  for (const [dimension, styles] of Object.entries(performance)) {
    const sorted = Object.entries(styles)
      .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement);

    if (sorted.length > 0) {
      console.log(`  ${dimension}:`);
      for (const [style, stats] of sorted.slice(0, 3)) {
        console.log(`    ${style}: ${stats.avgEngagement.toFixed(1)} (${stats.count} posts)`);
      }
    }
  }
  console.log('');
}
