// fetchVideo.js
// Fetch short, relevant historical videos (currently from Pexels)

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/**
 * Fetch a short video clip from Pexels related to the given search term.
 * Returns an MP4 buffer or null.
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
        per_page: 10,
        orientation: "landscape",
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

    // Prefer short, landscape clips
    const candidates = videos
      .map(v => ({
        url: (v.video_files || []).find(f => f.file_type === "video/mp4" && f.width >= f.height)?.link,
        duration: v.duration,
      }))
      .filter(c => c.url && c.duration && c.duration <= 30); // keep <= 30s

    if (!candidates.length) {
      console.log("[Video] No suitable short landscape videos found for:", searchTerm);
      return null;
    }

    const best = candidates[0];
    console.log("[Video] Downloading Pexels video:", best.url);

    const videoRes = await axios.get(best.url, {
      responseType: "arraybuffer",
      timeout: 20000,
    });

    const buffer = Buffer.from(videoRes.data);
    if (!buffer || buffer.length === 0) {
      console.warn("[Video] Empty video buffer from Pexels");
      return null;
    }

    console.log("[Video] ✅ Got Pexels video buffer, size KB:", (buffer.length / 1024).toFixed(1));
    return buffer;
  } catch (err) {
    console.error("[Video] Pexels video fetch failed:", err.message || err);
    return null;
  }
}

/**
 * Extract better search terms from text for video search
 * Tries to find relevant historical or visual terms
 */
function extractVideoSearchTerms(text) {
  if (!text || typeof text !== "string") return ["history"];
  
  const lower = text.toLowerCase();
  
  // Try to extract key historical terms
  const historicalTerms = [];
  
  // Look for years (can help with era-specific videos)
  const yearMatch = text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    if (year < 500) historicalTerms.push("ancient");
    else if (year < 1500) historicalTerms.push("medieval");
    else if (year < 1800) historicalTerms.push("renaissance");
    else if (year < 1900) historicalTerms.push("19th century");
    else historicalTerms.push("20th century");
  }
  
  // Extract meaningful nouns (longer words, proper nouns)
  const words = lower
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 4 && !["this", "that", "with", "from", "about", "which", "their", "there", "would", "could", "after", "before", "during", "history", "historical"].includes(w))
    .slice(0, 3);
  
  // Combine terms
  const searchTerms = [...new Set([...historicalTerms, ...words])];
  
  // If we have good terms, use them; otherwise use generic historical terms
  if (searchTerms.length > 0) {
    return searchTerms.slice(0, 2); // Use top 2 terms
  }
  
  // Fallback to generic historical/visual terms
  return ["history", "ancient"];
}

/**
 * Fetch a video for free‑form text (fact / quick fact content).
 * Tries multiple search terms to find relevant videos.
 */
export async function fetchVideoForText(text) {
  if (!text || typeof text !== "string") {
    console.log("[Video] Empty text provided for video search");
    return null;
  }

  const searchTerms = extractVideoSearchTerms(text);
  console.log(`[Video] Extracted search terms: ${searchTerms.join(", ")}`);

  // Try each search term until we find a video
  for (const term of searchTerms) {
    console.log(`[Video] Trying search term: "${term}"`);
    const video = await fetchFromPexelsVideo(term);
    if (video) {
      console.log(`[Video] ✅ Successfully found video for term: "${term}"`);
      return video;
    }
  }
  
  // If all specific terms fail, try a generic "history" search as last resort
  console.log("[Video] Trying generic 'history' search as fallback...");
  return await fetchFromPexelsVideo("history");
}


