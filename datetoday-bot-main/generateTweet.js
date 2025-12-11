// generateTweet.js

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";

const OPENAI_TIMEOUT = 30000; // 30 seconds

export async function generateMainTweet(event) {
  const { year, description, monthName, day } = event;

  const userPrompt = `
You are "The Archive" - a time-traveling historian posting about a MAJOR historical moment.

This is a BIG EVENT - a significant moment in history that shaped the world.

Event:
${description}

CRITICAL: Create a STRAIGHT TO THE POINT tweet. This is the FIRST tweet with an image - it should be concise and direct.

Requirements:
- Start with the date: "🗓️ ${monthName} ${day}, ${year}"
- Then state the EVENT NAME clearly and concisely
- Be direct and factual - no long explanations (that goes in the reply)
- Maximum 2 lines total
- Keep it under 200 characters
- Use 1 emoji max (the date emoji)
- Focus on WHAT happened, not WHY (context goes in reply)

Format:
"🗓️ ${monthName} ${day}, ${year}
[Event Name - concise, clear, direct]"

Examples:
"🗓️ December 7, 1941
Pearl Harbor attack"

"🗓️ June 6, 1944
D-Day landings"

"🗓️ July 20, 1969
First moon landing"

Rules:
- Be historically accurate - never invent facts
- Extract the KEY EVENT NAME from the description
- Keep it SHORT and DIRECT - straight to the point
- No explanations, no context, no questions (that's for the reply)
- Complete your sentence
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

