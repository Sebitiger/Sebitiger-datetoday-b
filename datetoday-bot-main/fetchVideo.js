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
 * Fetch a video for free‑form text (fact / quick fact content).
 * For now we just pass the text as query and rely on Pexels search.
 */
export async function fetchVideoForText(text) {
  if (!text || typeof text !== "string") return null;

  // Simple keyword extraction: keep a few meaningful words
  const words = text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5)
    .join(" ");

  const query = words || "history";
  return await fetchFromPexelsVideo(query);
}


