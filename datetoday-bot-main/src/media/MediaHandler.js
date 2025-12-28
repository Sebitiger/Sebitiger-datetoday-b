// src/media/MediaHandler.js
// Unified media handler for images and videos

import { fetchEventImage } from "../../fetchImage.js";
import { fetchVideoForText } from "../../fetchVideo.js";
import { isImageDuplicate } from "../../database.js";
import { MediaFetchError } from "../core/errors.js";
import { getMediaType, getContentConfig } from "../core/ContentTypes.js";

/**
 * Fetch media (image or video) for content
 * @param {string} contentType - Content type (from ContentTypes)
 * @param {Object} context - Context object with event, text, etc.
 * @returns {Promise<{buffer: Buffer, type: 'image'|'video'}|null>}
 */
export async function fetchMedia(contentType, context = {}) {
  const config = getContentConfig(contentType);
  const mediaType = getMediaType(contentType);
  
  // No media required
  if (!config.requiresMedia || mediaType === 'none') {
    return null;
  }
  
  // Try video first if configured
  if (mediaType === 'image_or_video' && config.videoChance > 0) {
    const shouldTryVideo = Math.random() < config.videoChance;
    
    if (shouldTryVideo && context.text) {
      try {
        console.log(`[Media] Attempting to fetch video for ${contentType}...`);
        const videoBuffer = await fetchVideoForText(context.text);
        
        if (videoBuffer && Buffer.isBuffer(videoBuffer) && videoBuffer.length > 10000) {
          console.log(`[Media] ✅ Video fetched successfully (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
          return { buffer: videoBuffer, type: 'video' };
        }
      } catch (err) {
        console.warn(`[Media] Video fetch failed, falling back to image:`, err.message);
      }
    }
  }
  
  // Fallback to image
  if (mediaType === 'image' || mediaType === 'image_or_video') {
    try {
      console.log(`[Media] Attempting to fetch image for ${contentType}...`);
      
      let imageBuffer = null;
      
      // Try event-based image first (if event provided)
      if (context.event) {
        imageBuffer = await fetchEventImage(context.event, true);
      }
      
      // Fallback to text-based image search
      if (!imageBuffer && context.text) {
        const { fetchImageForText } = await import("../../fetchImage.js");
        imageBuffer = await fetchImageForText(context.text, true);
      }
      
      if (imageBuffer && Buffer.isBuffer(imageBuffer) && imageBuffer.length > 1000) {
        // Check for duplicates
        const isDup = await isImageDuplicate(imageBuffer, 90);
        if (isDup) {
          throw new MediaFetchError('Image is duplicate', { contentType });
        }
        
        console.log(`[Media] ✅ Image fetched successfully (${(imageBuffer.length / 1024).toFixed(2)} KB)`);
        return { buffer: imageBuffer, type: 'image' };
      }
    } catch (err) {
      if (err instanceof MediaFetchError) {
        throw err;
      }
      console.warn(`[Media] Image fetch failed:`, err.message);
    }
  }
  
  // If media is required but we couldn't fetch it
  if (config.requiresMedia) {
    throw new MediaFetchError(
      `Failed to fetch required media for ${contentType}`,
      { contentType, mediaType, context: Object.keys(context) }
    );
  }
  
  return null;
}

/**
 * Fetch media with retries (tries different content if media fails)
 * @param {string} contentType - Content type
 * @param {Function} contentGenerator - Function that generates new content if media fails
 * @param {Object} initialContext - Initial context
 * @param {number} maxRetries - Maximum retries
 * @returns {Promise<{content: any, media: {buffer, type}|null}>}
 */
export async function fetchMediaWithRetry(contentType, contentGenerator, initialContext = {}, maxRetries = 3) {
  let context = { ...initialContext };
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      const media = await fetchMedia(contentType, context);
      return { content: context, media };
    } catch (err) {
      if (err instanceof MediaFetchError && err.message.includes('duplicate')) {
        // Try generating new content
        if (contentGenerator && attempts < maxRetries - 1) {
          console.log(`[Media] Duplicate media detected, generating new content (attempt ${attempts + 1}/${maxRetries})...`);
          context = await contentGenerator();
          attempts++;
          continue;
        }
      }
      
      // If it's the last attempt or not a duplicate error, throw
      if (attempts >= maxRetries - 1) {
        throw err;
      }
      
      attempts++;
      console.log(`[Media] Retrying media fetch (attempt ${attempts + 1}/${maxRetries})...`);
    }
  }
  
  throw new MediaFetchError('Failed to fetch media after retries', { contentType, attempts });
}


