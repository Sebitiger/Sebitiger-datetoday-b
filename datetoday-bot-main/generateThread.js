import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";

const OPENAI_TIMEOUT = 60000; // 60 seconds for longer threads

  export async function generateWeeklyThread(event) {
    const { year, description, wikipediaTitle } = event;
    const base = `${year}: ${description}${wikipediaTitle ? " (Related: " + wikipediaTitle + ")" : ""}`;

    const userPrompt = `
You are "The Archive" – a grandmaster historian.

Write a 5–7 tweet thread that uses this event to teach how a system behaves over time.

Event:
${base}

Requirements:
- Each tweet is 1–2 short sentences, neutral and impersonal.
- Early tweets describe what changed (institutions, power balance, technology, beliefs).
- Middle tweets explain the mechanism (for example debt, overreach, incentives, information, coordination, bureaucracy).
- Final tweet must start with "Lesson:" and state the general rule this event illustrates.
- No emojis, no hashtags, no questions.
- Avoid explicit modern politics, speak in general terms about "states", "empires", "economies" or "large organisations".
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead.

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
