// fetchImage.js
// Multi-source image fetcher: Wikipedia, Unsplash, Pexels, Wikimedia Commons
// Always returns: Buffer OR null

import axios from "axios";
import sharp from "sharp";
import { retryWithBackoff } from "./utils.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Try to fetch image from a Wikipedia page
 * @param {number} pageId - Wikipedia page ID
 * @param {boolean} returnMetadata - If true, returns {buffer, metadata}, otherwise just buffer
 * @returns {Promise<Buffer|Object|null>} - Image buffer or {buffer, metadata} or null
 */
async function fetchImageFromPageId(pageId, returnMetadata = false) {
  try {
    const pageInfoRes = await axios.get(
      "https://en.wikipedia.org/w/api.php",
      {
        params: {
          action: "query",
          pageids: pageId,
          prop: "pageimages|info|extracts",
          pithumbsize: 1200,
          inprop: "url",
          exintro: true,
          explaintext: true,
          exsentences: 2,
          format: "json",
          origin: "*",
        },
        headers: {
          'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)',
          'Accept': 'application/json'
        },
        timeout: 15000, // Increased timeout
      }
    );

    const pageInfo = pageInfoRes.data?.query?.pages?.[pageId];
    if (!pageInfo?.thumbnail?.source) {
      console.log(`[Image] Page ${pageId} has no thumbnail`);
      return null;
    }

    const imageUrl = pageInfo.thumbnail.source;
    const pageTitle = pageInfo.title || 'Unknown';
    const pageDescription = pageInfo.extract || '';
    const pageUrl = pageInfo.fullurl || '';

    console.log(`[Image] Found thumbnail URL for page ${pageId}: ${pageTitle}`);

    // Download with retry
    const imgRes = await retryWithBackoff(async () => {
      return await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 15000, // Increased timeout
        headers: {
          'User-Agent': 'DateTodayBot/1.0'
        }
      });
    }, 3, 1000); // More retries

    if (!imgRes || !imgRes.data) {
      console.error("[Image] No data in image response");
      return null;
    }

    const rawImageBuffer = Buffer.from(imgRes.data);
    
    if (!rawImageBuffer || rawImageBuffer.length === 0) {
      console.error("[Image] Empty image buffer");
      return null;
    }
    
    const processedBuffer = await processImageBuffer(rawImageBuffer);

    if (!processedBuffer || !Buffer.isBuffer(processedBuffer) || processedBuffer.length === 0) {
      console.error("[Image] Processed buffer is invalid");
      return null;
    }

    console.log(`[Image] ✅ Successfully fetched and processed image from page ${pageId}, size: ${(processedBuffer.length / 1024).toFixed(2)} KB`);

    // Return with metadata if requested
    if (returnMetadata) {
      return {
        buffer: processedBuffer,
        metadata: {
          source: 'Wikipedia',
          title: pageTitle,
          description: pageDescription,
          url: imageUrl,
          pageUrl: pageUrl,
          pageId: pageId
        }
      };
    }

    return processedBuffer;
  } catch (err) {
    console.error(`[Image] Failed to fetch from page ID ${pageId}:`, err.message);
    return null;
  }
}

/**
 * Process image buffer to optimal Twitter format
 * Handles both landscape and portrait images intelligently
 */
async function processImageBuffer(rawImageBuffer) {
  try {
    // Get image metadata to determine orientation
    const metadata = await sharp(rawImageBuffer).metadata();
    const originalWidth = metadata.width || 1200;
    const originalHeight = metadata.height || 600;
    const aspectRatio = originalWidth / originalHeight;
    
    const isPortrait = aspectRatio < 1; // Height > Width
    const isSquare = Math.abs(aspectRatio - 1) < 0.1;
    
    console.log(`[Image] Original dimensions: ${originalWidth}x${originalHeight}, aspect ratio: ${aspectRatio.toFixed(2)}, portrait: ${isPortrait}`);
    
    // Twitter optimal sizes:
    // Landscape: 1200x675 (16:9) or 1200x600 (2:1)
    // Portrait: 1200x1600 (3:4) or 1200x1800 (2:3)
    // Square: 1200x1200
    
    let processedBuffer;
    
    if (isPortrait) {
      // For portraits: Keep portrait orientation, use optimal portrait size
      // Twitter supports portrait images well - use 1200x1600 (3:4 ratio)
      console.log("[Image] Portrait image detected - keeping portrait orientation (1200x1600)");
      
      const portraitWidth = 1200;
      const portraitHeight = 1600; // 3:4 ratio, optimal for Twitter portrait images
      
      processedBuffer = await sharp(rawImageBuffer)
        .resize(portraitWidth, portraitHeight, {
          fit: "contain", // Preserves full image, maintains aspect ratio
          position: "center",
          background: { r: 18, g: 18, b: 18, alpha: 1 } // Dark background for any padding
        })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    } else if (isSquare) {
      // For squares: Keep square format
      console.log("[Image] Square image detected - keeping square format (1200x1200)");
      
      processedBuffer = await sharp(rawImageBuffer)
        .resize(1200, 1200, {
          fit: "contain",
          position: "center",
          background: { r: 18, g: 18, b: 18, alpha: 1 }
        })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    } else {
      // For landscape: Use optimal landscape size
      console.log("[Image] Landscape image - keeping landscape orientation (1200x675)");
      
      const landscapeWidth = 1200;
      const landscapeHeight = 675; // 16:9 ratio, optimal for Twitter landscape images
      
      processedBuffer = await sharp(rawImageBuffer)
        .resize(landscapeWidth, landscapeHeight, {
          fit: "cover", // Fill the frame for landscape
          position: "center", // Smart center cropping
        })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    }
    
    console.log("[Image] Image processed. Size:", (processedBuffer.length / 1024).toFixed(2), "KB");
    
    // If still too large, reduce quality while maintaining orientation
    if (processedBuffer.length > 5 * 1024 * 1024) {
      console.warn("[Image] Image too large, reducing quality while maintaining orientation...");
      
      if (isPortrait) {
        // Reduce portrait size proportionally
        return await sharp(rawImageBuffer)
          .resize(1000, 1333, { // Maintain 3:4 ratio
            fit: "contain",
            position: "center",
            background: { r: 18, g: 18, b: 18, alpha: 1 }
          })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
      } else if (isSquare) {
        // Reduce square size
        return await sharp(rawImageBuffer)
          .resize(1000, 1000, {
            fit: "contain",
            position: "center",
            background: { r: 18, g: 18, b: 18, alpha: 1 }
          })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
      } else {
        // Reduce landscape size proportionally
        return await sharp(rawImageBuffer)
          .resize(1000, 562, { // Maintain 16:9 ratio
            fit: "cover",
            position: "center"
          })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
      }
    }
    
    return processedBuffer;
  } catch (sharpErr) {
    console.error("[Image] Sharp processing error:", sharpErr.message);
    return rawImageBuffer; // Fallback to original
  }
}

/**
 * Detect if text describes a historical scene (vs. modern imagery)
 */
function isHistoricalSceneDescription(text) {
  const lower = text.toLowerCase();
  
  // Historical scene indicators (descriptive, evocative language)
  const historicalSceneMarkers = [
    "picture", "imagine", "picture a", "imagine a", "envision", "visualize",
    "lush", "pristine", "untouched", "ancient", "medieval", "vintage",
    "swaying", "breeze", "turquoise", "crystal clear", "emerald",
    "waiting to", "new frontier", "uncharted", "discovered", "explored",
    "centuries ago", "long ago", "in those days", "back then"
  ];
  
  // Modern imagery indicators (satellite, aerial, contemporary)
  const modernImageryMarkers = [
    "satellite", "aerial view", "from space", "drone", "overhead",
    "modern", "today", "current", "present day", "now", "contemporary",
    "developed", "urban", "cityscape", "infrastructure", "runway", "airport"
  ];
  
  const hasHistoricalMarkers = historicalSceneMarkers.some(marker => lower.includes(marker));
  const hasModernMarkers = modernImageryMarkers.some(marker => lower.includes(marker));
  
  return hasHistoricalMarkers && !hasModernMarkers;
}

