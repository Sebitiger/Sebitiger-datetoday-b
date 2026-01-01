/**
 * PREMIUM IMAGE VERIFICATION SYSTEM
 * Multi-source fetching with intelligent GPT-4 Vision scoring
 * Prioritizes Library of Congress > Smithsonian > Wikimedia Commons > Wikipedia
 */

import { openai } from '../openaiCommon.js';
import { smartFetchImage, simpleFetchImage } from './smartImageFetcher.js';
import { IMAGE_SOURCE_CONFIG, calculateImageScore } from './imageSourceConfig.js';

/**
 * Enhanced GPT-4 Vision verification with quality and accuracy scoring
 */
async function verifyImageWithScoring(candidate, event, tweetContent) {
  try {
    const base64Image = candidate.buffer.toString('base64');
    const metadata = candidate.metadata;

    const prompt = `You are an expert at verifying historical images for accuracy AND quality.

EVENT DETAILS:
Year: ${event.year}
Description: ${event.description}

TWEET CONTENT:
"${tweetContent}"

IMAGE SOURCE:
Source: ${metadata.source}
Search Term: ${metadata.searchTerm}
${metadata.title ? `Title: ${metadata.title}` : ''}
${metadata.description ? `Description: ${metadata.description}` : ''}
${metadata.date ? `Date: ${metadata.date}` : ''}
${metadata.url ? `URL Fragment: ${metadata.url?.slice(-50)}` : ''}

YOUR TASK:
Analyze the image and provide TWO separate scores:

1. HISTORICAL ACCURACY (0-100):
   - 90-100: Perfect match (exact person/event/location from correct time)
   - 70-89: Good match (relevant historical photo from correct era)
   - 50-69: Loosely related (generic historical image, somewhat relevant)
   - 30-49: Wrong era or only tangentially related
   - 0-29: Completely wrong (wrong person, modern photo, logo, irrelevant)

2. IMAGE QUALITY (0-100):
   - 90-100: High-resolution photograph, clear details, museum quality
   - 70-89: Good quality photo, acceptable resolution
   - 50-69: Adequate quality, some pixelation or low-res
   - 30-49: Poor quality, very low-res or heavily compressed
   - 0-29: Terrible quality, logo/icon/symbol instead of photo

SPECIAL RULES:
- Modern logos/symbols for historical events = 0 accuracy
- SVG icons (like military badges) = 0 accuracy unless it's specifically about that badge
- Prefer actual photographs over illustrations when possible
- Generic historical photos from correct era = 60-75 accuracy (acceptable)
- Primary source photos (actual event) = 90-100 accuracy

Respond in JSON:
{
  "accuracyScore": 85,
  "qualityScore": 70,
  "verdict": "APPROVED" | "ACCEPTABLE" | "REJECTED",
  "reasoning": "Clear explanation of why you scored it this way",
  "visualDescription": "What you actually see in the image",
  "isLogo": false,
  "isPhotograph": true,
  "isPeriodAppropriate": true
}

Verdict guidelines:
- APPROVED: accuracyScore >= 75 AND qualityScore >= 60
- ACCEPTABLE: accuracyScore >= 60 OR qualityScore >= 70
- REJECTED: accuracyScore < 60 AND qualityScore < 70`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert historian and image quality analyst. Respond ONLY in valid JSON.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high'
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4 Vision');
    }

    // Parse JSON response
    const parsed = JSON.parse(content);

    // Calculate combined score
    const combinedScore = calculateImageScore(
      parsed.accuracyScore,
      parsed.qualityScore,
      metadata.source
    );

    console.log(`[EnhancedVerifier] 📊 ${metadata.source}:`);
    console.log(`[EnhancedVerifier]    Accuracy: ${parsed.accuracyScore}/100`);
    console.log(`[EnhancedVerifier]    Quality: ${parsed.qualityScore}/100`);
    console.log(`[EnhancedVerifier]    Combined: ${combinedScore}/100`);
    console.log(`[EnhancedVerifier]    Verdict: ${parsed.verdict}`);

    return {
      ...parsed,
      combinedScore,
      source: metadata.source,
    };

  } catch (error) {
    console.error(`[EnhancedVerifier] Verification error: ${error.message}`);
    return {
      accuracyScore: 0,
      qualityScore: 0,
      combinedScore: 0,
      verdict: 'REJECTED',
      reasoning: `Verification failed: ${error.message}`,
      visualDescription: 'Unknown',
      source: candidate.metadata.source,
    };
  }
}

