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
  
  let attempts = 0;
  const maxRetries = 5;
  let lastError;
  
  while (attempts < maxRetries) {
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
        console.log(`[Workflow] Generated content is duplicate, retrying with new event... (${attempts + 1}/${maxRetries})`);
        attempts++;
        if (needsEvent(contentType)) {
          // Clear event to get a new one
          event = null;
        }
        continue;
      }
      
      // Post with media (this may throw if media is duplicate)
      try {
        const tweetId = await postContentWithMedia(contentType, content, {
          event,
          text: contentText
        });
        
        console.log(`[Workflow] ✅ Workflow completed successfully (${contentType}, ID: ${tweetId})`);
        return tweetId;
      } catch (mediaErr) {
        // If media is duplicate, retry with new event
        const isDuplicateError = mediaErr.message && (
          mediaErr.message.includes('duplicate') || 
          mediaErr.message.includes('Duplicate') ||
          (mediaErr.context && mediaErr.context.isDuplicate)
        );
        
        if (isDuplicateError) {
          console.log(`[Workflow] Duplicate media detected, retrying with new event... (${attempts + 1}/${maxRetries})`);
          attempts++;
          if (needsEvent(contentType)) {
            // Clear event to get a new one
            event = null;
          }
          continue;
        }
        // If it's a different media error, throw it
        throw mediaErr;
      }
      
    } catch (err) {
      lastError = err;
      
      // If it's a duplicate error, retry
      if (err.message && (err.message.includes('duplicate') || err.message.includes('Duplicate'))) {
        console.log(`[Workflow] Duplicate detected, retrying... (${attempts + 1}/${maxRetries})`);
        attempts++;
        continue;
      }
      
      // If it's not a duplicate error and we've tried enough, throw
      if (attempts >= maxRetries - 1) {
        console.error(`[Workflow] ❌ Workflow failed (${contentType}):`, err.message);
        throw err;
      }
      
      attempts++;
      console.warn(`[Workflow] Error occurred, retrying... (${attempts + 1}/${maxRetries}):`, err.message);
    }
  }
  
  // If we exhausted retries, throw last error
  console.error(`[Workflow] ❌ Workflow failed after ${maxRetries} attempts (${contentType})`);
  throw lastError || new ContentGenerationError('Failed to complete workflow after retries', { contentType });
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

// Track events we've tried today to avoid infinite loops
const attemptedEventsToday = new Set();

/**
 * Get event for content type
 */
async function getEventForContent(contentType, maxAttempts = 30) {
  let attempts = 0;
  const today = new Date().toDateString();
  
  // Clear attempted events if it's a new day
  if (!getEventForContent.lastDate || getEventForContent.lastDate !== today) {
    attemptedEventsToday.clear();
    getEventForContent.lastDate = today;
  }
  
  // Track how many times we've seen each event
  const eventAttemptCounts = new Map();
  
  while (attempts < maxAttempts) {
    const event = await getRandomEvent();
    const eventId = createEventId(event);
    
    // Count attempts for this event
    const attemptCount = (eventAttemptCounts.get(eventId) || 0) + 1;
    eventAttemptCounts.set(eventId, attemptCount);
    
    // If we've tried this event too many times (5+), skip it
    if (attemptCount > 5) {
      attempts++;
      continue;
    }
    
    // Skip if we've already successfully tried this event today (but allow retries for duplicates)
    if (attemptedEventsToday.has(eventId) && attemptCount === 1) {
      attempts++;
      continue;
    }
    
    const isPosted = await isEventPosted(eventId);
    const isAppropriate = await isEventAppropriate(event);
    const topicCooldown = await isTopicInCooldown(event.description);
    
    if (!isPosted && isAppropriate && !topicCooldown) {
      // Mark as attempted (but allow retrying if content is duplicate)
      attemptedEventsToday.add(eventId);
      return event;
    }
    
    // If event is posted or inappropriate, mark as attempted and skip
    if (isPosted || !isAppropriate || topicCooldown) {
      attemptedEventsToday.add(eventId);
      attempts++;
      continue;
    }
    
    attempts++;
  }
  
  // If we've exhausted all attempts, allow using an event we've tried if content will be different
  // This handles cases where only one event is available but we can create different content
  console.warn(`[Workflow] Exhausted ${maxAttempts} attempts, allowing event reuse with different content angle`);
  
  // Get the most attempted event (likely the only one available)
  let mostAttemptedEventId = null;
  let maxAttemptCount = 0;
  for (const [eventId, count] of eventAttemptCounts.entries()) {
    if (count > maxAttemptCount) {
      maxAttemptCount = count;
      mostAttemptedEventId = eventId;
    }
  }
  
  // Try one more time - if content generation creates different content, it should work
  const finalEvent = await getRandomEvent();
  const finalEventId = createEventId(finalEvent);
  const isPosted = await isEventPosted(finalEventId);
  const isAppropriate = await isEventAppropriate(finalEvent);
  const topicCooldown = await isTopicInCooldown(finalEvent.description);
  
  // Allow it if it's appropriate (even if we've tried it) - duplicate detection will catch actual duplicates
  if (isAppropriate && !topicCooldown && !isPosted) {
    return finalEvent;
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


