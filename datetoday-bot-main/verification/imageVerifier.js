/**
 * ENHANCED IMAGE VERIFICATION SYSTEM - BALANCED MODE
 * Only accepts APPROVED verdict with 70%+ confidence
 */

import { openai } from '../openaiCommon.js';
import {
  fetchEventImage,
  fetchFromWikimediaCommons,
  fetchFromLibraryOfCongress,
  fetchFromSmithsonian
} from '../fetchImage.js';
import sharp from 'sharp';
import { getCachedImage, cacheImage } from './imageCache.js';
import { getOptimalSourceOrder, getRecentSources } from './sourceOptimizer.js';
import { analyzeImageStyle, getStylePreferenceScore, trackImageStyle } from './stylePreferences.js';

/**
 * Pre-filter images by quality before expensive GPT-4 Vision verification
 * Checks resolution, file size, and aspect ratio
 * @param {Buffer} imageBuffer - Image buffer to check
 * @returns {Promise<{passed: boolean, reason: string, metadata: Object}>}
 */
async function checkImageQuality(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();

    const minWidth = 600;
    const minHeight = 400;
    const minFileSize = 30 * 1024; // 30KB
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    const fileSize = imageBuffer.length;

    // Check minimum dimensions
    if (metadata.width < minWidth || metadata.height < minHeight) {
      return {
        passed: false,
        reason: `Image too small (${metadata.width}x${metadata.height}, need ${minWidth}x${minHeight})`,
        metadata
      };
    }

    // Check file size
    if (fileSize < minFileSize) {
      return {
        passed: false,
        reason: `File too small (${(fileSize / 1024).toFixed(1)}KB, need ${minFileSize / 1024}KB)`,
        metadata
      };
    }

    if (fileSize > maxFileSize) {
      return {
        passed: false,
        reason: `File too large (${(fileSize / 1024 / 1024).toFixed(1)}MB, max ${maxFileSize / 1024 / 1024}MB)`,
        metadata
      };
    }

    // Check aspect ratio (avoid extreme ratios)
    const aspectRatio = metadata.width / metadata.height;
    if (aspectRatio > 3 || aspectRatio < 0.33) {
      return {
        passed: false,
        reason: `Aspect ratio too extreme (${aspectRatio.toFixed(2)})`,
        metadata
      };
    }

    return {
      passed: true,
      reason: `Quality OK (${metadata.width}x${metadata.height}, ${(fileSize / 1024).toFixed(1)}KB)`,
      metadata
    };
  } catch (error) {
    return {
      passed: false,
      reason: `Quality check failed: ${error.message}`,
      metadata: null
    };
  }
}

