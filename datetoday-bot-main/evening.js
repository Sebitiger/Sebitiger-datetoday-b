import { generateEveningFact } from "./generateFact.js";
import { postTweet } from "./twitterClient.js";

export async function postEveningFact() {
  console.log("[Evening] Starting evening fact job...");
  try {
    const fact = await generateEveningFact();
    
    if (!fact || !fact.trim().length) {
      throw new Error("Generated fact is empty");
    }

    // Note: postTweet now handles length validation automatically
    await postTweet(fact);
    console.log("[Evening] Evening fact job completed successfully.");
  } catch (err) {
    console.error("[Evening] Job failed:", err.message || err);
    console.error("[Evening] Stack:", err.stack);
    throw err; // Re-throw to allow caller to handle
  }
}
