/**
 * Fallback Image Fetcher - Thematic/Period-Appropriate Images
 *
 * When exact event images aren't found, fetch visually engaging images
 * that reflect the time period, theme, and keywords of the event.
 *
 * Lower accuracy standards - just needs to be historically appropriate
 * and visually engaging for the era/theme.
 */

import { fetchFromLibraryOfCongress, fetchFromWikimediaCommons, fetchEventImage } from '../fetchImage.js';
import { checkImageQuality } from './imageVerifier.js';
import { wasImageRecentlyUsed } from './imageDiversity.js';

/**
 * Extract thematic search terms from event
 * Focus on: era, type of event, location, general theme
 */
function extractThematicTerms(event) {
  const terms = [];
  const description = event.description.toLowerCase();
  const year = event.year;

  // PRIORITY 1: War/conflict themes (most specific)
  if (description.includes('war') || description.includes('battle')) {
    if (description.includes('world war i') || description.includes('ww1') || (year >= 1914 && year <= 1918)) {
      terms.push('world war 1', 'great war', 'ww1 soldiers', 'trenches', 'first world war');
    } else if (description.includes('world war ii') || description.includes('ww2') || (year >= 1939 && year <= 1945)) {
      terms.push('world war 2', 'ww2', 'second world war', 'ww2 soldiers', 'world war two');
    } else if (description.includes('civil war') || (year >= 1861 && year <= 1865)) {
      terms.push('american civil war', 'civil war soldiers', 'civil war battle', 'civil war');
    } else if (description.includes('revolution') || description.includes('revolutionary')) {
      terms.push('revolutionary war', 'american revolution', 'colonial america', 'george washington', 'continental army');
    } else {
      terms.push(`war ${year}`, `battle ${year}`, 'military history');
    }
  }

  // PRIORITY 2: Political/diplomatic themes
  if (description.includes('treaty') || description.includes('agreement') || description.includes('signed')) {
    terms.push('treaty signing', 'diplomacy', 'political leaders', `${year} politics`);
  }

  // PRIORITY 3: Discovery/exploration themes
  if (description.includes('discover') || description.includes('expedition') || description.includes('explorer')) {
    terms.push('exploration', 'discovery', 'explorers', `${year} exploration`);
  }

  // PRIORITY 4: Scientific/innovation themes
  if (description.includes('invent') || description.includes('patent') || description.includes('discover')) {
    terms.push('invention', 'innovation', 'science history', `${year} technology`);
  }

  // PRIORITY 5: Era-based terms (more generic, come after specific themes)
  if (year < 500) {
    terms.push('ancient history', 'antiquity', 'ancient civilization');
  } else if (year >= 500 && year < 1500) {
    terms.push('medieval', 'middle ages', 'medieval history');
  } else if (year >= 1500 && year < 1800) {
    // For 1500-1800, check if it's actually Revolutionary War era
    if (year >= 1775 && year <= 1783) {
      // Already added Revolutionary War terms above, add era as backup
      terms.push('18th century', 'colonial america', 'early american history');
    } else {
      terms.push('early modern', '17th century', '18th century');
    }
  } else if (year >= 1800 && year < 1900) {
    terms.push('19th century', 'victorian era', '1800s');
  } else if (year >= 1900 && year < 1950) {
    terms.push('early 20th century', '1900s', 'turn of century');
  } else if (year >= 1950 && year < 2000) {
    terms.push('mid 20th century', 'post war era', 'modern history');
  }

  // PRIORITY 6: Location-based (if US location mentioned)
  if (description.includes('america') || description.includes('united states') || description.includes('washington')) {
    terms.push('american history', 'united states history');
  }

  // PRIORITY 7: Year + general history as last resort
  terms.push(`${year} history`, `historical ${year}`, `history ${Math.floor(year / 10) * 10}s`);

  return terms;
}

/**
 * Fetch thematic fallback image
 * Lower standards: just needs to be period-appropriate and visually engaging
 */
