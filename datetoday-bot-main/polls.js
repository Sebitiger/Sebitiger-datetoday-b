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

Requirements:
- Question should be thought-provoking and educational
- 4 options (A, B, C, D)
- Options should be plausible but one is clearly correct
- Make it fun and shareable
- Keep question under 100 characters
- Each option under 25 characters
- NEVER use em dashes (—) - use commas, periods, or regular hyphens instead
- Write naturally like a human, not like AI-generated content

Format your response as:
QUESTION: [question text]
A: [option 1]
B: [option 2]
C: [option 3]
D: [option 4]
ANSWER: [correct option letter] - [brief explanation]

Example:
QUESTION: Which empire lasted the longest?
A: Roman Empire
B: British Empire
C: Ottoman Empire
D: Byzantine Empire
ANSWER: D - The Byzantine Empire lasted over 1,100 years (330-1453 AD)
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
 * Parse poll response from AI
 */
function parsePollResponse(text) {
  try {
    const questionMatch = text.match(/QUESTION:\s*(.+)/i);
    const optionAMatch = text.match(/A:\s*(.+)/i);
    const optionBMatch = text.match(/B:\s*(.+)/i);
    const optionCMatch = text.match(/C:\s*(.+)/i);
    const optionDMatch = text.match(/D:\s*(.+)/i);
    const answerMatch = text.match(/ANSWER:\s*([A-D])\s*-\s*(.+)/i);

    if (!questionMatch || !optionAMatch || !optionBMatch || !optionCMatch || !optionDMatch) {
      return null;
    }

    return {
      question: cleanAIContent(questionMatch[1].trim()),
      options: [
        cleanAIContent(optionAMatch[1].trim()),
        cleanAIContent(optionBMatch[1].trim()),
        cleanAIContent(optionCMatch[1].trim()),
        cleanAIContent(optionDMatch[1].trim()),
      ],
      correctAnswer: answerMatch ? answerMatch[1].trim() : null,
      explanation: answerMatch ? cleanAIContent(answerMatch[2].trim()) : null,
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
    const poll = await generatePoll();

    if (!poll) {
      throw new Error("Failed to generate poll");
    }

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
    console.log("[Polls] Poll posted. ID:", tweetId);

    // Store the answer for later (to reply with explanation)
    // In production, store this in a database
    return { tweetId, poll };

  } catch (err) {
    console.error("[Polls] Error posting poll:", err.message);
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

