/**
 * VERIFIED CONTENT GENERATOR - WITH CORRECTION LOOP
 * 
 * Enhanced system that:
 * 1. Generates content
 * 2. Verifies with GPT-4 + Wikipedia
 * 3. If <95%, uses corrections to fix
 * 4. Re-verifies
 * 5. Aims for 95%+ confidence
 */

import { openai } from '../openaiCommon.js';
import { verifyAndDecide, buildCorrectionPrompt } from './factChecker.js';
import { addToQueue } from './reviewQueue.js';

// DISTINCTIVE VOICE
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

Use this voice for all content generation.`;

/**
 * Generate content with correction loop
 * Target: 95%+ confidence
 */
export async function generateVerifiedContent(prompt, context = {}, options = {}) {
  const {
    maxAttempts = 3,
    targetConfidence = 95,
    minConfidence = 90,
    queueMedium = true
  } = options;

  let attempt = 0;
  let content = null;
  let verification = null;
  let bestResult = null;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`[VerifiedGenerator] 🎯 Attempt ${attempt}/${maxAttempts}`);

    try {
      // Generate content (or corrected version)
      if (attempt === 1) {
        content = await generateContent(prompt);
      } else if (verification?.corrections?.length > 0) {
        console.log(`[VerifiedGenerator] 🔧 Applying ${verification.corrections.length} corrections`);
        const correctionPrompt = buildCorrectionPrompt(content, verification);
        content = await generateContent(correctionPrompt);
      } else {
        content = await generateContent(prompt);
      }
      
      // Verify content (GPT-4 + Wikipedia)
      verification = await verifyAndDecide(content, context);
      
      console.log(`[VerifiedGenerator] 📊 Result:`, {
        confidence: verification.confidence,
        verdict: verification.verdict,
        wiki: verification.wikipediaVerified || false
      });

      // Track best result
      if (!bestResult || verification.confidence > bestResult.verification.confidence) {
        bestResult = { content, verification };
      }

      // TARGET REACHED - 95%+ confidence
      if (verification.confidence >= targetConfidence) {
        console.log(`[VerifiedGenerator] ✅ TARGET! ${verification.confidence}%`);
        return {
          content,
          verification,
          status: 'APPROVED',
          autoApproved: true,
          attempts: attempt,
          wikipediaVerified: verification.wikipediaVerified
        };
      }

      // HIGH confidence (90-94%) - queue
      if (verification.confidence >= minConfidence) {
        console.log(`[VerifiedGenerator] ⚠️  ${verification.confidence}% - queuing`);
        const queueItem = await addToQueue({ content, context, verification });
        return {
          content,
          verification,
          status: 'QUEUED',
          queueId: queueItem.id,
          autoApproved: false,
          attempts: attempt
        };
      }

      // MEDIUM - apply corrections
      if (verification.confidence >= 70 && attempt < maxAttempts) {
        console.log(`[VerifiedGenerator] 🔄 ${verification.confidence}% - correcting`);
        continue;
      }

      // LOW - retry fresh
      if (attempt < maxAttempts) {
        console.log(`[VerifiedGenerator] ❌ ${verification.confidence}% - retry`);
        verification.corrections = [];
        continue;
      }

    } catch (error) {
      console.error(`[VerifiedGenerator] 💥 Error:`, error.message);
      if (attempt === maxAttempts) throw error;
    }
  }

  // Exhausted - use best
  if (bestResult) {
    const conf = bestResult.verification.confidence;
    
    if (conf >= 85 && queueMedium) {
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
        attempts: maxAttempts
      };
    } else {
      return {
        content: bestResult.content,
        verification: bestResult.verification,
        status: 'REJECTED',
        autoApproved: false,
        attempts: maxAttempts
      };
    }
  }

  throw new Error('Failed to generate content');
}

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

export async function generateVerifiedTweet(event, options = {}) {
  const prompt = `Create a myth-busting or pattern-revealing tweet:

Year: ${event.year}
Event: ${event.description}
Date: ${event.monthName} ${event.day}

APPROACH:
1. REVERSAL: Challenge misconception
2. PATTERN: Modern parallel
3. TIMELINE TWIST: Surprising chronology
4. FORGOTTEN IMPACT: Why it matters

REQUIREMENTS:
- 2-4 short sentences
- First: Surprising claim
- Middle: Specific detail (dates, names, numbers)
- Last: Thought-provoking element
- NO hashtags, NO emojis
- 280 chars max
- Deadpan tone
- BE SPECIFIC (helps verification)`;

  return generateVerifiedContent(prompt, {
    year: event.year,
    eventDescription: event.description,
    contentType: 'single_tweet'
  }, options);
}

export async function generateVerifiedThread(event, options = {}) {
  const prompt = `Create a 5-6 tweet thread:

Year: ${event.year}
Event: ${event.description}

STRUCTURE:
1. HOOK: Surprising claim
2. CONTEXT: Specific details
3. STORY: What happened
4. IMPACT: Why it mattered
5. CONNECTION: Modern parallel
6. ENGAGEMENT: Question

VOICE:
- Deadpan
- No hashtags/emojis
- 2-4 sentences each
- Specific facts (dates, names)
- Challenge assumptions

FORMAT: Numbered tweets (1-6), new line each.
BE SPECIFIC with facts.`;

  return generateVerifiedContent(prompt, {
    year: event.year,
    eventDescription: event.description,
    contentType: 'thread'
  }, options);
}

export async function batchGenerateVerified(events, options = {}) {
  const results = [];
  
  for (const event of events) {
    try {
      const result = await generateVerifiedTweet(event, options);
      results.push({ event, ...result });
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      results.push({ event, status: 'ERROR', error: error.message });
    }
  }
  
  const approved = results.filter(r => r.status === 'APPROVED').length;
  const queued = results.filter(r => r.status === 'QUEUED').length;
  const rejected = results.filter(r => r.status === 'REJECTED').length;
  const wikiVerified = results.filter(r => r.wikipediaVerified).length;
  
  console.log(`[Batch] ✅${approved} ⏸️${queued} ❌${rejected} 🌐${wikiVerified}`);
  
  return results;
}
