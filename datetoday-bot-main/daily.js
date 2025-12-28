// daily.js
// Unified daily post using refactored system

import { postDaily } from "./src/index.js";

export async function postDailyTweet() {
  try {
    const tweetId = await postDaily();
    console.log(`[Daily] ✅ Posted successfully (ID: ${tweetId})`);
    return tweetId;
  } catch (err) {
    console.error("[Daily] ❌ Failed:", err.message);
    throw err;
  }
}

// Allow running directly
if (process.argv[1]?.includes("daily.js")) {
  postDailyTweet().catch(console.error);
}

