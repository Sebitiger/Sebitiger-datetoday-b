// database.js
// Simple file-based storage for deduplication and tracking
// For production, consider upgrading to SQLite or PostgreSQL

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const POSTED_EVENTS_FILE = path.join(DATA_DIR, "posted-events.json");
const POSTED_CONTENT_FILE = path.join(DATA_DIR, "posted-content.json");
const POSTED_IMAGES_FILE = path.join(DATA_DIR, "posted-images.json");
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
 * Extract key historical terms from text (for better duplicate detection)
 */
function extractKeyHistoricalTerms(text) {
  const normalized = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Extract important historical terms (proper nouns, years, key events)
  const words = normalized.split(' ').filter(w => {
    const clean = w.replace(/[^\w]/g, '');
    // Keep: years (4 digits), capitalized words (likely proper nouns), important historical terms
    return (clean.length > 3 && /^[A-Z]/.test(w)) || // Proper nouns
           /^\d{4}$/.test(clean) || // Years
           (clean.length > 4 && !['that', 'this', 'with', 'from', 'about', 'which', 'their', 'there', 'would', 'could', 'peace', 'treaty', 'war', 'world', 'history', 'historical'].includes(clean));
  });
  
  return words;
}

/**
 * Create content hash from text (for deduplication)
 * Now includes key historical terms for better matching
 */
function createContentHash(text) {
  const keyTerms = extractKeyHistoricalTerms(text);
  
  // Create hash from key terms (up to 8 terms for better matching)
  const hash = keyTerms.slice(0, 8).join('-').substring(0, 80);
  
  return hash || text.toLowerCase().slice(0, 50).replace(/[^\w]/g, '-');
}

/**
 * Check if similar content was posted recently (within last 60 days - VERY STRICT)
 * Now checks for same historical events/topics, not just similar text
 * EXTRA STRICT for "Did you know" facts
 */
