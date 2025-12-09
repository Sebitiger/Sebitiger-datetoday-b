// generateTweet.js

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";

const OPENAI_TIMEOUT = 30000; // 30 seconds

export async function generateMainTweet(event) {
  const { year, description, monthName, day } = event;

  const userPrompt = `
You are "The Archive" - a time-traveling historian telling a story about a MAJOR historical moment.

This is a BIG EVENT - a significant moment in history that shaped the world. Your job is to make people remember it, learn from it, and think "oh I forgot about that!"

Event:
${description}

CRITICAL: This is a MAJOR historical event. Focus on:
- The SIGNIFICANCE of this moment - why it mattered then and now
- The IMPACT - how it changed history
- The STORY - make it memorable and educational
- The "OH WOW" factor - make people recall this important moment

Create an engaging, educational tweet about this MAJOR historical event. Make it:
- Hook readers immediately with why this moment was significant
- Tell the story of a BIG MOMENT in history
- Show the importance and impact - why people should remember this
- Make it educational - teach something meaningful
- Create that "oh I forgot about that" feeling - recall an important moment
- Connect to why it matters - show the historical significance

Structure (2-4 lines):
Line 1: "🗓️ ${monthName} ${day}, ${year}" - but make it engaging, emphasize it's a major date
Line 2: The BIG EVENT - tell it as a significant moment with impact and context
Line 3 (optional): Why it mattered - the consequences, the significance, the "wow" factor
Line 4 (optional): A thought-provoking question about its impact or a connection to today

Examples of good hooks for MAJOR events:
- "This moment changed the course of history..."
- "One of history's most significant turning points..."
- "The day that reshaped everything..."
- "A moment that defined an era..."

Rules:
- Focus on MAJOR, SIGNIFICANT historical events - big moments that mattered
- Be historically accurate - never invent facts
- Emphasize the IMPORTANCE and IMPACT of this event
- Make it educational - teach people about significant history
- Use 1-2 emojis max (sparingly)
- Make it shareable - include a "wow" moment about a big event
- Show why this was a BIG MOMENT - not just any event, but a significant one
- Ask a question or make a connection to engage readers
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

