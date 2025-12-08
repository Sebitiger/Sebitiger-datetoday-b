// twitterClient.js

import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["API_KEY", "API_SECRET", "ACCESS_TOKEN", "ACCESS_SECRET"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const client = new TwitterApi({
  appKey: process.env.API_KEY,
  appSecret: process.env.API_SECRET,
  accessToken: process.env.ACCESS_TOKEN,
  accessSecret: process.env.ACCESS_SECRET,
});

// Twitter character limit
const MAX_TWEET_LENGTH = 280;

/**
 * Validates and trims tweet text to fit Twitter's character limit
 * @param {string} text - Tweet text to validate
 * @returns {string} - Validated and trimmed text
 */
export function validateTweetText(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Tweet text must be a non-empty string");
  }

  const trimmed = text.trim();
  if (!trimmed.length) {
    throw new Error("Tweet text cannot be empty");
  }

  if (trimmed.length > MAX_TWEET_LENGTH) {
    console.warn(`[Twitter] Tweet text exceeds ${MAX_TWEET_LENGTH} characters (${trimmed.length}), truncating...`);
    return trimmed.slice(0, MAX_TWEET_LENGTH - 1) + "…";
  }

  return trimmed;
}

/**
 * Post a tweet without image.
 * If replyToId is provided, posts as a reply.
 */
export async function postTweet(text, replyToId = null) {
  try {
    const validatedText = validateTweetText(text);
    
    // Log tweet content for debugging (first 100 chars)
    console.log("[Twitter] Posting tweet:", validatedText.slice(0, 100) + (validatedText.length > 100 ? "..." : ""));

    const payload = { text: validatedText };

    if (replyToId) {
      if (typeof replyToId !== "string" && typeof replyToId !== "number") {
        throw new Error("replyToId must be a string or number");
      }
      payload.reply = { in_reply_to_tweet_id: String(replyToId) };
    }

    const res = await client.v2.tweet(payload);
    const tweetId = res.data.id;
    console.log("[Twitter] Tweet posted. ID:", tweetId);
    return tweetId;
  } catch (err) {
    console.error("[Twitter] Error posting tweet:", err);
    throw err;
  }
}

/**
 * Post a tweet with an image (Buffer).
 * If replyToId is provided, posts as a reply.
 */
export async function postTweetWithImage(text, imageBuffer, replyToId = null) {
  try {
    const validatedText = validateTweetText(text);
    
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      throw new Error("imageBuffer must be a valid Buffer");
    }

    // Log tweet content for debugging
    console.log("[Twitter] Posting tweet with image:", validatedText.slice(0, 100) + (validatedText.length > 100 ? "..." : ""));

    let mediaId = null;

    if (imageBuffer) {
      console.log("[Twitter] Uploading media…");
      mediaId = await client.v1.uploadMedia(imageBuffer, { type: "image" });
      console.log("[Twitter] Media uploaded. ID:", mediaId);
    }

    const payload = { text: validatedText };

    if (mediaId) {
      payload.media = { media_ids: [mediaId] };
    }

    if (replyToId) {
      if (typeof replyToId !== "string" && typeof replyToId !== "number") {
        throw new Error("replyToId must be a string or number");
      }
      payload.reply = { in_reply_to_tweet_id: String(replyToId) };
    }

    const res = await client.v2.tweet(payload);
    const tweetId = res.data.id;
    console.log("[Twitter] Tweet with image posted. ID:", tweetId);
    return tweetId;
  } catch (err) {
    console.error("[Twitter] Error posting tweet with image:", err);
    throw err;
  }
}

/**
 * Post a thread (multiple tweets as replies to each other).
 * @param {string[]} tweets - Array of tweet texts
 */
export async function postThread(tweets) {
  try {
    if (!tweets || !Array.isArray(tweets) || !tweets.length) {
      throw new Error("Tweets must be a non-empty array");
    }

    // Validate all tweets before posting
    const validatedTweets = tweets.map((tweet, index) => {
      try {
        return validateTweetText(tweet);
      } catch (err) {
        throw new Error(`Invalid tweet at index ${index}: ${err.message}`);
      }
    });

    console.log(`[Twitter] Posting thread with ${validatedTweets.length} tweets...`);

    let previousTweetId = null;

    for (let i = 0; i < validatedTweets.length; i++) {
      const tweetText = validatedTweets[i];
      console.log(`[Twitter] Posting thread tweet ${i + 1}/${validatedTweets.length}...`);

      if (i === 0) {
        // First tweet - no reply
        const res = await client.v2.tweet({ text: tweetText });
        previousTweetId = res.data.id;
        console.log(`[Twitter] Thread tweet ${i + 1} posted. ID:`, previousTweetId);
      } else {
        if (!previousTweetId) {
          throw new Error("Failed to get tweet ID from previous tweet in thread");
        }
        // Subsequent tweets - reply to previous
        const res = await client.v2.tweet({
          text: tweetText,
          reply: { in_reply_to_tweet_id: String(previousTweetId) },
        });
        previousTweetId = res.data.id;
        console.log(`[Twitter] Thread tweet ${i + 1} posted. ID:`, previousTweetId);
      }

      // Small delay between tweets to avoid rate limits
      if (i < validatedTweets.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log("[Twitter] Thread posted successfully. Last tweet ID:", previousTweetId);
    return previousTweetId;
  } catch (err) {
    console.error("[Twitter] Error posting thread:", err);
    throw err;
  }
}
