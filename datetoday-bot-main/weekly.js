import { getEventForDate } from "./fetchEvents.js";
import { generateWeeklyThread } from "./generateThread.js";
import { postThread } from "./twitterClient.js";

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

    await postThread(tweets);
    console.log("[Weekly] Weekly thread job completed successfully.");
  } catch (err) {
    console.error("[Weekly] Job failed:", err.message || err);
    console.error("[Weekly] Stack:", err.stack);
    throw err; // Re-throw to allow caller to handle
  }
}
