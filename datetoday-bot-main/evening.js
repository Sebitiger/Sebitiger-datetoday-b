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

    // Try to fetch an image based on the fact content
    let imageBuffer = null;
    try {
      console.log("[Evening] Attempting to fetch image for evening fact...");
      imageBuffer = await fetchImageForText(fact);
      if (imageBuffer) {
        console.log("[Evening] Image fetched successfully for evening fact.");
      } else {
        console.log("[Evening] No image found for evening fact, posting text-only.");
      }
    } catch (imgErr) {
      console.error("[Evening] Image fetch error for evening fact:", imgErr.message || imgErr);
    }

    // Post with image if available, otherwise text-only
    if (imageBuffer) {
      await postTweetWithImage(fact, imageBuffer, null);
    } else {
      await postTweet(fact);
    }
    console.log("[Evening] Evening fact job completed successfully.");
  } catch (err) {
    console.error("[Evening] Job failed:", err.message || err);
    console.error("[Evening] Stack:", err.stack);
    throw err; // Re-throw to allow caller to handle
  }
}
