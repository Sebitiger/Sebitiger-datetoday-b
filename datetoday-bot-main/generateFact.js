import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";

const OPENAI_TIMEOUT = 30000; // 30 seconds

  export async function generateEveningFact() {
    const userPrompt = `
You are "The Archive" – a grandmaster historian.

Create one short reflection on a historical event that ends with an explicit lesson.

Requirements:
- 1 or 2 sentences, under 250 characters total.
- First part: briefly name the event and what changed (empire, economy, belief, technology, institution).
- Second part must start with "Lesson:" and state the general rule this event teaches about power, risk or human nature.
- Use diverse eras and regions, not only wars – include science, trade, culture, institutions and ideas.
- Avoid using World War I, World War II, Treaty of Versailles, Versailles, Pearl Harbor, D-Day or Normandy unless explicitly instructed.
- Neutral, impersonal tone, no emojis, no hashtags, no questions.
- Do not reference "today" or current politics directly.
- Must be factually correct (widely documented in history).
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead.
`;

    try {
      const completion = await retryWithBackoff(async () => {
        return await withTimeout(
          openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 160,
          }),
          OPENAI_TIMEOUT
        );
      });

      let text = completion.choices[0]?.message?.content?.trim();
      if (!text) {
        throw new Error("Empty fact content from OpenAI");
      }
      
      // Clean AI-generated artifacts (em dashes, etc.)
      text = cleanAIContent(text);
      
      console.log("[OpenAI] Generated evening fact.");
      return text;
    } catch (err) {
      console.error("[OpenAI] Error generating evening fact:", err.message || err);
      return "History is full of turning points that began with small, unnoticed decisions.";
    }
  }