/**
 * Validate if image actually matches the event (reject clearly wrong matches)
 */
function validateImageMatch(image, searchTerm, eventDescription = null) {
  if (!eventDescription) return true; // Can't validate without description
  
  const imageDesc = (image.description || image.alt_description || image.title || "").toLowerCase();
  const eventLower = eventDescription.toLowerCase();
  
  // CRITICAL: Reject modern satellite/aerial imagery when text describes historical scene
  if (isHistoricalSceneDescription(eventDescription)) {
    const modernImageryTerms = ["satellite", "aerial", "from space", "overhead view", "drone", "google earth", "map view", "topographic"];
    const isModernImagery = modernImageryTerms.some(term => imageDesc.includes(term));
    
    if (isModernImagery) {
      console.log(`[Image] Rejecting image: Text describes historical scene but image is modern satellite/aerial imagery`);
      return false;
    }
    
    // Prefer historical/period-appropriate images
    const historicalImageTerms = ["historical", "vintage", "antique", "old", "ancient", "period", "era", "19th century", "18th century", "illustration", "painting", "engraving", "drawing"];
    const isHistoricalImage = historicalImageTerms.some(term => imageDesc.includes(term));
    
    if (isHistoricalImage) {
      console.log(`[Image] ✅ Preferring historical image for historical scene description`);
    }
  }
  
  // Extract key terms from event (excluding generic words)
  const eventKeyTerms = eventLower
    .split(/\s+/)
    .filter(w => w.length > 4 && !["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "this", "that", "was", "were", "is", "are", "had", "have", "has"].includes(w));
  
  // Check if image matches at least one key term
  const hasMatchingTerm = eventKeyTerms.some(term => imageDesc.includes(term));
  
  // Special case: If event is about war but image is generic Christmas/holiday, reject
  if (eventLower.includes("war") && !imageDesc.includes("war") && !imageDesc.includes("soldier") && !imageDesc.includes("military") && !imageDesc.includes("battle")) {
    const genericHolidayTerms = ["christmas", "holiday", "celebration", "nativity", "decoration"];
    if (genericHolidayTerms.some(term => imageDesc.includes(term))) {
      console.log(`[Image] Rejecting image: Generic holiday image doesn't match war event`);
      return false;
    }
  }

  // Stricter validation for specific empires / civilizations
  // Roman Empire – avoid generic Europe / political maps with no Roman context
  if (eventLower.includes("roman empire") || (eventLower.includes("rome") && eventLower.includes("empire"))) {
    const romanTerms = ["roman", "rome", "romans", "imperium romanum", "roman empire", "byzantine", "constantinople", "mediterranean"];
    const hasRomanContext = romanTerms.some(term => imageDesc.includes(term));
    if (!hasRomanContext) {
      console.log("[Image] Rejecting image: Event about Roman Empire but image metadata lacks Roman context");
      return false;
    }
  }

  // Ottoman Empire – avoid generic WW1 trench photos, require Ottoman / region context
  if (eventLower.includes("ottoman empire") || eventLower.includes("ottoman")) {
    const ottomanTerms = ["ottoman", "istanbul", "constantinople", "turkey", "anatolia", "sultan", "ottoman empire", "middle east"];
    const hasOttomanContext = ottomanTerms.some(term => imageDesc.includes(term));
    if (!hasOttomanContext) {
      console.log("[Image] Rejecting image: Event about Ottoman Empire but image metadata lacks Ottoman context");
      return false;
    }
  }

  // Aztec Empire – avoid generic conquest imagery without Aztec context
  if (eventLower.includes("aztec")) {
    const aztecTerms = ["aztec", "aztecs", "tenochtitlan", "mexico", "mesoamerica", "mexica", "montezuma", "cortes", "cortés"];
    const hasAztecContext = aztecTerms.some(term => imageDesc.includes(term));
    if (!hasAztecContext) {
      console.log("[Image] Rejecting image: Event about Aztec Empire but image metadata lacks Aztec context");
      return false;
    }
  }
  
  // Global rule: if we have several key terms but the image matches none, reject as inaccurate
  if (eventKeyTerms.length > 2 && !hasMatchingTerm) {
    console.log(`[Image] Rejecting image: No key terms from event found in image metadata`);
    return false;
  }
  
  return true;
}

/**
 * Score image relevance based on search term and image metadata
 */
function scoreImageRelevance(image, searchTerm, eventDescription = null) {
  let score = 0;
  const searchLower = searchTerm.toLowerCase();
  const descLower = eventDescription?.toLowerCase() || "";
  
  // Check image description/title relevance
  const imageDesc = (image.description || image.alt_description || image.title || "").toLowerCase();
  
  // CRITICAL: Heavy penalty for modern satellite/aerial imagery when text describes historical scene
  if (eventDescription && isHistoricalSceneDescription(eventDescription)) {
    const modernImageryTerms = ["satellite", "aerial", "from space", "overhead view", "drone", "google earth", "map view", "topographic"];
    if (modernImageryTerms.some(term => imageDesc.includes(term))) {
      score -= 100; // Very heavy penalty - completely wrong type of image
      console.log(`[Image] Heavy penalty: Modern satellite imagery for historical scene description`);
    }
    
    // Bonus for historical/period-appropriate images
    const historicalImageTerms = ["historical", "vintage", "antique", "old", "ancient", "period", "era", "19th century", "18th century", "illustration", "painting", "engraving", "drawing", "lithograph"];
    if (historicalImageTerms.some(term => imageDesc.includes(term))) {
      score += 30; // Strong bonus for historical images
    }
  }
  
  // CRITICAL: Penalize generic matches that don't match the actual event
  const genericTerms = ["christmas", "holiday", "celebration", "nativity", "decoration", "lights"];
  const hasGenericOnly = genericTerms.some(term => imageDesc.includes(term)) && 
                         !descLower.split(/\s+/).some(word => word.length > 4 && imageDesc.includes(word));
  
  if (hasGenericOnly && descLower.includes("war") && !imageDesc.includes("war")) {
    score -= 50; // Heavy penalty for generic Christmas image when event is about war
  }
  
  // Exact phrase match (highest priority)
  if (imageDesc.includes(searchLower)) {
    score += 40; // Increased from 30
  }
  
  // Check if image matches key terms from event description
  if (eventDescription) {
    const eventWords = eventDescription.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4 && !["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"].includes(w));
    
    let matchingWords = 0;
    for (const word of eventWords.slice(0, 5)) {
      if (imageDesc.includes(word)) {
        matchingWords++;
      }
    }
    score += matchingWords * 15; // 15 points per matching key word
  }
  
  // Check for key historical terms in description
  const historicalTerms = ["history", "historical", "ancient", "war", "battle", "event", "historic", "soldier", "trench", "military"];
  for (const term of historicalTerms) {
    if (imageDesc.includes(term)) {
      score += 10;
    }
  }
  
  // Prefer images with people/events (more impactful) - but only if relevant
  const impactfulTerms = ["people", "person", "soldier", "leader", "crowd", "ceremony", "event", "trench", "battlefield"];
  for (const term of impactfulTerms) {
    if (imageDesc.includes(term)) {
      score += 15;
    }
  }
  
  // Penalize clearly wrong matches
  if (descLower.includes("world war") && !imageDesc.includes("war") && !imageDesc.includes("soldier") && !imageDesc.includes("military")) {
    score -= 30; // Penalty for non-war images when event is about war
  }
  
  // Prefer higher quality (likes/downloads indicate quality)
  if (image.likes) {
    score += Math.min(image.likes / 100, 20); // Max 20 points for popularity
  }
  
  // Accept both portrait and landscape - we'll process them appropriately
  // Don't penalize portrait images - they work well on Twitter too
  if (image.width && image.height) {
    const aspectRatio = image.width / image.height;
    // Good aspect ratios for Twitter: landscape (1.5-2.5) or portrait (0.4-0.75)
    if ((aspectRatio >= 1.5 && aspectRatio <= 2.5) || (aspectRatio >= 0.4 && aspectRatio <= 0.75)) {
      score += 10; // Good aspect ratio for Twitter
    }
  }
  
  return score;
}

/**
 * Fetch image from Unsplash (free, high-quality historical photos)
 * Now selects the BEST matching image from results
 */
async function fetchFromUnsplash(searchTerm, eventDescription = null) {
  try {
    const query = encodeURIComponent(searchTerm);
    // Allow both portrait and landscape images - we'll process them appropriately
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=10`; // Get both orientations
    
    const headers = {};
    if (process.env.UNSPLASH_ACCESS_KEY) {
      headers['Authorization'] = `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`;
    }
    
    const response = await axios.get(url, {
      headers,
      timeout: 10000,
    });
    
    const photos = response.data?.results || [];
    if (photos.length === 0) {
      return null;
    }
    
    // Score and rank images by relevance, filtering out clearly wrong matches
    const scoredPhotos = photos
      .filter(photo => validateImageMatch(photo, searchTerm, eventDescription))
      .map(photo => ({
        photo,
        score: scoreImageRelevance(photo, searchTerm, eventDescription)
      }))
      .filter(item => item.score > 0) // Only keep images with positive scores
      .sort((a, b) => b.score - a.score);
    
    if (scoredPhotos.length === 0) {
      console.log(`[Image] No valid images found after filtering`);
      return null;
    }
    
    // Get the best matching photo
    const bestPhoto = scoredPhotos[0].photo;
    const photoUrl = bestPhoto.urls?.regular || bestPhoto.urls?.small;
    if (!photoUrl) {
      return null;
    }
    
    console.log(`[Image] Selected best Unsplash image (score: ${scoredPhotos[0].score}): ${bestPhoto.description || searchTerm}`);
    
    // Download image
    const imgRes = await axios.get(photoUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    
    const rawImageBuffer = Buffer.from(imgRes.data);
    return await processImageBuffer(rawImageBuffer);
  } catch (err) {
    console.log(`[Image] Unsplash search failed: ${err.message}`);
    return null;
  }
}

/**
 * Fetch image from Pexels (free historical photos)
 * Now selects the BEST matching image from results
 */
async function fetchFromPexels(searchTerm, eventDescription = null) {
  try {
    const query = encodeURIComponent(searchTerm);
    // Allow both portrait and landscape images - we'll process them appropriately
    const url = `https://api.pexels.com/v1/search?query=${query}&per_page=15`; // Get both orientations
    
    const headers = {};
    if (process.env.PEXELS_API_KEY) {
      headers['Authorization'] = process.env.PEXELS_API_KEY;
    } else {
      return null;
    }
    
    const response = await axios.get(url, {
      headers,
      timeout: 10000,
    });
    
    const photos = response.data?.photos || [];
    if (photos.length === 0) {
      return null;
    }
    
    // Score and rank images by relevance, filtering out clearly wrong matches
    const validPhotos = photos.filter(photo => validateImageMatch(photo, searchTerm, eventDescription));
    
    if (validPhotos.length === 0) {
      console.log(`[Image] No valid images found after validation`);
      return null;
    }
    
    const scoredPhotos = validPhotos.map(photo => {
      const photoDesc = (photo.alt || "").toLowerCase();
      let score = 0;
      const searchLower = searchTerm.toLowerCase();
      
      // CRITICAL: Penalize generic matches
      const genericTerms = ["christmas", "holiday", "celebration", "nativity", "decoration", "lights"];
      const hasGenericOnly = genericTerms.some(term => photoDesc.includes(term)) && 
                             !eventDescription?.toLowerCase().split(/\s+/).some(word => word.length > 4 && photoDesc.includes(word));
      
      if (hasGenericOnly && eventDescription?.toLowerCase().includes("war") && !photoDesc.includes("war")) {
        score -= 50; // Heavy penalty for generic Christmas image when event is about war
      }
      
      // Exact match (highest priority)
      if (photoDesc.includes(searchLower)) {
        score += 40; // Increased from 30
      }
      
      // Check if image matches key terms from event description
      if (eventDescription) {
        const eventWords = eventDescription.toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 4 && !["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"].includes(w));
        
        let matchingWords = 0;
        for (const word of eventWords.slice(0, 5)) {
          if (photoDesc.includes(word)) {
            matchingWords++;
          }
        }
        score += matchingWords * 15; // 15 points per matching key word
      }
      
      // Historical terms boost
      const historicalTerms = ["history", "historical", "ancient", "war", "battle", "vintage", "old", "soldier", "trench", "military"];
      for (const term of historicalTerms) {
        if (photoDesc.includes(term)) {
          score += 10;
        }
      }
      
      // Impactful content (people, events) - but only if relevant
      const impactfulTerms = ["people", "person", "soldier", "crowd", "ceremony", "event", "monument", "trench", "battlefield"];
      for (const term of impactfulTerms) {
        if (photoDesc.includes(term)) {
          score += 15;
        }
      }
      
      // Penalize clearly wrong matches
      if (eventDescription?.toLowerCase().includes("world war") && !photoDesc.includes("war") && !photoDesc.includes("soldier") && !photoDesc.includes("military")) {
        score -= 30; // Penalty for non-war images when event is about war
      }
      
      // Prefer higher resolution (quality indicator)
      if (photo.width && photo.height) {
        const pixels = photo.width * photo.height;
        if (pixels > 2000000) { // > 2MP
          score += 10;
        }
        // Good aspect ratio for Twitter (both landscape and portrait)
        const aspectRatio = photo.width / photo.height;
        if ((aspectRatio >= 1.5 && aspectRatio <= 2.5) || (aspectRatio >= 0.4 && aspectRatio <= 0.75)) {
          score += 10;
        }
      }
      
      return { photo, score };
    }).sort((a, b) => b.score - a.score);
    
    // Get the best matching photo
    const bestPhoto = scoredPhotos[0].photo;
    const photoUrl = bestPhoto.src?.large || bestPhoto.src?.medium;
    if (!photoUrl) {
      return null;
    }
    
    console.log(`[Image] Selected best Pexels image (score: ${scoredPhotos[0].score}): ${bestPhoto.alt || searchTerm}`);
    
    // Download image
    const imgRes = await axios.get(photoUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    
    const rawImageBuffer = Buffer.from(imgRes.data);
    return await processImageBuffer(rawImageBuffer);
  } catch (err) {
    console.log(`[Image] Pexels search failed: ${err.message}`);
    return null;
  }
}

/**
 * Search Wikimedia Commons directly (more images than Wikipedia pages)
 * @param {string} searchTerm - Search term
 * @param {boolean} returnMetadata - If true, returns {buffer, metadata}
 * @returns {Promise<Buffer|Object|null>} - Image buffer or {buffer, metadata} or null
 */
export async function fetchFromWikimediaCommons(searchTerm, returnMetadata = false) {
  try {
    const query = encodeURIComponent(searchTerm);
    const url = `https://commons.wikimedia.org/w/api.php`;

    const response = await axios.get(url, {
      params: {
        action: "query",
        list: "search",
        srsearch: query,
        format: "json",
        srlimit: 5,
        origin: "*",
      },
      headers: {
        'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)'
      },
      timeout: 10000,
    });

    const pages = response.data?.query?.search || [];
    if (pages.length === 0) {
      return null;
    }

    // Get first page
    const pageId = pages[0].pageid;
    const pageTitle = pages[0].title || 'Unknown';
    const pageSnippet = pages[0].snippet || '';

    // Get page images and info
    const pageInfoRes = await axios.get(url, {
      params: {
        action: "query",
        pageids: pageId,
        prop: "pageimages|info|imageinfo",
        pithumbsize: 1200,
        inprop: "url",
        iiprop: "url|extmetadata",
        format: "json",
        origin: "*",
      },
      headers: {
        'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)'
      },
      timeout: 10000,
    });

    const pageInfo = pageInfoRes.data?.query?.pages?.[pageId];
    if (!pageInfo?.thumbnail?.source) {
      return null;
    }

    const imageUrl = pageInfo.thumbnail.source;
    const pageUrl = pageInfo.fullurl || '';

    // Try to extract date from metadata if available
    const imageInfo = pageInfo.imageinfo?.[0];
    const extMetadata = imageInfo?.extmetadata;
    const dateCreated = extMetadata?.DateTimeOriginal?.value || extMetadata?.DateTime?.value || '';

    console.log(`[Image] Found Wikimedia Commons image: ${pageTitle}`);

    // Download image
    const imgRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    const rawImageBuffer = Buffer.from(imgRes.data);
    const processedBuffer = await processImageBuffer(rawImageBuffer);

    if (returnMetadata) {
      return {
        buffer: processedBuffer,
        metadata: {
          source: 'Wikimedia Commons',
          title: pageTitle,
          description: pageSnippet.replace(/<[^>]*>/g, ''), // Strip HTML tags
          url: imageUrl,
          pageUrl: pageUrl,
          date: dateCreated,
          pageId: pageId
        }
      };
    }

    return processedBuffer;
  } catch (err) {
    console.log(`[Image] Wikimedia Commons search failed: ${err.message}`);
    return null;
  }
}

/**
 * Search Library of Congress for historical images
 * LOC has millions of high-quality historical photos
 * @param {string} searchTerm - Search term
 * @param {number} year - Optional year to filter results
 * @param {boolean} returnMetadata - If true, returns {buffer, metadata}
 * @returns {Promise<Buffer|Object|null>} - Image buffer or {buffer, metadata} or null
 */
export async function fetchFromLibraryOfCongress(searchTerm, year = null, returnMetadata = false) {
  try {
    const query = encodeURIComponent(searchTerm);
    const url = `https://www.loc.gov/collections/`;

    // LOC API endpoint
    const apiUrl = `https://www.loc.gov/search/`;

    const params = {
      q: searchTerm,
      fo: 'json', // JSON format
      c: 100, // Max results
      at: 'results,pagination',
      sp: 1 // Start page
    };

    // Add date filter if year provided
    if (year) {
      params.dates = `${year}/${year}`;
    }

    const response = await axios.get(apiUrl, {
      params,
      headers: {
        'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)',
        'Accept': 'application/json'
      },
      timeout: 15000,
    });

    const results = response.data?.results || [];
    if (results.length === 0) {
      return null;
    }

    // Find first result with an image
    for (const result of results.slice(0, 5)) {
      const imageUrl = result.image_url?.[0];
      if (!imageUrl) continue;

      const title = result.title || 'Unknown';
      const description = result.description?.[0] || '';
      const date = result.date || year?.toString() || '';
      const itemUrl = result.id || '';

      console.log(`[Image] Found LOC image: ${title}`);

      try {
        // Download image
        const imgRes = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: {
            'User-Agent': 'DateTodayBot/1.0'
          }
        });

        const rawImageBuffer = Buffer.from(imgRes.data);
        const processedBuffer = await processImageBuffer(rawImageBuffer);

        if (returnMetadata) {
          return {
            buffer: processedBuffer,
            metadata: {
              source: 'Library of Congress',
              title: title,
              description: description,
              url: imageUrl,
              pageUrl: itemUrl,
              date: date
            }
          };
        }

        return processedBuffer;
      } catch (downloadErr) {
        console.log(`[Image] Failed to download LOC image: ${downloadErr.message}`);
        continue; // Try next result
      }
    }

    return null;
  } catch (err) {
    console.log(`[Image] Library of Congress search failed: ${err.message}`);
    return null;
  }
}

