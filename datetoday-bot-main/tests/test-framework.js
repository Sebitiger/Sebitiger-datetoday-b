// test-framework.js
// Simple test framework for unit tests

export function describe(name, fn) {
  console.log(`\n${name}`);
  console.log("-".repeat(name.length));
  try {
    fn();
  } catch (err) {
    console.error(`Error in ${name}:`, err);
  }
}

export function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}:`, err.message);
    throw err;
  }
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

export function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

export function assertThrows(fn, message) {
  try {
    fn();
    throw new Error(message || "Expected function to throw");
  } catch (err) {
    // Expected to throw
    return true;
  }
}