export async function fetchThematicFallbackImage(event) {
  console.log('[ThematicFallback] 🎨 Searching for period-appropriate thematic image...');
  console.log(`[ThematicFallback] Event: ${event.year} - ${event.description?.slice(0, 60)}...`);

  const thematicTerms = extractThematicTerms(event);
  console.log(`[ThematicFallback] Generated ${thematicTerms.length} thematic search terms`);

  // Try each thematic term
  for (let i = 0; i < Math.min(5, thematicTerms.length); i++) {
    const term = thematicTerms[i];
    console.log(`[ThematicFallback] Trying: "${term}"`);

    // Try Library of Congress first (best quality)
    try {
      const locResult = await fetchFromLibraryOfCongress(term, event.year, true);
      if (locResult) {
        const buffer = locResult.buffer || locResult;
        const metadata = locResult.metadata || { source: 'Library of Congress', searchTerm: term };

        if (Buffer.isBuffer(buffer)) {
          // Check diversity - skip if recently used
          const recentlyUsed = await wasImageRecentlyUsed(buffer, metadata.url || metadata.imageUrl);
          if (recentlyUsed) {
            console.log(`[ThematicFallback] ⚠️  Skipping LOC image for "${term}": Recently used (trying next term)`);
            continue;
          }

          const qualityCheck = await checkImageQuality(buffer);
          if (qualityCheck.passed) {
            console.log(`[ThematicFallback] ✅ Found from Library of Congress: "${term}"`);
            return {
              buffer,
              metadata: {
                ...metadata,
                isFallback: true,
                fallbackType: 'thematic',
                thematicTerm: term,
              }
            };
          }
        }
      }
    } catch (error) {
      console.log(`[ThematicFallback] LOC failed for "${term}": ${error.message}`);
    }

    // Try Wikimedia Commons as backup
    try {
      const wikimediaResult = await fetchFromWikimediaCommons(term, true);
      if (wikimediaResult) {
        const buffer = wikimediaResult.buffer || wikimediaResult;
        const metadata = wikimediaResult.metadata || { source: 'Wikimedia Commons', searchTerm: term };

        if (Buffer.isBuffer(buffer)) {
          // Check diversity - skip if recently used
          const recentlyUsed = await wasImageRecentlyUsed(buffer, metadata.url || metadata.imageUrl);
          if (recentlyUsed) {
            console.log(`[ThematicFallback] ⚠️  Skipping Wikimedia image for "${term}": Recently used (trying next term)`);
            continue;
          }

          const qualityCheck = await checkImageQuality(buffer);
          if (qualityCheck.passed) {
            console.log(`[ThematicFallback] ✅ Found from Wikimedia Commons: "${term}"`);
            return {
              buffer,
              metadata: {
                ...metadata,
                isFallback: true,
                fallbackType: 'thematic',
                thematicTerm: term,
              }
            };
          }
        }
      }
    } catch (error) {
      console.log(`[ThematicFallback] Wikimedia failed for "${term}": ${error.message}`);
    }

    // Try Wikipedia as last resort for this term
    try {
      const wikipediaBuffer = await fetchEventImage({ ...event, description: term }, false);
      if (wikipediaBuffer && Buffer.isBuffer(wikipediaBuffer)) {
        // Check diversity - skip if recently used
        const recentlyUsed = await wasImageRecentlyUsed(wikipediaBuffer, null);
        if (recentlyUsed) {
          console.log(`[ThematicFallback] ⚠️  Skipping Wikipedia image for "${term}": Recently used (trying next term)`);
          continue;
        }

        const qualityCheck = await checkImageQuality(wikipediaBuffer);
        if (qualityCheck.passed) {
          console.log(`[ThematicFallback] ✅ Found from Wikipedia: "${term}"`);
          return {
            buffer: wikipediaBuffer,
            metadata: {
              source: 'Wikipedia',
              searchTerm: term,
              isFallback: true,
              fallbackType: 'thematic',
              thematicTerm: term,
            }
          };
        }
      }
    } catch (error) {
      console.log(`[ThematicFallback] Wikipedia failed for "${term}": ${error.message}`);
    }
  }

  console.log('[ThematicFallback] ❌ No thematic images found');
  return null;
}

/**
 * Verify thematic fallback image with RELAXED standards
 * Just needs to be period-appropriate and visually engaging
 */
export async function verifyThematicImage(candidate, event, openai) {
  try {
    console.log('[ThematicFallback] 🔍 Verifying thematic appropriateness...');

    const base64Image = candidate.buffer.toString('base64');
    const metadata = candidate.metadata;

    const prompt = `You are verifying that an image is THEMATICALLY APPROPRIATE for a historical tweet.

EVENT:
Year: ${event.year}
Description: ${event.description}

IMAGE SOURCE:
Source: ${metadata.source}
Search Term: "${metadata.thematicTerm}"

IMPORTANT: This is a FALLBACK image - we're NOT looking for an exact match!

YOUR TASK: Rate if this image is visually appropriate and engaging for this historical theme.

SCORING (0-100):
- 80-100: Perfect fit - shows the era, theme, or related historical context
- 60-79: Good fit - period-appropriate, captures the spirit of the event
- 40-59: Acceptable - roughly the right era or theme
- 20-39: Weak fit - wrong era but still historical
- 0-19: Not appropriate - completely unrelated or modern

EXAMPLES OF GOOD FALLBACK:
- Event: "1776 Norfolk burning" → Image: Revolutionary War soldiers (good fit)
- Event: "1944 D-Day landing" → Image: WW2 troops on beach (perfect fit)
- Event: "1969 Moon landing" → Image: Apollo astronaut (perfect fit)
- Event: "1215 Magna Carta signed" → Image: Medieval king (good fit)

Respond in JSON:
{
  "thematicScore": 75,
  "verdict": "APPROVED" | "ACCEPTABLE" | "REJECTED",
  "reasoning": "Brief explanation",
  "visualDescription": "What you see in the image",
  "isPeriodAppropriate": true,
  "isVisuallyEngaging": true
}

Verdict guidelines:
- APPROVED: thematicScore >= 65
- ACCEPTABLE: thematicScore >= 50
- REJECTED: thematicScore < 50`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a historian evaluating thematic appropriateness of images. Be GENEROUS - we want engaging visuals. Respond ONLY in valid JSON.'
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
      max_tokens: 400,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4 Vision');
    }

    // Clean markdown code fences
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```(?:json)?\s*/i, '');
      cleanedContent = cleanedContent.replace(/\s*```\s*$/, '');
    }

    const parsed = JSON.parse(cleanedContent);

    console.log(`[ThematicFallback] 📊 Thematic Score: ${parsed.thematicScore}/100`);
    console.log(`[ThematicFallback] 📊 Verdict: ${parsed.verdict}`);
    console.log(`[ThematicFallback] 💭 ${parsed.reasoning}`);

    return {
      ...parsed,
      source: metadata.source,
      thematicTerm: metadata.thematicTerm,
    };

  } catch (error) {
    console.error(`[ThematicFallback] Verification error: ${error.message}`);
    return {
      thematicScore: 0,
      verdict: 'REJECTED',
      reasoning: `Verification failed: ${error.message}`,
      visualDescription: 'Unknown',
    };
  }
}
