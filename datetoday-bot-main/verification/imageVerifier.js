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
 * Fetch multiple image candidates from ALL sources and select the best one
 * Uses parallel fetching, GPT-4 Vision scoring, engagement optimization, and style learning
 */
export async function fetchVerifiedImage(event, tweetContent) {
  try {
    console.log('[ImageVerifier] 🖼️  Fetching multiple image candidates from all sources...');

    // Get optimal source order based on engagement data
    const recentSources = await getRecentSources(5);
    const sourceOrder = await getOptimalSourceOrder(recentSources);

    const searchTerm = event.description?.split(' ').slice(0, 8).join(' ');

    // Define source fetch functions
    const sourceFetchers = {
      'Wikipedia Primary': () => fetchEventImage(event, false),
      'Wikimedia Commons': () => fetchFromWikimediaCommons(searchTerm, true),
      'Library of Congress': () => fetchFromLibraryOfCongress(searchTerm, event.year, true),
      'Smithsonian': () => fetchFromSmithsonian(searchTerm, true)
    };

    // Fetch from top 3 sources in parallel (to save time)
    const topSources = sourceOrder.slice(0, 3);
    console.log(`[ImageVerifier] Fetching from top 3 sources: ${topSources.join(', ')}`);

    const fetchPromises = topSources.map(async (sourceName) => {
      const fetcher = sourceFetchers[sourceName];
      if (!fetcher) return null;

      try {
        const result = await fetcher();
        if (!result) return null;

        // Handle both buffer-only and {buffer, metadata} returns
        const buffer = result.buffer || result;
        const metadata = result.metadata || {
          source: sourceName,
          searchTerm: searchTerm
        };

        return { buffer, metadata };
      } catch (error) {
        console.log(`[ImageVerifier] ${sourceName} fetch failed:`, error.message);
        return null;
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    const candidates = [];

    // Process results and apply quality filtering
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;

      const { buffer, metadata } = result.value;

      // Pre-filter by quality
      const qualityCheck = await checkImageQuality(buffer);

      if (qualityCheck.passed) {
        candidates.push({
          buffer,
          metadata: {
            ...metadata,
            imageMetadata: qualityCheck.metadata
          }
        });
        console.log(`[ImageVerifier] ✅ Quality passed: ${metadata.source}`);
      } else {
        console.log(`[ImageVerifier] ⚠️  Quality failed: ${metadata.source} - ${qualityCheck.reason}`);
      }
    }

    if (candidates.length === 0) {
      console.log('[ImageVerifier] No quality candidates found - posting text-only');
      return null;
    }

    console.log(`[ImageVerifier] 🔍 Evaluating ${candidates.length} candidate(s) with GPT-4 Vision...`);

    // Verify each candidate and score them
    const scoredCandidates = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      console.log(`[ImageVerifier] Analyzing candidate ${i + 1}/${candidates.length} (${candidate.metadata.source})...`);

      // Run verification and style analysis in parallel
      const [verification, styleInfo] = await Promise.all([
        verifyImageMatch(
          candidate.metadata,
          event,
          tweetContent,
          candidate.buffer
        ),
        analyzeImageStyle(candidate.buffer)
      ]);

      // Get style preference score
      const styleScore = await getStylePreferenceScore(styleInfo);

      // Combined score: 70% verification confidence + 30% style preference
      const combinedScore = verification.confidence * 0.7 + styleScore * 0.3;

      scoredCandidates.push({
        ...candidate,
        verification,
        styleInfo,
        styleScore,
        score: combinedScore
      });

      console.log(`[ImageVerifier] → ${verification.verdict} (${verification.confidence}%) | Style: ${styleInfo.type} (${styleScore.toFixed(1)}) | Combined: ${combinedScore.toFixed(1)}`);
    }

    // Sort by combined score (highest first)
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Get the best candidate
    const best = scoredCandidates[0];

    // BALANCED RULE: Only APPROVED verdict with 70%+ confidence
    if (best.verification.verdict === 'APPROVED' && best.verification.confidence >= 70) {
      console.log(`[ImageVerifier] ✅ Best image selected: ${best.metadata.source} (verification: ${best.verification.confidence}%, style: ${best.styleScore.toFixed(1)}, combined: ${best.score.toFixed(1)})`);
      console.log(`[ImageVerifier] Reason: ${best.verification.reasoning}`);
      console.log(`[ImageVerifier] Style: ${best.styleInfo.type} / ${best.styleInfo.era} / ${best.styleInfo.colorScheme}`);

      // Cache this successful image for future use
      await cacheImage(event, {
        source: best.metadata.source,
        confidence: best.verification.confidence,
        verdict: best.verification.verdict,
        styleInfo: best.styleInfo
      });

      // Track style for diversity learning (will be associated with tweet later)
      // Note: We'll track with tweetId when the tweet is posted

      return best.buffer;
    }

    // Everything else = reject
    console.log(`[ImageVerifier] ❌ All images REJECTED`);
    console.log(`[ImageVerifier] Best was: ${best.verification.verdict} (${best.verification.confidence}%)`);
    console.log(`[ImageVerifier] Reason: ${best.verification.reasoning}`);
    console.log(`[ImageVerifier] → Posting text-only instead`);
    return null;

  } catch (error) {
    console.error('[ImageVerifier] Error:', error.message);
    console.log('[ImageVerifier] → Posting text-only due to error');
    return null;
  }
}
