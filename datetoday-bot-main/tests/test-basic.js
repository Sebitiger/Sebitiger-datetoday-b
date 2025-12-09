// test-basic.js
// Basic unit tests for core functions

import { describe, it, assert } from "./test-framework.js";
import { validateTweetText } from "../twitterClient.js";
import { createEventId } from "../database.js";
import { containsSensitiveContent } from "../moderation.js";

// Simple test framework
export function runTests() {
  console.log("Running basic tests...\n");

  let passed = 0;
  let failed = 0;

  // Test tweet validation
  console.log("Testing tweet validation...");
  try {
    const shortTweet = "Hello world";
    const result = validateTweetText(shortTweet);
    assert(result === shortTweet, "Short tweet should pass");
    passed++;
    console.log("✅ Tweet validation: PASSED");
  } catch (err) {
    failed++;
    console.log("❌ Tweet validation: FAILED -", err.message);
  }

  // Test long tweet truncation
  try {
    const longTweet = "a".repeat(300);
    const result = validateTweetText(longTweet);
    assert(result.length <= 280, "Long tweet should be truncated");
    passed++;
    console.log("✅ Tweet truncation: PASSED");
  } catch (err) {
    failed++;
    console.log("❌ Tweet truncation: FAILED -", err.message);
  }

  // Test event ID creation
  console.log("\nTesting event ID creation...");
  try {
    const event = {
      year: 1969,
      monthName: "July",
      day: 20,
      description: "Apollo 11 moon landing",
    };
    const id = createEventId(event);
    assert(typeof id === "string", "Event ID should be a string");
    assert(id.length > 0, "Event ID should not be empty");
    passed++;
    console.log("✅ Event ID creation: PASSED");
  } catch (err) {
    failed++;
    console.log("❌ Event ID creation: FAILED -", err.message);
  }

  // Test content moderation
  console.log("\nTesting content moderation...");
  try {
    const safeContent = "On this day in 1969, Apollo 11 landed on the moon.";
    const check = containsSensitiveContent(safeContent);
    assert(check.hasSensitive === false, "Safe content should not be flagged");
    passed++;
    console.log("✅ Safe content check: PASSED");
  } catch (err) {
    failed++;
    console.log("❌ Safe content check: FAILED -", err.message);
  }

  try {
    const sensitiveContent = "The holocaust was a genocide.";
    const check = containsSensitiveContent(sensitiveContent);
    assert(check.hasSensitive === true, "Sensitive content should be flagged");
    passed++;
    console.log("✅ Sensitive content check: PASSED");
  } catch (err) {
    failed++;
    console.log("❌ Sensitive content check: FAILED -", err.message);
  }

  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}\n`);

  return { passed, failed, total: passed + failed };
}

// Simple test framework helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}


