// twitterClient.js

import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import { handleRateLimitError, waitIfRateLimited } from "./rateLimiter.js";

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
 * Smart truncation that doesn't cut mid-sentence
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

  // If already within limit, return as-is
  if (trimmed.length <= MAX_TWEET_LENGTH) {
    return trimmed;
  }

  console.warn(`[Twitter] Tweet text exceeds ${MAX_TWEET_LENGTH} characters (${trimmed.length}), truncating intelligently...`);
  
  // Smart truncation: try to cut at sentence boundaries first
  const maxLength = MAX_TWEET_LENGTH - 3; // Reserve space for "…"
  
  // Try to find last sentence ending before limit
  const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  let bestCut = maxLength;
  let foundSentenceEnd = false;
  
  for (const ending of sentenceEndings) {
    const lastIndex = trimmed.lastIndexOf(ending, maxLength);
    if (lastIndex > maxLength * 0.7) { // Only use if it's not too early
      bestCut = lastIndex + ending.length - 1;
      foundSentenceEnd = true;
      break;
    }
  }
  
  // If no sentence ending found, try word boundary
  if (!foundSentenceEnd) {
    const lastSpace = trimmed.lastIndexOf(' ', maxLength);
    if (lastSpace > maxLength * 0.8) { // Only use if it's not too early
      bestCut = lastSpace;
    }
  }
  
  // Truncate and add ellipsis
  const truncated = trimmed.slice(0, bestCut).trim();
  return truncated + (truncated.length < trimmed.length ? "…" : "");
}

/**
 * Post a tweet without image.
 * If replyToId is provided, posts as a reply.
 */
