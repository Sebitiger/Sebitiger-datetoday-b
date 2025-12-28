// src/workflow/WorkflowHandler.js
// Unified workflow handler

import { generateContent } from "../content/ContentGenerator.js";
import { postContentWithMedia } from "../posting/PostManager.js";
import { getContentForSchedule } from "../posting/ContentPlanner.js";
import { CONTENT_TYPES } from "../core/ContentTypes.js";
import { getRandomEvent } from "../../fetchEvents.js";
import { isContentDuplicate, isEventPosted, isTopicInCooldown, createEventId } from "../../database.js";
import { isEventAppropriate } from "../../moderation.js";
import { ContentGenerationError, PostingError } from "../core/errors.js";

/**
 * Execute a content workflow
 * @param {string} contentType - Content type or 'auto' to determine from schedule
 * @param {Object} options - Options
 * @returns {Promise<string>} - Tweet ID
 */
export async function executeWorkflow(contentType = 'auto', options = {}) {
  const { hour, dayOfWeek, event: providedEvent } = options;
  
  // Auto-determine content type from schedule
  if (contentType === 'auto') {
    contentType = getContentForSchedule(hour, dayOfWeek);
  }
  
  console.log(`[Workflow] Executing ${contentType} workflow...`);
  
  try {
    // Get event if needed
    let event = providedEvent;
    if (!event && needsEvent(contentType)) {
      event = await getEventForContent(contentType);
    }
    
    // Generate content
    let content = await generateContentWithRetry(contentType, { event });
    
    // Check for duplicates
    const contentText = Array.isArray(content) ? content.join(' ') : content;
    const isDup = await isContentDuplicate(contentText, 60);
    if (isDup) {
      throw new ContentGenerationError('Generated content is duplicate', { contentType });
    }
    
    // Post with media
    const tweetId = await postContentWithMedia(contentType, content, {
      event,
      text: contentText
    });
    
    console.log(`[Workflow] ✅ Workflow completed successfully (${contentType}, ID: ${tweetId})`);
    return tweetId;
    
  } catch (err) {
    console.error(`[Workflow] ❌ Workflow failed (${contentType}):`, err.message);
    throw err;
  }
}

/**
 * Generate content with retry logic
 */
async function generateContentWithRetry(contentType, context, maxRetries = 5) {
  let attempts = 0;
  let lastError;
  
  while (attempts < maxRetries) {
    try {
      // If we need an event and don't have one, get it
      if (needsEvent(contentType) && !context.event) {
        context.event = await getEventForContent(contentType);
      }
      
      const content = await generateContent(contentType, context);
      
      // Check for duplicates
      const contentText = Array.isArray(content) ? content.join(' ') : content;
      const isDup = await isContentDuplicate(contentText, 60);
      
      if (isDup) {
        console.log(`[Workflow] Generated content is duplicate, retrying... (${attempts + 1}/${maxRetries})`);
        attempts++;
        // Get new event for next attempt
        if (needsEvent(contentType)) {
          context.event = await getEventForContent(contentType);
        }
        continue;
      }
      
      return content;
      
    } catch (err) {
      lastError = err;
      console.warn(`[Workflow] Content generation failed, retrying... (${attempts + 1}/${maxRetries}):`, err.message);
      attempts++;
      
      if (attempts < maxRetries && needsEvent(contentType)) {
        // Try with a different event
        context.event = await getEventForContent(contentType);
      }
    }
  }
  
  throw lastError || new ContentGenerationError('Failed to generate content after retries', { contentType });
}

/**
 * Get event for content type
 */
async function getEventForContent(contentType, maxAttempts = 15) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const event = await getRandomEvent();
    const eventId = createEventId(event);
    
    const isPosted = await isEventPosted(eventId);
    const isAppropriate = await isEventAppropriate(event);
    const topicCooldown = await isTopicInCooldown(event.description);
    
    if (!isPosted && isAppropriate && !topicCooldown) {
      return event;
    }
    
    attempts++;
  }
  
  throw new Error('Failed to find appropriate event after multiple attempts');
}

/**
 * Check if content type needs an event
 */
function needsEvent(contentType) {
  return [
    CONTENT_TYPES.DAILY,
    CONTENT_TYPES.REPLY,
    CONTENT_TYPES.THREAD
  ].includes(contentType);
}


