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
    console.log(`[Image] Found thumbnail URL for page ${pageId}:`, imageUrl);

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
    return processedBuffer;
  } catch (err) {
    console.error(`[Image] Failed to fetch from page ID ${pageId}:`, err.message);
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
 * Score image relevance based on search term and image metadata
 */
function scoreImageRelevance(image, searchTerm, eventDescription = null) {
  let score = 0;
  const searchLower = searchTerm.toLowerCase();
  const descLower = eventDescription?.toLowerCase() || "";
  
  // Check image description/title relevance
  const imageDesc = (image.description || image.alt_description || image.title || "").toLowerCase();
  if (imageDesc.includes(searchLower)) {
    score += 30;
  }
  
  // Check for key historical terms in description
  const historicalTerms = ["history", "historical", "ancient", "war", "battle", "event", "historic"];
  for (const term of historicalTerms) {
    if (imageDesc.includes(term)) {
      score += 10;
    }
  }
  
  // Prefer images with people/events (more impactful)
  const impactfulTerms = ["people", "person", "soldier", "leader", "crowd", "ceremony", "event"];
  for (const term of impactfulTerms) {
    if (imageDesc.includes(term)) {
      score += 15;
    }
  }
  
  // Prefer higher quality (likes/downloads indicate quality)
  if (image.likes) {
    score += Math.min(image.likes / 100, 20); // Max 20 points for popularity
  }
  
  // Prefer landscape orientation (better for Twitter)
  if (image.width && image.height) {
    const aspectRatio = image.width / image.height;
    if (aspectRatio >= 1.5 && aspectRatio <= 2.5) {
      score += 10; // Good for Twitter (2:1 ratio)
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
    const url = `https://api.unsplash.com/search/photos?query=${query}&per_page=10&orientation=landscape`; // Get more results to choose from
    
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
    
    // Score and rank images by relevance
    const scoredPhotos = photos.map(photo => ({
      photo,
      score: scoreImageRelevance(photo, searchTerm, eventDescription)
    })).sort((a, b) => b.score - a.score);
    
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
    const url = `https://api.pexels.com/v1/search?query=${query}&per_page=15&orientation=landscape`; // Get more results
    
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
    
    // Score and rank images by relevance
    const scoredPhotos = photos.map(photo => {
      const photoDesc = (photo.alt || "").toLowerCase();
      let score = 0;
      const searchLower = searchTerm.toLowerCase();
      
      // Relevance scoring
      if (photoDesc.includes(searchLower)) {
        score += 30;
      }
      
      // Historical terms boost
      const historicalTerms = ["history", "historical", "ancient", "war", "battle", "vintage", "old"];
      for (const term of historicalTerms) {
        if (photoDesc.includes(term)) {
          score += 10;
        }
      }
      
      // Impactful content (people, events)
      const impactfulTerms = ["people", "person", "soldier", "crowd", "ceremony", "event", "monument"];
      for (const term of impactfulTerms) {
        if (photoDesc.includes(term)) {
          score += 15;
        }
      }
      
      // Prefer higher resolution (quality indicator)
      if (photo.width && photo.height) {
        const pixels = photo.width * photo.height;
        if (pixels > 2000000) { // > 2MP
          score += 10;
        }
        // Good aspect ratio for Twitter
        const aspectRatio = photo.width / photo.height;
        if (aspectRatio >= 1.5 && aspectRatio <= 2.5) {
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
 */
async function fetchFromWikimediaCommons(searchTerm) {
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
    
    // Get page images
    const pageInfoRes = await axios.get(url, {
      params: {
        action: "query",
        pageids: pageId,
        prop: "pageimages",
        pithumbsize: 1200,
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
    console.log(`[Image] Found Wikimedia Commons image: ${pages[0].title}`);
    
    // Download image
    const imgRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    
    const rawImageBuffer = Buffer.from(imgRes.data);
    return await processImageBuffer(rawImageBuffer);
  } catch (err) {
    console.log(`[Image] Wikimedia Commons search failed: ${err.message}`);
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
    
    // Strategy 1: Try Pexels FIRST (most reliable with API key)
    if (process.env.PEXELS_API_KEY) {
      const eventSearchTerms = [
        event.description?.slice(0, 30),
        event.year ? `${event.year} history` : null,
        event.description?.split(" ").slice(0, 3).join(" "),
        event.year ? `history ${event.year}` : null
      ].filter(Boolean);
      
      for (const term of eventSearchTerms) {
        if (!term || term.length < 3) continue;
        console.log(`[Image] Trying Pexels first for: "${term}"`);
        const pexelsImage = await fetchFromPexels(term, event.description);
        if (pexelsImage) {
          console.log(`[Image] ✅ Found best matching image from Pexels for event`);
          return pexelsImage;
        }
      }
    }
    
    // Strategy 2: Try multiple Wikipedia search strategies
    let imageBuffer = await searchWikipediaMultipleStrategies(event);
    
    if (imageBuffer) {
      return imageBuffer;
    }
    
    // Strategy 3: Try alternative sources (Unsplash, Wikimedia Commons)
    const eventSearchTerms = [
      event.description?.slice(0, 30),
      event.year ? `${event.year} history` : null,
      event.description?.split(" ").slice(0, 3).join(" "),
      event.year ? `history ${event.year}` : null
    ].filter(Boolean);
    
    for (const term of eventSearchTerms) {
      if (!term || term.length < 3) continue;
      
      // Try Unsplash (with event description for better matching)
      imageBuffer = await fetchFromUnsplash(term, event.description);
      if (imageBuffer) {
        console.log(`[Image] ✅ Found best matching image from Unsplash for event`);
        return imageBuffer;
      }
      
      // Try Wikimedia Commons
      imageBuffer = await fetchFromWikimediaCommons(term);
      if (imageBuffer) {
        console.log(`[Image] ✅ Found image from Wikimedia Commons for event`);
        return imageBuffer;
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