export async function postTweet(text, replyToId = null) {
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check if rate limited before attempting
      await waitIfRateLimited("tweets");
      
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
      lastError = err;
      
      // Check if it's a rate limit error (429)
      if (err.code === 429 || err.status === 429 || err.message?.includes("429")) {
        console.warn("[Twitter] Rate limit hit (429). Handling...");
        const rateLimitInfo = handleRateLimitError(err, "tweets");
        
        if (rateLimitInfo.rateLimited) {
          // Wait for rate limit to reset
          const waitTime = Math.min(rateLimitInfo.waitTime || 900000, 900000); // Max 15 minutes
          console.log(`[Twitter] Waiting ${Math.round(waitTime / 1000)}s for rate limit reset...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Retry after waiting
          continue;
        }
      }
      
      // For other errors, throw immediately
      if (attempt === maxRetries - 1) {
        console.error("[Twitter] Error posting tweet after retries:", err);
        throw err;
      }
      
      // Exponential backoff for other errors
      const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`[Twitter] Retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError || new Error("Failed to post tweet after retries");
}

/**
 * Internal helper to upload media (image or video).
 * @param {Buffer} mediaBuffer
 * @param {"image"|"video"} type
 * @returns {Promise<string>} mediaId
 */
async function uploadMedia(mediaBuffer, type) {
  if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer)) {
    throw new Error("mediaBuffer must be a valid Buffer");
  }
  if (type !== "image" && type !== "video") {
    throw new Error("Unsupported media type");
  }

  // Map type to proper MIME type for Twitter API
  const mimeType = type === "image" ? "image/jpeg" : "video/mp4";

  console.log(`[Twitter] Uploading ${type} media (${mimeType})…`);
  const mediaId = await client.v1.uploadMedia(mediaBuffer, { mimeType });
  console.log(`[Twitter] ${type} media uploaded. ID:`, mediaId);
  return mediaId;
}

/**
 * Post a tweet with an image (Buffer).
 * If replyToId is provided, posts as a reply.
 */
export async function postTweetWithImage(text, imageBuffer, replyToId = null) {
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check if rate limited before attempting
      await waitIfRateLimited("tweets");
      
      const validatedText = validateTweetText(text);
      
      if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
        throw new Error("imageBuffer must be a valid Buffer");
      }

      // Log tweet content for debugging
      console.log("[Twitter] Posting tweet with image:", validatedText.slice(0, 100) + (validatedText.length > 100 ? "..." : ""));

      const mediaId = await uploadMedia(imageBuffer, "image");

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
      lastError = err;
      
      // Check if it's a rate limit error (429)
      if (err.code === 429 || err.status === 429 || err.message?.includes("429")) {
        console.warn("[Twitter] Rate limit hit (429). Handling...");
        const rateLimitInfo = handleRateLimitError(err, "tweets");
        
        if (rateLimitInfo.rateLimited) {
          // Wait for rate limit to reset
          const waitTime = Math.min(rateLimitInfo.waitTime || 900000, 900000); // Max 15 minutes
          console.log(`[Twitter] Waiting ${Math.round(waitTime / 1000)}s for rate limit reset...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // Retry after waiting
          continue;
        }
      }
      
      // For other errors, throw immediately
      if (attempt === maxRetries - 1) {
        console.error("[Twitter] Error posting tweet with image after retries:", err);
        throw err;
      }
      
      // Exponential backoff for other errors
      const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`[Twitter] Retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError || new Error("Failed to post tweet with image after retries");
}

/**
 * Post a tweet with a video (Buffer).
 * If replyToId is provided, posts as a reply.
 */
export async function postTweetWithVideo(text, videoBuffer, replyToId = null) {
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await waitIfRateLimited("tweets");
      const validatedText = validateTweetText(text);

      if (!videoBuffer || !Buffer.isBuffer(videoBuffer)) {
        throw new Error("videoBuffer must be a valid Buffer");
      }

      console.log("[Twitter] Posting tweet with video:", validatedText.slice(0, 100) + (validatedText.length > 100 ? "..." : ""));

      const mediaId = await uploadMedia(videoBuffer, "video");

      const payload = { text: validatedText, media: { media_ids: [mediaId] } };

      if (replyToId) {
        if (typeof replyToId !== "string" && typeof replyToId !== "number") {
          throw new Error("replyToId must be a string or number");
        }
        payload.reply = { in_reply_to_tweet_id: String(replyToId) };
      }

      const res = await client.v2.tweet(payload);
      const tweetId = res.data.id;
      console.log("[Twitter] Tweet with video posted. ID:", tweetId);
      return tweetId;
    } catch (err) {
      lastError = err;

      if (err.code === 429 || err.status === 429 || err.message?.includes("429")) {
        console.warn("[Twitter] Rate limit hit (429) when posting video. Handling...");
        const rateLimitInfo = handleRateLimitError(err, "tweets");

        if (rateLimitInfo.rateLimited) {
          const waitTime = Math.min(rateLimitInfo.waitTime || 900000, 900000);
          console.log(`[Twitter] Waiting ${Math.round(waitTime / 1000)}s for rate limit reset...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      if (attempt === maxRetries - 1) {
        console.error("[Twitter] Error posting tweet with video after retries:", err);
        throw err;
      }

      const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
      console.log(`[Twitter] Retrying video tweet in ${backoffDelay}ms... (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError || new Error("Failed to post tweet with video after retries");
}

/**
 * Post a thread (multiple tweets as replies to each other).
 * @param {string[]} tweets - Array of tweet texts
 * @param {Buffer|null} imageBuffer - Optional image buffer for the first tweet
 */
export async function postThread(tweets, imageBuffer = null) {
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
        // First tweet - can have image
        if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
          previousTweetId = await postTweetWithImage(tweetText, imageBuffer, null);
          console.log(`[Twitter] Thread tweet ${i + 1} posted with image. ID:`, previousTweetId);
        } else {
          const res = await client.v2.tweet({ text: tweetText });
          previousTweetId = res.data.id;
          console.log(`[Twitter] Thread tweet ${i + 1} posted. ID:`, previousTweetId);
        }
      } else {
        if (!previousTweetId) {
          throw new Error("Failed to get tweet ID from previous tweet in thread");
        }
        // Subsequent tweets - reply to previous (no images)
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
