// generateReply.js

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff } from "./utils.js";

const OPENAI_TIMEOUT = 30000; // 30 seconds

export async function generateReply(event) {
  const userPrompt = `
Write a concise historian-style explanation (1–3 sentences)
giving context and significance for this event:

"${event.description}"

Rules:
- Neutral, factual, educational.
- No emojis.
- No hashtags.
- No invented details.
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
          temperature: 0.4,
          max_tokens: 220,
        }),
        OPENAI_TIMEOUT
      );
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("Empty reply from OpenAI");
    }
    console.log("[OpenAI] Reply generated successfully");
    return text;
  } catch (err) {
    console.error("[OpenAI reply error]", err.message || err);
    return "Additional historical context is unavailable at the moment.";
  }
}
