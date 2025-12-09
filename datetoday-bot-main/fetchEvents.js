// fetchEvents.js
// Fetches today's historical events from ByAbbe API
// and returns ONE random clean event.

import axios from "axios";

// Default timeout for API calls (10 seconds)
const API_TIMEOUT = 10000;

/**
 * Checks if event is too broad/generic (lacks specific details)
 */
function isEventTooBroad(event) {
  const desc = event.description.toLowerCase();
  
  // Too generic indicators
  const genericPatterns = [
    /^[a-z\s]+(?:was|were|became|started|began|ended|occurred|happened)/i, // Vague verbs
    /\b(?:something|someone|some|various|several|many|group|people|person)\b/i, // Vague nouns
    /\b(?:established|founded|created|formed)\b.*\b(?:organization|institution|group|committee|society)\b/i, // Generic organizations
  ];
  
  // Check for specific details (good events have these)
  const hasSpecificName = /[A-Z][a-z]+ [A-Z][a-z]+/.test(event.description); // Proper nouns
  const hasSpecificPlace = /\b(?:in|at|near|of)\s+[A-Z][a-z]+/.test(event.description); // Named places
  const hasSpecificNumber = /\d+/.test(event.description); // Numbers/dates
  const hasSpecificEvent = /\b(?:battle|treaty|declaration|assassination|landing|flight|discovery|invention)\b/i.test(desc);
  
  // If it's too generic and lacks specifics, it's too broad
  const isGeneric = genericPatterns.some(pattern => pattern.test(event.description));
  const lacksSpecifics = !hasSpecificName && !hasSpecificPlace && !hasSpecificEvent;
  
  return isGeneric || lacksSpecifics;
}

/**
 * Scores an event based on how "major" and specific it is historically
 * Higher score = more major/well-known/specific event
 */
function scoreEventMajority(event) {
  const desc = event.description.toLowerCase();
  let score = 0;

  // Penalize broad/generic events heavily
  if (isEventTooBroad(event)) {
    score -= 50; // Heavy penalty
  }

  // Major wars and conflicts (very high priority)
  if (desc.includes("world war") || desc.includes("civil war") || desc.includes("revolution")) {
    score += 50;
  }
  if (desc.includes("battle") && /battle of [A-Z]/.test(event.description)) {
    score += 40; // Named battles
  }
  if (desc.includes("war") || desc.includes("invasion")) {
    score += 30;
  }

  // Major discoveries and achievements with specific names
  if (desc.includes("moon landing") || desc.includes("apollo") || desc.includes("first man on the moon")) {
    score += 50;
  }
  if (desc.includes("discovered") && /[A-Z][a-z]+/.test(event.description)) {
    score += 30; // Named discoveries
  }
  if (desc.includes("invention") && /[A-Z][a-z]+/.test(event.description)) {
    score += 30; // Named inventions
  }
  if (desc.includes("first") && (desc.includes("flight") || desc.includes("space") || desc.includes("cross") || desc.includes("reach"))) {
    score += 35;
  }

  // Major treaties and agreements with names
  if (desc.includes("treaty") && /treaty of [A-Z]/.test(event.description)) {
    score += 40; // Named treaties
  }
  if (desc.includes("treaty") || desc.includes("agreement") || desc.includes("signed")) {
    score += 25;
  }
  if (desc.includes("independence") && /[A-Z][a-z]+/.test(event.description)) {
    score += 40; // Named independence declarations
  }
  if (desc.includes("independence") || desc.includes("declared independence")) {
    score += 35;
  }

  // Major political events with specific names
  if (desc.includes("assassinated") && /[A-Z][a-z]+ [A-Z][a-z]+/.test(event.description)) {
    score += 40; // Named assassinations
  }
  if (desc.includes("assassinated") || desc.includes("assassination")) {
    score += 30;
  }
  if (desc.includes("crowned") && /[A-Z][a-z]+/.test(event.description)) {
    score += 25; // Named coronations
  }
  if (desc.includes("crowned") || desc.includes("coronation")) {
    score += 20;
  }

  // Major disasters with names
  if (desc.includes("titanic") || desc.includes("hindenburg") || desc.includes("chernobyl")) {
    score += 50; // Famous named disasters
  }
  if (desc.includes("earthquake") || desc.includes("tsunami") || desc.includes("hurricane")) {
    score += 30;
  }

  // Famous historical figures (boost score significantly)
  const famousPeople = [
    "napoleon", "hitler", "churchill", "lincoln", "kennedy", "einstein", 
    "shakespeare", "da vinci", "galileo", "newton", "darwin", "edison",
    "columbus", "caesar", "cleopatra", "gandhi", "martin luther king",
    "washington", "jefferson", "franklin", "roosevelt", "truman"
  ];
  for (const person of famousPeople) {
    if (desc.includes(person)) {
      score += 35; // Increased from 25
      break;
    }
  }

  // Major cultural milestones with names
  if (desc.includes("published") && /[A-Z][a-z]+/.test(event.description)) {
    score += 20; // Named publications
  }
  if (desc.includes("premiered") && /[A-Z][a-z]+/.test(event.description)) {
    score += 15; // Named premieres
  }

  // Major scientific breakthroughs with names
  if (desc.includes("theory") && /[A-Z][a-z]+/.test(event.description)) {
    score += 25; // Named theories
  }
  if (desc.includes("nobel prize") || desc.includes("nobel")) {
    score += 35; // Increased
  }

  // Major infrastructure/achievements with names
  if (desc.includes("opened") && /[A-Z][a-z]+/.test(event.description)) {
    score += 25; // Named openings
  }

  // Bonus for specific details
  if (/[A-Z][a-z]+ [A-Z][a-z]+/.test(event.description)) {
    score += 15; // Has proper nouns (names)
  }
  if (/\d+/.test(event.description)) {
    score += 10; // Has numbers
  }

  // Penalize niche/local events
  if (desc.includes("local") || desc.includes("regional") || desc.includes("municipal")) {
    score -= 30; // Increased penalty
  }
  if (desc.includes("minor") || desc.includes("small") || desc.includes("unimportant")) {
    score -= 25; // Increased penalty
  }

  // Bonus for older events (pre-1900 are often more "historical")
  if (event.year < 1900) {
    score += 10;
  }

  return score;
}

