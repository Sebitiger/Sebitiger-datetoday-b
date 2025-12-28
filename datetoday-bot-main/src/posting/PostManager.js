// src/posting/PostManager.js
// Unified posting manager

import { postTweet, postTweetWithImage, postTweetWithVideo, postThread } from "../../twitterClient.js";
import { CONTENT_TYPES, getContentConfig } from "../core/ContentTypes.js";
import { PostingError } from "../core/errors.js";
import { markContentPosted, markTopicPosted, markEventPosted, createEventId } from "../../database.js";

/**
 * Post content with media handling
 * @param {string} contentType - Content type
 * @param {string|string[]} content - Content text (or array for threads)
 * @param {Object} options - Options object
 * @returns {Promise<string>} - Tweet ID
 */
export async function postContent(contentType, content, options = {}) {
  const config = getContentConfig(contentType);
  const { media, event, replyToId } = options;
  
  try {
    // Validate content
    if (Array.isArray(content)) {
      // Thread
      if (content.length < config.minTweets) {
        throw new PostingError(`Thread too short (${content.length} tweets, need ${config.minTweets})`);
      }
    } else {
      // Single tweet
      if (content.length > config.maxLength) {
        throw new PostingError(`Content too long (${content.length} chars, max ${config.maxLength})`);
      }
    }
    
    let tweetId;
    
    // Handle threads
    if (Array.isArray(content)) {
      if (media && media.type === 'image') {
        tweetId = await postThread(content, media.buffer);
      } else {
        tweetId = await postThread(content, null);
      }
    }
    // Handle single tweet with media
    else if (media) {
      if (media.type === 'video') {
        tweetId = await postTweetWithVideo(content, media.buffer, replyToId);
      } else if (media.type === 'image') {
        tweetId = await postTweetWithImage(content, media.buffer, replyToId);
      } else {
        throw new PostingError(`Unknown media type: ${media.type}`);
      }
    }
    // Handle single tweet without media
    else {
      tweetId = await postTweet(content, replyToId);
    }
    
    if (!tweetId) {
      throw new PostingError('No tweet ID returned from posting');
    }
    
    // Mark as posted
    await markContentPosted(
      Array.isArray(content) ? content.join(' ') : content,
      tweetId,
      media?.buffer || null
    );
    
    // Mark topic for cooldown
    await markTopicPosted(Array.isArray(content) ? content[0] : content);
    
    // Mark event if provided
    if (event) {
      const eventId = createEventId(event);
      await markEventPosted(eventId, tweetId);
    }
    
    console.log(`[PostManager] ✅ Posted ${contentType} successfully (ID: ${tweetId})`);
    return tweetId;
    
  } catch (err) {
    if (err instanceof PostingError) {
      throw err;
    }
    throw new PostingError(
      `Failed to post ${contentType}`,
      { contentType, originalError: err.message }
    );
  }
}

/**
 * Post content with automatic media fetching
 * @param {string} contentType - Content type
 * @param {string|string[]} content - Content text
 * @param {Object} context - Context for media fetching
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - Tweet ID
 */
export async function postContentWithMedia(contentType, content, context = {}, options = {}) {
  const { fetchMedia } = await import("../media/MediaHandler.js");
  const { MediaFetchError } = await import("../core/errors.js");
  
  let media = null;
  
  // Try to fetch media if required
  if (getContentConfig(contentType).requiresMedia) {
    try {
      media = await fetchMedia(contentType, {
        ...context,
        text: Array.isArray(content) ? content[0] : content
      });
    } catch (err) {
      // If it's a duplicate media error, preserve that information
      if (err instanceof MediaFetchError && err.message.includes('duplicate')) {
        throw new PostingError(
          `Duplicate media detected for ${contentType}`,
          { contentType, originalError: err.message, isDuplicate: true }
        );
      }
      
      // If media is required but fetch failed, throw
      if (getContentConfig(contentType).requiresMedia) {
        throw new PostingError(
          `Failed to fetch required media for ${contentType}`,
          { contentType, originalError: err.message }
        );
      }
      // Otherwise, continue without media
      console.warn(`[PostManager] Media fetch failed, posting without media:`, err.message);
    }
  }
  
  return await postContent(contentType, content, {
    ...options,
    media,
    event: context.event
  });
}


