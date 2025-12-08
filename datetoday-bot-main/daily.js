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
    const mainTweetText = await generateMainTweet(event);
    info("[Daily] Main tweet text generated");

    // 3. Try to fetch an image for the event
    let imageBuffer = null;
    try {
      console.log("[Daily] Attempting to fetch image…");
      imageBuffer = await fetchEventImage(event);
      if (imageBuffer) {
        console.log("[Daily] Image fetched successfully.");
      } else {
        console.log("[Daily] No image found, posting text-only.");
      }
    } catch (imgErr) {
      console.error("[Daily] Image fetch error:", imgErr.message || imgErr);
    }

    // 4. Post main tweet (with or without image)
    let mainTweetId;
    try {
      if (imageBuffer) {
        mainTweetId = await postTweetWithImage(mainTweetText, imageBuffer, null);
      } else {
        mainTweetId = await postTweet(mainTweetText, null);
      }
      
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