/**
 * Search Smithsonian Open Access for historical images
 * Smithsonian has 3 million+ high-quality images, completely free
 * @param {string} searchTerm - Search term
 * @param {boolean} returnMetadata - If true, returns {buffer, metadata}
 * @returns {Promise<Buffer|Object|null>} - Image buffer or {buffer, metadata} or null
 */
export async function fetchFromSmithsonian(searchTerm, returnMetadata = false) {
  try {
    const query = encodeURIComponent(searchTerm);
    const apiUrl = `https://api.si.edu/openaccess/api/v1.0/search`;

    const response = await axios.get(apiUrl, {
      params: {
        q: searchTerm,
        rows: 10,
        start: 0,
        'api_key': '' // Smithsonian doesn't require API key for open access
      },
      headers: {
        'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)',
        'Accept': 'application/json'
      },
      timeout: 15000,
    });

    const results = response.data?.response?.rows || [];
    if (results.length === 0) {
      return null;
    }

    // Find first result with online media
    for (const result of results) {
      const content = result.content;
      const descriptiveNonRepeating = content?.descriptiveNonRepeating;
      const onlineMedia = descriptiveNonRepeating?.online_media;

      if (!onlineMedia || !onlineMedia.media || onlineMedia.media.length === 0) {
        continue;
      }

      // Get largest image
      const media = onlineMedia.media.find(m => m.type === 'Images');
      if (!media || !media.content) continue;

      const imageUrl = media.content;
      const title = content?.freetext?.title?.[0]?.content || content?.title || 'Unknown';
      const description = content?.freetext?.notes?.[0]?.content || '';
      const date = content?.freetext?.date?.[0]?.content || '';
      const itemUrl = descriptiveNonRepeating?.record_link || '';

      console.log(`[Image] Found Smithsonian image: ${title}`);

      try {
        // Download image
        const imgRes = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 15000,
          headers: {
            'User-Agent': 'DateTodayBot/1.0'
          }
        });

        const rawImageBuffer = Buffer.from(imgRes.data);
        const processedBuffer = await processImageBuffer(rawImageBuffer);

        if (returnMetadata) {
          return {
            buffer: processedBuffer,
            metadata: {
              source: 'Smithsonian',
              title: title,
              description: description,
              url: imageUrl,
              pageUrl: itemUrl,
              date: date
            }
          };
        }

        return processedBuffer;
      } catch (downloadErr) {
        console.log(`[Image] Failed to download Smithsonian image: ${downloadErr.message}`);
        continue;
      }
    }

    return null;
  } catch (err) {
    console.log(`[Image] Smithsonian search failed: ${err.message}`);
    return null;
  }
}

