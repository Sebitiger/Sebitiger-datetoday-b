import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";

const OPENAI_TIMEOUT = 60000; // 60 seconds for longer threads

  export async function generateWeeklyThread(event) {
    const { year, description, wikipediaTitle } = event;
    const base = `${year}: ${description}${wikipediaTitle ? " (Related: " + wikipediaTitle + ")" : ""}`;

    const userPrompt = `
You are writing a Twitter thread for DateToday about a MAJOR historical event - a significant moment that shaped history.

This is a BIG EVENT - focus on its SIGNIFICANCE, IMPACT, and why it MATTERED.

Event:
${base}

CRITICAL: This is a MAJOR historical event. Emphasize:
- The SIGNIFICANCE of this moment - why it was a big deal
- The IMPACT - how it changed history
- The IMPORTANCE - why people should remember this
- The STORY - make it memorable and educational
- The "OH WOW" factor - make people recall this important moment

Write a 5-7 tweet thread about this MAJOR historical event.
Each tweet:
- 1-2 short sentences
- Focus on the SIGNIFICANCE and IMPACT of this major event
- Make it educational - teach about important history
- no emojis, no hashtags
- must stand alone but also flow with the others
- NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
- Write naturally like a human, not like AI-generated content

Structure:
1) Hook: why this MAJOR event is significant and important - a big moment in history.
2) Context: what led to this significant moment.
3) The moment itself - the BIG EVENT that happened.
4) A hidden or lesser-known detail about this major event.
5) The consequence - how this significant event changed history.
6) Optional twist or human angle about this important moment.
7) Optional closing reflection on the significance of this major event.

Output format:
Write each tweet on its own line, with no numbering and no extra text.
`;

    try {
      const completion = await retryWithBackoff(async () => {
        return await withTimeout(
          openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 600,
          }),
          OPENAI_TIMEOUT
        );
      });

      const raw = completion.choices[0]?.message?.content || "";
      const lines = raw
        .split("\n")
        .map(l => cleanAIContent(l.trim())) // Clean each tweet
        .filter(Boolean);

      const tweets = lines.slice(0, 7); // safety limit
      if (!tweets.length) {
        throw new Error("No tweets parsed from OpenAI response");
      }
      console.log("[OpenAI] Generated weekly thread with", tweets.length, "tweets.");
      return tweets;
    } catch (err) {
      console.error("[OpenAI] Error generating weekly thread:", err.message || err);
      return [
        "History is full of weeks that quietly changed everything. This was one of them.",
        "DateToday had trouble generating the usual deep dive, but the lesson remains: small decisions can echo for centuries."
      ];
    }
  }
