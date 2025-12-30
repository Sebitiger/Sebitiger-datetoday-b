/**
 * VERIFIED CONTENT INTEGRATION
 * 
 * Easy integration point for existing bot systems.
 * Drop-in replacement for content generation functions.
 */

import { generateVerifiedTweet, generateVerifiedThread } from './verifiedGenerator.js';
import { getApprovedContent, markAsPosted } from './reviewQueue.js';
import { recordVerification } from './learningSystem.js';
import { openai, SYSTEM_PROMPT } from '../openaiCommon.js';

/**
 * Generate and post a verified tweet
 * This is a drop-in replacement for your current tweet generation
 */
export async function createVerifiedTweet(event, options = {}) {
  const {
    autoPost = true,        // Auto-post high-confidence content
    minConfidence = 90,     // Confidence threshold for auto-posting
    fallbackToQueue = true  // Use queue system for medium confidence
  } = options;

  try {
    const result = await generateVerifiedTweet(event, {
      maxRetries: 3,
      minConfidence,
      queueMedium: fallbackToQueue
    });

    // Record for learning
    await recordVerification(result.verification, result.status);

    if (result.status === 'APPROVED' && autoPost) {
      return {
        content: result.content,
        shouldPost: true,
        confidence: result.verification.confidence,
        autoApproved: true
      };
    }

    if (result.status === 'QUEUED') {
      return {
        content: result.content,
        shouldPost: false,
        confidence: result.verification.confidence,
        queueId: result.queueId,
        message: 'Content queued for review'
      };
    }

    // If rejected, try fallback to unverified generation
    if (!fallbackToQueue) {
      console.log('[VerifiedContent] Low confidence, generating fallback content...');
      return await createFallbackContent(event);
    }

    return {
      content: result.content,
      shouldPost: false,
      confidence: result.verification.confidence,
      message: 'Content did not meet confidence threshold'
    };

  } catch (error) {
    console.error('[VerifiedContent] Error:', error.message);
    
    // Fallback to unverified generation
    return await createFallbackContent(event);
  }
}

/**
 * Generate and post a verified thread
 */
export async function createVerifiedThreadContent(event, options = {}) {
  const {
    autoPost = true,
    minConfidence = 90,
    fallbackToQueue = true
  } = options;

  try {
    const result = await generateVerifiedThread(event, {
      maxRetries: 3,
      minConfidence,
      queueMedium: fallbackToQueue
    });

    await recordVerification(result.verification, result.status);

    if (result.status === 'APPROVED' && autoPost) {
      // Split thread into individual tweets
      const tweets = result.content
        .split('\n\n')
        .filter(t => t.trim())
        .map(t => t.replace(/^\d+\.\s*/, '').trim());

      return {
        tweets,
        shouldPost: true,
        confidence: result.verification.confidence,
        autoApproved: true
      };
    }

    if (result.status === 'QUEUED') {
      return {
        tweets: result.content.split('\n\n').filter(t => t.trim()),
        shouldPost: false,
        confidence: result.verification.confidence,
        queueId: result.queueId,
        message: 'Thread queued for review'
      };
    }

    return {
      tweets: [],
      shouldPost: false,
      confidence: result.verification.confidence,
      message: 'Thread did not meet confidence threshold'
    };

  } catch (error) {
    console.error('[VerifiedContent] Thread error:', error.message);
    return {
      tweets: [],
      shouldPost: false,
      error: error.message
    };
  }
}

/**
 * Get next pre-approved content from queue
 * Use this if you want to post manually approved content
 */
export async function getNextApprovedPost() {
  try {
    const approved = await getApprovedContent(1);
    
    if (approved.length === 0) {
      return null;
    }

    const item = approved[0];
    
    return {
      id: item.id,
      content: item.correctedContent || item.content,
      context: item.context,
      verification: item.verification,
      isThread: item.context?.contentType === 'thread'
    };

  } catch (error) {
    console.error('[VerifiedContent] Error getting approved content:', error.message);
    return null;
  }
}

/**
 * Mark content as posted (call after successful tweet)
 */
export async function markContentAsPosted(itemId, tweetId = null) {
  try {
    await markAsPosted(itemId, tweetId);
    console.log(`[VerifiedContent] Marked ${itemId} as posted`);
  } catch (error) {
    console.error('[VerifiedContent] Error marking as posted:', error.message);
  }
}

/**
 * Fallback: Generate content without verification
 * Use when verification fails or for lower-stakes content
 */
async function createFallbackContent(event) {
  console.log('[VerifiedContent] Using fallback (unverified) generation');
  
  try {
    const prompt = `Create an engaging tweet about this historical event:

Year: ${event.year}
Event: ${event.description}

Make it surprising and shareable. 280 characters max. No hashtags.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 300
    });

    const content = response.choices[0].message.content.trim();

    return {
      content,
      shouldPost: true,
      confidence: 0, // Unverified
      autoApproved: false,
      fallback: true,
      message: 'Fallback content (unverified)'
    };

  } catch (error) {
    throw new Error(`Fallback generation failed: ${error.message}`);
  }
}

/**
 * Get system status and recommendations
 */
export async function getSystemStatus() {
  const { getQueueStats } = await import('./reviewQueue.js');
  const { getInsights, getGuidance } = await import('./learningSystem.js');
  
  const queueStats = await getQueueStats();
  const insights = await getInsights();
  const guidance = await getGuidance();
  
  return {
    queue: queueStats,
    learning: {
      totalGenerated: insights.statistics.totalGenerated,
      approvalRate: insights.statistics.approvalRate,
      averageConfidence: insights.statistics.averageConfidence.toFixed(1) + '%'
    },
    guidance: guidance.recommendations,
    timestamp: new Date().toISOString()
  };
}
