/**
 * VERIFIED CONTENT GENERATOR - WITH DISTINCTIVE VOICE
 * 
 * Generates content with built-in fact-checking and verification.
 * Updated with deadpan, pattern-seeking voice that makes history memorable.
 */

import { openai, SYSTEM_PROMPT } from '../openaiCommon.js';
import { verifyAndDecide } from './factChecker.js';
import { addToQueue } from './reviewQueue.js';

// DISTINCTIVE VOICE GUIDELINES
const VOICE_SYSTEM_PROMPT = `You are a historian with a distinctive, memorable voice:

VOICE CHARACTERISTICS:
- Deadpan, not enthusiastic
- Surprising, not obvious  
- Concise, not wordy
- Pattern-seeking, not just facts
- NO hashtags, NO emojis, NO exclamation marks (unless absolutely essential)

STRUCTURE:
- Lead with surprising claim or reversal
- Present specific facts
- Connect to broader pattern or modern day
- End with thought-provoking element

BAD EXAMPLES:
❌ "Did you know? In 1969, Apollo 11 landed on the moon! 🚀 #History #Space"
❌ "On this day in 1776, the Declaration of Independence was signed! Amazing! 🇺🇸"
❌ "Thomas Edison was an incredible inventor who changed the world! ⚡"

GOOD EXAMPLES:
✅ "1969: We put humans on the moon.
    2024: We argue about whether Earth is flat.
    
    Progress isn't linear."

✅ "Napoleon wasn't short.
    He was 5'7" - average for his time.
    
    British propaganda. We believed it for 200 years."

✅ "Oxford University: Founded 1096
    Aztec Empire: Founded 1325
    
    We teach history like European institutions are 'modern.'
    They're often more ancient than the 'ancient' civilizations we study."

✅ "1518: Dancing plague in Strasbourg. People danced until death.
    2024: Infinite scroll. Doom scrolling. Screen addiction.
    
    We keep finding new ways to trap ourselves in loops."

Use this voice for all content generation.`;

/**
 * Generate content with automatic fact-checking
 */
export async function generateVerifiedContent(prompt, context = {}, options = {}) {
  const {
    maxRetries = 3,
    minConfidence = 90,
    queueMedium = true
  } = options;

  let attempt = 0;
  let bestResult = null;

  while (attempt < maxRetries) {
    attempt++;
    console.log(`[VerifiedGenerator] Attempt ${attempt}/${maxRetries}`);

    try {
      // Generate content with distinctive voice
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

  // All retries exhausted
  if (bestResult) {
    if (bestResult.verification.needsReview && queueMedium) {
      console.log(`[VerifiedGenerator] All retries exhausted. Best: ${bestResult.verification.confidence}%. Queuing.`);
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
        autoApproved: false
      };
    } else {
      return {
        content: bestResult.content,
        verification: bestResult.verification,
        status: 'REJECTED',
        autoApproved: false
      };
    }
  }

  throw new Error('Failed to generate content after all retries');
}

/**
 * Generate content using OpenAI with distinctive voice
 */
async function generateContent(prompt) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VOICE_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: 500
  });

  return response.choices[0].message.content.trim();
}

/**
 * Generate a single tweet with verification - MYTH-BUSTING style
 */
export async function generateVerifiedTweet(event, options = {}) {
  const prompt = `Create a myth-busting or pattern-revealing tweet about this event:

Year: ${event.year}
Event: ${event.description}
Date: ${event.monthName} ${event.day}

APPROACH OPTIONS (pick the best fit):
1. REVERSAL: Challenge a common misconception
2. PATTERN: Connect to modern parallel
3. TIMELINE TWIST: Surprising chronology fact
4. FORGOTTEN IMPACT: Explain why this matters but we forgot

REQUIREMENTS:
- 2-4 short sentences (or lines)
- First line: Surprising claim or fact
- Middle: Specific detail
- Last line: Thought-provoking element or modern connection
- NO hashtags, NO emojis, NO exclamation marks
- 280 characters max
- Deadpan tone

EXAMPLES OF GOOD STRUCTURE:
"[Surprising fact about the event]

[Specific detail that makes it real]

[Modern connection or pattern OR why we got it wrong]"

Make people stop scrolling and think.`;

  const context = {
    year: event.year,
    eventDescription: event.description,
    contentType: 'single_tweet'
  };

  return generateVerifiedContent(prompt, context, options);
}

/**
 * Generate a thread with verification - DEEP DIVE style
 */
export async function generateVerifiedThread(event, options = {}) {
  const prompt = `Create a 5-6 tweet thread that makes this event unforgettable:

Year: ${event.year}
Event: ${event.description}

THREAD STRUCTURE:
1. HOOK: Surprising claim or question (make them stop scrolling)
2. CONTEXT: Set the scene with specific details
3. THE STORY: What actually happened (with a twist if possible)
4. THE IMPACT: Why it mattered (not obvious impacts)
5. MODERN CONNECTION: How it relates to today OR pattern it reveals
6. ENGAGEMENT: Question that makes them think or share

VOICE RULES:
- Deadpan delivery
- No hashtags, no emojis
- Each tweet: 2-4 sentences max
- Specific details over generic statements
- Challenge assumptions
- Reveal patterns

FORMAT: Return numbered tweets (1-6), each on new line.

EXAMPLE HOOK:
"1. Everyone thinks medieval people were filthy.

They weren't. They bathed regularly, had soap, used perfume.

The myth started with Victorians who wanted to feel superior."`;

  const context = {
    year: event.year,
    eventDescription: event.description,
    contentType: 'thread'
  };

  return generateVerifiedContent(prompt, context, options);
}

/**
 * Batch generate with distinctive voice
 */
export async function batchGenerateVerified(events, options = {}) {
  const results = [];
  
  for (const event of events) {
    try {
      const result = await generateVerifiedTweet(event, options);
      results.push({ event, ...result });
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('[VerifiedGenerator] Batch error:', error.message);
      results.push({ event, status: 'ERROR', error: error.message });
    }
  }
  
  const approved = results.filter(r => r.status === 'APPROVED').length;
  const queued = results.filter(r => r.status === 'QUEUED').length;
  const rejected = results.filter(r => r.status === 'REJECTED').length;
  
  console.log(`[VerifiedGenerator] Batch: ${approved} approved, ${queued} queued, ${rejected} rejected`);
  
  return results;
}
