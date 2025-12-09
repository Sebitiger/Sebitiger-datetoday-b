// logger.js
// Structured logging system

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "logs");

// Log levels
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Current log level (can be set via env var)
const CURRENT_LOG_LEVEL = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

/**
 * Ensure log directory exists
 */
async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }
}

/**
 * Format log entry
 */
function formatLogEntry(level, message, metadata = {}) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };
}

/**
 * Write to log file
 */
async function writeToFile(entry) {
  try {
    await ensureLogDir();
    const date = new Date().toISOString().split("T")[0];
    const logFile = path.join(LOG_DIR, `bot-${date}.log`);
    const logLine = JSON.stringify(entry) + "\n";
    await fs.appendFile(logFile, logLine, "utf-8");
  } catch (err) {
    // Fallback to console if file write fails
    console.error("[Logger] Failed to write to file:", err.message);
  }
}

/**
 * Log with level
 */
function log(level, message, metadata = {}) {
  if (LOG_LEVELS[level] > CURRENT_LOG_LEVEL) {
    return; // Skip if below current log level
  }

  const entry = formatLogEntry(level, message, metadata);
  
  // Console output with colors
  const colors = {
    ERROR: "\x1b[31m", // Red
    WARN: "\x1b[33m",  // Yellow
    INFO: "\x1b[36m",  // Cyan
    DEBUG: "\x1b[90m", // Gray
    RESET: "\x1b[0m",
  };

  const color = colors[level] || "";
  const reset = colors.RESET;
  const prefix = `[${entry.timestamp}] [${level}]`;
  
  console.log(`${color}${prefix}${reset} ${message}`, metadata && Object.keys(metadata).length > 0 ? metadata : "");

  // Write to file (async, don't wait)
  writeToFile(entry).catch(() => {});
}

/**
 * Error log
 */
export function error(message, metadata = {}) {
  log("ERROR", message, metadata);
}

/**
 * Warning log
 */
export function warn(message, metadata = {}) {
  log("WARN", message, metadata);
}

/**
 * Info log
 */
export function info(message, metadata = {}) {
  log("INFO", message, metadata);
}

/**
 * Debug log
 */
export function debug(message, metadata = {}) {
  log("DEBUG", message, metadata);
}

/**
 * Log API call
 */
export function logApiCall(service, endpoint, duration, success, error = null) {
  const metadata = {
    service,
    endpoint,
    duration: `${duration}ms`,
    success,
    ...(error && { error: error.message }),
  };

  if (success) {
    info(`API call: ${service} ${endpoint}`, metadata);
  } else {
    error(`API call failed: ${service} ${endpoint}`, metadata);
  }
}

/**
 * Log tweet post
 */
export function logTweetPost(type, tweetId, success, error = null) {
  const metadata = {
    type,
    tweetId,
    success,
    ...(error && { error: error.message }),
  };

  if (success) {
    info(`Tweet posted: ${type}`, metadata);
  } else {
    error(`Tweet post failed: ${type}`, metadata);
  }
}

/**
 * Log engagement
 */
export function logEngagement(action, details = {}) {
  info(`Engagement: ${action}`, details);
}

/**
 * Clean old log files (keep last 7 days)
 */
export async function cleanOldLogs() {
  try {
    await ensureLogDir();
    const files = await fs.readdir(LOG_DIR);
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    for (const file of files) {
      if (file.startsWith("bot-") && file.endsWith(".log")) {
        const filePath = path.join(LOG_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < sevenDaysAgo) {
          await fs.unlink(filePath);
          info(`Deleted old log file: ${file}`);
        }
      }
    }
  } catch (err) {
    error("Error cleaning old logs", { error: err.message });
  }
}


