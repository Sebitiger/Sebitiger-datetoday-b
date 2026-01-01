/**
 * Standalone test script to debug image fetching
 * Usage: node test-image-fetch.js
 */

import { fetchVerifiedImage } from "./verification/imageVerifier.js";
import { getRandomEvent } from "./fetchEvents.js";

async function testImageFetch() {
  console.log("=== IMAGE FETCH TEST ===\n");

  try {
    // Get a random event
    console.log("Fetching random historical event...");
    const event = await getRandomEvent();

    console.log("\n📅 Event Details:");
    console.log("Year:", event.year);
    console.log("Description:", event.description);
    console.log("Month/Day:", event.monthName, event.day);
    console.log("\n" + "=".repeat(60) + "\n");

    // Try to fetch an image
    console.log("Attempting to fetch verified image...\n");
    const imageBuffer = await fetchVerifiedImage(event, event.description);

    console.log("\n" + "=".repeat(60));
    console.log("\n🎯 FINAL RESULT:");
    if (imageBuffer) {
      console.log("✅ SUCCESS! Image fetched");
      console.log("   Buffer size:", (imageBuffer.length / 1024).toFixed(2), "KB");
      console.log("   Is Buffer?:", Buffer.isBuffer(imageBuffer));
    } else {
      console.log("❌ FAILED! No image returned");
      console.log("   This means the function returned null");
    }
    console.log("\n" + "=".repeat(60) + "\n");

  } catch (error) {
    console.error("\n💥 ERROR:", error.message);
    console.error("\nStack trace:");
    console.error(error.stack);
  }
}

testImageFetch();
