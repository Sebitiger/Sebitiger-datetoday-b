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
 * List of ICONIC, well-known historical events that should be prioritized
 * These are events that most people know about
 */
const ICONIC_EVENTS = [
  // Famous battles (everyone knows these)
  "waterloo", "hastings", "gettysburg", "stalingrad", "normandy", "d-day", "d day", "pearl harbor",
  "marathon", "thermopylae", "cannae", "actium", "tours", "agincourt", "leipzig",
  "verdun", "somme", "battle of britain", "midway", "el alamein", "battle of the bulge",
  "bunker hill", "yorktown", "saratoga", "antietam", "vicksburg", "appomattox",
  
  // Major historical events (world-changing moments)
  "hegira", "hijra", "hegirah", "fall of constantinople", "fall of rome", "sack of rome",
  "black death", "bubonic plague", "great fire of london", "great depression", "dust bowl",
  "renaissance", "reformation", "crusades", "inquisition",
  
  // Famous treaties and agreements
  "treaty of versailles", "treaty of westphalia", "treaty of paris", "magna carta",
  "edict of nantes", "peace of westphalia", "treaty of ghent", "treaty of tordesillas",
  
  // Major discoveries and achievements
  "columbus", "america discovered", "new world", "moon landing", "apollo", "first flight",
  "wright brothers", "penicillin", "vaccine", "printing press", "gutenberg",
  "sputnik", "first satellite", "first man in space", "yuri gagarin",
  
  // Famous assassinations
  "assassination of lincoln", "assassination of kennedy", "assassination of archduke",
  "assassination of julius caesar", "assassination of gandhi", "assassination of martin luther king",
  "assassination of archduke ferdinand", "franz ferdinand",
  
  // Major revolutions
  "french revolution", "american revolution", "russian revolution", "october revolution",
  "industrial revolution", "glorious revolution", "chinese revolution",
  
  // Famous declarations
  "declaration of independence", "declaration of rights", "universal declaration",
  "emancipation proclamation", "magna carta",
  
  // Major disasters
  "titanic", "hindenburg", "chernobyl", "pompeii", "krakatoa", "pompeii",
  
  // Famous historical figures (when they did something major)
  "napoleon", "caesar", "julius caesar", "alexander the great", "genghis khan", "cleopatra",
  "shakespeare", "da vinci", "leonardo", "michelangelo", "galileo", "newton", "darwin", "einstein",
  "lincoln", "washington", "napoleon bonaparte",
  
  // Major dates (iconic years - GLOBAL not just US)
  "1066", "1453", "1492", "1789", "1914", "1945", "1969",

  // Famous places/events
  "berlin wall", "iron curtain", "cold war", "space race", "arms race",
  "holocaust", "nuremberg", "hiroshima", "nagasaki",

  // GLOBAL DIVERSITY ADDITIONS
  "silk road", "terracotta", "forbidden city", "ming dynasty", "qing dynasty",
  "ottoman empire", "mughal empire", "safavid", "aztec", "maya", "inca",
  "zulu", "ashanti", "mali empire", "mansa musa", "timbuktu",
  "edo period", "meiji", "tokugawa", "samurai", "shogun",
  "mahatma gandhi", "nelson mandela", "ho chi minh", "mao zedong",
  "taj mahal", "machu picchu", "angkor wat", "petra",
  "haitian revolution", "bolivar", "mexican revolution", "cuban revolution",
  "indian independence", "partition of india", "opium war",
  "meiji restoration", "boxer rebellion", "taiping rebellion"
];

/**
 * Check if event matches an iconic, well-known historical event
 */
function isIconicEvent(event) {
  const desc = event.description.toLowerCase();
  const year = event.year?.toString() || "";
  
  // Check if description contains iconic event keywords
  for (const iconic of ICONIC_EVENTS) {
    if (desc.includes(iconic)) {
      return true;
    }
  }
  
  // Check if year matches iconic years
  if (ICONIC_EVENTS.includes(year)) {
    return true;
  }
  
  return false;
}

