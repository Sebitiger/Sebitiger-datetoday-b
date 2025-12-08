// database.js
// Simple file-based storage for deduplication and tracking
// For production, consider upgrading to SQLite or PostgreSQL

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const POSTED_EVENTS_FILE = path.join(DATA_DIR, "posted-events.json");
const INTERACTIONS_FILE = path.join(DATA_DIR, "interactions.json");
const POLLS_FILE = path.join(DATA_DIR, "polls.json");

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }
}

/**
 * Load JSON file, return empty object if doesn't exist
 */
async function loadJSON(filePath) {
  try {
    await ensureDataDir();
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

/**
 * Save JSON file
 */
async function saveJSON(filePath, data) {
  try {
    await ensureDataDir();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[Database] Error saving ${filePath}:`, err.message);
  }
}

/**
 * Check if event was already posted
 */
export async function isEventPosted(eventId) {
  const posted = await loadJSON(POSTED_EVENTS_FILE);
  return posted[eventId] === true;
}

/**
 * Mark event as posted
 */
export async function markEventPosted(eventId, tweetId = null) {
  const posted = await loadJSON(POSTED_EVENTS_FILE);
  posted[eventId] = {
    posted: true,
    tweetId,
    timestamp: new Date().toISOString(),
  };
  await saveJSON(POSTED_EVENTS_FILE, posted);
}

/**
 * Create event ID from event data
 */
export function createEventId(event) {
  return `${event.year}-${event.monthName}-${event.day}-${event.description?.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "")}`;
}

/**
 * Store interaction (mention, reply, etc.)
 */
export async function storeInteraction(interaction) {
  const interactions = await loadJSON(INTERACTIONS_FILE);
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  interactions[id] = {
    ...interaction,
    timestamp: new Date().toISOString(),
  };
  await saveJSON(INTERACTIONS_FILE, interactions);
  return id;
}

/**
 * Get recent interactions
 */
export async function getRecentInteractions(limit = 10) {
  const interactions = await loadJSON(INTERACTIONS_FILE);
  return Object.values(interactions)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

/**
 * Store poll data for later answer
 */
export async function storePoll(pollId, pollData) {
  const polls = await loadJSON(POLLS_FILE);
  polls[pollId] = {
    ...pollData,
    createdAt: new Date().toISOString(),
  };
  await saveJSON(POLLS_FILE, polls);
}

/**
 * Get poll data
 */
export async function getPoll(pollId) {
  const polls = await loadJSON(POLLS_FILE);
  return polls[pollId] || null;
}

/**
 * Get polls ready for answering (24+ hours old)
 */
export async function getPollsReadyForAnswer() {
  const polls = await loadJSON(POLLS_FILE);
  const now = Date.now();
  const ready = [];

  for (const [pollId, pollData] of Object.entries(polls)) {
    const createdAt = new Date(pollData.createdAt).getTime();
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    
    if (ageHours >= 24 && !pollData.answered) {
      ready.push({ pollId, ...pollData });
    }
  }

  return ready;
}

/**
 * Mark poll as answered
 */
export async function markPollAnswered(pollId) {
  const polls = await loadJSON(POLLS_FILE);
  if (polls[pollId]) {
    polls[pollId].answered = true;
    polls[pollId].answeredAt = new Date().toISOString();
    await saveJSON(POLLS_FILE, polls);
  }
}

/**
 * Clean old data (keep last 30 days)
 */
export async function cleanOldData() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  // Clean interactions
  const interactions = await loadJSON(INTERACTIONS_FILE);
  const cleanedInteractions = {};
  for (const [id, interaction] of Object.entries(interactions)) {
    if (new Date(interaction.timestamp).getTime() > thirtyDaysAgo) {
      cleanedInteractions[id] = interaction;
    }
  }
  await saveJSON(INTERACTIONS_FILE, cleanedInteractions);

  // Clean polls (keep answered polls for 7 days)
  const polls = await loadJSON(POLLS_FILE);
  const cleanedPolls = {};
  for (const [id, poll] of Object.entries(polls)) {
    const pollTime = new Date(poll.createdAt).getTime();
    const keepFor = poll.answered ? 7 : 30; // Keep answered for 7 days, unanswered for 30
    if (pollTime > (Date.now() - (keepFor * 24 * 60 * 60 * 1000))) {
      cleanedPolls[id] = poll;
    }
  }
  await saveJSON(POLLS_FILE, cleanedPolls);

  console.log("[Database] Cleaned old data");
}

