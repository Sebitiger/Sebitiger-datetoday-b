// daily.js

import { getRandomEvent } from "./fetchEvents.js";
import { generateMainTweet } from "./generateTweet.js";
import { generateReply } from "./generateReply.js";
import { fetchEventImage } from "./fetchImage.js";
import { postTweet, postTweetWithImage } from "./twitterClient.js";
import { isEventPosted, markEventPosted, createEventId } from "./database.js";
import { isEventAppropriate } from "./moderation.js";
import { trackPost } from "./analytics.js";
import { info, error, logTweetPost } from "./logger.js";

export async function postDailyTweet() {
  info("[Daily] Starting daily tweet job...");

  try {
    // 1. Fetch a random historical event (with deduplication and moderation)
    let event = await getRandomEvent();
    let eventId = createEventId(event);
    let attempts = 0;
    const maxAttempts = 15;
    
    // Check if event was already posted or inappropriate, try another if so
    while (attempts < maxAttempts) {
      const isPosted = await isEventPosted(eventId);
      const isAppropriate = await isEventAppropriate(event);
      
      if (!isPosted && isAppropriate) {
        break; // Found good event
      }
      
      if (isPosted) {
        info(`[Daily] Event already posted, fetching another... (attempt ${attempts + 1})`);
      } else if (!isAppropriate) {
        info(`[Daily] Event flagged by moderation, fetching another... (attempt ${attempts + 1})`);
      }
      
      event = await getRandomEvent();
      eventId = createEventId(event);
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      error("[Daily] Could not find appropriate new event after multiple attempts");
      throw new Error("Failed to find appropriate event");
    }
    info("[Daily] Selected event", {
      year: event.year,
      description: event.description?.slice(0, 120),
    });

    // 2. Generate main tweet text
    let mainTweetText = await generateMainTweet(event);
    info("[Daily] Main tweet text generated");

    // 3. Fetch an image for the event (REQUIRED - try multiple events if needed)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 5; // Increased attempts
    let eventAttempts = 0;
    const maxEventAttempts = 5; // Try up to 5 different events
    
    while (!imageBuffer && eventAttempts < maxEventAttempts) {
      imageAttempts = 0;
      
      while (!imageBuffer && imageAttempts < maxImageAttempts) {
        try {
          console.log(`[Daily] Attempting to fetch image for event: "${event.description?.slice(0, 60)}" (attempt ${imageAttempts + 1}/${maxImageAttempts})…`);
          imageBuffer = await fetchEventImage(event, true); // requireImage = true
          
          if (imageBuffer && Buffer.isBuffer(imageBuffer) && imageBuffer.length > 0) {
            console.log(`[Daily] ✅ Image fetched successfully! Size: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
            break;
          } else {
            console.warn(`[Daily] ❌ No valid image buffer returned on attempt ${imageAttempts + 1}`);
            imageBuffer = null; // Ensure it's null
            imageAttempts++;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (imgErr) {
          console.error(`[Daily] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
          imageBuffer = null;
          imageAttempts++;
          if (imageAttempts < maxImageAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      // If still no image, try a different event
      if (!imageBuffer && eventAttempts < maxEventAttempts - 1) {
        console.warn(`[Daily] No image found for current event, trying a different event... (event attempt ${eventAttempts + 1}/${maxEventAttempts})`);
        eventAttempts++;
        
        // Get a new event
        let newEvent = await getRandomEvent();
        let newEventId = createEventId(newEvent);
        let newEventAttempts = 0;
        
        // Make sure it's not posted and is appropriate
        while (newEventAttempts < 10) {
          const isPosted = await isEventPosted(newEventId);
          const isAppropriate = await isEventAppropriate(newEvent);
          
          if (!isPosted && isAppropriate) {
            break;
          }
          newEvent = await getRandomEvent();
          newEventId = createEventId(newEvent);
          newEventAttempts++;
        }
        
        event = newEvent;
        eventId = newEventId;
        
        // Regenerate tweet text for new event
        const newTweetText = await generateMainTweet(event);
        if (newTweetText) {
          // Update mainTweetText - we'll use this if we find an image
          mainTweetText = newTweetText;
          console.log(`[Daily] Switched to new event: ${event.year} - ${event.description?.slice(0, 60)}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        break;
      }
    }
    
    // Final check - must have image (this is a hard requirement)
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      error("[Daily] CRITICAL: Could not fetch image after trying multiple events and attempts.");
      error("[Daily] Attempted:", {
        imageAttempts: imageAttempts,
        eventAttempts: eventAttempts,
        lastEvent: { year: event.year, description: event.description?.slice(0, 100) }
      });
      error("[Daily] Posting will FAIL - no tweet will be posted without an image.");
      throw new Error("Failed to fetch required image for daily tweet - tried multiple events and all fallback strategies");
    }
    
    // Double-check image is valid before proceeding
    if (imageBuffer.length < 1000) {
      error("[Daily] Image buffer too small, likely invalid");
      throw new Error("Image buffer is too small to be valid");
    }
    
    info("[Daily] Image confirmed valid", { sizeKB: (imageBuffer.length / 1024).toFixed(2) });

    // 4. Post main tweet (WITH IMAGE - required)
    let mainTweetId;
    try {
      mainTweetId = await postTweetWithImage(mainTweetText, imageBuffer, null);
      
      if (!mainTweetId) {
        throw new Error("Failed to post main tweet - no tweet ID returned");
      }
      
      logTweetPost("daily", mainTweetId, true);
      info("[Daily] Main tweet posted", { tweetId: mainTweetId });

      // Track in analytics
      await trackPost({
        type: "daily",
        tweetId: mainTweetId,
        content: mainTweetText,
      });

      // Mark event as posted
      await markEventPosted(eventId, mainTweetId);
    } catch (postErr) {
      logTweetPost("daily", null, false, postErr);
      throw postErr;
    }

    // 5. Generate reply
    const replyText = await generateReply(event);

    // 6. Post reply under main tweet (no image)
    if (replyText && replyText.trim().length > 0) {
      await postTweet(replyText, mainTweetId);
      console.log("[Daily] Reply posted under main tweet.");
    } else {
      console.warn("[Daily] Reply text is empty, skipping reply post.");
    }

  } catch (err) {
    error("[Daily] Job failed", { error: err.message, stack: err.stack });
    throw err; // Re-throw to allow caller to handle
  }

  info("[Daily] Daily tweet job completed successfully");
}

// Allow running directly with: node daily.js
if (process.argv[1]?.includes("daily.js")) {
  postDailyTweet();
}
