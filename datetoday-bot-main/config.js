// config.js
// Centralized configuration management

export const CONFIG = {
  // Posting schedules (UTC)
  schedules: {
    daily: "0 9 * * *",           // 09:00 UTC
    evening: "0 18 * * *",        // 18:00 UTC
    weekly: "0 16 * * 0",         // Sunday 16:00 UTC
    polls: "0 14 * * 2,4",        // Tuesday & Thursday 14:00 UTC
    whatIf: "0 12 * * 3",         // Wednesday 12:00 UTC
    hiddenConnection: "0 15 * * 5", // Friday 15:00 UTC
    mentions: "*/15 * * * *",     // Every 15 minutes
  },

  // OpenAI settings
  openai: {
    model: {
      standard: "gpt-4o-mini",
      advanced: "gpt-4o",
    },
    timeout: {
      standard: 30000,  // 30 seconds
      advanced: 60000,  // 60 seconds
    },
    maxTokens: {
      tweet: 220,
      reply: 220,
      fact: 160,
      thread: 600,
      whatIf: 800,
    },
  },

  // Twitter settings
  twitter: {
    maxTweetLength: 280,
    maxRepliesPerHour: 20,
    replyDelayMs: 3000,
    threadDelayMs: 1000,
  },

  // API timeouts
  timeouts: {
    events: 10000,      // 10 seconds
    images: 10000,      // 10 seconds
    wikipedia: 10000,   // 10 seconds
  },

  // Image processing
  images: {
    maxSize: 5 * 1024 * 1024,  // 5MB
    maxDimensions: 1200,
    fallbackDimensions: 800,
    quality: {
      high: 85,
      medium: 70,
    },
  },

  // Retry settings
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
  },

  // Content filtering
  content: {
    minEventLength: 40,
    filterKeywords: [
      "election",
      "football",
      "soccer",
      "governor",
      "premier league",
    ],
  },
};