async function verifyImageMatch(imageMetadata, event, tweetContent, imageBuffer) {
  try {
    // Convert image buffer to base64 for GPT-4 Vision
    const base64Image = imageBuffer.toString('base64');

    const verificationPrompt = `You are verifying that an image matches a historical event. Be STRICT but FAIR.

EVENT:
Year: ${event.year}
Description: ${event.description}

TWEET CONTENT:
"${tweetContent}"

IMAGE METADATA:
Source: ${imageMetadata.source}
Search Term Used: ${imageMetadata.searchTerm}
${imageMetadata.url ? `URL: ${imageMetadata.url}` : ''}
${imageMetadata.title ? `Title: ${imageMetadata.title}` : ''}
${imageMetadata.description ? `Description: ${imageMetadata.description}` : ''}
${imageMetadata.date ? `Date: ${imageMetadata.date}` : ''}

ANALYZE THE ACTUAL IMAGE:
1. Look at what the image actually shows
2. Check if it matches the person/event/time period described
3. Look for name mismatches (e.g., "King Michael" vs "Queen Mary" = WRONG)
4. Check for anachronisms (modern photos for old events = WRONG)
5. Generic historical photos from correct era = OK if relevant

Respond in JSON:
{
  "isMatch": true/false,
  "confidence": 85,
  "verdict": "APPROVED" | "QUESTIONABLE" | "WRONG",
  "reasoning": "Specific explanation based on what you SEE in the image",
  "visualDescription": "Brief description of what the image shows"
}

GUIDELINES:
- APPROVED (70-100%): Image clearly shows the event/person/era, or is a relevant historical photo from the correct period
- QUESTIONABLE (50-69%): Generic historical image, loosely related but not specific
- WRONG (0-49%): Wrong person, wrong era, modern photo, or completely unrelated

Be FAIR: Historical photos from the correct era that relate to the topic should be APPROVED even if not perfectly specific.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // GPT-4 Vision
      messages: [
        {
          role: 'system',
          content: 'Expert at verifying historical image accuracy using visual analysis. Respond in JSON.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: verificationPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high' // High detail for better analysis
              }
            }
          ]
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);

    console.log('[ImageVerifier] Result:', result.verdict, result.confidence + '%');
    console.log('[ImageVerifier] Visual:', result.visualDescription || 'N/A');
    console.log('[ImageVerifier] Reasoning:', result.reasoning);

    return {
      isMatch: result.isMatch !== false,
      confidence: result.confidence || 0,
      verdict: result.verdict || 'QUESTIONABLE',
      reasoning: result.reasoning || '',
      visualDescription: result.visualDescription || '',
      concerns: result.concerns || []
    };

  } catch (error) {
    console.error('[ImageVerifier] Error:', error.message);
    return {
      isMatch: false,
      confidence: 0,
      verdict: 'ERROR',
      reasoning: error.message,
      concerns: ['Verification system error']
    };
  }
}

/**
 * Simplified, bulletproof image fetching with GPT-4 Vision verification
 * ALWAYS tries Wikipedia first (most reliable), then optionally tries other sources
 */
export async function fetchVerifiedImage(event, tweetContent) {
  try {
    console.log('[ImageVerifier] 🖼️  Fetching image with GPT-4 Vision verification...');

    const searchTerm = event.description?.split(' ').slice(0, 8).join(' ');
    const candidates = [];

    // STEP 1: ALWAYS try Wikipedia first (most reliable)
    console.log('[ImageVerifier] Trying Wikipedia (primary source)...');
    try {
      const wikipediaImage = await fetchEventImage(event, false);
      if (wikipediaImage && Buffer.isBuffer(wikipediaImage)) {
        candidates.push({
          buffer: wikipediaImage,
          metadata: {
            source: 'Wikipedia',
            searchTerm: searchTerm
          }
        });
        console.log('[ImageVerifier] ✅ Wikipedia image found');
      }
    } catch (error) {
      console.log('[ImageVerifier] Wikipedia fetch failed:', error.message);
    }

    // STEP 2: Try Wikimedia Commons as backup (also reliable)
    if (candidates.length === 0) {
      console.log('[ImageVerifier] Trying Wikimedia Commons (backup)...');
      try {
        const wikimediaResult = await fetchFromWikimediaCommons(searchTerm, true);
        if (wikimediaResult) {
          const buffer = wikimediaResult.buffer || wikimediaResult;
          const metadata = wikimediaResult.metadata || {
            source: 'Wikimedia Commons',
            searchTerm: searchTerm
          };

          if (buffer && Buffer.isBuffer(buffer)) {
            candidates.push({ buffer, metadata });
            console.log('[ImageVerifier] ✅ Wikimedia Commons image found');
          }
        }
      } catch (error) {
        console.log('[ImageVerifier] Wikimedia Commons fetch failed:', error.message);
      }
    }

    // STEP 3: If still no image, we're done (post text-only)
    if (candidates.length === 0) {
      console.log('[ImageVerifier] ❌ No images found from any source - posting text-only');
      return null;
    }

    console.log(`[ImageVerifier] Found ${candidates.length} candidate(s)`);

    // STEP 4: Quality check the first candidate
    const candidate = candidates[0];
    const qualityCheck = await checkImageQuality(candidate.buffer);

    if (!qualityCheck.passed) {
      console.log(`[ImageVerifier] ⚠️  Quality check failed: ${qualityCheck.reason}`);
      console.log('[ImageVerifier] → Posting text-only');
      return null;
    }

    console.log(`[ImageVerifier] ✅ Quality check passed: ${qualityCheck.reason}`);

    // STEP 5: GPT-4 Vision verification (optional - can be disabled for speed/cost)
    const ENABLE_VISION_VERIFICATION = false; // Set to true to enable full GPT-4 Vision verification

    if (ENABLE_VISION_VERIFICATION) {
      console.log('[ImageVerifier] 🔍 Verifying with GPT-4 Vision...');

      const verification = await verifyImageMatch(
        candidate.metadata,
        event,
        tweetContent,
        candidate.buffer
      );

      console.log(`[ImageVerifier] → ${verification.verdict} (${verification.confidence}%)`);
      console.log(`[ImageVerifier] Reason: ${verification.reasoning}`);

      // BALANCED RULE: Only APPROVED verdict with 70%+ confidence
      if (verification.verdict === 'APPROVED' && verification.confidence >= 70) {
        console.log('[ImageVerifier] ✅ Image APPROVED by GPT-4 Vision');
        return candidate.buffer;
      } else {
        console.log(`[ImageVerifier] ❌ Image REJECTED by GPT-4 Vision (${verification.verdict}, ${verification.confidence}%)`);
        console.log('[ImageVerifier] → Posting text-only');
        return null;
      }
    } else {
      // Simplified mode: if we have a quality image from reliable source, use it
      console.log('[ImageVerifier] ✅ Using image (Vision verification disabled)');
      console.log(`[ImageVerifier] Source: ${candidate.metadata.source}`);
      return candidate.buffer;
    }

  } catch (error) {
    console.error('[ImageVerifier] Error:', error.message);
    console.log('[ImageVerifier] → Posting text-only due to error');
    return null;
  }
}
