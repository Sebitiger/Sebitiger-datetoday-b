// fetchImage.js
// Safe, stable Wikipedia image fetcher with multiple fallback strategies
// Always returns: Buffer OR null

import axios from "axios";
import sharp from "sharp";
import { retryWithBackoff } from "./utils.js";

/**
 * Try to fetch image from a Wikipedia page
 * @param {number} pageId - Wikipedia page ID
 * @returns {Promise<Buffer|null>} - Image buffer or null
 */
async function fetchImageFromPageId(pageId) {
  try {
    const pageInfoRes = await axios.get(
      "https://en.wikipedia.org/w/api.php",
      {
        params: {
          action: "query",
          pageids: pageId,
          prop: "pageimages",
          pithumbsize: 1200,
          format: "json",
          origin: "*",
        },
        timeout: 10000,
      }
    );

    const pageInfo = pageInfoRes.data?.query?.pages?.[pageId];
    if (!pageInfo?.thumbnail?.source) {
      return null;
    }

    const imageUrl = pageInfo.thumbnail.source;
    console.log("[Image] Found thumbnail URL:", imageUrl);

    // Download with retry
    const imgRes = await retryWithBackoff(async () => {
      return await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 10000,
      });
    }, 2, 1000);

    const rawImageBuffer = Buffer.from(imgRes.data);
    return await processImageBuffer(rawImageBuffer);
  } catch (err) {
    console.log("[Image] Failed to fetch from page ID:", pageId, err.message);
    return null;
  }
}

/**
 * Process image buffer to optimal Twitter format
 */
async function processImageBuffer(rawImageBuffer) {
  try {
    const targetWidth = 1200;
    const targetHeight = 600;
    
    const processedBuffer = await sharp(rawImageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    
    console.log("[Image] Image processed. Size:", (processedBuffer.length / 1024).toFixed(2), "KB");
    
    if (processedBuffer.length > 5 * 1024 * 1024) {
      console.warn("[Image] Image too large, reducing quality...");
      return await sharp(rawImageBuffer)
        .resize(1000, 500, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    }
    
    return processedBuffer;
  } catch (sharpErr) {
    console.error("[Image] Sharp processing error:", sharpErr.message);
    return rawImageBuffer; // Fallback to original
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
          timeout: 10000,
        }
      );

      const pages = searchRes.data?.query?.search || [];
      
      // Try each page result
      for (const page of pages) {
        const imageBuffer = await fetchImageFromPageId(page.pageid);
        if (imageBuffer) {
          console.log("[Image] Successfully found image using strategy:", query);
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

export async function fetchEventImage(event) {
  try {
    console.log("[Image] Starting image fetch for event:", event.description?.slice(0, 80));
    
    // Try multiple search strategies
    const imageBuffer = await searchWikipediaMultipleStrategies(event);
    
    if (imageBuffer) {
      return imageBuffer;
    }
    
    // Fallback: Try searching by year if available
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
              srlimit: 3,
              origin: "*",
            },
            timeout: 10000,
          }
        );
        
        const pages = yearSearchRes.data?.query?.search || [];
        for (const page of pages) {
          const imageBuffer = await fetchImageFromPageId(page.pageid);
          if (imageBuffer) {
            console.log("[Image] Found image via year fallback");
            return imageBuffer;
          }
        }
      } catch (err) {
        console.log("[Image] Year fallback failed:", err.message);
      }
    }
    
    console.log("[Image] No image found after all strategies");
    return null;
  } catch (err) {
    console.error("[Image ERROR]", err.message);
    return null; // fail safe
  }
}

/**
 * Fetch an image from Wikipedia based on text content
 * Useful for viral content that doesn't have an event object
 * @param {string} text - Text content to search for (e.g., tweet text, historical fact)
 * @returns {Promise<Buffer|null>} - Image buffer or null if not found
 */
export async function fetchImageForText(text) {
  try {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return null;
    }

    console.log("[Image] Starting image fetch for text:", text.slice(0, 80));

    // Build multiple search strategies
    const strategies = [];
    
    // Strategy 1: Extract capitalized words (likely proper nouns)
    const capitalizedWords = text
      .replace(/[📅🗓️📜🌍🤯💡]/g, "")
      .split(" ")
      .filter(word => word.length > 3 && word[0] === word[0].toUpperCase() && /^[A-Z]/.test(word))
      .slice(0, 5)
      .join(" ");
    if (capitalizedWords.length > 5) {
      strategies.push(capitalizedWords);
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
            timeout: 10000,
          }
        );

        const pages = searchRes.data?.query?.search || [];
        
        // Try each page result
        for (const page of pages) {
          const imageBuffer = await fetchImageFromPageId(page.pageid);
          if (imageBuffer) {
            console.log("[Image] Successfully found image for text using strategy:", query);
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
