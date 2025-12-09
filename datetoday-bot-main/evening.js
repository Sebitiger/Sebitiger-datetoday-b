import { generateEveningFact } from "./generateFact.js";
import { postTweet, postTweetWithImage } from "./twitterClient.js";
import { fetchImageForText } from "./fetchImage.js";

export async function postEveningFact() {
  console.log("[Evening] Starting evening fact job...");
  try {
    const fact = await generateEveningFact();
    
    if (!fact || !fact.trim().length) {
      throw new Error("Generated fact is empty");
    }

    // Fetch an image based on the fact content (REQUIRED - retry until found)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 3;
    
    while (!imageBuffer && imageAttempts < maxImageAttempts) {
      try {
        console.log(`[Evening] Attempting to fetch image (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
        imageBuffer = await fetchImageForText(fact, true); // requireImage = true
        if (imageBuffer) {
          console.log("[Evening] Image fetched successfully for evening fact.");
          break;
        } else {
          console.warn(`[Evening] No image found on attempt ${imageAttempts + 1}, retrying...`);
          imageAttempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (imgErr) {
        console.error(`[Evening] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
        imageAttempts++;
        if (imageAttempts < maxImageAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!imageBuffer) {
      console.error("[Evening] CRITICAL: Could not fetch image after multiple attempts. Posting will fail.");
      throw new Error("Failed to fetch required image for evening fact");
    }

    // Post with image (REQUIRED)
    await postTweetWithImage(fact, imageBuffer, null);
    console.log("[Evening] Evening fact job completed successfully.");
  } catch (err) {
    console.error("[Evening] Job failed:", err.message || err);
    console.error("[Evening] Stack:", err.stack);
    throw err; // Re-throw to allow caller to handle
  }
}
