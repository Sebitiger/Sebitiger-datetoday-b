/**
 * Test alternative image sources that might work
 */

import axios from 'axios';

async function testAlternativeSources() {
  console.log("=== TESTING ALTERNATIVE IMAGE SOURCES ===\n");

  // Test 1: Unsplash (no API key needed for basic access)
  console.log("Test 1: Unsplash API");
  try {
    const res = await axios.get("https://api.unsplash.com/search/photos", {
      params: {
        query: "history",
        per_page: 1,
      },
      headers: {
        'Accept-Version': 'v1',
      },
      timeout: 10000,
    });
    console.log("✅ Unsplash accessible! Found:", res.data?.results?.length || 0, "results");
    if (res.data?.results?.[0]?.urls?.regular) {
      console.log("   Image URL:", res.data.results[0].urls.regular.slice(0, 60) + "...");
    }
  } catch (error) {
    console.log("❌ Unsplash failed:", error.message);
    if (error.response?.status === 401) {
      console.log("   (401 = needs API key, but at least it's accessible)");
    }
  }

  // Test 2: Wikimedia Commons (different from Wikipedia API)
  console.log("\nTest 2: Wikimedia Commons");
  try {
    const res = await axios.get("https://commons.wikimedia.org/w/api.php", {
      params: {
        action: "query",
        list: "search",
        srsearch: "Apollo 11",
        srnamespace: 6,
        format: "json",
        srlimit: 1,
      },
      headers: {
        'User-Agent': 'DateTodayBot/1.0',
      },
      timeout: 10000,
    });
    console.log("✅ Wikimedia Commons accessible! Found:", res.data?.query?.search?.length || 0, "results");
  } catch (error) {
    console.log("❌ Wikimedia Commons failed:", error.message);
    if (error.response?.data) {
      console.log("   Response:", error.response.data);
    }
  }

  // Test 3: Direct image URL test (bypass APIs)
  console.log("\nTest 3: Direct image download from Wikimedia");
  try {
    const testUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Apollo_11_Launch_-_GPN-2000-000630.jpg/800px-Apollo_11_Launch_-_GPN-2000-000630.jpg";
    const res = await axios.get(testUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
    });
    const buffer = Buffer.from(res.data);
    console.log("✅ Direct image download works! Size:", (buffer.length / 1024).toFixed(2), "KB");
  } catch (error) {
    console.log("❌ Direct download failed:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("RECOMMENDATION:");
  console.log("Since Wikipedia API is blocked, switch to:");
  console.log("1. Direct Wikimedia image URLs (if we know the URLs)");
  console.log("2. Unsplash with API key");
  console.log("3. Pexels with API key");
  console.log("4. Pre-curated image database");
  console.log("=".repeat(60));
}

testAlternativeSources();
