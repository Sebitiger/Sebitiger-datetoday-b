// viralContent.js
// Advanced content generators for viral historian persona

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";
import { postTweet, postThread, postTweetWithImage } from "./twitterClient.js";
import { fetchImageForText, fetchEventImage } from "./fetchImage.js";

const OPENAI_TIMEOUT = 60000; // 60 seconds for longer content

/**
 * Generate a "What If" alternate history scenario
 */
export async function generateWhatIfScenario() {
  const userPrompt = `
Create a compelling "What If" alternate history scenario that will go viral.

Requirements:
- Pick a real historical moment that could have changed everything
- Explore the alternate timeline realistically
- Make it thought-provoking and shareable
- Write as a 5-7 tweet thread
- Start with a hook: "What if [event] never happened?"
- Build suspense and show the ripple effects
- End with a question that sparks discussion
- NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
- Write naturally like a human, not like AI-generated content

Format each tweet on a new line, no numbering.

Generate a viral "What If" scenario now:
`;

  try {
    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 800,
        }),
        OPENAI_TIMEOUT
      );
    });

    const raw = completion.choices[0]?.message?.content || "";
    const tweets = raw
      .split("\n")
      .map(l => cleanAIContent(l.trim())) // Clean each tweet
      .filter(l => l.length > 0 && !l.match(/^Tweet \d+:/i))
      .slice(0, 7);

    if (tweets.length < 3) {
      throw new Error("Not enough tweets generated");
    }

    console.log("[Viral] Generated What If scenario with", tweets.length, "tweets");
    return tweets;
  } catch (err) {
    console.error("[Viral] Error generating What If:", err.message);
    return null;
  }
}

/**
 * Generate "Hidden Connections" - surprising links between events
 */
export async function generateHiddenConnection() {
  const userPrompt = `
Create a "Hidden Connection" tweet that reveals a surprising link between historical events.

Requirements:
- Find two seemingly unrelated events that happened around the same time
- Show the fascinating connection
- Make it shareable and "mind-blowing"
- Write as a single engaging tweet (under 270 chars to ensure complete sentences)
- Start with a hook: "The same year..." or "While X happened, Y was..."
- End with a thought-provoking insight
- CRITICAL: Complete your sentence - never cut off mid-sentence
- Always end with proper punctuation
- NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
- Write naturally like a human, not like AI-generated content

Generate a viral hidden connection now:
`;

  try {
    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 250,
        }),
        OPENAI_TIMEOUT
      );
    });

    let text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return null;
    }
    
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    
    // Ensure complete sentence
    if (text.length > 280) {
      // Smart truncation
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.'),
        text.lastIndexOf('!'),
        text.lastIndexOf('?')
      );
      if (lastSentenceEnd > text.length * 0.7) {
        text = text.slice(0, lastSentenceEnd + 1);
      } else {
        return null; // Can't truncate safely
      }
    }
    
    // Ensure it ends with punctuation
    const lastChar = text[text.length - 1];
    if (!['.', '!', '?', '…'].includes(lastChar)) {
      text = text.trim() + '.';
    }
    
    console.log("[Viral] Generated hidden connection");
    return text;
  } catch (err) {
    console.error("[Viral] Error generating connection:", err.message);
    return null;
  }
}

/**
 * Post a "What If" thread (viral content)
 */
