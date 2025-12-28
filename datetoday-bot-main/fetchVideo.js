// fetchVideo.js
// Fetch short, relevant historical videos from Pexels and Pixabay

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/**
 * Score video relevance based on duration, quality, and orientation
 */
function scoreVideo(video, searchTerm) {
  let score = 0;
  
  // Prefer shorter videos (better for Twitter engagement)
  if (video.duration <= 15) score += 20;
  else if (video.duration <= 30) score += 10;
  else if (video.duration <= 60) score += 5;
  
  // Prefer videos with good aspect ratios (both landscape and portrait work)
  if (video.width && video.height) {
    const aspectRatio = video.width / video.height;
    // Twitter supports both orientations well
    if ((aspectRatio >= 1.5 && aspectRatio <= 2.5) || // Landscape
        (aspectRatio >= 0.4 && aspectRatio <= 0.75) || // Portrait
        (Math.abs(aspectRatio - 1) < 0.1)) { // Square
      score += 15;
    }
  }
  
  // Prefer higher quality videos
  if (video.quality === 'hd' || video.quality === 'sd') {
    score += 10;
  }
  
  // Prefer smaller file sizes (faster upload)
  if (video.file_size && video.file_size < 15 * 1024 * 1024) { // < 15MB
    score += 10;
  }
  
  return score;
}

/**
 * Fetch a short video clip from Pexels related to the given search term.
 * Returns an MP4 buffer or null. Supports both portrait and landscape.
 */
async function fetchFromPexelsVideo(searchTerm) {
  if (!process.env.PEXELS_API_KEY) {
    console.log("[Video] No PEXELS_API_KEY set, skipping video search.");
    return null;
  }

  try {
    const url = "https://api.pexels.com/videos/search";
    const res = await axios.get(url, {
      params: {
        query: searchTerm,
        per_page: 20, // Increased to get more options
      },
      headers: {
        Authorization: process.env.PEXELS_API_KEY,
      },
      timeout: 12000,
    });

    const videos = res.data?.videos || [];
    if (!videos.length) {
      console.log("[Video] No Pexels videos found for:", searchTerm);
      return null;
    }

    // Collect all suitable video candidates (both portrait and landscape)
    const candidates = [];
    
    for (const v of videos) {
      if (!v.video_files || !v.duration) continue;
      
      // Find best quality MP4 file for each video
      const videoFiles = v.video_files
        .filter(f => f.file_type === "video/mp4")
        .sort((a, b) => {
          // Prefer smaller files (faster upload) but good quality
          if (a.width && b.width) return b.width - a.width; // Prefer higher resolution
          return 0;
        });
      
      for (const file of videoFiles) {
        if (file.duration && file.duration <= 30 && file.link) {
          candidates.push({
            url: file.link,
            duration: file.duration || v.duration,
            width: file.width,
            height: file.height,
            file_size: file.file_size,
            quality: file.quality,
            score: 0
          });
          break; // Use best file for this video
        }
      }
    }

    if (!candidates.length) {
      console.log("[Video] No suitable short videos found for:", searchTerm);
      return null;
    }

    // Score and sort candidates
    candidates.forEach(c => {
      c.score = scoreVideo(c, searchTerm);
    });
    
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    
    console.log(`[Video] Selected video: ${best.duration}s, ${best.width}x${best.height}, score: ${best.score}`);

    const videoRes = await axios.get(best.url, {
      responseType: "arraybuffer",
      timeout: 30000, // Increased timeout for video downloads
      maxContentLength: 50 * 1024 * 1024, // Max 50MB
    });

    const buffer = Buffer.from(videoRes.data);
    if (!buffer || buffer.length === 0) {
      console.warn("[Video] Empty video buffer from Pexels");
      return null;
    }

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`[Video] ✅ Got Pexels video buffer, size: ${sizeMB} MB`);
    
    // Check file size (Twitter limit is ~512MB, but we prefer smaller)
    if (buffer.length > 100 * 1024 * 1024) {
      console.warn(`[Video] Video file is large (${sizeMB} MB), may cause upload issues`);
    }
    
    return buffer;
  } catch (err) {
    console.error("[Video] Pexels video fetch failed:", err.message || err);
    return null;
  }
}

