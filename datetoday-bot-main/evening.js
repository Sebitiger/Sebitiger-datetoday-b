// evening.js
// Unified evening post using refactored system

import { postEveningFact as postEveningFactNew } from "./src/index.js";

export async function postEveningFact() {
  try {
    const tweetId = await postEveningFactNew();
    console.log(`[Evening] ✅ Posted successfully (ID: ${tweetId})`);
    return tweetId;
  } catch (err) {
    console.error("[Evening] ❌ Failed:", err.message);
    throw err;
  }
}

// Allow running directly
if (process.argv[1]?.includes("evening.js")) {
  postEveningFact().catch(console.error);
}

