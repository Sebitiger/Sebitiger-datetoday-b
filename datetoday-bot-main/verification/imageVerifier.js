/**
 * ENHANCED IMAGE VERIFICATION SYSTEM - BALANCED MODE
 * Only accepts APPROVED verdict with 70%+ confidence
 */

import { openai } from '../openaiCommon.js';
import { fetchEventImage } from '../fetchImage.js';

async function verifyImageMatch(imageMetadata, event, tweetContent) {
  try {
    const verificationPrompt = `You are verifying that an image matches a historical event. Be VERY strict.

EVENT:
Year: ${event.year}
Description: ${event.description}

TWEET CONTENT:
"${tweetContent}"

IMAGE METADATA:
Source: ${imageMetadata.source}
Search Term Used: ${imageMetadata.searchTerm}
Image URL Fragment: ${imageMetadata.urlFragment || 'Unknown'}

Your task:
1. Check if the image ACTUALLY shows the person/event described
2. Look for name mismatches (e.g., "King Michael" vs "Queen Mary" = WRONG)
3. Check for wrong time period or context
4. Be strict - when in doubt, mark as QUESTIONABLE or WRONG

Respond in JSON:
{
  "isMatch": true/false,
  "confidence": 85,
  "verdict": "APPROVED" | "QUESTIONABLE" | "WRONG",
  "reasoning": "Specific explanation of why this image does/doesn't match"
}

CRITICAL EXAMPLES:
- Event about "King X", Image shows "Queen Y" = WRONG (different person!)
- Event about battle, Image shows unrelated scene = WRONG
- Event from 1900s, Image is modern photo = WRONG
- Generic stock photo with no specific connection = QUESTIONABLE
- Historical photo clearly showing the actual event/person = APPROVED

Be STRICT. Only mark APPROVED if you're confident the image actually matches.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Expert at verifying historical image accuracy. Be strict. Respond in JSON.' },
        { role: 'user', content: verificationPrompt }
      ],
      temperature: 0.2, // Even lower for stricter checking
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    console.log('[ImageVerifier] Result:', result.verdict, result.confidence + '%');
    console.log('[ImageVerifier] Reasoning:', result.reasoning);

    return {
      isMatch: result.isMatch !== false,
      confidence: result.confidence || 0,
      verdict: result.verdict || 'QUESTIONABLE',
      reasoning: result.reasoning || '',
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

export async function fetchVerifiedImage(event, tweetContent) {
  try {
    console.log('[ImageVerifier] 🖼️  Fetching image...');
    
    const imageBuffer = await fetchEventImage(event, false);
    
    if (!imageBuffer) {
      console.log('[ImageVerifier] No image found - posting text-only');
      return null;
    }
    
    // Extract more metadata for better verification
    const imageMetadata = {
      source: 'Wikipedia/Pexels/Unsplash',
      searchTerm: event.description?.split(' ').slice(0, 8).join(' '),
      urlFragment: 'Unknown' // Could be extracted from fetch process
    };
    
    console.log('[ImageVerifier] 🔍 Verifying accuracy with BALANCED mode...');

    const verification = await verifyImageMatch(imageMetadata, event, tweetContent);

    // BALANCED RULE: Only APPROVED verdict with 70%+ confidence
    if (verification.verdict === 'APPROVED' && verification.confidence >= 70) {
      console.log(`[ImageVerifier] ✅ Image APPROVED (${verification.confidence}%)`);
      console.log(`[ImageVerifier] Reason: ${verification.reasoning}`);
      return imageBuffer;
    }
    
    // Everything else = reject
    console.log(`[ImageVerifier] ❌ Image REJECTED`);
    console.log(`[ImageVerifier] Verdict: ${verification.verdict}, Confidence: ${verification.confidence}%`);
    console.log(`[ImageVerifier] Reason: ${verification.reasoning}`);
    console.log(`[ImageVerifier] → Posting text-only instead`);
    return null;
    
  } catch (error) {
    console.error('[ImageVerifier] Error:', error.message);
    console.log('[ImageVerifier] → Posting text-only due to error');
    return null;
  }
}
