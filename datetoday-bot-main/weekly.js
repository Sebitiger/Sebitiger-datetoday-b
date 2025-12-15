import { getEventForDate } from "./fetchEvents.js";
import { generateWeeklyThread } from "./generateThread.js";
import { postThread } from "./twitterClient.js";
import { fetchEventImage } from "./fetchImage.js";
import { isContentDuplicate, markContentPosted, isImageDuplicate } from "./database.js";

export async function postWeeklyThread() {
  console.log("[Weekly] Starting weekly thread job...");
  try {
    // By default we just reuse today's date.
    // You could change this to pick a random day in the last 7 days.
    const event = await getEventForDate();
    console.log("[Weekly] Event for thread:", event.year, "-", event.description?.slice(0, 80) || "N/A", "...");

    // Generate thread and check for duplicates (retry up to 5 times)
    let tweets = await generateWeeklyThread(event);
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      if (!tweets || !tweets.length) {
        attempts++;
        tweets = await generateWeeklyThread(event);
        continue;
      }
      
      // Check if first tweet (main content) is duplicate
      const isDuplicate = await isContentDuplicate(tweets[0], 60);
      if (!isDuplicate) {
        break; // Found unique content
      }
      
      console.log(`[Weekly] Generated thread is similar to recent post, generating new one... (attempt ${attempts + 1}/${maxAttempts})`);
      tweets = await generateWeeklyThread(event);
      attempts++;
    }
    
    if (!tweets || !tweets.length) {
      throw new Error("No tweets generated for weekly thread after duplicate checks");
    }

    // Fetch an image for the event (REQUIRED - retry until found)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 3;
    
    while (!imageBuffer && imageAttempts < maxImageAttempts) {
      try {
        console.log(`[Weekly] Attempting to fetch image (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
        imageBuffer = await fetchEventImage(event, true); // requireImage = true
        if (imageBuffer) {
          console.log("[Weekly] Image fetched successfully for weekly thread.");
          break;
        } else {
          console.warn(`[Weekly] No image found on attempt ${imageAttempts + 1}, retrying...`);
          imageAttempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (imgErr) {
        console.error(`[Weekly] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
        imageAttempts++;
        if (imageAttempts < maxImageAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!imageBuffer) {
      console.error("[Weekly] CRITICAL: Could not fetch image after multiple attempts. Posting will fail.");
      throw new Error("Failed to fetch required image for weekly thread");
    }
    
    // Check if image is duplicate
    const isImageDup = await isImageDuplicate(imageBuffer, 90);
    if (isImageDup) {
      throw new Error("Image is duplicate - aborting post");
    }
    
    // Final check: verify content is still unique
    const finalDuplicateCheck = await isContentDuplicate(tweets[0], 60);
    if (finalDuplicateCheck) {
      throw new Error("Content became duplicate during image fetching - aborting post");
    }

    const threadTweetId = await postThread(tweets, imageBuffer);
    
    // Mark content and image as posted
    await markContentPosted(tweets.join(' '), threadTweetId, imageBuffer);
    
    console.log("[Weekly] Weekly thread job completed successfully.");
  } catch (err) {
    console.error("[Weekly] Job failed:", err.message || err);
    console.error("[Weekly] Stack:", err.stack);
    throw err; // Re-throw to allow caller to handle
  }
}
