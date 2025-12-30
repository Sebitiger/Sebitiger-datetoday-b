import dotenv from "dotenv";
import { generateVerifiedTweet } from "./verification/verifiedGenerator.js";
import { getRandomEvent } from "./fetchEvents.js";
import { twitterClient } from "./twitterClient.js";

dotenv.config();

console.log("[Test] Starting immediate verified post test...");

async function testPost() {
  try {
    const event = await getRandomEvent();
    console.log(`[Test] Selected event: ${event.year} - ${event.description.substring(0, 50)}...`);
    
    const result = await generateVerifiedTweet(event, {
      minConfidence: 90,
      maxRetries: 3,
      queueMedium: true
    });
    
    console.log(`[Test] Result status: ${result.status}`);
    console.log(`[Test] Confidence: ${result.verification.confidence}%`);
    console.log(`[Test] Verdict: ${result.verification.verdict}`);
    
    if (result.status === 'APPROVED') {
      console.log(`[Test] ✅ APPROVED! Posting to Twitter...`);
      console.log(`[Test] Content: ${result.content}`);
      
      const tweet = await twitterClient.v2.tweet(result.content);
      console.log(`[Test] ✅ POSTED! Tweet ID: ${tweet.data.id}`);
    } else if (result.status === 'QUEUED') {
      console.log(`[Test] ⚠️ QUEUED for review`);
      console.log(`[Test] Queue ID: ${result.queueId}`);
    } else {
      console.log(`[Test] ❌ REJECTED`);
    }
  } catch (err) {
    console.error(`[Test] ❌ Error:`, err);
  }
}

testPost();
