// utils.js
// Utility functions for retry logic and error handling

/**
 * Retries an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} initialDelay - Initial delay in ms (default: 1000)
 * @returns {Promise} - Result of the function
 */
export async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors (e.g., authentication, validation)
      if (error.status === 401 || error.status === 403 || error.status === 400) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Creates a timeout promise that rejects after specified milliseconds
 * @param {number} ms - Milliseconds to wait before timeout
 * @returns {Promise} - Promise that rejects after timeout
 */
export function createTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
}

/**
 * Wraps an async function with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} - Promise that times out if not resolved in time
 */
export async function withTimeout(promise, timeoutMs) {
  return Promise.race([promise, createTimeout(timeoutMs)]);
}

/**
 * Cleans AI-generated artifacts from text to make it sound more natural
 * Removes em dashes, fixes common AI patterns, etc.
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
export function cleanAIContent(text) {
  if (!text || typeof text !== "string") {
    return text;
  }

  let cleaned = text;

  // Replace em dashes (—) with more natural punctuation
  // Pattern: "word—word" becomes "word, word" or "word. Word" depending on context
  cleaned = cleaned.replace(/—/g, (match, offset, string) => {
    const before = string[offset - 1];
    const after = string[offset + 1];
    
    // If it's between words, use comma
    if (before && after && before !== ' ' && after !== ' ') {
      return ', ';
    }
    // If it's after a space, it's likely a dash for emphasis - use period
    if (before === ' ') {
      return '. ';
    }
    // Default to comma
    return ', ';
  });

  // Fix double spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Fix spaces before punctuation
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');

  return cleaned.trim();
}

/**
 * Deterministically pick a historical period for a given date.
 * This is used so all posts in a single day focus on the same broad era.
 * @param {Date} [date] - JS Date (defaults to now, in UTC)
 * @returns {{id: string, label: string, description: string}}
 */
export function getDailyPeriod(date = new Date()) {
  const periods = [
    {
      id: "ancient",
      label: "Ancient world",
      description: "Events before year 500, including Mesopotamia, Egypt, Greece, Rome, early Asian and other ancient civilizations.",
    },
    {
      id: "medieval",
      label: "Medieval era",
      description: "Roughly 500–1500, including Byzantium, Islamic golden age, medieval Europe, early kingdoms in Africa and Asia.",
    },
    {
      id: "early_modern",
      label: "Early modern",
      description: "1500–1800, including Renaissance, Reformation, global empires, scientific revolution and early capitalism.",
    },
    {
      id: "nineteenth",
      label: "Nineteenth century",
      description: "1800–1900, including industrialisation, revolutions, nation‑states and imperial competition.",
    },
    {
      id: "twentieth",
      label: "Twentieth century (non‑world‑war focus)",
      description: "1900–2000, but avoid making World War I and World War II the main topic, focus on decolonisation, technology, institutions and social change.",
    },
    {
      id: "non_western",
      label: "Non‑Western focus",
      description: "Across eras, but emphasising Africa, Asia, the Middle East, the Americas and Oceania rather than Western Europe or the United States.",
    },
  ];

  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayOfYear = Math.floor((today - startOfYear) / (1000 * 60 * 60 * 24));

  const index = dayOfYear % periods.length;
  return periods[index];
}

