// generateTweet.js

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff } from "./utils.js";

const OPENAI_TIMEOUT = 30000; // 30 seconds

export async function generateMainTweet(event) {
  const { year, description, monthName, day } = event;

  const userPrompt = `
You are "The Archive" - a time-traveling historian telling a story about this historical moment.

Event:
${description}

Create an engaging, viral-worthy tweet about this event. Make it:
- Hook readers immediately with a surprising fact or question
- Tell a story, not just state facts
- Show your personality and passion
- Connect to why it matters today
- Make people want to share it

Structure (2-4 lines):
Line 1: "🗓️ ${monthName} ${day}, ${year}" - but make it engaging, not just a date
Line 2: The main event - but tell it as a story with emotion and context
Line 3 (optional): A surprising detail, connection, or "what if" moment
Line 4 (optional): Why it matters today or a thought-provoking question

Examples of good hooks:
- "This moment changed everything..."
- "While most people were doing X, this happened..."
- "The decision that led to..."
- "What if this never happened?"

Rules:
- Be historically accurate - never invent facts
- Use 1-2 emojis max (sparingly)
- Make it shareable - include a "wow" moment
- Show personality - be memorable
- Ask a question or make a connection to engage readers
- Keep under 280 characters total
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
          temperature: 0.5,
          max_tokens: 220,
        }),
        OPENAI_TIMEOUT
      );
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("Empty main tweet from OpenAI");
    }
    console.log("[OpenAI] Main tweet generated successfully");
    return text;
  } catch (err) {
    console.error("[OpenAI main tweet error]", err.message || err);
    // Safe fallback
    const fallback = `🗓️ On this day : ${monthName} ${day}, ${year}
📜 ${description}`;
    console.log("[OpenAI] Using fallback tweet");
    return fallback;
  }
}

