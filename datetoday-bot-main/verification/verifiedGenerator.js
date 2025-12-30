/**
 * VERIFIED CONTENT GENERATOR
 * 
 * Generates content with built-in fact-checking and verification.
 * Integrates with the review queue system for quality control.
 */

import { openai, SYSTEM_PROMPT } from '../openaiCommon.js';
import { verifyAndDecide } from './factChecker.js';
import { addToQueue } from './reviewQueue.js';

/**
 * Generate content with automatic fact-checking
 * @param {string} prompt - Content generation prompt
 * @param {object} context - Context for verification (event details, etc.)
 * @param {object} options - Generation options
 * @returns {Promise<object>} Generated content with verification
 */
export async function generateVerifiedContent(prompt, context = {}, options = {}) {
  const {
    maxRetries = 3,
    minConfidence = 90, // Auto-post threshold
    queueMedium = true  // Queue medium-confidence content
  } = options;

  let attempt = 0;
  let bestResult = null;

  while (attempt < maxRetries) {
    attempt++;
    console.log(`[VerifiedGenerator] Attempt ${attempt}/${maxRetries}`);

    try {
      // Generate content
      const content = await generateContent(prompt);
      
      // Verify content
      const verification = await verifyAndDecide(content, context);
      
      console.log(`[VerifiedGenerator] Generated content verification:`, {
        confidence: verification.confidence,
        verdict: verification.verdict,
        action: verification.action
      });

      // Track best result
      if (!bestResult || verification.confidence > bestResult.verification.confidence) {
        bestResult = { content, verification };
      }

      // HIGH confidence - auto-post
      if (verification.shouldPost && verification.confidence >= minConfidence) {
        console.log(`[VerifiedGenerator] ✅ High confidence (${verification.confidence}%), ready to post`);
        return {
          content,
          verification,
          status: 'APPROVED',
          autoApproved: true
        };
      }

      // MEDIUM confidence - queue for review
      if (verification.needsReview && queueMedium) {
        console.log(`[VerifiedGenerator] ⚠️ Medium confidence (${verification.confidence}%), adding to review queue`);
        const queueItem = await addToQueue({ content, context, verification });
        return {
          content,
          verification,
          status: 'QUEUED',
          queueId: queueItem.id,
          autoApproved: false
        };
      }

      // LOW confidence - retry if we have attempts left
      if (attempt < maxRetries) {
        console.log(`[VerifiedGenerator] ❌ Low confidence (${verification.confidence}%), retrying...`);
        continue;
      }

    } catch (error) {
      console.error(`[VerifiedGenerator] Error on attempt ${attempt}:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  // All retries exhausted - return best result or fail
  if (bestResult) {
    if (bestResult.verification.needsReview && queueMedium) {
      console.log(`[VerifiedGenerator] All retries exhausted. Best result: ${bestResult.verification.confidence}%. Adding to queue.`);
      const queueItem = await addToQueue({ 
        content: bestResult.content, 
        context, 
        verification: bestResult.verification 
      });
      return {
        content: bestResult.content,
        verification: bestResult.verification,
        status: 'QUEUED',
        queueId: queueItem.id,
        autoApproved: false,
        note: 'Best of multiple attempts, needs review'
      };
    } else {
      console.log(`[VerifiedGenerator] All retries exhausted. Best result: ${bestResult.verification.confidence}%. Rejected.`);
      return {
        content: bestResult.content,
        verification: bestResult.verification,
        status: 'REJECTED',
        autoApproved: false,
        note: 'All attempts failed confidence threshold'
      };
    }
  }

  throw new Error('Failed to generate content after all retries');
}

/**
 * Generate content using OpenAI
 */
async function generateContent(prompt) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 500
  });

  return response.choices[0].message.content.trim();
}

/**
 * Generate a single tweet with verification
 */
export async function generateVerifiedTweet(event, options = {}) {
  const prompt = `Create an engaging tweet about this historical event:

Year: ${event.year}
Event: ${event.description}
Date: ${event.monthName} ${event.day}

Requirements:
- Make it surprising and shareable
- Challenge assumptions or reveal lesser-known facts
- Use specific details
- No hashtags, no emojis (unless truly essential)
- 280 characters max
- End with a thought-provoking element (question, connection to today, or surprising detail)

Focus on making people stop scrolling, think, and want to share.`;

  const context = {
    year: event.year,
    eventDescription: event.description,
    contentType: 'single_tweet'
  };

  return generateVerifiedContent(prompt, context, options);
}

/**
 * Generate a thread with verification
 */
export async function generateVerifiedThread(event, options = {}) {
  const prompt = `Create a 5-6 tweet thread about this historical event:

Year: ${event.year}
Event: ${event.description}

Thread structure:
1. Hook tweet (stop the scroll)
2. Set the scene (context)
3. The story (what happened)
4. The impact (why it matters)
5. Connection to today or thought-provoking question

Requirements:
- Each tweet 280 chars max
- No hashtags, no emojis
- Use specific details
- Make it engaging and shareable
- Challenge assumptions
- End with engagement hook

Format: Return each tweet on a new line, numbered 1-5 or 1-6.`;

  const context = {
    year: event.year,
    eventDescription: event.description,
    contentType: 'thread'
  };

  return generateVerifiedContent(prompt, context, options);
}

/**
 * Batch generate multiple pieces of content
 * Useful for creating a content bank
 */
export async function batchGenerateVerified(events, options = {}) {
  const results = [];
  
  for (const event of events) {
    try {
      const result = await generateVerifiedTweet(event, options);
      results.push({ event, ...result });
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('[VerifiedGenerator] Batch generation error:', error.message);
      results.push({
        event,
        status: 'ERROR',
        error: error.message
      });
    }
  }
  
  const approved = results.filter(r => r.status === 'APPROVED').length;
  const queued = results.filter(r => r.status === 'QUEUED').length;
  const rejected = results.filter(r => r.status === 'REJECTED').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`[VerifiedGenerator] Batch complete: ${approved} approved, ${queued} queued, ${rejected} rejected, ${errors} errors`);
  
  return results;
}