/**
 * Extract better search terms from text for video search
 * Tries to find relevant historical or visual terms that will yield good video results
 */
function extractVideoSearchTerms(text) {
  if (!text || typeof text !== "string") return ["history", "ancient"];
  
  const lower = text.toLowerCase();
  const searchTerms = [];
  
  // Historical periods based on year
  const yearMatch = text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year < 500) {
      searchTerms.push("ancient", "antiquity", "roman", "greek", "egypt");
    } else if (year < 1500) {
      searchTerms.push("medieval", "middle ages", "castle", "knight");
    } else if (year < 1800) {
      searchTerms.push("renaissance", "baroque", "17th century", "18th century");
    } else if (year < 1900) {
      searchTerms.push("19th century", "industrial", "victorian");
    } else {
      searchTerms.push("20th century", "modern", "vintage");
    }
  }
  
  // Extract key historical entities and concepts
  const historicalKeywords = {
    // Places
    'rome': ['roman', 'ancient rome', 'colosseum'],
    'greece': ['greek', 'ancient greece', 'athens'],
    'egypt': ['ancient egypt', 'pyramid', 'pharaoh'],
    'france': ['french', 'paris', 'versailles'],
    'britain': ['british', 'england', 'london'],
    'germany': ['german', 'berlin'],
    'spain': ['spanish', 'madrid'],
    'china': ['chinese', 'ancient china'],
    'japan': ['japanese', 'samurai'],
    'america': ['american', 'usa', 'united states'],
    
    // Events
    'war': ['battle', 'military', 'soldier'],
    'revolution': ['revolution', 'rebellion', 'uprising'],
    'empire': ['empire', 'imperial'],
    'king': ['royal', 'king', 'queen', 'monarchy'],
    'treaty': ['diplomacy', 'peace'],
    'discovery': ['exploration', 'discovery', 'voyage'],
    'independence': ['freedom', 'independence', 'liberty'],
  };
  
  // Check for historical keywords and add relevant search terms
  for (const [keyword, terms] of Object.entries(historicalKeywords)) {
    if (lower.includes(keyword)) {
      searchTerms.push(...terms);
    }
  }
  
  // Extract proper nouns (capitalized words) - these are often important
  const properNouns = text.match(/\b[A-Z][a-z]+\b/g) || [];
  const meaningfulProperNouns = properNouns
    .filter(word => {
      const w = word.toLowerCase();
      return w.length > 4 && 
             !['This', 'That', 'The', 'When', 'Where', 'What', 'Who', 'How', 'Why', 'Then', 'Than'].includes(word);
    })
    .map(w => w.toLowerCase())
    .slice(0, 3);
  
  searchTerms.push(...meaningfulProperNouns);
  
  // Extract meaningful common nouns (longer words)
  const words = lower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => {
      return w.length > 5 && 
             !["this", "that", "with", "from", "about", "which", "their", "there", "would", "could", 
               "after", "before", "during", "history", "historical", "event", "happened", "occurred",
               "finally", "acknowledges", "declared", "signed", "began", "ended"].includes(w);
    })
    .slice(0, 2);
  
  searchTerms.push(...words);
  
  // Remove duplicates and limit
  const uniqueTerms = [...new Set(searchTerms)];
  
  // Prioritize: historical periods > proper nouns > common nouns
  const prioritized = [
    ...uniqueTerms.filter(t => ['ancient', 'medieval', 'renaissance', '19th century', '20th century'].includes(t)),
    ...uniqueTerms.filter(t => !['ancient', 'medieval', 'renaissance', '19th century', '20th century'].includes(t))
  ];
  
  // Return top 3-4 terms to try
  if (prioritized.length > 0) {
    return prioritized.slice(0, 4);
  }
  
  // Fallback to generic historical/visual terms
  return ["history", "ancient", "historical"];
}

