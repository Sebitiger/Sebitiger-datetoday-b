// fetchEvents.js
// Fetches today's historical events from ByAbbe API
// and returns ONE random clean event.

import axios from "axios";

// Default timeout for API calls (10 seconds)
const API_TIMEOUT = 10000;

/**
 * Filters events to remove low-quality or unwanted entries
 */
function filterEvents(events) {
  return events.filter((ev) => {
    const desc = ev.description.toLowerCase();

    return (
      desc.length > 40 &&
      !desc.includes("election") &&
      !desc.includes("football") &&
      !desc.includes("soccer") &&
      !desc.includes("governor") &&
      !desc.includes("premier league")
    );
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
 * Selects a random event from the array
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
    const randomEvent = selectRandomEvent(usableEvents);

    return formatEvent(randomEvent, date, false);

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
