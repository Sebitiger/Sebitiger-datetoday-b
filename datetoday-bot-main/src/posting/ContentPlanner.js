// src/posting/ContentPlanner.js
// Strategic content planning for optimal engagement

import { CONTENT_TYPES } from "../core/ContentTypes.js";

/**
 * Get content type for a given schedule slot
 * Optimized for engagement and variety
 */
export function getContentForSchedule(hour, dayOfWeek) {
  // Day of week: 0 = Sunday, 1 = Monday, etc.
  const day = dayOfWeek || new Date().getUTCDay();
  const hourNum = hour || new Date().getUTCHours();
  
  // Morning (9-11 UTC) - Main content
  if (hourNum === 9) {
    return CONTENT_TYPES.DAILY;
  }
  
  // Midday (12-13 UTC) - Engagement content
  if (hourNum === 12) {
    if (day === 3) { // Wednesday
      return CONTENT_TYPES.WHAT_IF;
    }
    return CONTENT_TYPES.QUICK_FACT;
  }
  
  if (hourNum === 13) {
    return CONTENT_TYPES.QUICK_FACT;
  }
  
  // Afternoon (14-15 UTC) - Interactive content
  if (hourNum === 14) {
    if (day === 2 || day === 4) { // Tuesday or Thursday
      return CONTENT_TYPES.POLL;
    }
    return CONTENT_TYPES.QUICK_FACT;
  }
  
  if (hourNum === 15) {
    if (day === 1) { // Monday
      return CONTENT_TYPES.HISTORY_DEBUNK;
    }
    if (day === 5) { // Friday
      return CONTENT_TYPES.HIDDEN_CONNECTION;
    }
    return CONTENT_TYPES.QUICK_FACT;
  }
  
  // Late afternoon (16-17 UTC) - Deep content
  if (hourNum === 16) {
    if (day === 0) { // Sunday
      return CONTENT_TYPES.THREAD;
    }
    return CONTENT_TYPES.QUICK_FACT;
  }
  
  if (hourNum === 17) {
    return CONTENT_TYPES.QUICK_FACT;
  }
  
  // Evening (18-20 UTC) - Reflection content
  if (hourNum === 18) {
    return CONTENT_TYPES.EVENING_FACT;
  }
  
  if (hourNum === 19 || hourNum === 20) {
    return CONTENT_TYPES.QUICK_FACT;
  }
  
  // Default to quick fact
  return CONTENT_TYPES.QUICK_FACT;
}

/**
 * Get optimal posting schedule
 * Returns array of {hour, day, contentType}
 */
export function getOptimalSchedule() {
  const schedule = [];
  
  // Daily main tweet
  schedule.push({ hour: 9, day: null, type: CONTENT_TYPES.DAILY });
  
  // Midday engagement (12:00)
  for (let day = 0; day < 7; day++) {
    if (day === 3) { // Wednesday - What If
      schedule.push({ hour: 12, day, type: CONTENT_TYPES.WHAT_IF });
    } else {
      schedule.push({ hour: 12, day, type: CONTENT_TYPES.QUICK_FACT });
    }
  }
  
  // Afternoon (13:00, 14:00, 15:00)
  for (let day = 0; day < 7; day++) {
    schedule.push({ hour: 13, day, type: CONTENT_TYPES.QUICK_FACT });
    
    if (day === 2 || day === 4) { // Tuesday/Thursday - Polls
      schedule.push({ hour: 14, day, type: CONTENT_TYPES.POLL });
    } else {
      schedule.push({ hour: 14, day, type: CONTENT_TYPES.QUICK_FACT });
    }
    
    if (day === 1) { // Monday - Debunk
      schedule.push({ hour: 15, day, type: CONTENT_TYPES.HISTORY_DEBUNK });
    } else if (day === 5) { // Friday - Hidden Connection
      schedule.push({ hour: 15, day, type: CONTENT_TYPES.HIDDEN_CONNECTION });
    } else {
      schedule.push({ hour: 15, day, type: CONTENT_TYPES.QUICK_FACT });
    }
  }
  
  // Late afternoon (16:00, 17:00)
  for (let day = 0; day < 7; day++) {
    if (day === 0) { // Sunday - Thread
      schedule.push({ hour: 16, day, type: CONTENT_TYPES.THREAD });
    } else {
      schedule.push({ hour: 16, day, type: CONTENT_TYPES.QUICK_FACT });
    }
    schedule.push({ hour: 17, day, type: CONTENT_TYPES.QUICK_FACT });
  }
  
  // Evening (18:00, 19:00, 20:00)
  schedule.push({ hour: 18, day: null, type: CONTENT_TYPES.EVENING_FACT });
  schedule.push({ hour: 19, day: null, type: CONTENT_TYPES.QUICK_FACT });
  schedule.push({ hour: 20, day: null, type: CONTENT_TYPES.QUICK_FACT });
  
  return schedule;
}


