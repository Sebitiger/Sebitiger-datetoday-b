/**
 * ENHANCED FACT CHECKER with CORRECTIONS + WIKIPEDIA VERIFICATION
 * 
 * Multi-layer verification:
 * 1. GPT-4 initial check with specific corrections
 * 2. Wikipedia cross-reference for key facts
 * 3. Final confidence scoring (target: 95%+)
 */

import { openai } from '../openaiCommon.js';

/**
 * Main verification function with corrections
 */
export async function verifyAndDecide(content, context = {}) {
  // Layer 1: GPT-4 Verification with corrections
  const gptVerification = await verifyWithGPT4(content, context);
  
  // If high confidence, check Wikipedia for extra validation
  if (gptVerification.confidence >= 85) {
    const wikiVerification = await verifyWithWikipedia(content, context);
    
    // Combine scores
    const finalConfidence = calculateFinalConfidence(gptVerification, wikiVerification);
    
    return {
      ...gptVerification,
      confidence: finalConfidence,
      wikipediaVerified: wikiVerification.verified,
      wikipediaSources: wikiVerification.sources,
      shouldPost: finalConfidence >= 95,
      needsReview: finalConfidence >= 90 && finalConfidence < 95,
      action: finalConfidence >= 95 ? 'POST' : (finalConfidence >= 90 ? 'QUEUE' : 'CORRECT')
    };
  }
  
  // If low confidence, return with corrections for retry
  return {
    ...gptVerification,
    shouldPost: false,
    needsReview: false,
    action: gptVerification.confidence >= 70 ? 'CORRECT' : 'REJECT'
  };
}

/**
 * GPT-4 Verification with specific corrections
 */
