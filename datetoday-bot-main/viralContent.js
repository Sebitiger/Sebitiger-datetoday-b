// viralContent.js
// Advanced content generators for viral historian persona

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent } from "./utils.js";
import { postTweet, postThread, postTweetWithImage } from "./twitterClient.js";
import { fetchImageForText, fetchEventImage } from "./fetchImage.js";
import { isContentDuplicate, markContentPosted, isImageDuplicate, markTopicPosted } from "./database.js";

const OPENAI_TIMEOUT = 60000; // 60 seconds for longer content

/**
 * Generate a "What If" alternate history scenario
 */
export async function generateWhatIfScenario() {
  const userPrompt = `
You are "The Archive" – a grandmaster historian.

Create a 5–7 tweet "What If" scenario that uses an alternate outcome to explain a real historical mechanism.

Requirements:
- Choose one real, major turning point (no invented events).
- Briefly state what actually happened, then describe a plausible alternate path.
- In each tweet, highlight a mechanism (alliances, resources, information flows, institutions, technology, ideology).
- Final tweet must start with "Lesson:" and state the general rule this scenario exposes about how systems behave.
- Neutral, impersonal tone, no emojis, no hashtags, no questions.
- Avoid modern political references, keep language general.
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead.

Format: each tweet on a new line, with no numbering.
`;

  try {
    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: 800,
        }),
        OPENAI_TIMEOUT
      );
    });

    const raw = completion.choices[0]?.message?.content || "";
    const tweets = raw
      .split("\n")
      .map(l => cleanAIContent(l.trim())) // Clean each tweet
      .filter(l => l.length > 0 && !l.match(/^Tweet \d+:/i))
      .slice(0, 7);

    if (tweets.length < 3) {
      throw new Error("Not enough tweets generated");
    }

    console.log("[Viral] Generated What If scenario with", tweets.length, "tweets");
    return tweets;
  } catch (err) {
    console.error("[Viral] Error generating What If:", err.message);
    return null;
  }
}

/**
 * Generate "Hidden Connections" - surprising links between events
 */