/**
 * Scores an event based on how "major" and specific it is historically
 * Higher score = more major/well-known/specific event
 * NOW PRIORITIZES ICONIC, WELL-KNOWN EVENTS
 */
function scoreEventMajority(event) {
  const desc = event.description.toLowerCase();
  let score = 0;

  // HUGE BOOST for iconic, well-known events
  if (isIconicEvent(event)) {
    score += 100; // Massive boost for iconic events
    console.log(`[Events] Iconic event detected: ${event.description?.slice(0, 60)}`);
  }

  // Penalize broad/generic events (but less harshly to allow more variety)
  if (isEventTooBroad(event)) {
    score -= 30; // Reduced from 50 to 30 - allow more diverse events
  }

  // HEAVILY PENALIZE 20th century wars (user wants less war content)
  if (desc.includes("world war") && (event.year >= 1914 && event.year <= 1945)) {
    score -= 50; // INCREASED penalty: too much WW1/WW2
  }
  if (desc.includes("treaty of versailles") || desc.includes("versailles treaty")) {
    score -= 30; // INCREASED penalty: repetitive
  }

  // PENALIZE US-specific wars (reduce US bias)
  if (desc.includes("civil war") && (event.year >= 1861 && event.year <= 1865)) {
    score -= 40; // US Civil War appears too often
  }
  if (desc.includes("revolutionary war") || desc.includes("american revolution")) {
    score -= 35; // Revolutionary War appears too often
  }

  // DEPRIORITIZE battles generally (lowest engagement per user)
  if (desc.includes("battle")) {
    score -= 20; // Battles have low viral potential
  }
  if (desc.includes("war") || desc.includes("invasion")) {
    score -= 10; // Wars less interesting than discoveries/culture
  }

  // Only boost NON-US wars/revolutions slightly
  if (desc.includes("revolution") && !desc.includes("american")) {
    if (event.year < 1900) {
      score += 25; // Non-US revolutions only
    }
  }
  
  // GEOGRAPHIC DIVERSITY BOOSTS (reduce Western bias)
  // Asian history
  if (desc.match(/\b(china|chinese|japan|japanese|korea|korean|india|indian|persia|persian|mongol|silk road|dynasty)\b/i)) {
    score += 50; // Major boost for Asian history
  }
  // African history
  if (desc.match(/\b(africa|african|egypt|egyptian|ethiopia|ethiopian|mali|zulu|ashanti|mansa musa)\b/i)) {
    score += 55; // Highest boost - African history underrepresented
  }
  // Latin American history
  if (desc.match(/\b(mexico|mexican|brazil|brazilian|argentina|peru|aztec|maya|inca|bolivar|latin america)\b/i)) {
    score += 50; // Major boost for Latin American history
  }
  // Middle Eastern history
  if (desc.match(/\b(ottoman|baghdad|damascus|jerusalem|arabia|arabic|muslim|islam|caliphate)\b/i)) {
    score += 50; // Major boost for Middle Eastern history
  }
  // Indigenous/Native history
  if (desc.match(/\b(indigenous|native|aboriginal|maori|polynesian)\b/i)) {
    score += 55; // Very underrepresented
  }

  // PENALIZE overly US-centric events
  if (desc.match(/\b(united states|america|american)\b/i) && !desc.includes("native american")) {
    score -= 25; // Reduce US content frequency
  }

  // BROADER TOPICS: Science and technology (expanded)
  if (desc.includes("discovered") || desc.includes("discovery")) {
    score += 40; // INCREASED: discoveries are viral
  }
  if (desc.includes("invention") || desc.includes("invented")) {
    score += 40; // INCREASED: inventions are viral
  }
  if (desc.includes("theory") || desc.includes("hypothesis")) {
    score += 30; // Scientific theories
  }
  if (desc.includes("experiment") || desc.includes("breakthrough")) {
    score += 30; // Scientific breakthroughs
  }
  if (desc.includes("medicine") || desc.includes("medical") || desc.includes("cure") || desc.includes("treatment")) {
    score += 30; // Medical advances
  }
  if (desc.includes("technology") || desc.includes("technological")) {
    score += 25; // Technology advances
  }
  
  // BROADER TOPICS: Arts and culture (SIGNIFICANTLY INCREASED - more viral than battles)
  if (desc.includes("published") && /[A-Z][a-z]+/.test(event.description)) {
    score += 45; // INCREASED: publications are shareable
  }
  if (desc.includes("premiered") || desc.includes("debut") || desc.includes("first performance")) {
    score += 40; // INCREASED: cultural moments are viral
  }
  if (desc.includes("exhibition") || desc.includes("museum") || desc.includes("gallery")) {
    score += 35; // INCREASED: art events
  }
  if (desc.includes("composed") || desc.includes("symphony") || desc.includes("opera")) {
    score += 40; // INCREASED: musical milestones
  }
  if (desc.includes("painted") || desc.includes("sculpture") || desc.includes("artwork")) {
    score += 40; // INCREASED: art creation
  }
  if (desc.includes("literature") || desc.includes("novel") || desc.includes("poetry") || desc.includes("book")) {
    score += 40; // INCREASED: literary works
  }
  // Famous artists/writers
  if (desc.match(/\b(picasso|van gogh|monet|rembrandt|shakespeare|tolstoy|dickens|austen|homer|virgil)\b/i)) {
    score += 45; // Famous creators
  }
  
  // BROADER TOPICS: Exploration and geography
  if (desc.includes("expedition") || desc.includes("explorer") || desc.includes("explored")) {
    score += 35; // Exploration
  }
  if (desc.includes("reached") || desc.includes("arrived") || desc.includes("crossed")) {
    score += 25; // Geographic achievements
  }
  if (desc.includes("mountain") || desc.includes("peak") || desc.includes("summit")) {
    score += 25; // Mountain climbing
  }
  if (desc.includes("pole") || desc.includes("antarctic") || desc.includes("arctic")) {
    score += 30; // Polar exploration
  }
  
  // BROADER TOPICS: Social and cultural movements
  if (desc.includes("movement") || desc.includes("protest") || desc.includes("demonstration")) {
    score += 30; // Social movements
  }
  if (desc.includes("rights") || desc.includes("freedom") || desc.includes("liberation")) {
    score += 30; // Rights movements
  }
  if (desc.includes("festival") || desc.includes("celebration") || desc.includes("ceremony")) {
    score += 20; // Cultural celebrations
  }
  
  // BROADER TOPICS: Architecture and infrastructure
  if (desc.includes("built") || desc.includes("construction") || desc.includes("completed")) {
    score += 25; // Construction projects
  }
  if (desc.includes("opened") && /[A-Z][a-z]+/.test(event.description)) {
    score += 30; // Increased from 25 - important openings
  }
  if (desc.includes("bridge") || desc.includes("tunnel") || desc.includes("canal")) {
    score += 30; // Infrastructure
  }
  
  // BROADER TOPICS: Sports and achievements (major events only)
  if (desc.includes("olympic") || desc.includes("olympics")) {
    score += 30; // Olympic games
  }
  if (desc.includes("championship") && /[A-Z][a-z]+/.test(event.description)) {
    score += 20; // Major championships
  }

  // Major discoveries and achievements with specific names
  if (desc.includes("moon landing") || desc.includes("apollo") || desc.includes("first man on the moon")) {
    score += 50;
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

  // Major scientific breakthroughs with names
  if (desc.includes("nobel prize") || desc.includes("nobel")) {
    score += 35; // Nobel prizes
  }

  // Bonus for specific details
  if (/[A-Z][a-z]+ [A-Z][a-z]+/.test(event.description)) {
    score += 15; // Has proper nouns (names)
  }
  if (/\d+/.test(event.description)) {
    score += 10; // Has numbers
  }

  // Penalize niche/local events (but less harshly)
  if (desc.includes("local") || desc.includes("regional") || desc.includes("municipal")) {
    score -= 20; // Reduced from 30 to 20
  }
  if (desc.includes("minor") || desc.includes("small") || desc.includes("unimportant")) {
    score -= 15; // Reduced from 25 to 15
  }

  // MAJOR BONUS for older historical periods (to diversify from 20th century focus)
  if (event.year < 1000) {
    score += 40; // Ancient history - big bonus
  } else if (event.year < 1500) {
    score += 35; // Medieval period - big bonus
  } else if (event.year < 1800) {
    score += 30; // Renaissance/Early Modern - big bonus
  } else if (event.year < 1900) {
    score += 20; // 19th century - good bonus
  } else if (event.year < 1950) {
    score -= 10; // Early 20th century - slight penalty (too much WW1/WW2)
  } else if (event.year < 2000) {
    score -= 5; // Late 20th century - small penalty
  }
  
  // Extra bonus for very ancient events
  if (event.year < 500) {
    score += 20; // Extra bonus for ancient times
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
 * NOW AVOIDS WW1/WW2 if limit reached
 */
async function selectMajorEvent(events) {
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

  // STRICT: Prioritize ICONIC events (score >= 100), then very major (60+), then major (50+)
  const iconicEvents = scoredEvents.filter(item => item.score >= 100);
  const veryMajorEvents = scoredEvents.filter(item => item.score >= 60);
  const majorEvents = scoredEvents.filter(item => item.score >= 50);
  
  // BROADER SELECTION: Allow more variety - prefer iconic (100+), but also include good events (30+)
  // This ensures we get diverse topics, not just wars and battles
  let candidates = iconicEvents.length > 0 ? iconicEvents :
                   veryMajorEvents.length > 0 ? veryMajorEvents :
                   majorEvents.length > 0 ? majorEvents :
                   scoredEvents.filter(item => item.score >= 30); // Lowered from 40 to 30 for broader topics
  
  // FILTER OUT WW1/WW2 if limit reached
  // Import dynamically to avoid circular dependency
  let wwLimitReached = false;
  try {
    const { checkWWPostLimit } = await import('./database.js');
    wwLimitReached = await checkWWPostLimit();
  } catch (err) {
    console.warn('[Events] Could not check WW limit:', err.message);
  }
  
  if (wwLimitReached) {
    // Remove WW1/WW2 events from candidates
    const desc = (event) => event.description?.toLowerCase() || '';
    const isWW = (event) => {
      const d = desc(event);
      return d.includes('world war') || d.includes('ww1') || d.includes('ww2') || 
             d.includes('versailles') || d.includes('pearl harbor') || 
             d.includes('d-day') || d.includes('normandy') ||
             (event.year >= 1914 && event.year <= 1945 && (d.includes('war') || d.includes('battle')));
    };
    
    const filteredCandidates = candidates.filter(item => !isWW(item.event));
    
    if (filteredCandidates.length > 0) {
      console.log(`[Events] Filtered out ${candidates.length - filteredCandidates.length} WW1/WW2 events (limit reached)`);
      candidates = filteredCandidates;
    } else {
      console.log(`[Events] Warning: All candidates are WW1/WW2, but limit reached. Using lower-scored non-WW events.`);
      // Fallback to non-WW events even if lower scored
      candidates = scoredEvents.filter(item => !isWW(item.event) && item.score >= 20);
    }
  }
  
  if (iconicEvents.length > 0) {
    console.log(`[Events] Found ${iconicEvents.length} iconic events - prioritizing these`);
  }

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
    
    // Prioritize major events for daily posts (now async to check WW limit)
    const majorEvent = await selectMajorEvent(usableEvents);
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
    // Use major event selection for weekly threads too (now async)
    const majorEvent = await selectMajorEvent(usableEvents);
    const selectedEvent = majorEvent || selectRandomEvent(usableEvents);
    
    if (majorEvent) {
      const score = scoreEventMajority(majorEvent);
      console.log(`[Events] Selected major event for weekly thread (score: ${score})`);
    }

    return formatEvent(selectedEvent, date, true);

  } catch (err) {
    console.error("[Events ERROR]", err.message);
    throw err;
  }
}
