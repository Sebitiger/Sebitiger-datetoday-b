// viralContent.js
// Unified viral content using refactored system

import { 
  postQuickFact as postQuickFactNew, 
  postWhatIf as postWhatIfNew, 
  postHiddenConnection as postHiddenConnectionNew, 
  postHistoryDebunk as postHistoryDebunkNew 
} from "./src/index.js";

export async function postQuickFact() {
  try {
    const tweetId = await postQuickFactNew();
    console.log(`[Viral] ✅ Quick fact posted (ID: ${tweetId})`);
    return tweetId;
  } catch (err) {
    console.error("[Viral] ❌ Quick fact failed:", err.message);
    throw err;
  }
}

export async function postWhatIfThread() {
  try {
    const tweetId = await postWhatIfNew();
    console.log(`[Viral] ✅ What If thread posted (ID: ${tweetId})`);
    return tweetId;
  } catch (err) {
    console.error("[Viral] ❌ What If thread failed:", err.message);
    throw err;
  }
}

export async function postHiddenConnection() {
  try {
    const tweetId = await postHiddenConnectionNew();
    console.log(`[Viral] ✅ Hidden connection posted (ID: ${tweetId})`);
    return tweetId;
  } catch (err) {
    console.error("[Viral] ❌ Hidden connection failed:", err.message);
    throw err;
  }
}

export async function postHistoryDebunk() {
  try {
    const tweetId = await postHistoryDebunkNew();
    console.log(`[Viral] ✅ History debunk posted (ID: ${tweetId})`);
    return tweetId;
  } catch (err) {
    console.error("[Viral] ❌ History debunk failed:", err.message);
    throw err;
  }
}

