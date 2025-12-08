// viralContent.js
// Advanced content generators for viral historian persona

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff } from "./utils.js";
import { postTweet, postThread } from "./twitterClient.js";

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
      .map(l => l.trim())
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
- Write as a single engaging tweet (under 280 chars)
- Start with a hook: "The same year..." or "While X happened, Y was..."
- End with a thought-provoking insight

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

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text || text.length > 280) {
      return null;
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

    await postThread(tweets);
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

    await postTweet(tweet);
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
- Under 200 characters
- Surprising or "mind-blowing"
- Shareable (makes people want to retweet)
- Educational
- Use 1 emoji max
- Start with a hook: "Did you know..." or "In [year]..." or "Fun fact:"

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

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text || text.length > 200) {
      return null;
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

    await postTweet(tweet);
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
- Write as a single tweet (under 280 chars)
- Start with: "History myth:" or "Actually..." or "Here's the truth about..."
- Be engaging and educational

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

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text || text.length > 280) {
      return null;
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

    await postTweet(tweet);
    console.log("[Viral] History debunk posted successfully");
  } catch (err) {
    console.error("[Viral] Error posting history debunk:", err.message);
  }
}

