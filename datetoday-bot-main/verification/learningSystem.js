/**
 * LEARNING SYSTEM
 * 
 * Tracks verification patterns and learns from corrections.
 * Improves accuracy over time by analyzing what gets approved/rejected.
 */

import fs from 'fs/promises';
import path from 'path';

const LEARNING_DATA_FILE = path.join(process.cwd(), 'data', 'learning_data.json');

/**
 * Initialize learning data structure
 */
async function initLearningData() {
  try {
    await fs.access(LEARNING_DATA_FILE);
    return await readLearningData();
  } catch {
    const initialData = {
      patterns: {
        commonErrors: [],
        successfulFormats: [],
        problematicTopics: [],
        reliableTopics: []
      },
      statistics: {
        totalGenerated: 0,
        totalApproved: 0,
        totalQueued: 0,
        totalRejected: 0,
        averageConfidence: 0,
        topConcerns: {}
      },
      improvements: []
    };
    await fs.writeFile(LEARNING_DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
}

/**
 * Read learning data
 */
async function readLearningData() {
  try {
    const content = await fs.readFile(LEARNING_DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[Learning] Error reading data:', error.message);
    return initLearningData();
  }
}

/**
 * Write learning data
 */
async function writeLearningData(data) {
  try {
    await fs.writeFile(LEARNING_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[Learning] Error writing data:', error.message);
  }
}

/**
 * Record a verification result to learn from
 */
export async function recordVerification(verification, outcome) {
  const data = await readLearningData();
  
  // Update statistics
  data.statistics.totalGenerated++;
  if (outcome === 'APPROVED') data.statistics.totalApproved++;
  if (outcome === 'QUEUED') data.statistics.totalQueued++;
  if (outcome === 'REJECTED') data.statistics.totalRejected++;
  
  // Update average confidence
  const total = data.statistics.totalGenerated;
  const currentAvg = data.statistics.averageConfidence;
  data.statistics.averageConfidence = ((currentAvg * (total - 1)) + verification.confidence) / total;
  
  // Track concerns
  if (verification.concerns && verification.concerns.length > 0) {
    for (const concern of verification.concerns) {
      data.statistics.topConcerns[concern] = (data.statistics.topConcerns[concern] || 0) + 1;
    }
  }
  
  // Learn from patterns
  if (outcome === 'REJECTED' && verification.concerns) {
    // Track common errors
    for (const concern of verification.concerns) {
      if (!data.patterns.commonErrors.some(e => e.concern === concern)) {
        data.patterns.commonErrors.push({
          concern,
          count: 1,
          firstSeen: new Date().toISOString()
        });
      } else {
        const error = data.patterns.commonErrors.find(e => e.concern === concern);
        error.count++;
      }
    }
    
    // Track problematic topics
    if (verification.context?.eventDescription) {
      const topic = extractTopic(verification.context.eventDescription);
      if (!data.patterns.problematicTopics.includes(topic)) {
        data.patterns.problematicTopics.push(topic);
      }
    }
  }
  
  if (outcome === 'APPROVED' && verification.confidence >= 95) {
    // Track successful formats
    if (verification.claim && verification.claim.length < 280) {
      data.patterns.successfulFormats.push({
        format: verification.claim,
        confidence: verification.confidence,
        timestamp: new Date().toISOString()
      });
      
      // Keep only top 50 successful formats
      data.patterns.successfulFormats.sort((a, b) => b.confidence - a.confidence);
      data.patterns.successfulFormats = data.patterns.successfulFormats.slice(0, 50);
    }
    
    // Track reliable topics
    if (verification.context?.eventDescription) {
      const topic = extractTopic(verification.context.eventDescription);
      if (!data.patterns.reliableTopics.includes(topic)) {
        data.patterns.reliableTopics.push(topic);
      }
    }
  }
  
  await writeLearningData(data);
}

/**
 * Extract topic from event description
 */
function extractTopic(description) {
  const desc = description.toLowerCase();
  
  if (desc.includes('war') || desc.includes('battle')) return 'war';
  if (desc.includes('science') || desc.includes('discover')) return 'science';
  if (desc.includes('art') || desc.includes('paint')) return 'art';
  if (desc.includes('invent') || desc.includes('technology')) return 'technology';
  if (desc.includes('music') || desc.includes('composer')) return 'music';
  if (desc.includes('literature') || desc.includes('author')) return 'literature';
  
  return 'other';
}

/**
 * Get insights for improving content generation
 */
export async function getInsights() {
  const data = await readLearningData();
  
  // Calculate approval rate
  const total = data.statistics.totalGenerated;
  const approvalRate = total > 0 
    ? ((data.statistics.totalApproved / total) * 100).toFixed(1)
    : 0;
  
  // Get top concerns
  const topConcerns = Object.entries(data.statistics.topConcerns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([concern, count]) => ({ concern, count }));
  
  // Get most common errors
  const commonErrors = data.patterns.commonErrors
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    statistics: {
      ...data.statistics,
      approvalRate: `${approvalRate}%`
    },
    topConcerns,
    commonErrors,
    problematicTopics: data.patterns.problematicTopics,
    reliableTopics: data.patterns.reliableTopics,
    totalSuccessfulFormats: data.patterns.successfulFormats.length
  };
}

/**
 * Generate guidance based on learning
 */
export async function getGuidance() {
  const insights = await getInsights();
  
  const guidance = {
    avoidTopics: [],
    preferTopics: [],
    commonPitfalls: [],
    recommendations: []
  };
  
  // Suggest avoiding problematic topics
  if (insights.problematicTopics.length > 0) {
    guidance.avoidTopics = insights.problematicTopics;
    guidance.recommendations.push(`Avoid or be extra careful with: ${insights.problematicTopics.join(', ')}`);
  }
  
  // Suggest preferring reliable topics
  if (insights.reliableTopics.length > 0) {
    guidance.preferTopics = insights.reliableTopics;
    guidance.recommendations.push(`These topics have high success rate: ${insights.reliableTopics.join(', ')}`);
  }
  
  // Warn about common pitfalls
  if (insights.commonErrors.length > 0) {
    guidance.commonPitfalls = insights.commonErrors.map(e => e.concern);
    guidance.recommendations.push('Common issues to avoid:');
    insights.commonErrors.forEach(e => {
      guidance.recommendations.push(`  - ${e.concern} (occurred ${e.count} times)`);
    });
  }
  
  // Approval rate feedback
  const approvalRate = parseFloat(insights.statistics.approvalRate);
  if (approvalRate < 50) {
    guidance.recommendations.push('⚠️ Low approval rate - consider being more conservative with claims');
  } else if (approvalRate > 80) {
    guidance.recommendations.push('✅ High approval rate - system is working well!');
  }
  
  return guidance;
}

/**
 * Export learning data for analysis
 */
export async function exportLearningData() {
  const data = await readLearningData();
  const insights = await getInsights();
  const guidance = await getGuidance();
  
  return {
    rawData: data,
    insights,
    guidance,
    exportedAt: new Date().toISOString()
  };
}

/**
 * Reset learning data (use with caution)
 */
export async function resetLearningData() {
  console.warn('[Learning] Resetting all learning data');
  await initLearningData();
}