export async function postWhatIfThread() {
  try {
    console.log("[Viral] Generating What If scenario...");
    const tweets = await generateWhatIfScenario();
    
    if (!tweets || tweets.length < 3) {
      throw new Error("Failed to generate What If scenario");
    }

    // Fetch an image based on the first tweet content (REQUIRED - retry until found)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 3;
    
    while (!imageBuffer && imageAttempts < maxImageAttempts) {
      try {
        console.log(`[Viral] Attempting to fetch image for What If thread (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
        imageBuffer = await fetchImageForText(tweets[0], true); // requireImage = true
        if (imageBuffer) {
          console.log("[Viral] Image fetched successfully for What If thread.");
          break;
        } else {
          console.warn(`[Viral] No image found on attempt ${imageAttempts + 1}, retrying...`);
          imageAttempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (imgErr) {
        console.error(`[Viral] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
        imageAttempts++;
        if (imageAttempts < maxImageAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!imageBuffer) {
      console.error("[Viral] CRITICAL: Could not fetch image for What If thread. Posting will fail.");
      throw new Error("Failed to fetch required image for What If thread");
    }

    await postThread(tweets, imageBuffer);
    console.log("[Viral] What If thread posted successfully");
  } catch (err) {
    console.error("[Viral] Error posting What If thread:", err.message);
  }
}

/**
 * Post a hidden connection tweet
 */
export async function postHiddenConnection() {
  try {
    console.log("[Viral] Generating hidden connection...");
    const tweet = await generateHiddenConnection();
    
    if (!tweet) {
      throw new Error("Failed to generate hidden connection");
    }

    // Fetch an image based on the tweet content (REQUIRED - retry until found)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 3;
    
    while (!imageBuffer && imageAttempts < maxImageAttempts) {
      try {
        console.log(`[Viral] Attempting to fetch image for hidden connection (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
        imageBuffer = await fetchImageForText(tweet, true); // requireImage = true
        if (imageBuffer) {
          console.log("[Viral] Image fetched successfully for hidden connection.");
          break;
        } else {
          console.warn(`[Viral] No image found on attempt ${imageAttempts + 1}, retrying...`);
          imageAttempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (imgErr) {
        console.error(`[Viral] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
        imageAttempts++;
        if (imageAttempts < maxImageAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!imageBuffer) {
      console.error("[Viral] CRITICAL: Could not fetch image for hidden connection. Posting will fail.");
      throw new Error("Failed to fetch required image for hidden connection");
    }

    await postTweetWithImage(tweet, imageBuffer, null);
    console.log("[Viral] Hidden connection posted successfully");
  } catch (err) {
    console.error("[Viral] Error posting hidden connection:", err.message);
  }
}

/**
 * Generate "Quick Fact" - short, shareable historical fact
 */
export async function generateQuickFact() {
  const userPrompt = `
Create a short, surprising historical fact that will go viral.

Requirements:
- Under 250 characters (to ensure complete sentences)
- Surprising or "mind-blowing"
- Shareable (makes people want to retweet)
- Educational
- Use 1 emoji max
- Start with a hook: "Did you know..." or "In [year]..." or "Fun fact:"
- CRITICAL: Complete your sentence - never cut off mid-sentence
- Always end with proper punctuation
- NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
- Write naturally like a human, not like AI-generated content

Example:
"In 1969, we landed on the moon using less computing power than your smartphone. The Apollo guidance computer had 64KB of memory. Your phone? Millions of times more powerful. 🤯"

Generate a viral quick fact now:
`;

  try {
    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 150,
        }),
        OPENAI_TIMEOUT
      );
    });

    let text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return null;
    }
    
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    
    // Ensure complete sentence
    if (text.length > 280) {
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.'),
        text.lastIndexOf('!'),
        text.lastIndexOf('?')
      );
      if (lastSentenceEnd > text.length * 0.7) {
        text = text.slice(0, lastSentenceEnd + 1);
      } else {
        return null;
      }
    }
    
    // Ensure it ends with punctuation
    const lastChar = text[text.length - 1];
    if (!['.', '!', '?', '…'].includes(lastChar)) {
      text = text.trim() + '.';
    }
    
    console.log("[Viral] Generated quick fact");
    return text;
  } catch (err) {
    console.error("[Viral] Error generating quick fact:", err.message);
    return null;
  }
}

/**
 * Post a quick fact
 */
