// src/index.js
// New unified entry point

import { executeWorkflow } from "./workflow/WorkflowHandler.js";
import { getContentForSchedule } from "./posting/ContentPlanner.js";
import { CONTENT_TYPES } from "./core/ContentTypes.js";

/**
 * Main entry point for scheduled posts
 * @param {Object} options - { hour, dayOfWeek, contentType }
 */
export async function runScheduledPost(options = {}) {
  const { hour, dayOfWeek, contentType } = options;
  
  try {
    const tweetId = await executeWorkflow(contentType || 'auto', {
      hour,
      dayOfWeek
    });
    
    return { success: true, tweetId };
    
  } catch (err) {
    console.error('[Main] Scheduled post failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Convenience functions for specific content types
 */
export async function postDaily() {
  return await executeWorkflow(CONTENT_TYPES.DAILY, { hour: 9 });
}

export async function postQuickFact() {
  return await executeWorkflow(CONTENT_TYPES.QUICK_FACT);
}

export async function postEveningFact() {
  return await executeWorkflow(CONTENT_TYPES.EVENING_FACT, { hour: 18 });
}

export async function postWhatIf() {
  return await executeWorkflow(CONTENT_TYPES.WHAT_IF);
}

export async function postHiddenConnection() {
  return await executeWorkflow(CONTENT_TYPES.HIDDEN_CONNECTION);
}

export async function postHistoryDebunk() {
  return await executeWorkflow(CONTENT_TYPES.HISTORY_DEBUNK);
}

export async function postWeeklyThread() {
  return await executeWorkflow(CONTENT_TYPES.THREAD);
}


