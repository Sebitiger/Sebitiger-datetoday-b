// polls.js
// Generate and post interactive polls to drive engagement

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";
import { client } from "./twitterClient.js";

const OPENAI_TIMEOUT = 30000;

/**
 * Generate a historical poll question with options
 */
async function generatePoll() {
  const userPrompt = `
Create an engaging historical poll question for Twitter.

CRITICAL REQUIREMENTS:
- Question should be thought-provoking and educational
- 4 options (A, B, C, D)
- Options should be plausible but one is clearly correct
- Make it fun and shareable
- Keep question under 100 characters
- EACH OPTION MUST BE EXACTLY 25 CHARACTERS OR LESS (Twitter's strict limit)
- Options should be SHORT - just the answer text, nothing else
- NEVER include the question text in the options
- NEVER include "ANSWER:" or explanation in the options
- NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
- Write naturally like a human, not like AI-generated content

Format your response EXACTLY as:
QUESTION: [question text]
A: [option 1 - max 25 chars]
B: [option 2 - max 25 chars]
C: [option 3 - max 25 chars]
D: [option 4 - max 25 chars]
ANSWER: [correct option letter] - [brief explanation]

Examples of GOOD options (all under 25 chars):
A: Roman Empire
B: British Empire
C: Ottoman Empire
D: Byzantine Empire

Examples of BAD options (too long):
A: The Roman Empire which lasted from 27 BC to 476 AD (TOO LONG - 50+ chars)
B: Roman Empire (27 BC-476 AD) (TOO LONG - 30+ chars)

Generate a poll now:
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
          temperature: 0.8,
          max_tokens: 300,
        }),
        OPENAI_TIMEOUT
      );
    });

    let text = completion.choices[0]?.message?.content?.trim();
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    return parsePollResponse(text);
  } catch (err) {
    console.error("[Polls] Error generating poll:", err.message);
    return null;
  }
}

/**
 * Truncate option to exactly 25 characters (Twitter limit)
 */
function truncateOption(option) {
  if (!option) return "";
  const cleaned = cleanAIContent(option.trim());
  if (cleaned.length <= 25) {
    return cleaned;
  }
  // Truncate at word boundary if possible
  const truncated = cleaned.slice(0, 25);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 15) {
    return truncated.slice(0, lastSpace);
  }
  return truncated;
}

/**
 * Parse poll response from AI
 */
function parsePollResponse(text) {
  try {
    // Split by lines to avoid capturing too much
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    let question = null;
    const optionsMap = new Map(); // Use Map to ensure correct order
    let correctAnswer = null;
    let explanation = null;
    
    for (const line of lines) {
      // Match question
      const qMatch = line.match(/^QUESTION:\s*(.+)$/i);
      if (qMatch) {
        question = cleanAIContent(qMatch[1].trim());
        continue;
      }
      
      // Match options (stop at newline or next letter)
      const optionMatch = line.match(/^([A-D]):\s*(.+)$/i);
      if (optionMatch) {
        const letter = optionMatch[1].toUpperCase();
        let optionText = optionMatch[2].trim();
        // Remove anything after a newline, next option pattern, or ANSWER
        optionText = optionText.split(/\n|(?=^[A-D]:)|(?=^ANSWER:)/i)[0].trim();
        // Remove any trailing explanation text
        optionText = optionText.replace(/\s*ANSWER:.*$/i, '').trim();
        const truncated = truncateOption(optionText);
        if (truncated.length > 0) {
          optionsMap.set(letter, truncated);
        }
        continue;
      }
      
      // Match answer
      const answerMatch = line.match(/^ANSWER:\s*([A-D])\s*-\s*(.+)$/i);
      if (answerMatch) {
        correctAnswer = answerMatch[1].toUpperCase();
        explanation = cleanAIContent(answerMatch[2].trim());
        break; // Stop after answer
      }
    }
    
    if (!question || optionsMap.size !== 4) {
      console.error(`[Polls] Invalid poll format - question: ${!!question}, options found: ${optionsMap.size}`);
      console.error("[Polls] Raw text:", text);
      return null;
    }
    
    // Get options in order (A, B, C, D)
    const optionTexts = ['A', 'B', 'C', 'D'].map(letter => {
      const opt = optionsMap.get(letter);
      if (!opt) {
        console.error(`[Polls] Missing option ${letter}`);
        return null;
      }
      return opt;
    });
    
    if (optionTexts.some(opt => !opt)) {
      console.error("[Polls] Some options are missing");
      return null;
    }
    
    // Validate all options are 25 chars or less
    for (let i = 0; i < optionTexts.length; i++) {
      if (optionTexts[i].length > 25) {
        console.warn(`[Polls] Option ${options[i].letter} is ${optionTexts[i].length} chars, truncating to 25`);
        optionTexts[i] = truncateOption(optionTexts[i]);
      }
      if (optionTexts[i].length === 0) {
        console.error(`[Polls] Option ${options[i].letter} is empty after processing`);
        return null;
      }
    }
    
    return {
      question: cleanAIContent(question),
      options: optionTexts,
      correctAnswer,
      explanation,
    };
  } catch (err) {
    console.error("[Polls] Error parsing poll:", err.message);
    return null;
  }
}

/**
 * Post a poll to Twitter
 */
export async function postPoll() {
  try {
    console.log("[Polls] Generating poll...");
    let poll = await generatePoll();

    if (!poll) {
      throw new Error("Failed to generate poll");
    }

    // Validate and fix options before posting
    const validatedOptions = poll.options.map((opt, idx) => {
      const truncated = truncateOption(opt);
      if (truncated.length > 25) {
        console.error(`[Polls] Option ${idx + 1} still too long after truncation: ${truncated.length} chars`);
        return truncated.slice(0, 25); // Force truncate
      }
      if (truncated.length === 0) {
        throw new Error(`Option ${idx + 1} is empty`);
      }
      return truncated;
    });

    // Final validation
    for (let i = 0; i < validatedOptions.length; i++) {
      if (validatedOptions[i].length > 25) {
        validatedOptions[i] = validatedOptions[i].slice(0, 25);
        console.warn(`[Polls] Force truncated option ${i + 1} to 25 chars`);
      }
      console.log(`[Polls] Option ${String.fromCharCode(65 + i)}: "${validatedOptions[i]}" (${validatedOptions[i].length} chars)`);
    }

    // Update poll with validated options
    poll.options = validatedOptions;

    // Create poll text
    const pollText = `${poll.question}\n\nA: ${poll.options[0]}\nB: ${poll.options[1]}\nC: ${poll.options[2]}\nD: ${poll.options[3]}`;

    // Post poll (Twitter API v2 supports polls)
    const response = await client.v2.tweet({
      text: pollText,
      poll: {
        options: poll.options,
        duration_minutes: 1440, // 24 hours
      },
    });

    const tweetId = response.data.id;
    console.log("[Polls] Poll posted successfully. ID:", tweetId);

    // Store the answer for later (to reply with explanation)
    // In production, store this in a database
    return { tweetId, poll };

  } catch (err) {
    console.error("[Polls] Error posting poll:", err.message);
    if (err.errors) {
      console.error("[Polls] Twitter API errors:", JSON.stringify(err.errors, null, 2));
    }
    throw err;
  }
}

/**
 * Post poll answer after 24 hours
 */
export async function postPollAnswer(tweetId, poll) {
  try {
    if (!poll.correctAnswer || !poll.explanation) {
      return;
    }

    const answerText = `📚 The answer is ${poll.correctAnswer}!\n\n${poll.explanation}\n\nThanks to everyone who participated! 🎉`;

    await client.v2.tweet({
      text: answerText,
      reply: { in_reply_to_tweet_id: tweetId },
    });

    console.log("[Polls] Poll answer posted");
  } catch (err) {
    console.error("[Polls] Error posting poll answer:", err.message);
  }
}

/**
 * Generate "Guess the Year" poll
 */
export async function generateGuessTheYearPoll() {
  const userPrompt = `
Create a "Guess the Year" poll about a historical event.

Format:
EVENT: [description of event]
YEAR: [actual year]
OPTIONS: [year1, year2, year3, year4] (one correct, three plausible but wrong)
- NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
- Write naturally like a human, not like AI-generated content

Example:
EVENT: The first successful airplane flight by the Wright brothers
YEAR: 1903
OPTIONS: 1898, 1903, 1910, 1907
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
          temperature: 0.7,
          max_tokens: 200,
        }),
        OPENAI_TIMEOUT
      );
    });

    let text = completion.choices[0]?.message?.content?.trim();
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    
    const eventMatch = text.match(/EVENT:\s*(.+)/i);
    const yearMatch = text.match(/YEAR:\s*(\d+)/i);
    const optionsMatch = text.match(/OPTIONS:\s*(.+)/i);

    if (!eventMatch || !yearMatch || !optionsMatch) {
      return null;
    }

    const options = optionsMatch[1].split(',').map(o => cleanAIContent(o.trim()));
    const correctYear = yearMatch[1];

    return {
      question: `In what year did this happen?\n\n${cleanAIContent(eventMatch[1])}`,
      options: options,
      correctAnswer: correctYear,
    };
  } catch (err) {
    console.error("[Polls] Error generating guess the year:", err.message);
    return null;
  }
}