export async function postQuickFact() {
  try {
    console.log("[Viral] Generating quick fact...");
    const tweet = await generateQuickFact();
    
    if (!tweet) {
      throw new Error("Failed to generate quick fact");
    }

    // Fetch an image based on the tweet content (REQUIRED - retry until found)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 3;
    
    while (!imageBuffer && imageAttempts < maxImageAttempts) {
      try {
        console.log(`[Viral] Attempting to fetch image for quick fact (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
        imageBuffer = await fetchImageForText(tweet, true); // requireImage = true
        if (imageBuffer) {
          console.log("[Viral] Image fetched successfully for quick fact.");
          break;
        } else {
          console.warn(`[Viral] No image found on attempt ${imageAttempts + 1}, retrying...`);
          imageAttempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (imgErr) {
        console.error(`[Viral] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
        imageAttempts++;
        if (imageAttempts < maxImageAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!imageBuffer) {
      console.error("[Viral] CRITICAL: Could not fetch image for quick fact. Posting will fail.");
      throw new Error("Failed to fetch required image for quick fact");
    }

    await postTweetWithImage(tweet, imageBuffer, null);
    console.log("[Viral] Quick fact posted successfully");
  } catch (err) {
    console.error("[Viral] Error posting quick fact:", err.message);
  }
}

/**
 * Generate "Debunking History" tweet
 */
export async function generateHistoryDebunk() {
  const userPrompt = `
Create a "Debunking History" tweet that corrects a popular misconception.

Requirements:
- Pick a well-known historical "fact" that's actually wrong
- Explain the truth clearly
- Make it shareable (people love being "in the know")
- Write as a single tweet (under 270 chars to ensure complete sentences)
- Start with: "History myth:" or "Actually..." or "Here's the truth about..."
- Be engaging and educational
- CRITICAL: Complete your sentence - never cut off mid-sentence
- Always end with proper punctuation
- NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
- Write naturally like a human, not like AI-generated content

Generate a viral history debunk now:
`;

  try {
    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 250,
        }),
        OPENAI_TIMEOUT
      );
    });

    let text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return null;
    }
    
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    
    // Ensure complete sentence
    if (text.length > 280) {
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.'),
        text.lastIndexOf('!'),
        text.lastIndexOf('?')
      );
      if (lastSentenceEnd > text.length * 0.7) {
        text = text.slice(0, lastSentenceEnd + 1);
      } else {
        return null;
      }
    }
    
    // Ensure it ends with punctuation
    const lastChar = text[text.length - 1];
    if (!['.', '!', '?', '…'].includes(lastChar)) {
      text = text.trim() + '.';
    }
    
    console.log("[Viral] Generated history debunk");
    return text;
  } catch (err) {
    console.error("[Viral] Error generating debunk:", err.message);
    return null;
  }
}

/**
 * Post a history debunk
 */
export async function postHistoryDebunk() {
  try {
    console.log("[Viral] Generating history debunk...");
    const tweet = await generateHistoryDebunk();
    
    if (!tweet) {
      throw new Error("Failed to generate history debunk");
    }

    // Fetch an image based on the tweet content (REQUIRED - retry until found)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 3;
    
    while (!imageBuffer && imageAttempts < maxImageAttempts) {
      try {
        console.log(`[Viral] Attempting to fetch image for history debunk (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
        imageBuffer = await fetchImageForText(tweet, true); // requireImage = true
        if (imageBuffer) {
          console.log("[Viral] Image fetched successfully for history debunk.");
          break;
        } else {
          console.warn(`[Viral] No image found on attempt ${imageAttempts + 1}, retrying...`);
          imageAttempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (imgErr) {
        console.error(`[Viral] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
        imageAttempts++;
        if (imageAttempts < maxImageAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!imageBuffer) {
      console.error("[Viral] CRITICAL: Could not fetch image for history debunk. Posting will fail.");
      throw new Error("Failed to fetch required image for history debunk");
    }

    await postTweetWithImage(tweet, imageBuffer, null);
    console.log("[Viral] History debunk posted successfully");
  } catch (err) {
    console.error("[Viral] Error posting history debunk:", err.message);
  }
}

