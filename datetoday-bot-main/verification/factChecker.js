/**
 * FACT VERIFICATION SYSTEM
 * 
 * This module provides AI-powered fact-checking for generated content.
 * It uses GPT-4 to verify historical accuracy before posting.
 * 
 * Confidence Levels:
 * - HIGH (90-100): Verified facts, safe to auto-post
 * - MEDIUM (70-89): Likely accurate, queue for review
 * - LOW (0-69): Questionable accuracy, reject
 */

import { openai } from '../openaiCommon.js';

const FACT_CHECK_PROMPT = `You are a strict historical fact-checker. Your job is to verify the accuracy of historical claims.

CRITICAL RULES:
1. Be STRICT - err on the side of caution
2. Check for oversimplifications that distort truth
3. Flag claims that lack nuance
4. Verify dates, names, and specific details
5. Identify potential propaganda or bias
6. Note missing context that changes meaning

CONFIDENCE LEVELS:
- 100: Absolutely verified, multiple reliable sources
- 90-99: Very confident, well-documented facts
- 80-89: Confident, but minor uncertainties exist
- 70-79: Likely accurate, but lacks some verification
- 60-69: Questionable, significant concerns
- 0-59: Inaccurate or misleading

RESPONSE FORMAT (JSON only):
{
  "confidence": 0-100,
  "verdict": "ACCURATE" | "NEEDS_NUANCE" | "MISLEADING" | "INACCURATE",
  "concerns": ["list of specific issues"],
  "corrections": ["suggested fixes"],
  "sources_to_check": ["what to verify"],
  "missing_context": ["important omissions"]
}

Examples of what to flag:

❌ "Galileo was put on trial for discovering Jupiter's moons"
→ INACCURATE: He was tried for heliocentrism, not the moons
→ Confidence: 20

❌ "Einstein failed math in school"
→ INACCURATE: Myth from grading system change
→ Confidence: 15

✅ "Napoleon was 5'7\", average for his time"
→ ACCURATE: Well-documented, multiple sources
→ Confidence: 95

⚠️ "Medieval people were filthy"
→ NEEDS_NUANCE: They bathed regularly, this is Victorian propaganda
→ Confidence: 60

Return ONLY the JSON object, no other text.`;

/**
 * Verify a historical claim using GPT-4
 * @param {string} claim - The claim to verify (e.g., a tweet or thread)
 * @param {object} context - Additional context (event year, description, etc.)
 * @returns {Promise<object>} Verification result
 */
export async function verifyHistoricalClaim(claim, context = {}) {
  try {
    console.log('[FactChecker] Verifying claim:', claim.slice(0, 100) + '...');
    
    const contextInfo = [];
    if (context.year) contextInfo.push(`Year: ${context.year}`);
    if (context.eventDescription) contextInfo.push(`Event: ${context.eventDescription}`);
    
    const fullPrompt = contextInfo.length > 0
      ? `${contextInfo.join('\n')}\n\nCLAIM TO VERIFY:\n${claim}`
      : `CLAIM TO VERIFY:\n${claim}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: FACT_CHECK_PROMPT },
        { role: 'user', content: fullPrompt }
      ],
      temperature: 0.1, // Low temperature for consistency
      max_tokens: 1000
    });

    let result = response.choices[0].message.content.trim();
    
    // Strip markdown code blocks if present
    if (result.startsWith('```json')) {
      result = result.replace(/^```json\s*/g, '').replace(/\s*```$/g, '');
    } else if (result.startsWith('```')) {
      result = result.replace(/^```\s*/g, '').replace(/\s*```$/g, '');
    }
    result = result.trim();
    
    // Parse JSON response
    let verification;
    try {
      verification = JSON.parse(result);
    } catch (parseError) {
      console.error('[FactChecker] Failed to parse JSON:', result);
      throw new Error('Fact-checker returned invalid JSON');
    }

    // Validate response structure
    if (!verification.confidence || !verification.verdict) {
      throw new Error('Fact-checker response missing required fields');
    }

    // Add timestamp
    verification.timestamp = new Date().toISOString();
    verification.claim = claim;
    verification.context = context;

    // Log result
    console.log(`[FactChecker] Verdict: ${verification.verdict} (confidence: ${verification.confidence}%)`);
    if (verification.concerns?.length > 0) {
      console.log('[FactChecker] Concerns:', verification.concerns);
    }

    return verification;

  } catch (error) {
    console.error('[FactChecker] Verification failed:', error.message);
    
    // Return safe default on error
    return {
      confidence: 0,
      verdict: 'ERROR',
      concerns: [error.message],
      corrections: [],
      sources_to_check: [],
      missing_context: [],
      timestamp: new Date().toISOString(),
      claim,
      context
    };
  }
}

/**
 * Determine if content should be auto-posted, queued, or rejected
 * @param {object} verification - Result from verifyHistoricalClaim
 * @returns {object} Action to take
 */
export function getVerificationAction(verification) {
  const { confidence, verdict } = verification;

  // HIGH CONFIDENCE: Auto-post
  if (confidence >= 90 && verdict === 'ACCURATE') {
    return {
      action: 'POST',
      reason: 'High confidence, verified accurate',
      shouldPost: true,
      needsReview: false
    };
  }

  // MEDIUM CONFIDENCE: Queue for review
  if (confidence >= 70 && (verdict === 'ACCURATE' || verdict === 'NEEDS_NUANCE')) {
    return {
      action: 'QUEUE',
      reason: 'Medium confidence, needs human review',
      shouldPost: false,
      needsReview: true
    };
  }

  // LOW CONFIDENCE: Reject
  return {
    action: 'REJECT',
    reason: `Low confidence (${confidence}%) or ${verdict}`,
    shouldPost: false,
    needsReview: false
  };
}

/**
 * Verify content and get posting decision
 * @param {string} content - Content to verify
 * @param {object} context - Context information
 * @returns {Promise<object>} Complete verification result with action
 */
export async function verifyAndDecide(content, context = {}) {
  const verification = await verifyHistoricalClaim(content, context);
  const action = getVerificationAction(verification);
  
  return {
    ...verification,
    ...action
  };
}

/**
 * Batch verify multiple pieces of content
 * @param {Array<{content: string, context: object}>} items - Items to verify
 * @returns {Promise<Array<object>>} Verification results
 */
export async function batchVerify(items) {
  console.log(`[FactChecker] Batch verifying ${items.length} items...`);
  
  const results = [];
  
  for (const item of items) {
    const result = await verifyAndDecide(item.content, item.context);
    results.push({
      ...item,
      verification: result
    });
    
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  const posted = results.filter(r => r.verification.shouldPost).length;
  const queued = results.filter(r => r.verification.needsReview).length;
  const rejected = results.filter(r => !r.verification.shouldPost && !r.verification.needsReview).length;
  
  console.log(`[FactChecker] Batch complete: ${posted} to post, ${queued} queued, ${rejected} rejected`);
  
  return results;
}
