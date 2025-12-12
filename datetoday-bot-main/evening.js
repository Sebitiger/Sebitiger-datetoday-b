import { generateEveningFact } from "./generateFact.js";
import { postTweet, postTweetWithImage } from "./twitterClient.js";
import { fetchImageForText } from "./fetchImage.js";
import { isContentDuplicate, markContentPosted } from "./database.js";

export async function postEveningFact() {
  console.log("[Evening] Starting evening fact job...");
  try {
    // Generate fact and check for duplicates (retry up to 5 times)
    let fact = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      fact = await generateEveningFact();
      
      if (!fact || !fact.trim().length) {
        attempts++;
        continue;
      }
      
      // Check if similar content was posted recently (30 days - stricter)
      const isDuplicate = await isContentDuplicate(fact, 30); // Check last 30 days
      if (!isDuplicate) {
        break; // Found unique content
      }
      
      console.log(`[Evening] Generated fact is similar to recent post, generating new one... (attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
    }
    
    if (!fact || !fact.trim().length) {
      throw new Error("Failed to generate unique evening fact after multiple attempts");
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
    const tweetId = await postTweetWithImage(fact, imageBuffer, null);
    
    // Mark content as posted to prevent duplicates
    await markContentPosted(fact, tweetId);
    
    console.log("[Evening] Evening fact job completed successfully.");
  } catch (err) {
    console.error("[Evening] Job failed:", err.message || err);
    console.error("[Evening] Stack:", err.stack);
    throw err; // Re-throw to allow caller to handle
  }
}
