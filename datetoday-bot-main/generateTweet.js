// generateTweet.js

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";

const OPENAI_TIMEOUT = 30000; // 30 seconds

export async function generateMainTweet(event) {
  const { year, description, monthName, day } = event;

  const userPrompt = `
You are "The Archive" – a grandmaster historian.

Event description:
${description}
Year: ${year}

Write the main tweet of a pair. This tweet only names the moment, the reply will explain it.

Requirements:
- Start with the date line exactly: "🗓️ ${monthName} ${day}, ${year}".
- Second line: a concise event name (no more than 6–8 words), neutral and factual.
- Under 140 characters total, no extra emojis, no hashtags, no questions.
- Do not explain causes or consequences here, only label the moment.
- Be historically accurate, never invent facts.
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead.
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

    let text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("Empty main tweet from OpenAI");
    }
    
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    
    // Ensure text is complete (ends with punctuation or is clearly finished)
    if (text.length > 270) {
      console.warn("[OpenAI] Generated tweet is too long, truncating intelligently...");
      // The validateTweetText function will handle smart truncation
    }
    
    // Check if text ends mid-sentence (no ending punctuation)
    const lastChar = text[text.length - 1];
    if (!['.', '!', '?', '…', ':', ')', '"', "'"].includes(lastChar) && text.length > 50) {
      // If it seems cut off, try to complete it
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.'),
        text.lastIndexOf('!'),
        text.lastIndexOf('?')
      );
      if (lastSentenceEnd > text.length * 0.7) {
        text = text.slice(0, lastSentenceEnd + 1);
      } else {
        text = text.trim() + '…';
      }
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