/**
 * Fetch a short video clip from Pixabay (free alternative to Pexels)
 * Returns an MP4 buffer or null.
 */
async function fetchFromPixabayVideo(searchTerm) {
  if (!process.env.PIXABAY_API_KEY) {
    // Pixabay is optional, don't log if not set
    return null;
  }

  try {
    const url = "https://pixabay.com/api/videos/";
    const res = await axios.get(url, {
      params: {
        key: process.env.PIXABAY_API_KEY,
        q: searchTerm,
        per_page: 20,
        video_type: 'film', // Prefer film over animation
        min_width: 640, // Minimum quality
      },
      timeout: 12000,
    });

    const videos = res.data?.hits || [];
    if (!videos.length) {
      console.log("[Video] No Pixabay videos found for:", searchTerm);
      return null;
    }

    // Collect suitable video candidates
    const candidates = [];
    
    for (const v of videos) {
      if (!v.videos || !v.duration) continue;
      
      // Find best quality video file
      const videoFiles = v.videos;
      const bestFile = videoFiles.medium || videoFiles.small || videoFiles.tiny;
      
      if (bestFile && bestFile.url && v.duration <= 30) {
        candidates.push({
          url: bestFile.url,
          duration: v.duration,
          width: bestFile.width,
          height: bestFile.height,
          file_size: bestFile.size,
          score: 0
        });
      }
    }

    if (!candidates.length) {
      console.log("[Video] No suitable short Pixabay videos found for:", searchTerm);
      return null;
    }

    // Score and sort candidates
    candidates.forEach(c => {
      c.score = scoreVideo(c, searchTerm);
    });
    
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    
    console.log(`[Video] Selected Pixabay video: ${best.duration}s, ${best.width}x${best.height}, score: ${best.score}`);

    const videoRes = await axios.get(best.url, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024,
    });

    const buffer = Buffer.from(videoRes.data);
    if (!buffer || buffer.length === 0) {
      console.warn("[Video] Empty video buffer from Pixabay");
      return null;
    }

    const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`[Video] ✅ Got Pixabay video buffer, size: ${sizeMB} MB`);
    
    return buffer;
  } catch (err) {
    console.error("[Video] Pixabay video fetch failed:", err.message || err);
    return null;
  }
}

/**
 * Fetch a video for free‑form text (fact / quick fact content).
 * Tries multiple search terms and multiple sources to find relevant videos.
 */
export async function fetchVideoForText(text) {
  if (!text || typeof text !== "string") {
    console.log("[Video] Empty text provided for video search");
    return null;
  }

  const searchTerms = extractVideoSearchTerms(text);
  console.log(`[Video] Extracted search terms: ${searchTerms.join(", ")}`);

  // Try each search term with both sources
  for (const term of searchTerms) {
    console.log(`[Video] Trying search term: "${term}"`);
    
    // Try Pexels first (usually better quality)
    const pexelsVideo = await fetchFromPexelsVideo(term);
    if (pexelsVideo) {
      console.log(`[Video] ✅ Successfully found Pexels video for term: "${term}"`);
      return pexelsVideo;
    }
    
    // Try Pixabay as alternative
    const pixabayVideo = await fetchFromPixabayVideo(term);
    if (pixabayVideo) {
      console.log(`[Video] ✅ Successfully found Pixabay video for term: "${term}"`);
      return pixabayVideo;
    }
  }
  
  // If all specific terms fail, try generic searches as last resort
  console.log("[Video] Trying generic searches as fallback...");
  
  const fallbackTerms = ["history", "ancient", "historical"];
  for (const term of fallbackTerms) {
    const video = await fetchFromPexelsVideo(term) || await fetchFromPixabayVideo(term);
    if (video) {
      console.log(`[Video] ✅ Found fallback video for: "${term}"`);
      return video;
    }
  }
  
  console.log("[Video] ❌ No videos found after trying all sources and terms");
  return null;
}