export async function generateHiddenConnection() {
  const userPrompt = `
You are "The Archive" – a grandmaster historian.

Write one tweet that reveals a structural connection between two events.

Requirements:
- Choose two real, significant events from different domains or regions but in a similar era.
- State both events briefly, then name the shared pattern (for example empire overreach, financial strain, technological disruption, institutional decay).
- End with a separate clause starting "Pattern:" or "Lesson:" that states the general rule they share.
- Under 270 characters, neutral and impersonal, no emojis, no hashtags, no questions.
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
          temperature: 0.7,
          max_tokens: 250,
        }),
        OPENAI_TIMEOUT
      );
    });

    let text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return null;
    }
    
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    
    // Ensure complete sentence
    if (text.length > 280) {
      // Smart truncation
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.'),
        text.lastIndexOf('!'),
        text.lastIndexOf('?')
      );
      if (lastSentenceEnd > text.length * 0.7) {
        text = text.slice(0, lastSentenceEnd + 1);
      } else {
        return null; // Can't truncate safely
      }
    }
    
    // Ensure it ends with punctuation
    const lastChar = text[text.length - 1];
    if (!['.', '!', '?', '…'].includes(lastChar)) {
      text = text.trim() + '.';
    }
    
    console.log("[Viral] Generated hidden connection");
    return text;
  } catch (err) {
    console.error("[Viral] Error generating connection:", err.message);
    return null;
  }
}

/**
 * Post a "What If" thread (viral content)
 */
export async function postWhatIfThread() {
  try {
    console.log("[Viral] Generating What If scenario...");
    
    // Generate and check for duplicates (retry up to 5 times)
    let tweets = await generateWhatIfScenario();
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      if (!tweets || tweets.length < 3) {
        attempts++;
        tweets = await generateWhatIfScenario();
        continue;
      }
      
      // Check if first tweet (main content) is duplicate
      const isDuplicate = await isContentDuplicate(tweets[0], 60);
      if (!isDuplicate) {
        break; // Found unique content
      }
      
      console.log(`[Viral] Generated What If thread is similar to recent post, generating new one... (attempt ${attempts + 1}/${maxAttempts})`);
      tweets = await generateWhatIfScenario();
      attempts++;
    }
    
    if (!tweets || tweets.length < 3) {
      throw new Error("Failed to generate unique What If scenario after duplicate checks");
    }

    // Fetch an image based on the first tweet content (REQUIRED - retry until found)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 3;
    
    while (!imageBuffer && imageAttempts < maxImageAttempts) {
      try {
        console.log(`[Viral] Attempting to fetch image for What If thread (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
        imageBuffer = await fetchImageForText(tweets[0], true); // requireImage = true
        if (imageBuffer) {
          console.log("[Viral] Image fetched successfully for What If thread.");
          break;
        } else {
          console.warn(`[Viral] No image found on attempt ${imageAttempts + 1}, retrying...`);
          imageAttempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (imgErr) {
        console.error(`[Viral] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
        imageAttempts++;
        if (imageAttempts < maxImageAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!imageBuffer) {
      console.error("[Viral] CRITICAL: Could not fetch image for What If thread. Posting will fail.");
      throw new Error("Failed to fetch required image for What If thread");
    }
    
    // Check if image is duplicate
    const isImageDup = await isImageDuplicate(imageBuffer, 90);
    if (isImageDup) {
      throw new Error("Image is duplicate - aborting post");
    }
    
    // Final check: verify content is still unique
    const finalDuplicateCheck = await isContentDuplicate(tweets[0], 60);
    if (finalDuplicateCheck) {
      throw new Error("Content became duplicate during image fetching - aborting post");
    }

    const threadTweetId = await postThread(tweets, imageBuffer);
    
    // Mark content and image as posted
    await markContentPosted(tweets.join(' '), threadTweetId, imageBuffer);
    
    // Mark topic as posted (for cooldown)
    await markTopicPosted(tweets[0]);
    
    console.log("[Viral] What If thread posted successfully");
  } catch (err) {
    console.error("[Viral] Error posting What If thread:", err.message);
  }
}

/**
 * Post a hidden connection tweet
 */
export async function postHiddenConnection() {
  try {
    console.log("[Viral] Generating hidden connection...");
    
    // Generate and check for duplicates (retry up to 5 times)
    let tweet = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      tweet = await generateHiddenConnection();
      
      if (!tweet) {
        attempts++;
        continue;
      }
      
      // Check if similar content was posted recently (60 days - very strict for facts)
      const isDuplicate = await isContentDuplicate(tweet, 60); // Check last 60 days
      if (!isDuplicate) {
        break; // Found unique content
      }
      
      console.log(`[Viral] Generated hidden connection is similar to recent post, generating new one... (attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
    }
    
    if (!tweet) {
      throw new Error("Failed to generate unique hidden connection after multiple attempts");
    }

    // Fetch an image based on the tweet content (REQUIRED - retry until found, check for duplicates)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 10; // Increased to find unique image
    let tweetAttempts = 0;
    const maxTweetAttempts = 5; // Try different tweets if images are duplicates
    
    while (!imageBuffer && tweetAttempts < maxTweetAttempts) {
      imageAttempts = 0;
      
      while (!imageBuffer && imageAttempts < maxImageAttempts) {
        try {
          console.log(`[Viral] Attempting to fetch image for hidden connection (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
          const fetchedImage = await fetchImageForText(tweet, true); // requireImage = true
          
          if (fetchedImage) {
            // Check if image was already posted
            const isImageDup = await isImageDuplicate(fetchedImage, 90);
            if (isImageDup) {
              console.warn(`[Viral] Image is duplicate, trying different tweet...`);
              // Generate new tweet and try again
              tweet = await generateHiddenConnection();
              const isTweetDup = await isContentDuplicate(tweet, 60);
              if (isTweetDup || !tweet) {
                tweetAttempts++;
                continue;
              }
              imageAttempts = 0; // Reset for new tweet
              continue;
            }
            
            imageBuffer = fetchedImage;
            console.log("[Viral] Image fetched successfully and verified as unique.");
            break;
          } else {
            console.warn(`[Viral] No image found on attempt ${imageAttempts + 1}, retrying...`);
            imageAttempts++;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (imgErr) {
          console.error(`[Viral] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
          imageAttempts++;
          if (imageAttempts < maxImageAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (!imageBuffer && tweetAttempts < maxTweetAttempts - 1) {
        console.warn(`[Viral] Could not find unique image, trying different tweet...`);
        tweetAttempts++;
        tweet = await generateHiddenConnection();
        const isTweetDup = await isContentDuplicate(tweet, 60);
        if (isTweetDup || !tweet) {
          continue;
        }
      } else {
        break;
      }
    }
    
    if (!imageBuffer) {
      console.error("[Viral] CRITICAL: Could not fetch unique image for hidden connection. Posting will fail.");
      throw new Error("Failed to fetch required unique image for hidden connection");
    }

    // Final check: verify content and image are unique before posting
    const finalDuplicateCheck = await isContentDuplicate(tweet, 60);
    if (finalDuplicateCheck) {
      throw new Error("Content became duplicate during image fetching - aborting post");
    }
    
    const isImageDup = await isImageDuplicate(imageBuffer, 90);
    if (isImageDup) {
      throw new Error("Image is duplicate - aborting post");
    }

    const tweetId = await postTweetWithImage(tweet, imageBuffer, null);
    
    // Mark content AND image as posted to prevent duplicates
    await markContentPosted(tweet, tweetId, imageBuffer);
    
    // Mark topic as posted (for cooldown)
    await markTopicPosted(tweet);
    
    console.log("[Viral] Hidden connection posted successfully");
  } catch (err) {
    console.error("[Viral] Error posting hidden connection:", err.message);
  }
}

/**
 * Generate "Quick Fact" - short, shareable historical fact
 */
export async function generateQuickFact() {
  const userPrompt = `
You are "The Archive" – a grandmaster historian.

Write one tweet that states a concise historical fact and the general lesson it represents.

Requirements:
- Under 240 characters, 1 or 2 sentences.
- First part: briefly name the event and what changed (empire, economy, belief, technology, institution, idea).
- Second part must start with "Lesson:" and give the abstract rule this illustrates (for example about power, risk, feedback, information or incentives).
- Use a wide range of eras and regions (ancient, medieval, early modern, modern, non‑Western), not only wars.
- Neutral, impersonal tone, no emojis, no hashtags, no questions.
- Avoid topics centred on World War I, World War II, Treaty of Versailles, Versailles, Pearl Harbor, D-Day or Normandy unless explicitly instructed.
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead.

Generate a quick fact plus lesson about a historical event now:
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
          max_tokens: 150,
        }),
        OPENAI_TIMEOUT
      );
    });

    let text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return null;
    }
    
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    
    // Ensure complete sentence
    if (text.length > 280) {
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.'),
        text.lastIndexOf('!'),
        text.lastIndexOf('?')
      );
      if (lastSentenceEnd > text.length * 0.7) {
        text = text.slice(0, lastSentenceEnd + 1);
      } else {
        return null;
      }
    }
    
    // Ensure it ends with punctuation
    const lastChar = text[text.length - 1];
    if (!['.', '!', '?', '…'].includes(lastChar)) {
      text = text.trim() + '.';
    }
    
    console.log("[Viral] Generated quick fact");
    return text;
  } catch (err) {
    console.error("[Viral] Error generating quick fact:", err.message);
    return null;
  }
}

/**
 * Post a quick fact
 */
export async function postQuickFact() {
  try {
    console.log("[Viral] Generating quick fact...");
    
    // Generate fact and check for duplicates (retry up to 5 times)
    let tweet = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      tweet = await generateQuickFact();
      
      if (!tweet) {
        attempts++;
        continue;
      }
      
      // Check if similar content was posted recently (60 days - very strict for facts)
      const isDuplicate = await isContentDuplicate(tweet, 60); // Check last 60 days
      if (!isDuplicate) {
        break; // Found unique content
      }
      
      console.log(`[Viral] Generated quick fact is similar to recent post, generating new one... (attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
    }
    
    if (!tweet) {
      throw new Error("Failed to generate unique quick fact after multiple attempts");
    }

    // Fetch an image based on the tweet content (REQUIRED - retry until found, check for duplicates)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 10; // Increased to find unique image
    let tweetAttempts = 0;
    const maxTweetAttempts = 5; // Try different tweets if images are duplicates
    
    while (!imageBuffer && tweetAttempts < maxTweetAttempts) {
      imageAttempts = 0;
      
      while (!imageBuffer && imageAttempts < maxImageAttempts) {
        try {
          console.log(`[Viral] Attempting to fetch image for quick fact (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
          const fetchedImage = await fetchImageForText(tweet, true); // requireImage = true
          
          if (fetchedImage) {
            // Check if image was already posted
            const isImageDup = await isImageDuplicate(fetchedImage, 90);
            if (isImageDup) {
              console.warn(`[Viral] Image is duplicate, trying different tweet...`);
              // Generate new tweet and try again
              tweet = await generateQuickFact();
              const isTweetDup = await isContentDuplicate(tweet, 60);
              if (isTweetDup) {
                tweetAttempts++;
                continue;
              }
              imageAttempts = 0; // Reset for new tweet
              continue;
            }
            
            imageBuffer = fetchedImage;
            console.log("[Viral] Image fetched successfully and verified as unique.");
            break;
          } else {
            console.warn(`[Viral] No image found on attempt ${imageAttempts + 1}, retrying...`);
            imageAttempts++;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (imgErr) {
          console.error(`[Viral] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
          imageAttempts++;
          if (imageAttempts < maxImageAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (!imageBuffer && tweetAttempts < maxTweetAttempts - 1) {
        console.warn(`[Viral] Could not find unique image, trying different tweet...`);
        tweetAttempts++;
        tweet = await generateQuickFact();
        const isTweetDup = await isContentDuplicate(tweet, 60);
        if (isTweetDup) {
          continue;
        }
      } else {
        break;
      }
    }
    
    if (!imageBuffer) {
      console.error("[Viral] CRITICAL: Could not fetch unique image for quick fact. Posting will fail.");
      throw new Error("Failed to fetch required unique image for quick fact");
    }

    // Final check: verify content is still unique before posting
    const finalDuplicateCheck = await isContentDuplicate(tweet, 60);
    if (finalDuplicateCheck) {
      throw new Error("Content became duplicate during image fetching - aborting post");
    }

    const tweetId = await postTweetWithImage(tweet, imageBuffer, null);
    
    // Mark content AND image as posted to prevent duplicates
    await markContentPosted(tweet, tweetId, imageBuffer);
    
    // Mark topic as posted (for cooldown)
    await markTopicPosted(tweet);
    
    console.log("[Viral] Quick fact posted successfully");
  } catch (err) {
    console.error("[Viral] Error posting quick fact:", err.message);
  }
}

/**
 * Generate "Debunking History" tweet
 */
export async function generateHistoryDebunk() {
  const userPrompt = `
You are "The Archive" – a grandmaster historian.

Write one tweet that corrects a simple historical misconception and states the deeper pattern.

Requirements:
- Under 260 characters, neutral and impersonal.
- Briefly state the misconception, then give the accurate version.
- End with a clause starting "Lesson:" that gives the general rule this error illustrates (for example about propaganda, simplification, survivor bias, memory or power).
- No emojis, no hashtags, no questions, no explicit modern political commentary.
- Avoid debunks whose main topic is World War I, World War II, Treaty of Versailles, Versailles, Pearl Harbor, D-Day or Normandy unless explicitly instructed.
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead.

Generate a history debunk plus lesson now:
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
          max_tokens: 250,
        }),
        OPENAI_TIMEOUT
      );
    });

    let text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return null;
    }
    
    // Clean AI-generated artifacts (em dashes, etc.)
    text = cleanAIContent(text);
    
    // Ensure complete sentence
    if (text.length > 280) {
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.'),
        text.lastIndexOf('!'),
        text.lastIndexOf('?')
      );
      if (lastSentenceEnd > text.length * 0.7) {
        text = text.slice(0, lastSentenceEnd + 1);
      } else {
        return null;
      }
    }
    
    // Ensure it ends with punctuation
    const lastChar = text[text.length - 1];
    if (!['.', '!', '?', '…'].includes(lastChar)) {
      text = text.trim() + '.';
    }
    
    console.log("[Viral] Generated history debunk");
    return text;
  } catch (err) {
    console.error("[Viral] Error generating debunk:", err.message);
    return null;
  }
}

/**
 * Post a history debunk
 */
export async function postHistoryDebunk() {
  try {
    console.log("[Viral] Generating history debunk...");
    
    // Generate and check for duplicates (retry up to 5 times)
    let tweet = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      tweet = await generateHistoryDebunk();
      
      if (!tweet) {
        attempts++;
        continue;
      }
      
      // Check if similar content was posted recently (60 days - very strict for facts)
      const isDuplicate = await isContentDuplicate(tweet, 60); // Check last 60 days
      if (!isDuplicate) {
        break; // Found unique content
      }
      
      console.log(`[Viral] Generated history debunk is similar to recent post, generating new one... (attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
    }
    
    if (!tweet) {
      throw new Error("Failed to generate unique history debunk after multiple attempts");
    }

    // Fetch an image based on the tweet content (REQUIRED - retry until found, check for duplicates)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 10; // Increased to find unique image
    let tweetAttempts = 0;
    const maxTweetAttempts = 5; // Try different tweets if images are duplicates
    
    while (!imageBuffer && tweetAttempts < maxTweetAttempts) {
      imageAttempts = 0;
      
      while (!imageBuffer && imageAttempts < maxImageAttempts) {
        try {
          console.log(`[Viral] Attempting to fetch image for history debunk (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
          const fetchedImage = await fetchImageForText(tweet, true); // requireImage = true
          
          if (fetchedImage) {
            // Check if image was already posted
            const isImageDup = await isImageDuplicate(fetchedImage, 90);
            if (isImageDup) {
              console.warn(`[Viral] Image is duplicate, trying different tweet...`);
              // Generate new tweet and try again
              tweet = await generateHistoryDebunk();
              const isTweetDup = await isContentDuplicate(tweet, 60);
              if (isTweetDup || !tweet) {
                tweetAttempts++;
                continue;
              }
              imageAttempts = 0; // Reset for new tweet
              continue;
            }
            
            imageBuffer = fetchedImage;
            console.log("[Viral] Image fetched successfully and verified as unique.");
            break;
          } else {
            console.warn(`[Viral] No image found on attempt ${imageAttempts + 1}, retrying...`);
            imageAttempts++;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (imgErr) {
          console.error(`[Viral] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
          imageAttempts++;
          if (imageAttempts < maxImageAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (!imageBuffer && tweetAttempts < maxTweetAttempts - 1) {
        console.warn(`[Viral] Could not find unique image, trying different tweet...`);
        tweetAttempts++;
        tweet = await generateHistoryDebunk();
        const isTweetDup = await isContentDuplicate(tweet, 60);
        if (isTweetDup || !tweet) {
          continue;
        }
      } else {
        break;
      }
    }
    
    if (!imageBuffer) {
      console.error("[Viral] CRITICAL: Could not fetch unique image for history debunk. Posting will fail.");
      throw new Error("Failed to fetch required unique image for history debunk");
    }

    // Final check: verify content and image are unique before posting
    const finalDuplicateCheck = await isContentDuplicate(tweet, 60);
    if (finalDuplicateCheck) {
      throw new Error("Content became duplicate during image fetching - aborting post");
    }
    
    const isImageDup = await isImageDuplicate(imageBuffer, 90);
    if (isImageDup) {
      throw new Error("Image is duplicate - aborting post");
    }

    const tweetId = await postTweetWithImage(tweet, imageBuffer, null);
    
    // Mark content AND image as posted to prevent duplicates
    await markContentPosted(tweet, tweetId, imageBuffer);
    
    // Mark topic as posted (for cooldown)
    await markTopicPosted(tweet);
    
    console.log("[Viral] History debunk posted successfully");
  } catch (err) {
    console.error("[Viral] Error posting history debunk:", err.message);
  }
}

