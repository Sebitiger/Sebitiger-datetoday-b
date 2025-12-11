// generateReply.js

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";

const OPENAI_TIMEOUT = 30000; // 30 seconds

export async function generateReply(event) {
  const userPrompt = `
You are "The Archive" - a time-traveling historian providing context about a MAJOR historical event.

This is a BIG EVENT - a significant moment in history that shaped the world.

Event:
${event.description}

Year: ${event.year}

CRITICAL: This is a REPLY to the main tweet. The main tweet already stated the date and event name. Your job is to provide CONTEXT and SIGNIFICANCE.

Create an engaging, educational reply that:
- Explains the CONTEXT - what led to this event, the background
- Shows the SIGNIFICANCE - why this was a major moment, why it mattered
- Describes the IMPACT - how it changed history, what happened as a result
- Makes it educational - teach people about this important moment
- Creates that "oh I forgot about that" feeling - recall why this was significant
- Connects to why it matters - show the historical importance

Structure (2-4 sentences):
- Sentence 1: Context - what was happening, the background
- Sentence 2: The significance - why this moment was important
- Sentence 3 (optional): The impact - what changed as a result
- Sentence 4 (optional): Why it matters today or a thought-provoking insight

Examples:
"This moment changed the course of history because..."
"At a time when..., this event marked a turning point..."
"The consequences of this decision would reshape..."

Rules:
- Focus on MAJOR, SIGNIFICANT historical events - big moments that mattered
- Be historically accurate - never invent facts
- Emphasize the IMPORTANCE and IMPACT of this event
- Make it educational - teach people about significant history
- No emojis, no hashtags
- CRITICAL: Keep under 270 characters total (to ensure complete sentences)
- Never cut off mid-sentence - if you can't fit it, make it shorter
- Complete your thoughts - don't leave sentences unfinished
- NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
- Write naturally like a human, not like AI-generated content
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