async function verifyWithGPT4(content, context) {
  const verificationPrompt = `You are a meticulous fact-checker. Verify this historical content for accuracy.

Content to verify:
"${content}"

Context:
Year: ${context.year || 'Unknown'}
Event: ${context.eventDescription || 'Unknown'}

Your task:
1. Check historical accuracy (dates, names, facts)
2. Identify oversimplifications or missing context
3. Provide SPECIFIC corrections if anything is wrong
4. Give a confidence score (0-100%)

Respond in JSON format:
{
  "confidence": 85,
  "verdict": "ACCURATE" | "NEEDS_NUANCE" | "INCORRECT",
  "concerns": ["concern1", "concern2"],
  "corrections": [
    "Specific correction 1",
    "Specific correction 2"
  ],
  "suggestedFix": "If corrections needed, suggest how to fix the content",
  "reasoning": "Brief explanation of your assessment"
}

EXAMPLES OF GOOD CORRECTIONS:
❌ BAD: "Date is wrong"
✅ GOOD: "Event happened in 1815, not 1816. Correct date: June 18, 1815"

❌ BAD: "Missing context"
✅ GOOD: "Add context: This occurred during the Napoleonic Wars, specifically at Waterloo"

❌ BAD: "Name is incorrect"
✅ GOOD: "Napoleon was 5'7\\" (170cm), not 5'2\\". The 'short Napoleon' is British propaganda"

Be specific, actionable, and helpful.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert fact-checker. Provide detailed, specific corrections in valid JSON format.' 
        },
        { role: 'user', content: verificationPrompt }
      ],
      temperature: 0.3, // Lower temp for accuracy
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    console.log('[FactChecker] GPT-4 Verification:', {
      confidence: result.confidence,
      verdict: result.verdict,
      hasCorrections: result.corrections?.length > 0
    });

    return {
      confidence: result.confidence || 0,
      verdict: result.verdict || 'UNKNOWN',
      concerns: result.concerns || [],
      corrections: result.corrections || [],
      suggestedFix: result.suggestedFix || null,
      reasoning: result.reasoning || '',
      verificationMethod: 'GPT-4'
    };

  } catch (error) {
    console.error('[FactChecker] GPT-4 verification error:', error.message);
    
    // Default to cautious response on error
    return {
      confidence: 50,
      verdict: 'ERROR',
      concerns: ['Verification failed'],
      corrections: [],
      suggestedFix: null,
      reasoning: error.message,
      verificationMethod: 'GPT-4'
    };
  }
}

/**
 * Wikipedia Verification Layer
 * Searches Wikipedia to cross-reference key facts
 */
async function verifyWithWikipedia(content, context) {
  try {
    // Extract key terms to search
    const searchTerms = extractKeyTerms(content, context);
    
    console.log('[WikiVerifier] Searching for:', searchTerms);
    
    // Search Wikipedia for each key term
    const wikiResults = await Promise.all(
      searchTerms.slice(0, 2).map(term => searchWikipedia(term))
    );
    
    // Check if content matches Wikipedia
    const matches = wikiResults.filter(r => r.found);
    const verificationScore = (matches.length / searchTerms.slice(0, 2).length) * 100;
    
    console.log('[WikiVerifier] Found', matches.length, 'of', searchTerms.slice(0, 2).length, 'terms');
    
    return {
      verified: matches.length > 0,
      score: verificationScore,
      sources: matches.map(m => m.url),
      termsChecked: searchTerms.slice(0, 2),
      termsFound: matches.map(m => m.term)
    };
    
  } catch (error) {
    console.error('[WikiVerifier] Error:', error.message);
    return {
      verified: false,
      score: 0,
      sources: [],
      termsChecked: [],
      termsFound: []
    };
  }
}

/**
 * Extract key terms from content for Wikipedia search
 */
function extractKeyTerms(content, context) {
  const terms = [];
  
  // Add year if present
  if (context.year) {
    terms.push(context.year.toString());
  }
  
  // Extract proper nouns and important terms from content
  // Simple approach: look for capitalized words and dates
  const words = content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
  const dates = content.match(/\b\d{4}\b/g) || [];
  
  // Combine and deduplicate
  const allTerms = [...new Set([...terms, ...words, ...dates])];
  
  // Filter out common words
  const filtered = allTerms.filter(term => 
    term.length > 3 && 
    !['This', 'That', 'Today', 'December', 'January'].includes(term)
  );
  
  return filtered.slice(0, 3); // Max 3 terms to search
}

/**
 * Search Wikipedia for a term
 */
async function searchWikipedia(term) {
  try {
    // Wikipedia API search
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&format=json&origin=*`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.query?.search?.length > 0) {
      const pageTitle = data.query.search[0].title;
      const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
      
      return {
        found: true,
        term,
        title: pageTitle,
        url: pageUrl
      };
    }
    
    return { found: false, term };
    
  } catch (error) {
    console.error('[WikiSearch] Error searching for', term, ':', error.message);
    return { found: false, term };
  }
}

/**
 * Calculate final confidence score combining GPT-4 and Wikipedia
 */
function calculateFinalConfidence(gptVerification, wikiVerification) {
  const gptScore = gptVerification.confidence;
  const wikiScore = wikiVerification.score;
  
  // If Wikipedia verification successful, boost confidence
  if (wikiVerification.verified) {
    // Weighted average: GPT-4 (70%), Wikipedia (30%)
    const combined = (gptScore * 0.7) + (wikiScore * 0.3);
    
    // Cap at 98% (never 100% certain)
    return Math.min(Math.round(combined), 98);
  }
  
  // If Wikipedia check failed or returned nothing, use GPT-4 score only
  return gptScore;
}

/**
 * Apply corrections to content
 * This is called by the generator when confidence is <90%
 */
export function buildCorrectionPrompt(originalContent, verification) {
  if (!verification.corrections || verification.corrections.length === 0) {
    return null;
  }
  
  return `Previous version had issues. Generate a corrected version.

ORIGINAL CONTENT:
"${originalContent}"

ISSUES FOUND:
${verification.concerns.map(c => `- ${c}`).join('\n')}

SPECIFIC CORRECTIONS NEEDED:
${verification.corrections.map(c => `- ${c}`).join('\n')}

${verification.suggestedFix ? `SUGGESTED FIX:\n${verification.suggestedFix}\n` : ''}

Generate a NEW version that:
1. Fixes ALL the issues above
2. Uses the same engaging style
3. Keeps the same approximate length
4. Maintains deadpan, myth-busting tone
5. NO hashtags, NO emojis

CORRECTED VERSION:`;
}
