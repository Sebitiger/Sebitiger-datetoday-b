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

    // 2. Get page info + thumbnail
    const pageInfoRes = await axios.get(
      "https://en.wikipedia.org/w/api.php",
      {
        params: {
          action: "query",
          pageids: pageId,
          prop: "pageimages",
          pithumbsize: 800,
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
    // Twitter requirements: max 5MB, formats: JPG, PNG, GIF, WebP
    // Resize to max 1200x1200 to reduce file size while maintaining quality
    try {
      const processedBuffer = await sharp(rawImageBuffer)
        .resize(1200, 1200, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85, mozjpeg: true }) // Convert to JPEG for smaller size
        .toBuffer();

      console.log("[Image] Image processed. Original:", (rawImageBuffer.length / 1024).toFixed(2), "KB, Processed:", (processedBuffer.length / 1024).toFixed(2), "KB");
      
      // Check file size (Twitter limit is 5MB)
      if (processedBuffer.length > 5 * 1024 * 1024) {
        console.warn("[Image] Processed image still exceeds 5MB, using lower quality...");
        const smallerBuffer = await sharp(rawImageBuffer)
          .resize(800, 800, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 70, mozjpeg: true })
          .toBuffer();
        return smallerBuffer;
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