/**
 * Search Wikipedia with multiple query strategies
 */
async function searchWikipediaMultipleStrategies(event) {
  const strategies = [];
  
  // Strategy 1: Full description (first 10 words)
  strategies.push(event.description.split(" ").slice(0, 10).join(" "));
  
  // Strategy 2: First 5 words (more focused)
  strategies.push(event.description.split(" ").slice(0, 5).join(" "));
  
  // Strategy 3: Extract key nouns (capitalized words)
  const capitalizedWords = event.description
    .split(" ")
    .filter(word => word.length > 3 && word[0] === word[0].toUpperCase())
    .slice(0, 5)
    .join(" ");
  if (capitalizedWords.length > 5) {
    strategies.push(capitalizedWords);
  }
  
  // Strategy 4: Year + first 3 words (e.g., "1969 Apollo moon")
  if (event.year) {
    strategies.push(`${event.year} ${event.description.split(" ").slice(0, 3).join(" ")}`);
  }
  
  // Strategy 5: Remove common words, keep important terms
  const importantWords = event.description
    .split(" ")
    .filter(word => {
      const lower = word.toLowerCase();
      return !["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"].includes(lower) &&
             word.length > 3;
    })
    .slice(0, 6)
    .join(" ");
  if (importantWords.length > 5) {
    strategies.push(importantWords);
  }

  // Try each strategy
  for (const query of strategies) {
    if (!query || query.trim().length < 3) continue;
    
    try {
      console.log("[Image] Trying search strategy:", query);
      
      const searchRes = await axios.get(
        "https://en.wikipedia.org/w/api.php",
        {
          params: {
            action: "query",
            list: "search",
            srsearch: query,
            format: "json",
            srlimit: 5, // Try top 5 results instead of just 1
            origin: "*",
          },
          headers: {
            'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)'
          },
          timeout: 10000,
        }
      );

      const pages = searchRes.data?.query?.search || [];
      
      // Score pages by relevance (title match, snippet match)
      const scoredPages = pages.map(page => {
        let score = 0;
        const pageTitle = (page.title || "").toLowerCase();
        const pageSnippet = (page.snippet || "").toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Exact title match gets highest score
        if (pageTitle === queryLower) {
          score += 50;
        } else if (pageTitle.includes(queryLower)) {
          score += 30;
        }
        
        // Snippet relevance
        if (pageSnippet.includes(queryLower)) {
          score += 20;
        }
        
        // Prefer pages with specific historical terms
        const historicalTerms = ["war", "battle", "treaty", "revolution", "independence", "discovery"];
        for (const term of historicalTerms) {
          if (pageTitle.includes(term) || pageSnippet.includes(term)) {
            score += 10;
          }
        }
        
        return { page, score };
      }).sort((a, b) => b.score - a.score);
      
      // Try pages in order of relevance (best match first)
      for (const { page, score } of scoredPages) {
        const imageBuffer = await fetchImageFromPageId(page.pageid);
        if (imageBuffer) {
          console.log(`[Image] Successfully found image using strategy: "${query}" (relevance score: ${score})`);
          return imageBuffer;
        }
      }
    } catch (err) {
      console.log("[Image] Strategy failed:", query, err.message);
      continue; // Try next strategy
    }
  }
  
  return null;
}