export async function isContentDuplicate(text, daysToCheck = 60) {
  const content = await loadJSON(POSTED_CONTENT_FILE);
  const contentHash = createContentHash(text);
  const cutoffTime = Date.now() - (daysToCheck * 24 * 60 * 60 * 1000);
  
  // Check if this is a "Did you know" style fact (needs extra strict checking)
  const isDidYouKnow = /^(did you know|fun fact|here's|this is|in \d{4})/i.test(text.trim());
  const strictThreshold = 0.0; // ZERO tolerance - any similarity = duplicate
  const minMatchingTerms = isDidYouKnow ? 1 : 2; // Very low threshold - even 1 matching term can be duplicate
  
  // Extract key historical terms from current text
  const currentKeyTerms = extractKeyHistoricalTerms(text);
  const currentTermsSet = new Set(currentKeyTerms.map(t => t.toLowerCase()));
  
  // Remove "did you know" and similar phrases for better matching
  const normalizedText = text.toLowerCase()
    .replace(/^(did you know|fun fact|here's|this is|in \d{4})/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Check if same hash exists and was posted recently
  for (const [hash, data] of Object.entries(content)) {
    const postedTime = new Date(data.timestamp).getTime();
    if (postedTime <= cutoffTime) continue; // Skip old posts
    
    if (!data.text) continue;
    
    // Normalize previous text too
    const normalizedPrevious = data.text.toLowerCase()
      .replace(/^(did you know|fun fact|here's|this is|in \d{4})/i, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Check hash similarity - ZERO tolerance
    if (hash === contentHash || hash.includes(contentHash) || contentHash.includes(hash)) {
      // Any hash match = duplicate (even if text is slightly different)
      console.log(`[Database] Duplicate detected: Hash match (hash: ${hash.substring(0, 30)}...)`);
      return true;
    }
    
    // Also check if the actual text has ANY similarity (ZERO tolerance)
    const similarity = calculateSimilarity(normalizedText, normalizedPrevious);
    if (similarity > 0.0) {
      // If there's any word overlap, check if key terms match
      if (matchingTerms.length >= 1) {
        console.log(`[Database] Duplicate detected: Text similarity (${similarity.toFixed(2)} similarity, ${matchingTerms.length} matching terms)`);
        return true;
      }
    }
    
    // Check if same historical event/topic (even if wording is different)
    const previousKeyTerms = extractKeyHistoricalTerms(data.text);
    const previousTermsSet = new Set(previousKeyTerms.map(t => t.toLowerCase()));
    
    // Count matching key terms
    const matchingTerms = [...currentTermsSet].filter(term => previousTermsSet.has(term));
    const totalUniqueTerms = new Set([...currentTermsSet, ...previousTermsSet]).size;
    
    // If enough key terms match, it's likely the same event/topic
    // ZERO tolerance - even small overlap = duplicate
    const termMatchRatio = totalUniqueTerms > 0 ? matchingTerms.length / totalUniqueTerms : 0;
    const termThreshold = 0.0; // ZERO tolerance - any matching terms = potential duplicate
    
    // If we have matching key terms (especially proper nouns, years, or event names), it's a duplicate
    if (matchingTerms.length >= minMatchingTerms) {
      console.log(`[Database] Duplicate detected: Same historical event (${matchingTerms.length} matching terms: ${matchingTerms.join(', ')}, ratio: ${termMatchRatio.toFixed(2)})`);
      return true;
    }
    
    // Check for same year + same key event terms
    const currentYear = text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)?.[1];
    const previousYear = data.text.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/)?.[1];
    
    if (currentYear && previousYear && currentYear === previousYear) {
      // Same year - check if key event terms match
      const eventTerms = ['treaty', 'battle', 'war', 'revolution', 'assassination', 'declaration', 'landing', 'attack', 'versailles', 'hitler', 'germany', 'france', 'britain'];
      const currentEventTerms = eventTerms.filter(term => text.toLowerCase().includes(term));
      const previousEventTerms = eventTerms.filter(term => data.text.toLowerCase().includes(term));
      
        // ZERO tolerance - same year + any matching event term = duplicate
        if (currentEventTerms.length > 0 && 
            previousEventTerms.length > 0 && 
            currentEventTerms.some(term => previousEventTerms.includes(term))) {
          console.log(`[Database] Duplicate detected: Same year (${currentYear}) + same event type (${currentEventTerms.join(', ')})`);
          return true;
        }
    }
    
    // EXTRA STRICT: For "Did you know" facts, check if they're about the same topic
    // even with different wording (e.g., "Treaty of Versailles" vs "Versailles Treaty")
    if (isDidYouKnow) {
      // Extract main topic (remove common fact phrases)
      const currentTopic = normalizedText.split(' ').filter(w => 
        w.length > 4 && 
        !['that', 'this', 'with', 'from', 'about', 'which', 'their', 'there', 'would', 'could', 'peace', 'treaty', 'war', 'world', 'history', 'historical', 'imposed', 'harsh', 'penalties', 'reparations', 'contributed', 'sparked', 'conflict', 'lesson'].includes(w)
      ).slice(0, 5).join(' ');
      
      const previousTopic = normalizedPrevious.split(' ').filter(w => 
        w.length > 4 && 
        !['that', 'this', 'with', 'from', 'about', 'which', 'their', 'there', 'would', 'could', 'peace', 'treaty', 'war', 'world', 'history', 'historical', 'imposed', 'harsh', 'penalties', 'reparations', 'contributed', 'sparked', 'conflict', 'lesson'].includes(w)
      ).slice(0, 5).join(' ');
      
      // ZERO tolerance - any topic similarity = duplicate
      const topicSimilarity = calculateSimilarity(currentTopic, previousTopic);
      if (topicSimilarity > 0.0 && matchingTerms.length >= 1) {
        console.log(`[Database] Duplicate detected: "Did you know" fact about same topic (${topicSimilarity.toFixed(2)} topic similarity, ${matchingTerms.length} matching terms)`);
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate text similarity (improved - focuses on meaningful words)
 */
function calculateSimilarity(text1, text2) {
  // Remove common words and focus on meaningful terms
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'this', 'that', 'these', 'those', 'was', 'were', 'is', 'are', 'had', 'have', 'has', 'did', 'does', 'do', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'peace', 'treaty', 'war', 'world', 'history', 'historical']);
  
  const words1 = new Set(
    text1.split(/\s+/)
      .map(w => w.toLowerCase().replace(/[^\w]/g, ''))
      .filter(w => w.length > 3 && !commonWords.has(w))
  );
  
  const words2 = new Set(
    text2.split(/\s+/)
      .map(w => w.toLowerCase().replace(/[^\w]/g, ''))
      .filter(w => w.length > 3 && !commonWords.has(w))
  );
  
  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

/**
 * Create image hash from image buffer (for duplicate detection)
 */
function createImageHash(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    return null;
  }
  // Create hash from first 10KB of image (enough to detect duplicates)
  const sample = imageBuffer.slice(0, Math.min(10240, imageBuffer.length));
  return crypto.createHash('md5').update(sample).digest('hex');
}

/**
 * Check if image was already posted recently
 */
export async function isImageDuplicate(imageBuffer, daysToCheck = 60) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    return false;
  }
  
  const images = await loadJSON(POSTED_IMAGES_FILE);
  const imageHash = createImageHash(imageBuffer);
  
  if (!imageHash) {
    return false;
  }
  
  const cutoffTime = Date.now() - (daysToCheck * 24 * 60 * 60 * 1000);
  
  if (images[imageHash]) {
    const postedTime = new Date(images[imageHash].timestamp).getTime();
    if (postedTime > cutoffTime) {
      console.log(`[Database] Duplicate image detected (posted ${Math.round((Date.now() - postedTime) / (1000 * 60 * 60 * 24))} days ago)`);
      return true;
    }
  }
  
  return false;
}

/**
 * Mark image as posted (for deduplication)
 */
export async function markImagePosted(imageBuffer, tweetId = null) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    return;
  }
  
  const images = await loadJSON(POSTED_IMAGES_FILE);
  const imageHash = createImageHash(imageBuffer);
  
  if (imageHash) {
    images[imageHash] = {
      tweetId,
      timestamp: new Date().toISOString(),
    };
    await saveJSON(POSTED_IMAGES_FILE, images);
  }
}

/**
 * Mark content as posted (for deduplication)
 */
export async function markContentPosted(text, tweetId = null, imageBuffer = null) {
  const content = await loadJSON(POSTED_CONTENT_FILE);
  const contentHash = createContentHash(text);
  
  content[contentHash] = {
    text: text.slice(0, 200), // Store first 200 chars for comparison
    tweetId,
    timestamp: new Date().toISOString(),
  };
  
  await saveJSON(POSTED_CONTENT_FILE, content);
  
  // Also mark image if provided
  if (imageBuffer) {
    await markImagePosted(imageBuffer, tweetId);
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

  // Clean posted content (keep last 60 days - longer for better duplicate detection)
  const postedContent = await loadJSON(POSTED_CONTENT_FILE);
  const cleanedContent = {};
  for (const [hash, data] of Object.entries(postedContent)) {
    const postedTime = new Date(data.timestamp).getTime();
    if (postedTime > (Date.now() - (60 * 24 * 60 * 60 * 1000))) {
      cleanedContent[hash] = data;
    }
  }
  await saveJSON(POSTED_CONTENT_FILE, cleanedContent);

  // Clean posted images (keep last 60 days)
  const postedImages = await loadJSON(POSTED_IMAGES_FILE);
  const cleanedImages = {};
  for (const [hash, data] of Object.entries(postedImages)) {
    const postedTime = new Date(data.timestamp).getTime();
    if (postedTime > (Date.now() - (60 * 24 * 60 * 60 * 1000))) {
      cleanedImages[hash] = data;
    }
  }
  await saveJSON(POSTED_IMAGES_FILE, cleanedImages);

  console.log("[Database] Cleaned old data");
}


