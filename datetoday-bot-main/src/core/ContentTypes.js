// src/core/ContentTypes.js
// Centralized content type definitions

export const CONTENT_TYPES = {
  DAILY: 'daily',
  QUICK_FACT: 'quick_fact',
  EVENING_FACT: 'evening_fact',
  THREAD: 'thread',
  WHAT_IF: 'what_if',
  HIDDEN_CONNECTION: 'hidden_connection',
  HISTORY_DEBUNK: 'history_debunk',
  POLL: 'poll',
  REPLY: 'reply'
};

export const CONTENT_CONFIG = {
  [CONTENT_TYPES.DAILY]: {
    name: 'Daily Historical Event',
    maxLength: 140,
    requiresMedia: true,
    mediaType: 'image_or_video',
    videoChance: 0.5, // Increased from 0.3 - videos get more engagement
    formatStyles: ['surprising_fact', 'human_story', 'moment_of_change', 'relatable_connection', 'dramatic_scene', 'question_hook', 'simple_statement']
  },
  [CONTENT_TYPES.QUICK_FACT]: {
    name: 'Quick Historical Fact',
    maxLength: 240,
    requiresMedia: true,
    mediaType: 'image_or_video',
    videoChance: 0.8, // Increased from 0.6 - videos get significantly more views
    formatStyles: ['surprising', 'insightful']
  },
  [CONTENT_TYPES.EVENING_FACT]: {
    name: 'Evening Reflection',
    maxLength: 250,
    requiresMedia: false,
    mediaType: 'none',
    videoChance: 0
  },
  [CONTENT_TYPES.THREAD]: {
    name: 'Weekly Deep Dive Thread',
    maxLength: 280,
    minTweets: 5,
    maxTweets: 7,
    requiresMedia: true,
    mediaType: 'image',
    videoChance: 0
  },
  [CONTENT_TYPES.WHAT_IF]: {
    name: 'What If Scenario',
    maxLength: 280,
    minTweets: 5,
    maxTweets: 7,
    requiresMedia: true,
    mediaType: 'image',
    videoChance: 0
  },
  [CONTENT_TYPES.HIDDEN_CONNECTION]: {
    name: 'Hidden Historical Connection',
    maxLength: 270,
    requiresMedia: true,
    mediaType: 'image',
    videoChance: 0
  },
  [CONTENT_TYPES.HISTORY_DEBUNK]: {
    name: 'History Myth Debunk',
    maxLength: 260,
    requiresMedia: true,
    mediaType: 'image',
    videoChance: 0
  },
  [CONTENT_TYPES.POLL]: {
    name: 'Interactive Poll',
    maxLength: 100,
    requiresMedia: false,
    mediaType: 'none',
    videoChance: 0
  },
  [CONTENT_TYPES.REPLY]: {
    name: 'Reply Tweet',
    maxLength: 270,
    requiresMedia: false,
    mediaType: 'none',
    videoChance: 0
  }
};

/**
 * Get content type configuration
 */
export function getContentConfig(type) {
  return CONTENT_CONFIG[type] || CONTENT_CONFIG[CONTENT_TYPES.QUICK_FACT];
}

/**
 * Check if content type requires media
 */
export function requiresMedia(type) {
  return getContentConfig(type).requiresMedia;
}

/**
 * Get media type preference for content type
 */
export function getMediaType(type) {
  return getContentConfig(type).mediaType;
}