/**
 * Search for generic historical images as last resort fallback
 * Uses multiple sources: Wikipedia, Unsplash, Pexels, Wikimedia Commons
 * Well-known historical pages that are guaranteed to have images
 */
async function fetchGenericHistoricalImage(year = null) {
  try {
    // First try year-based searches
    if (year) {
      const yearTerms = [
        `${year} history`,
        `${year} historical event`,
        `history ${year}`,
        `${year} world history`
      ];
      
      for (const term of yearTerms) {
        console.log(`[Image] Trying year-based fallback: "${term}"`);
        try {
          const searchRes = await axios.get(
            "https://en.wikipedia.org/w/api.php",
            {
          params: {
            action: "query",
            list: "search",
            srsearch: term,
            format: "json",
            srlimit: 10, // Increased
            origin: "*",
          },
          headers: {
            'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)'
          },
          timeout: 15000,
        }
      );
          
          const pages = searchRes.data?.query?.search || [];
          for (const page of pages) {
            const imageBuffer = await fetchImageFromPageId(page.pageid);
            if (imageBuffer) {
              console.log(`[Image] Found year-based historical image via "${term}"`);
              return imageBuffer;
            }
          }
        } catch (err) {
          console.log(`[Image] Year-based fallback "${term}" failed:`, err.message);
          continue;
        }
      }
    }
    
    // Fallback to well-known historical pages that always have images
    const guaranteedPages = [
      "World War II",
      "World War I", 
      "Ancient Rome",
      "Ancient Greece",
      "Medieval period",
      "Renaissance",
      "Industrial Revolution",
      "History of the world",
      "Timeline of world history"
    ];
    
    for (const pageTitle of guaranteedPages) {
      console.log(`[Image] Trying guaranteed page: "${pageTitle}"`);
      try {
        const searchRes = await axios.get(
          "https://en.wikipedia.org/w/api.php",
          {
            params: {
              action: "query",
              titles: pageTitle,
              prop: "pageimages",
              pithumbsize: 1200,
              format: "json",
              origin: "*",
            },
            headers: {
              'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)'
            },
            timeout: 15000,
          }
        );
        
        const pages = searchRes.data?.query?.pages || {};
        for (const pageId in pages) {
          const page = pages[pageId];
          if (page.thumbnail?.source) {
            const imageBuffer = await fetchImageFromPageId(pageId);
            if (imageBuffer) {
              console.log(`[Image] Found image from guaranteed page: "${pageTitle}"`);
              return imageBuffer;
            }
          }
        }
      } catch (err) {
        console.log(`[Image] Guaranteed page "${pageTitle}" failed:`, err.message);
        continue;
      }
    }
    
    // Last resort: search generic terms
    const genericTerms = ["history", "historical event", "ancient history", "world history", "medieval history"];
    for (const term of genericTerms) {
      console.log(`[Image] Trying generic term: "${term}"`);
      try {
        const searchRes = await axios.get(
          "https://en.wikipedia.org/w/api.php",
          {
            params: {
              action: "query",
              list: "search",
              srsearch: term,
              format: "json",
              srlimit: 10,
              origin: "*",
            },
            headers: {
              'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)'
            },
            timeout: 15000,
          }
        );
        
        const pages = searchRes.data?.query?.search || [];
        for (const page of pages) {
          const imageBuffer = await fetchImageFromPageId(page.pageid);
          if (imageBuffer) {
            console.log(`[Image] Found generic historical image via "${term}"`);
            return imageBuffer;
          }
        }
      } catch (err) {
        console.log(`[Image] Generic term "${term}" failed:`, err.message);
        continue;
      }
    }
    
    // Try alternative sources: Pexels FIRST (most reliable with API key), then Unsplash, Wikimedia Commons
    const searchTerms = year 
      ? [`${year} history`, `historical ${year}`, `${year} event`, `history ${year}`]
      : ["history", "historical event", "ancient history", "world history"];
    
    for (const term of searchTerms) {
      console.log(`[Image] Trying alternative sources for: "${term}"`);
      
      // Try Pexels FIRST (most reliable with API key)
      if (process.env.PEXELS_API_KEY) {
        console.log(`[Image] Trying Pexels for: "${term}"`);
        const pexelsImage = await fetchFromPexels(term);
        if (pexelsImage) {
          console.log(`[Image] ✅ Found best matching image from Pexels: "${term}"`);
          return pexelsImage;
        }
      }
      
      // Try Unsplash (selects best match from results)
      console.log(`[Image] Trying Unsplash for: "${term}"`);
      const unsplashImage = await fetchFromUnsplash(term);
      if (unsplashImage) {
        console.log(`[Image] ✅ Found best matching image from Unsplash: "${term}"`);
        return unsplashImage;
      }
      
      // Try Wikimedia Commons
      console.log(`[Image] Trying Wikimedia Commons for: "${term}"`);
      const commonsImage = await fetchFromWikimediaCommons(term);
      if (commonsImage) {
        console.log(`[Image] ✅ Found image from Wikimedia Commons: "${term}"`);
        return commonsImage;
      }
    }
    
    // ABSOLUTE LAST RESORT: Direct image URLs that are guaranteed to work
    // These are public domain historical images from Wikimedia Commons
    console.log("[Image] Trying absolute last resort: Direct historical image URLs");
    const guaranteedImageUrls = [
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/World_War_II_Montage_2014.jpg/1200px-World_War_II_Montage_2014.jpg", // WWII - always available
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/East_side_of_the_Gettysburg_Battlefield.jpg/1200px-East_side_of_the_Gettysburg_Battlefield.jpg", // Civil War
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Declaration_of_Independence_%281819%29_by_John_Trumbull.jpg/1200px-Declaration_of_Independence_%281819%29_by_John_Trumbull.jpg", // Historical document
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Ancient_Rome_Colosseum.jpg/1200px-Ancient_Rome_Colosseum.jpg", // Ancient Rome
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Parthenon_from_west.jpg/1200px-Parthenon_from_west.jpg", // Ancient Greece
    ];
    
    for (const imageUrl of guaranteedImageUrls) {
      try {
        console.log(`[Image] Trying guaranteed image URL...`);
        const imgRes = await axios.get(imageUrl, {
          responseType: "arraybuffer",
          timeout: 20000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DateTodayBot/1.0)'
          }
        });
        
        if (imgRes && imgRes.data) {
          const rawImageBuffer = Buffer.from(imgRes.data);
          if (rawImageBuffer.length > 1000) { // At least 1KB
            const processedBuffer = await processImageBuffer(rawImageBuffer);
            if (processedBuffer && processedBuffer.length > 0) {
              console.log("[Image] ✅ Found image from guaranteed URL (last resort)");
              return processedBuffer;
            }
          }
        }
      } catch (err) {
        console.log(`[Image] Guaranteed URL failed: ${err.message}`);
        continue;
      }
    }
    
    console.error("[Image] CRITICAL: All fallbacks including guaranteed URLs failed!");
    return null;
  } catch (err) {
    console.error("[Image] Generic fallback error:", err.message);
    // Try one more time with guaranteed direct image URLs
    try {
      const emergencyUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/World_War_II_Montage_2014.jpg/1200px-World_War_II_Montage_2014.jpg";
      const imgRes = await axios.get(emergencyUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: {
          'User-Agent': 'DateTodayBot/1.0'
        }
      });
      
      if (imgRes && imgRes.data) {
        const rawImageBuffer = Buffer.from(imgRes.data);
        const processedBuffer = await processImageBuffer(rawImageBuffer);
        if (processedBuffer) {
          console.log("[Image] ✅ Emergency fallback to direct image URL succeeded");
          return processedBuffer;
        }
      }
    } catch (e) {
      console.error("[Image] Emergency fallback also failed:", e.message);
    }
    return null;
  }
}

