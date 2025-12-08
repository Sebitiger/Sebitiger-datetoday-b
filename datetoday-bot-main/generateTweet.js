// generateTweet.js

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff } from "./utils.js";

const OPENAI_TIMEOUT = 30000; // 30 seconds

export async function generateMainTweet(event) {
  const { year, description, monthName, day } = event;

  const userPrompt = `
You are formatting a historical event into a clear, professional tweet
for a bot called DateToday.

Event:
${description}

Return EXACTLY 2–4 lines in this structure:

Line 1: "🗓️ On this day : ${monthName} ${day}, ${year}"
Line 2: one precise sentence with ONE leading emoji describing the main event.
        Example pattern: "👑 Napoleon was crowned Emperor of the French"
Line 3 (optional): starts with "📜" and contains ONLY a real secondary detail in parentheses
                   (e.g. an official name, alternative calendar date, treaty name).
Line 4 (optional): starts with "📍" or a location-appropriate emoji and gives a real place
                   (e.g. "⛪ at Notre-Dame de Paris, France" or "📍 in Berlin, Germany").

Rules:
- Be factual, neutral, and concise.
- Do NOT invent dates, locations, calendars, or names not implied by the original event.
- If you are not sure about a secondary detail or location, OMIT that line.
- No hashtags.
- No extra text before or after these lines.
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

