/**
 * Test if Wikipedia API is accessible and working
 */

import axios from 'axios';

async function testWikipediaAPI() {
  console.log("=== WIKIPEDIA API TEST ===\n");

  try {
    // Test 1: Simple search
    console.log("Test 1: Simple Wikipedia search for 'Apollo 11'");
    const searchRes = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: {
        action: "query",
        list: "search",
        srsearch: "Apollo 11",
        format: "json",
        srlimit: 3,
        origin: "*",
      },
      timeout: 10000,
    });

    const pages = searchRes.data?.query?.search || [];
    console.log(`✅ Found ${pages.length} pages`);
    pages.forEach((page, i) => {
      console.log(`   ${i + 1}. ${page.title} (pageid: ${page.pageid})`);
    });

    if (pages.length === 0) {
      console.log("❌ PROBLEM: Wikipedia search returned no results!");
      return;
    }

    // Test 2: Get image from first page
    console.log("\nTest 2: Fetching image from first page");
    const pageId = pages[0].pageid;
    const pageInfoRes = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: {
        action: "query",
        pageids: pageId,
        prop: "pageimages",
        pithumbsize: 1200,
        format: "json",
        origin: "*",
      },
      timeout: 10000,
    });

    const pageInfo = pageInfoRes.data?.query?.pages?.[pageId];
    const imageUrl = pageInfo?.thumbnail?.source;

    if (imageUrl) {
      console.log(`✅ Found image URL: ${imageUrl}`);

      // Test 3: Download the image
      console.log("\nTest 3: Downloading image");
      const imgRes = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 15000,
      });

      const buffer = Buffer.from(imgRes.data);
      console.log(`✅ Downloaded image: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`   Is Buffer?: ${Buffer.isBuffer(buffer)}`);

      console.log("\n✅ ALL TESTS PASSED - Wikipedia API is working!");
    } else {
      console.log("⚠️  Page has no image");
      console.log("   This means Wikipedia found the page but it has no thumbnail");
    }

  } catch (error) {
    console.error("\n❌ TEST FAILED!");
    console.error("Error:", error.message);
    if (error.code) console.error("Code:", error.code);
    if (error.response) {
      console.error("HTTP Status:", error.response.status);
      console.error("Response:", error.response.data);
    }
  }
}

testWikipediaAPI();