export async function fetchEventImage(event, requireImage = true) {
  try {
    console.log("[Image] Starting image fetch for event:", event.description?.slice(0, 80));
    
    // Check if this is a historical scene description (needs period-appropriate images)
    const isHistoricalScene = isHistoricalSceneDescription(event.description);
    if (isHistoricalScene) {
      console.log("[Image] Detected historical scene description - prioritizing period-appropriate images");
    }
    
    // Strategy 1: Extract accurate search terms from event (prioritize specific historical phrases)
    const eventSearchTerms = [];
    
    // If historical scene, add period-specific search terms
    if (isHistoricalScene && event.year) {
      const year = parseInt(event.year);
      if (year < 500) {
        eventSearchTerms.push("ancient", "antiquity", "classical");
      } else if (year < 1500) {
        eventSearchTerms.push("medieval", "middle ages");
      } else if (year < 1800) {
        eventSearchTerms.push("renaissance", "17th century", "18th century");
      } else if (year < 1900) {
        eventSearchTerms.push("19th century", "victorian", "historical");
      } else {
        eventSearchTerms.push("early 20th century", "vintage", "historical");
      }
    }
    
    // Extract specific historical event phrases (highest priority)
    const historicalEventPatterns = [
      /(world war [i1-2]|ww[i1-2]|great war)/i,
      /(christmas truce|truce of \d{4})/i,
      /(battle of [a-z\s]+)/i,
      /(treaty of [a-z\s]+)/i,
      /(assassination of [a-z\s]+)/i,
      /(declaration of [a-z\s]+)/i,
      /(revolution of \d{4}|[a-z]+ revolution)/i,
      /(landing|invasion|attack|bombing) of [a-z\s]+/i,
    ];
    
    for (const pattern of historicalEventPatterns) {
      const match = event.description.match(pattern);
      if (match) {
        eventSearchTerms.push(match[0]);
        console.log(`[Image] Found specific historical event phrase: "${match[0]}"`);
      }
    }
    
    // Add year + key terms (excluding generic words)
    if (event.year) {
      const importantTerms = event.description
        .split(" ")
        .filter(word => {
          const lower = word.toLowerCase();
          return !["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "christmas", "holiday", "celebration"].includes(lower) &&
                 word.length > 3;
        })
        .slice(0, 4)
        .join(" ");
      if (importantTerms.length > 5) {
        eventSearchTerms.push(`${event.year} ${importantTerms}`);
        // For historical scenes, also add without year to find period illustrations
        if (isHistoricalScene) {
          eventSearchTerms.push(`${importantTerms} historical`, `${importantTerms} vintage`);
        }
      }
    }
    
    // Add capitalized proper nouns
    const capitalizedWords = event.description
      .split(" ")
      .filter(word => word.length > 3 && word[0] === word[0].toUpperCase())
      .slice(0, 5)
      .join(" ");
    if (capitalizedWords.length > 5) {
      eventSearchTerms.push(capitalizedWords);
    }
    
    // Add full description (first 30 chars) only if it doesn't contain generic terms
    const genericTerms = ['christmas', 'holiday', 'celebration'];
    const first30 = event.description?.slice(0, 30);
    if (first30 && !genericTerms.some(term => first30.toLowerCase().includes(term))) {
      eventSearchTerms.push(first30);
    }
    
    // DIVERSIFIED IMAGE SEARCH: Rotate source order to avoid same images
    // For WW1/WW2 events, use alternative search terms to avoid trench photos
    const isWWEvent = event.description.toLowerCase().includes('world war') || 
                      event.description.toLowerCase().includes('ww1') || 
                      event.description.toLowerCase().includes('ww2') ||
                      (event.year >= 1914 && event.year <= 1945 && event.description.toLowerCase().includes('war'));
    
    // For WW events, add alternative search terms (avoid generic "world war" searches)
    if (isWWEvent) {
      // Add specific non-trench terms
      const altTerms = [];
      if (event.description.toLowerCase().includes('treaty') || event.description.toLowerCase().includes('versailles')) {
        altTerms.push('Versailles signing hall', 'Paris Peace Conference 1919', 'Wilson Clemenceau Lloyd George');
      }
      if (event.description.toLowerCase().includes('pearl harbor')) {
        altTerms.push('Pearl Harbor memorial', 'Hawaii 1941', 'USS Arizona');
      }
      if (event.description.toLowerCase().includes('d-day') || event.description.toLowerCase().includes('normandy')) {
        altTerms.push('Normandy beaches', 'D-Day planning', 'Eisenhower D-Day');
      }
      eventSearchTerms.push(...altTerms);
    }
    
    // Rotate source order based on day to avoid always using same source
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const sourceOrder = dayOfYear % 3; // Rotate between 3 orders
    
    let imageBuffer = null;
    
    // Order 0: Pexels -> Wikipedia -> Unsplash -> Wikimedia
    // Order 1: Wikipedia -> Unsplash -> Pexels -> Wikimedia  
    // Order 2: Unsplash -> Wikimedia -> Wikipedia -> Pexels
    
    if (sourceOrder === 0) {
      // Try Pexels FIRST
      if (process.env.PEXELS_API_KEY && eventSearchTerms.length > 0) {
        for (const term of eventSearchTerms) {
          if (!term || term.length < 3) continue;
          console.log(`[Image] Trying Pexels (rotated order) for: "${term}"`);
          imageBuffer = await fetchFromPexels(term, event.description);
          if (imageBuffer) {
            console.log(`[Image] ✅ Found image from Pexels`);
            return imageBuffer;
          }
        }
      }
      
      // Try Wikipedia
      imageBuffer = await searchWikipediaMultipleStrategies(event);
      if (imageBuffer) return imageBuffer;
      
      // Try Unsplash
      if (eventSearchTerms.length > 0) {
        for (const term of eventSearchTerms) {
          if (!term || term.length < 3) continue;
          imageBuffer = await fetchFromUnsplash(term, event.description);
          if (imageBuffer) {
            console.log(`[Image] ✅ Found image from Unsplash`);
            return imageBuffer;
          }
        }
      }
      
      // Try Wikimedia Commons
      if (eventSearchTerms.length > 0) {
        for (const term of eventSearchTerms) {
          if (!term || term.length < 3) continue;
          imageBuffer = await fetchFromWikimediaCommons(term);
          if (imageBuffer) {
            console.log(`[Image] ✅ Found image from Wikimedia Commons`);
            return imageBuffer;
          }
        }
      }
    } else if (sourceOrder === 1) {
      // Try Wikipedia FIRST
      imageBuffer = await searchWikipediaMultipleStrategies(event);
      if (imageBuffer) return imageBuffer;
      
      // Try Unsplash
      if (eventSearchTerms.length > 0) {
        for (const term of eventSearchTerms) {
          if (!term || term.length < 3) continue;
          imageBuffer = await fetchFromUnsplash(term, event.description);
          if (imageBuffer) {
            console.log(`[Image] ✅ Found image from Unsplash`);
            return imageBuffer;
          }
        }
      }
      
      // Try Pexels
      if (process.env.PEXELS_API_KEY && eventSearchTerms.length > 0) {
        for (const term of eventSearchTerms) {
          if (!term || term.length < 3) continue;
          imageBuffer = await fetchFromPexels(term, event.description);
          if (imageBuffer) {
            console.log(`[Image] ✅ Found image from Pexels`);
            return imageBuffer;
          }
        }
      }
      
      // Try Wikimedia Commons
      if (eventSearchTerms.length > 0) {
        for (const term of eventSearchTerms) {
          if (!term || term.length < 3) continue;
          imageBuffer = await fetchFromWikimediaCommons(term);
          if (imageBuffer) {
            console.log(`[Image] ✅ Found image from Wikimedia Commons`);
            return imageBuffer;
          }
        }
      }
    } else {
      // Try Unsplash FIRST
      if (eventSearchTerms.length > 0) {
        for (const term of eventSearchTerms) {
          if (!term || term.length < 3) continue;
          imageBuffer = await fetchFromUnsplash(term, event.description);
          if (imageBuffer) {
            console.log(`[Image] ✅ Found image from Unsplash`);
            return imageBuffer;
          }
        }
      }
      
      // Try Wikimedia Commons
      if (eventSearchTerms.length > 0) {
        for (const term of eventSearchTerms) {
          if (!term || term.length < 3) continue;
          imageBuffer = await fetchFromWikimediaCommons(term);
          if (imageBuffer) {
            console.log(`[Image] ✅ Found image from Wikimedia Commons`);
            return imageBuffer;
          }
        }
      }
      
      // Try Wikipedia
      imageBuffer = await searchWikipediaMultipleStrategies(event);
      if (imageBuffer) return imageBuffer;
      
      // Try Pexels
      if (process.env.PEXELS_API_KEY && eventSearchTerms.length > 0) {
        for (const term of eventSearchTerms) {
          if (!term || term.length < 3) continue;
          imageBuffer = await fetchFromPexels(term, event.description);
          if (imageBuffer) {
            console.log(`[Image] ✅ Found image from Pexels`);
            return imageBuffer;
          }
        }
      }
    }
    
    // Strategy 2: Try searching by year if available
    if (event.year) {
      console.log("[Image] Trying fallback: search by year", event.year);
      try {
        const yearSearchRes = await axios.get(
          "https://en.wikipedia.org/w/api.php",
          {
            params: {
              action: "query",
              list: "search",
              srsearch: `${event.year} history`,
              format: "json",
              srlimit: 5,
              origin: "*",
            },
            headers: {
              'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)'
            },
            timeout: 10000,
          }
        );
        
        const pages = yearSearchRes.data?.query?.search || [];
        for (const page of pages) {
          imageBuffer = await fetchImageFromPageId(page.pageid);
          if (imageBuffer) {
            console.log("[Image] Found image via year fallback");
            return imageBuffer;
          }
        }
      } catch (err) {
        console.log("[Image] Year fallback failed:", err.message);
      }
    }
    
    // Strategy 3: Try decade-based search (e.g., "1960s history")
    if (event.year) {
      const decade = Math.floor(event.year / 10) * 10;
      console.log(`[Image] Trying decade fallback: ${decade}s`);
      try {
        const decadeSearchRes = await axios.get(
          "https://en.wikipedia.org/w/api.php",
          {
            params: {
              action: "query",
              list: "search",
              srsearch: `${decade}s history`,
              format: "json",
              srlimit: 5,
              origin: "*",
            },
            headers: {
              'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)'
            },
            timeout: 10000,
          }
        );
        
        const pages = decadeSearchRes.data?.query?.search || [];
        for (const page of pages) {
          imageBuffer = await fetchImageFromPageId(page.pageid);
          if (imageBuffer) {
            console.log(`[Image] Found image via decade fallback (${decade}s)`);
            return imageBuffer;
          }
        }
      } catch (err) {
        console.log("[Image] Decade fallback failed:", err.message);
      }
    }
    
    // Strategy 4: Generic historical images (last resort)
    if (requireImage) {
      console.log("[Image] Trying generic historical image fallback...");
      imageBuffer = await fetchGenericHistoricalImage(event.year);
      if (imageBuffer) {
        return imageBuffer;
      }
    }
    
    // Strategy 5: Guaranteed direct image URLs (absolute last resort)
    if (requireImage) {
      console.log("[Image] Trying guaranteed direct image URLs...");
      const guaranteedImageUrls = [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/World_War_II_Montage_2014.jpg/1200px-World_War_II_Montage_2014.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/East_side_of_the_Gettysburg_Battlefield.jpg/1200px-East_side_of_the_Gettysburg_Battlefield.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Declaration_of_Independence_%281819%29_by_John_Trumbull.jpg/1200px-Declaration_of_Independence_%281819%29_by_John_Trumbull.jpg",
      ];
      
      for (const imageUrl of guaranteedImageUrls) {
        try {
          const imgRes = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            timeout: 20000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; DateTodayBot/1.0)'
            }
          });
          
          if (imgRes && imgRes.data) {
            const rawImageBuffer = Buffer.from(imgRes.data);
            if (rawImageBuffer.length > 1000) {
              const processedBuffer = await processImageBuffer(rawImageBuffer);
              if (processedBuffer && processedBuffer.length > 0) {
                console.log("[Image] ✅ Found image from guaranteed URL");
                return processedBuffer;
              }
            }
          }
        } catch (err) {
          console.log(`[Image] Guaranteed URL failed: ${err.message}`);
          continue;
        }
      }
    }
    
    if (requireImage) {
      console.error("[Image] CRITICAL: No image found after all strategies - this should not happen!");
    } else {
      console.log("[Image] No image found after all strategies");
    }
    return null;
  } catch (err) {
    console.error("[Image ERROR]", err.message);
    if (requireImage) {
      // If image is required, try one more generic fallback
      console.log("[Image] Attempting emergency generic fallback...");
      return await fetchGenericHistoricalImage(event?.year);
    }
    return null;
  }
}