/**
 * Filters events to remove low-quality, unwanted, or too-broad entries
 */
function filterEvents(events) {
  return events.filter((ev) => {
    const desc = ev.description.toLowerCase();

    // Basic quality checks
    if (desc.length < 50) return false; // Increased minimum length
    if (desc.includes("election")) return false;
    if (desc.includes("football")) return false;
    if (desc.includes("soccer")) return false;
    if (desc.includes("governor")) return false;
    if (desc.includes("premier league")) return false;
    
    // Filter out too-broad events
    if (isEventTooBroad(ev)) return false;
    
    // Must have some specific detail (proper noun, number, or named event)
    const hasSpecifics = /[A-Z][a-z]+ [A-Z][a-z]+/.test(ev.description) || // Proper nouns
                        /\d+/.test(ev.description) || // Numbers
                        /\b(?:battle|treaty|declaration|assassination|landing|flight|discovery|invention|war)\b/i.test(desc); // Named events
    
    return hasSpecifics;
  });
}

/**
 * Fetches events from the API for a given date
 */
async function fetchEventsForDate(month, day) {
  const url = `https://byabbe.se/on-this-day/${month}/${day}/events.json`;
  console.log("[Events] Fetching events from:", url);

  const res = await axios.get(url, {
    timeout: API_TIMEOUT,
  });
  
  const events = res.data?.events || [];

  if (!events.length) {
    throw new Error("No events returned by API");
  }

  // Filter garbage + hyper-specific political entries
  const filtered = filterEvents(events);
  const usableEvents = filtered.length ? filtered : events;

  return usableEvents;
}

/**
 * Selects a major event from the array, prioritizing high-scoring events
 * Uses weighted random selection - higher scores have better chance, but still some randomness
 */
function selectMajorEvent(events) {
  if (!events.length) {
    return null;
  }

  // Score all events
  const scoredEvents = events.map(event => ({
    event,
    score: scoreEventMajority(event)
  }));

  // Sort by score (highest first)
  scoredEvents.sort((a, b) => b.score - a.score);

  // Get top 30% of events (major events)
  const topCount = Math.max(1, Math.ceil(scoredEvents.length * 0.3));
  const topEvents = scoredEvents.slice(0, topCount);

  // If we have events with score >= 40, prefer those (increased threshold for more specific events)
  const majorEvents = scoredEvents.filter(item => item.score >= 40);
  const candidates = majorEvents.length > 0 ? majorEvents : 
                     scoredEvents.filter(item => item.score >= 20); // Fallback to score >= 20

  // Weighted random selection from candidates
  // Higher scores get higher weight, but still random
  const totalWeight = candidates.reduce((sum, item) => sum + Math.max(1, item.score), 0);
  let random = Math.random() * totalWeight;
  
  for (const item of candidates) {
    random -= Math.max(1, item.score);
    if (random <= 0) {
      return item.event;
    }
  }

  // Fallback to highest scored event
  return candidates[0].event;
}

/**
 * Selects a random event from the array (legacy function, kept for compatibility)
 */
function selectRandomEvent(events) {
  return events[Math.floor(Math.random() * events.length)];
}

/**
 * Formats an event object with date information
 */
function formatEvent(event, date, includeWikipedia = false) {
  const formatted = {
    year: event.year,
    description: event.description,
    monthName: date.toLocaleString("en-US", { month: "long" }),
    day: date.getDate(),
  };

  if (includeWikipedia && event.wikipedia) {
    formatted.wikipediaTitle = event.wikipedia[0]?.title || null;
  }

  return formatted;
}

export async function getRandomEvent() {
  try {
    const date = new Date();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const usableEvents = await fetchEventsForDate(month, day);
    
    // Prioritize major events for daily posts
    const majorEvent = selectMajorEvent(usableEvents);
    const selectedEvent = majorEvent || selectRandomEvent(usableEvents);

    if (majorEvent) {
      const score = scoreEventMajority(majorEvent);
      console.log(`[Events] Selected major event (score: ${score})`);
    } else {
      console.log("[Events] No major events found, using random selection");
    }

    return formatEvent(selectedEvent, date, false);

  } catch (err) {
    console.error("[Events ERROR]", err.message);
    throw err;
  }
}

export async function getEventForDate() {
  try {
    const date = new Date();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const usableEvents = await fetchEventsForDate(month, day);
    const randomEvent = selectRandomEvent(usableEvents);

    return formatEvent(randomEvent, date, true);

  } catch (err) {
    console.error("[Events ERROR]", err.message);
    throw err;
  }
}