/**
 * Main function: Fetch and verify image with premium sources
 */
export async function fetchVerifiedImage(event, tweetContent) {
  try {
    console.log(`[EnhancedVerifier] 🎯 Starting premium image fetch...`);
    console.log(`[EnhancedVerifier] Event: ${event.year} - ${event.description?.slice(0, 60)}...`);

    const config = IMAGE_SOURCE_CONFIG.verification;

    if (!config.enabled) {
      console.log(`[EnhancedVerifier] ⚠️  Verification disabled - using simple fetch`);
      return await simpleFetchImage(event);
    }

    // Step 1: Fetch candidates from multiple premium sources
    console.log(`[EnhancedVerifier] 📡 Fetching from premium sources (parallel)...`);
    const candidates = await smartFetchImage(event, tweetContent);

    if (!candidates || candidates.length === 0) {
      console.log(`[EnhancedVerifier] ❌ No images found from any source`);
      return null;
    }

    console.log(`[EnhancedVerifier] 🔍 Verifying ${candidates.length} candidates with GPT-4 Vision...`);

    // Step 2: Verify each candidate with GPT-4 Vision
    const verifiedCandidates = [];

    for (const candidate of candidates) {
      const verification = await verifyImageWithScoring(candidate, event, tweetContent);

      verifiedCandidates.push({
        ...candidate,
        verification,
      });

      // Early exit if we find a great image
      if (verification.verdict === 'APPROVED' && verification.combinedScore >= 85) {
        console.log(`[EnhancedVerifier] ✅ Found excellent image from ${candidate.metadata.source} (score: ${verification.combinedScore})`);
        console.log(`[EnhancedVerifier] → ${verification.visualDescription}`);
        return candidate.buffer;
      }
    }

    // Step 3: Sort by combined score and select best
    verifiedCandidates.sort((a, b) => b.verification.combinedScore - a.verification.combinedScore);

    const best = verifiedCandidates[0];

    // Decision logic based on config
    const threshold = config.confidenceThreshold;
    const rejectThreshold = config.rejectBelow;

    if (best.verification.combinedScore >= threshold) {
      console.log(`[EnhancedVerifier] ✅ APPROVED: ${best.metadata.source} (score: ${best.verification.combinedScore})`);
      console.log(`[EnhancedVerifier] → ${best.verification.reasoning}`);
      return best.buffer;
    }

    if (best.verification.combinedScore >= rejectThreshold && best.verification.verdict !== 'REJECTED') {
      console.log(`[EnhancedVerifier] ⚠️  ACCEPTABLE: ${best.metadata.source} (score: ${best.verification.combinedScore})`);
      console.log(`[EnhancedVerifier] → Using it (above reject threshold)`);
      console.log(`[EnhancedVerifier] → ${best.verification.reasoning}`);
      return best.buffer;
    }

    console.log(`[EnhancedVerifier] ❌ All images REJECTED (best score: ${best.verification.combinedScore})`);
    console.log(`[EnhancedVerifier] → ${best.verification.reasoning}`);
    console.log(`[EnhancedVerifier] → Posting text-only`);

    return null;

  } catch (error) {
    console.error(`[EnhancedVerifier] Error: ${error.message}`);
    console.log(`[EnhancedVerifier] → Attempting fallback to simple fetch`);

    try {
      return await simpleFetchImage(event);
    } catch (fallbackError) {
      console.error(`[EnhancedVerifier] Fallback also failed: ${fallbackError.message}`);
      return null;
    }
  }
}

// Export for backward compatibility
export { verifyImageWithScoring as verifyImageMatch };
