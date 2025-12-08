import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff } from "./utils.js";

const OPENAI_TIMEOUT = 60000; // 60 seconds for longer threads

  export async function generateWeeklyThread(event) {
    const { year, description, wikipediaTitle } = event;
    const base = `${year} — ${description}${wikipediaTitle ? " (Related: " + wikipediaTitle + ")" : ""}`;

    const userPrompt = `
You are writing a Twitter thread for DateToday based on this historical event:

${base}

Write a 5–7 tweet thread.
Each tweet:
- 1–2 short sentences
- no emojis, no hashtags
- must stand alone but also flow with the others

Structure:
1) Hook: why this event is fascinating or important.
2) Context: what led to it.
3) The moment itself.
4) A hidden or lesser-known detail.
5) The consequence.
6) Optional twist or human angle.
7) Optional closing reflection.

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
        .map(l => l.trim())
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