/**
 * Fetch an image from Wikipedia based on text content
 * Useful for viral content that doesn't have an event object
 * @param {string} text - Text content to search for (e.g., tweet text, historical fact)
 * @returns {Promise<Buffer|null>} - Image buffer or null if not found
 */
/**
 * Extract specific, accurate search terms from text
 * Prioritizes historical events, people, places over generic terms
 */
function extractAccurateSearchTerms(text) {
  const strategies = [];
  const cleanText = text.replace(/[📅🗓️📜🌍🤯💡]/g, "").toLowerCase();
  
  // Strategy 1: Extract key historical event phrases (highest priority)
  const historicalEventPatterns = [
    /(world war [i1-2]|ww[i1-2]|great war)/i,
    /(christmas truce|truce of \d{4})/i,
    /(battle of [a-z\s]+)/i,
    /(treaty of [a-z\s]+)/i,
    /(assassination of [a-z\s]+)/i,
    /(declaration of [a-z\s]+)/i,
    /(revolution of \d{4}|[a-z]+ revolution)/i,
    /(landing|invasion|attack|bombing) of [a-z\s]+/i,
  ];
  
  for (const pattern of historicalEventPatterns) {
    const match = text.match(pattern);
    if (match) {
      strategies.push(match[0]);
      console.log(`[Image] Found specific historical event phrase: "${match[0]}"`);
    }
  }
  
  // Strategy 2: Extract capitalized proper nouns (people, places, events)
  const capitalizedWords = text
    .split(" ")
    .filter(word => word.length > 3 && word[0] === word[0].toUpperCase() && /^[A-Z]/.test(word))
    .slice(0, 5)
    .join(" ");
  if (capitalizedWords.length > 5) {
    strategies.push(capitalizedWords);
  }
  
  // Strategy 3: Extract year + key terms (e.g., "1914 World War")
  const yearMatch = text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
  if (yearMatch) {
    const year = yearMatch[1];
    // Get important terms near the year
    const words = text.split(/\s+/);
    const yearIndex = words.findIndex(w => w.includes(year));
    if (yearIndex >= 0) {
      const contextWords = words.slice(Math.max(0, yearIndex - 2), yearIndex + 3)
        .filter(w => w.length > 3 && !['the', 'a', 'an', 'in', 'on', 'at', 'of', 'to', 'for'].includes(w.toLowerCase()))
        .join(" ");
      if (contextWords.length > 5) {
        strategies.push(contextWords);
      }
    }
  }
  
  // Strategy 4: Remove generic terms and keep specific ones
  const genericTerms = ['christmas', 'holiday', 'celebration', 'event', 'moment', 'day', 'time', 'period'];
  const importantWords = text
    .split(" ")
    .filter(word => {
      const lower = word.toLowerCase().replace(/[^\w]/g, '');
      return word.length > 3 && 
             !genericTerms.includes(lower) &&
             !['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'this', 'that', 'these', 'those'].includes(lower);
    })
    .slice(0, 6)
    .join(" ");
  if (importantWords.length > 5) {
    strategies.push(importantWords);
  }
  
  // Strategy 5: Full description (first 30 chars) - but only if it contains specific terms
  const first30 = text.slice(0, 30);
  if (first30.length > 10 && !genericTerms.some(term => first30.toLowerCase().includes(term))) {
    strategies.push(first30);
  }
  
  return strategies.filter(s => s && s.trim().length > 3);
}

export async function fetchImageForText(text, requireImage = true) {
  try {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      if (requireImage) {
        // Try generic fallback if text is empty
        return await fetchGenericHistoricalImage();
      }
      return null;
    }

    console.log("[Image] Starting image fetch for text:", text.slice(0, 80));

    // Build accurate search strategies
    const strategies = extractAccurateSearchTerms(text);
    
    if (strategies.length === 0) {
      // Fallback to old method if extraction fails
      const capitalizedWords = text
        .replace(/[📅🗓️📜🌍🤯💡]/g, "")
        .split(" ")
        .filter(word => word.length > 3 && word[0] === word[0].toUpperCase() && /^[A-Z]/.test(word))
        .slice(0, 5)
        .join(" ");
      if (capitalizedWords.length > 5) {
        strategies.push(capitalizedWords);
      }
    }
    
    // Strategy 2: Extract year + key terms
    const yearMatch = text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    if (yearMatch) {
      const year = yearMatch[1];
      const keyTerms = text
        .replace(/[📅🗓️📜🌍🤯💡]/g, "")
        .replace(/\d{4}/g, "")
        .replace(/[^\w\s]/g, " ")
        .split(" ")
        .filter(word => word.length > 4)
        .slice(0, 3)
        .join(" ");
      if (keyTerms.length > 3) {
        strategies.push(`${year} ${keyTerms}`);
      }
    }
    
    // Strategy 3: Remove common words, keep important terms
    const importantWords = text
      .replace(/[📅🗓️📜🌍🤯💡]/g, "")
      .replace(/\d{4}/g, "")
      .replace(/[^\w\s]/g, " ")
      .split(" ")
      .filter(word => {
        const lower = word.toLowerCase();
        return !["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "this", "that", "was", "were", "is", "are"].includes(lower) &&
               word.length > 3;
      })
      .slice(0, 6)
      .join(" ");
    if (importantWords.length > 5) {
      strategies.push(importantWords);
    }
    
    // Strategy 4: First 8 meaningful words
    const firstWords = text
      .replace(/[📅🗓️📜🌍🤯💡]/g, "")
      .replace(/[^\w\s]/g, " ")
      .split(" ")
      .filter(word => word.length > 3)
      .slice(0, 8)
      .join(" ");
    if (firstWords.length > 5) {
      strategies.push(firstWords);
    }

    // Try each strategy
    for (const query of strategies) {
      if (!query || query.trim().length < 3) continue;
      
      try {
        console.log("[Image] Trying text search strategy:", query);
        
        const searchRes = await axios.get(
          "https://en.wikipedia.org/w/api.php",
          {
            params: {
              action: "query",
              list: "search",
              srsearch: query,
              format: "json",
              srlimit: 5, // Try top 5 results
              origin: "*",
            },
            headers: {
              'User-Agent': 'DateTodayBot/1.0 (https://github.com/yourusername/datetoday-bot; contact@example.com)'
            },
            timeout: 10000,
          }
        );

        const pages = searchRes.data?.query?.search || [];
        
        // Score pages by relevance to text
        const scoredPages = pages.map(page => {
          let score = 0;
          const pageTitle = (page.title || "").toLowerCase();
          const pageSnippet = (page.snippet || "").toLowerCase();
          const queryLower = query.toLowerCase();
          
          // Title match
          if (pageTitle === queryLower) {
            score += 50;
          } else if (pageTitle.includes(queryLower)) {
            score += 30;
          }
          
          // Snippet relevance
          if (pageSnippet.includes(queryLower)) {
            score += 20;
          }
          
          return { page, score };
        }).sort((a, b) => b.score - a.score);
        
        // Try pages in order of relevance (best match first)
        for (const { page, score } of scoredPages) {
          const imageBuffer = await fetchImageFromPageId(page.pageid);
          if (imageBuffer) {
            console.log(`[Image] Successfully found image for text using strategy: "${query}" (relevance score: ${score})`);
            return imageBuffer;
          }
        }
      } catch (err) {
        console.log("[Image] Text strategy failed:", query, err.message);
        continue;
      }
    }
    
    console.log("[Image] No image found for text after all strategies");
    return null;

  } catch (err) {
    console.error("[Image ERROR for text]", err.message);
    return null; // fail safe
  }
}
