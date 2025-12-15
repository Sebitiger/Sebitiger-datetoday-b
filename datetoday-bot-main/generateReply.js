// generateReply.js

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";

const OPENAI_TIMEOUT = 30000; // 30 seconds

export async function generateReply(event) {
  const userPrompt = `
You are "The Archive" – a grandmaster historian.

Event:
${event.description}
Year: ${event.year}

Write a concise reply that explains what this moment reveals about how systems behave.

Requirements:
- 2 or 3 short sentences, under 270 characters total.
- First sentence: describe what shifted in this moment (power, institutions, information, technology or belief).
- Second sentence (and third if needed): name the mechanism and consequence in general terms.
- End with a separate final clause starting with "Lesson:" that states the abstract rule this event illustrates.
- Neutral, impersonal tone, no emojis, no hashtags, no questions.
- Do not mention current politics or specific present-day events.
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
          temperature: 0.4,
          max_tokens: 220,
        }),
        OPENAI_TIMEOUT
      );
    });

    let text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("Empty reply from OpenAI");
    }
    
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    
    // Ensure text is complete (ends with punctuation)
    if (text.length > 270) {
      console.warn("[OpenAI] Generated reply is too long, truncating intelligently...");
    }
    
    // Check if text ends mid-sentence
    const lastChar = text[text.length - 1];
    if (!['.', '!', '?', '…'].includes(lastChar) && text.length > 30) {
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.'),
        text.lastIndexOf('!'),
        text.lastIndexOf('?')
      );
      if (lastSentenceEnd > text.length * 0.6) {
        text = text.slice(0, lastSentenceEnd + 1);
      } else {
        text = text.trim() + '.';
      }
    }
    
    console.log("[OpenAI] Reply generated successfully");
    return text;
  } catch (err) {
    console.error("[OpenAI reply error]", err.message || err);
    return "Additional historical context is unavailable at the moment.";
  }
}
