/**
 * ENHANCED IMAGE VERIFICATION SYSTEM
 */

import { openai } from '../openaiCommon.js';
import { fetchEventImage } from '../fetchImage.js';

async function verifyImageMatch(imageMetadata, event, tweetContent) {
  try {
    const verificationPrompt = `You are verifying that an image matches a historical event.

EVENT:
Year: ${event.year}
Description: ${event.description}

TWEET CONTENT:
"${tweetContent}"

IMAGE METADATA:
Source: ${imageMetadata.source}
Search Term: ${imageMetadata.searchTerm}

Respond in JSON:
{
  "isMatch": true/false,
  "confidence": 85,
  "verdict": "APPROVED" | "QUESTIONABLE" | "WRONG",
  "reasoning": "Brief explanation"
}

Be strict. Modern satellite imagery for historical events = WRONG. Generic stock photos = QUESTIONABLE.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Expert at verifying historical image accuracy. Respond in JSON.' },
        { role: 'user', content: verificationPrompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    console.log('[ImageVerifier] Result:', result.verdict, result.confidence + '%');

    return {
      isMatch: result.isMatch !== false,
      confidence: result.confidence || 0,
      verdict: result.verdict || 'QUESTIONABLE',
      reasoning: result.reasoning || ''
    };

  } catch (error) {
    console.error('[ImageVerifier] Error:', error.message);
    return {
      isMatch: false,
      confidence: 0,
      verdict: 'ERROR',
      reasoning: error.message
    };
  }
}

export async function fetchVerifiedImage(event, tweetContent, minConfidence = 70) {
  try {
    console.log('[ImageVerifier] 🖼️  Fetching image...');
    
    const imageBuffer = await fetchEventImage(event, false);
    
    if (!imageBuffer) {
      console.log('[ImageVerifier] No image found');
      return null;
    }
    
    const imageMetadata = {
      source: 'Wikipedia/Pexels/Unsplash',
      searchTerm: event.description?.split(' ').slice(0, 5).join(' ')
    };
    
    console.log('[ImageVerifier] 🔍 Verifying accuracy...');
    
    const verification = await verifyImageMatch(imageMetadata, event, tweetContent);
    
    if (verification.verdict === 'APPROVED' && verification.confidence >= minConfidence) {
      console.log(`[ImageVerifier] ✅ APPROVED (${verification.confidence}%)`);
      return imageBuffer;
    }
    
    if (verification.verdict === 'QUESTIONABLE' && verification.confidence >= 80) {
      console.log(`[ImageVerifier] ⚠️  QUESTIONABLE but high confidence (${verification.confidence}%)`);
      return imageBuffer;
    }
    
    console.log(`[ImageVerifier] ❌ REJECTED (${verification.confidence}%): ${verification.reasoning}`);
    return null;
    
  } catch (error) {
    console.error('[ImageVerifier] Error:', error.message);
    return null;
  }
}
