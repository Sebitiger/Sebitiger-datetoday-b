// rateLimiter.js
// Twitter API rate limit handling

import { client } from "./twitterClient.js";

// Rate limit tracking
const rateLimitStatus = {
  tweets: { remaining: 300, resetAt: null },
  mentions: { remaining: 75, resetAt: null },
  media: { remaining: 500, resetAt: null },
};

/**
 * Check rate limit status from Twitter API
 */
export async function checkRateLimits() {
  try {
    // Twitter API v2 doesn't expose rate limits easily
    // This is a simplified version - in production, track based on responses
    const me = await client.v2.me();
    return rateLimitStatus;
  } catch (err) {
    console.error("[RateLimiter] Error checking rate limits:", err.message);
    return rateLimitStatus;
  }
}

/**
 * Handle rate limit error
 */
export function handleRateLimitError(error, endpoint) {
  if (error.code === 429 || error.status === 429 || error.message?.includes("429")) {
    // Try to extract reset time from error headers or use default
    let resetTime = null;
    
    // Check for rate limit reset header
    if (error.rateLimit?.reset) {
      resetTime = error.rateLimit.reset * 1000; // Convert to milliseconds
    } else if (error.headers?.['x-rate-limit-reset']) {
      resetTime = parseInt(error.headers['x-rate-limit-reset']) * 1000;
    } else {
      // Default: wait 15 minutes (900 seconds)
      resetTime = Date.now() + 900000;
    }
    
    rateLimitStatus[endpoint] = {
      remaining: 0,
      resetAt: new Date(resetTime),
    };
    
    const waitTime = Math.max(0, resetTime - Date.now());
    console.warn(`[RateLimiter] Rate limit hit for ${endpoint}. Waiting ${Math.round(waitTime / 1000)}s until ${new Date(resetTime).toISOString()}`);
    
    return {
      rateLimited: true,
      waitTime,
      resetAt: new Date(resetTime),
    };
  }
  
  return { rateLimited: false };
}

/**
 * Wait if rate limited
 */
export async function waitIfRateLimited(endpoint) {
  const status = rateLimitStatus[endpoint];
  if (status && status.resetAt && status.remaining === 0) {
    const waitTime = status.resetAt.getTime() - Date.now();
    if (waitTime > 0) {
      console.log(`[RateLimiter] Waiting ${Math.round(waitTime / 1000)}s for ${endpoint} rate limit reset`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Decrement rate limit counter
 */
export function decrementRateLimit(endpoint) {
  if (rateLimitStatus[endpoint] && rateLimitStatus[endpoint].remaining > 0) {
    rateLimitStatus[endpoint].remaining--;
  }
}

/**
 * Check if we can make a request
 */
export async function canMakeRequest(endpoint) {
  await waitIfRateLimited(endpoint);
  const status = rateLimitStatus[endpoint];
  return status ? status.remaining > 0 : true;
}


