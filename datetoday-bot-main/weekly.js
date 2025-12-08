import { getEventForDate } from "./fetchEvents.js";
import { generateWeeklyThread } from "./generateThread.js";
import { postThread } from "./twitterClient.js";
import { fetchEventImage } from "./fetchImage.js";

export async function postWeeklyThread() {
  console.log("[Weekly] Starting weekly thread job...");
  try {
    // By default we just reuse today's date.
    // You could change this to pick a random day in the last 7 days.
    const event = await getEventForDate();
    console.log("[Weekly] Event for thread:", event.year, "-", event.description?.slice(0, 80) || "N/A", "...");

    const tweets = await generateWeeklyThread(event);
    
    if (!tweets || !tweets.length) {
      throw new Error("No tweets generated for weekly thread");
    }

    // Try to fetch an image for the event
    let imageBuffer = null;
    try {
      console.log("[Weekly] Attempting to fetch image for weekly thread...");
      imageBuffer = await fetchEventImage(event);
      if (imageBuffer) {
        console.log("[Weekly] Image fetched successfully for weekly thread.");
      } else {
        console.log("[Weekly] No image found for weekly thread, posting text-only.");
      }
    } catch (imgErr) {
      console.error("[Weekly] Image fetch error for weekly thread:", imgErr.message || imgErr);
    }

    await postThread(tweets, imageBuffer);
    console.log("[Weekly] Weekly thread job completed successfully.");
  } catch (err) {
    console.error("[Weekly] Job failed:", err.message || err);
    console.error("[Weekly] Stack:", err.stack);
    throw err; // Re-throw to allow caller to handle
  }
}
