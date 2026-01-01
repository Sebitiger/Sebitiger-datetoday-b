/**
 * Test different ways to access Wikipedia API
 */

import axios from 'axios';

async function testDifferentApproaches() {
  console.log("=== TESTING DIFFERENT WIKIPEDIA ACCESS METHODS ===\n");

  // Test 1: Without origin parameter
  console.log("Test 1: Without 'origin' parameter");
  try {
    const res = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: {
        action: "query",
        list: "search",
        srsearch: "Apollo 11",
        format: "json",
        srlimit: 1,
        // NO origin parameter
      },
      headers: {
        'User-Agent': 'DateTodayBot/1.0 (Educational use; contact@example.com)',
      },
      timeout: 10000,
    });
    console.log("✅ SUCCESS! Found pages:", res.data?.query?.search?.length || 0);
    return true;
  } catch (error) {
    console.log("❌ FAILED:", error.message);
    if (error.response?.data) {
      console.log("   Response:", error.response.data);
    }
  }

  // Test 2: With JSONP callback
  console.log("\nTest 2: With callback (JSONP)");
  try {
    const res = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: {
        action: "query",
        list: "search",
        srsearch: "Apollo 11",
        format: "json",
        callback: "?",
        srlimit: 1,
      },
      headers: {
        'User-Agent': 'DateTodayBot/1.0 (Educational use; contact@example.com)',
      },
      timeout: 10000,
    });
    console.log("✅ SUCCESS!");
    return true;
  } catch (error) {
    console.log("❌ FAILED:", error.message);
  }

  // Test 3: Different User-Agent
  console.log("\nTest 3: With browser User-Agent");
  try {
    const res = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: {
        action: "query",
        list: "search",
        srsearch: "Apollo 11",
        format: "json",
        srlimit: 1,
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 10000,
    });
    console.log("✅ SUCCESS! Found pages:", res.data?.query?.search?.length || 0);
    return true;
  } catch (error) {
    console.log("❌ FAILED:", error.message);
  }

  console.log("\n❌ ALL METHODS FAILED - Wikipedia API is blocked in this environment");
  console.log("\nThis explains why images aren't uploading!");
  console.log("Solution: Use alternative image sources or run in different environment");

  return false;
}

testDifferentApproaches();
