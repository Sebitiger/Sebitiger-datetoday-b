// fetchImage.js
// Safe, stable Wikipedia image fetcher
// Always returns: Buffer OR null

import axios from "axios";
import sharp from "sharp";

export async function fetchEventImage(event) {
  try {
    // Use the first 8–10 words of the event description as a search query
    const query = event.description.split(" ").slice(0, 10).join(" ");

    console.log("[Image] Searching Wikipedia for:", query);

    // 1. Search Wikipedia
    const searchRes = await axios.get(
      "https://en.wikipedia.org/w/api.php",
      {
        params: {
          action: "query",
          list: "search",
          srsearch: query,
          format: "json",
          srlimit: 1,
          origin: "*",
        },
      }
    );

    const page = searchRes.data?.query?.search?.[0];
    if (!page) {
      console.log("[Image] No matching Wikipedia page.");
      return null;
    }

    const pageId = page.pageid;

    // 2. Get page info + thumbnail (larger size for better quality)
    const pageInfoRes = await axios.get(
      "https://en.wikipedia.org/w/api.php",
      {
        params: {
          action: "query",
          pageids: pageId,
          prop: "pageimages",
          pithumbsize: 1200, // Increased from 800 for better quality
          format: "json",
          origin: "*",
        },
      }
    );

    const pageInfo = pageInfoRes.data?.query?.pages?.[pageId];

    if (!pageInfo?.thumbnail?.source) {
      console.log("[Image] No thumbnail available.");
      return null;
    }

    const imageUrl = pageInfo.thumbnail.source;
    console.log("[Image] Thumbnail URL:", imageUrl);

    // 3. Download the image
    const imgRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 10000, // 10 second timeout
    });

    const rawImageBuffer = Buffer.from(imgRes.data);
    
    // 4. Process and optimize image using sharp
    // Twitter optimal: 2:1 aspect ratio (1200x600px) for best timeline display
    // This maximizes visibility and engagement - images with 2:1 ratio get 150% more engagement
    try {
      const targetWidth = 1200;
      const targetHeight = 600;
      
      // Use center crop to create consistent 2:1 ratio (optimal for Twitter timeline)
      const processedBuffer = await sharp(rawImageBuffer)
        .resize(targetWidth, targetHeight, {
          fit: "cover", // Crop to fill for optimal Twitter display
          position: "center", // Center crop for best composition
        })
        .jpeg({ quality: 90, mozjpeg: true }) // Higher quality for viral content
        .toBuffer();
      
      console.log("[Image] Image processed with 2:1 aspect ratio (optimal for Twitter). Size:", (processedBuffer.length / 1024).toFixed(2), "KB");
      
      // Check file size (Twitter limit is 5MB)
      if (processedBuffer.length > 5 * 1024 * 1024) {
        console.warn("[Image] Processed image exceeds 5MB, using smaller size...");
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
      console.error("[Image] Sharp processing error, using original:", sharpErr.message);
      // Fallback to original if sharp fails
      return rawImageBuffer;
    }

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

    // Extract key terms from text (remove emojis, dates, common words)
    const cleaned = text
      .replace(/[📅🗓️📜🌍🤯💡]/g, "") // Remove emojis
      .replace(/\d{4}/g, "") // Remove years
      .replace(/[^\w\s]/g, " ") // Remove punctuation
      .split(" ")
      .filter(word => word.length > 3) // Only words longer than 3 chars
      .slice(0, 8) // Take first 8 meaningful words
      .join(" ");

    if (cleaned.trim().length < 5) {
      console.log("[Image] Text too short or no meaningful keywords found");
      return null;
    }

    console.log("[Image] Searching Wikipedia for text:", cleaned);

    // Search Wikipedia
    const searchRes = await axios.get(
      "https://en.wikipedia.org/w/api.php",
      {
        params: {
          action: "query",
          list: "search",
          srsearch: cleaned,
          format: "json",
          srlimit: 1,
          origin: "*",
        },
        timeout: 10000,
      }
    );

    const page = searchRes.data?.query?.search?.[0];
    if (!page) {
      console.log("[Image] No matching Wikipedia page for text.");
      return null;
    }

    const pageId = page.pageid;

    // Get page info + thumbnail (larger size for better quality)
    const pageInfoRes = await axios.get(
      "https://en.wikipedia.org/w/api.php",
      {
        params: {
          action: "query",
          pageids: pageId,
          prop: "pageimages",
          pithumbsize: 1200, // Increased from 800 for better quality
          format: "json",
          origin: "*",
        },
        timeout: 10000,
      }
    );

    const pageInfo = pageInfoRes.data?.query?.pages?.[pageId];

    if (!pageInfo?.thumbnail?.source) {
      console.log("[Image] No thumbnail available for text.");
      return null;
    }

    const imageUrl = pageInfo.thumbnail.source;
    console.log("[Image] Thumbnail URL:", imageUrl);

    // Download the image
    const imgRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });

    const rawImageBuffer = Buffer.from(imgRes.data);
    
    // Process and optimize image using sharp
    // Twitter optimal: 2:1 aspect ratio (1200x600px) for best timeline display
    try {
      const metadata = await sharp(rawImageBuffer).metadata();
      const { width, height } = metadata;
      
      let targetWidth = 1200;
      let targetHeight = 600;
      
      // Use center crop for consistent 2:1 ratio (best for Twitter)
      const processedBuffer = await sharp(rawImageBuffer)
        .resize(targetWidth, targetHeight, {
          fit: "cover", // Crop to fill for optimal Twitter display
          position: "center", // Center crop for best composition
        })
        .jpeg({ quality: 90, mozjpeg: true }) // Higher quality for viral content
        .toBuffer();

      console.log("[Image] Image processed for text with 2:1 aspect ratio. Size:", (processedBuffer.length / 1024).toFixed(2), "KB");
      
      // Check file size (Twitter limit is 5MB)
      if (processedBuffer.length > 5 * 1024 * 1024) {
        console.warn("[Image] Processed image still exceeds 5MB, using lower quality...");
        const smallerBuffer = await sharp(rawImageBuffer)
          .resize(1000, 500, {
            fit: "cover",
            position: "center",
          })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
        return smallerBuffer;
      }

      return processedBuffer;
    } catch (sharpErr) {
      console.error("[Image] Sharp processing error, using original:", sharpErr.message);
      return rawImageBuffer;
    }

  } catch (err) {
    console.error("[Image ERROR for text]", err.message);
    return null; // fail safe
  }
}
