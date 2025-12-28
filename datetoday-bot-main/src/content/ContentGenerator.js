// src/content/ContentGenerator.js
// Unified content generation system

import { openai, SYSTEM_PROMPT } from "../../openaiCommon.js";
import { withTimeout, retryWithBackoff, cleanAIContent, selectTweetFormat, getDailyPeriod } from "../../utils.js";
import { CONTENT_TYPES, getContentConfig } from "../core/ContentTypes.js";
import { ContentGenerationError } from "../core/errors.js";

const OPENAI_TIMEOUT = 30000;

/**
 * Generate content based on type and context
 * @param {string} contentType - Content type from CONTENT_TYPES
 * @param {Object} context - Context object (event, text, etc.)
 * @returns {Promise<string|string[]>} - Generated content (string or array for threads)
 */
export async function generateContent(contentType, context = {}) {
  const config = getContentConfig(contentType);
  
  try {
    let prompt = buildPrompt(contentType, context);
    let model = getModelForType(contentType);
    let temperature = getTemperatureForType(contentType);
    let maxTokens = getMaxTokensForType(contentType);
    
    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature,
          max_tokens: maxTokens,
        }),
        OPENAI_TIMEOUT
      );
    }, 3, 1000);

    let text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new ContentGenerationError(`Empty content generated for ${contentType}`, { contentType });
    }
    
    // Clean AI-generated artifacts
    text = cleanAIContent(text);
    
    // Process based on content type
    if (contentType === CONTENT_TYPES.THREAD || contentType === CONTENT_TYPES.WHAT_IF) {
      return processThread(text, config);
    }
    
    // Validate length
    if (text.length > config.maxLength) {
      text = truncateIntelligently(text, config.maxLength);
    }
    
    // Remove trailing ellipsis or incomplete endings
    text = text.replace(/\.\.\.+$/, '').trim();
    if (text.endsWith('…')) {
      text = text.slice(0, -1).trim();
    }
    
    // Ensure proper ending
    text = ensureProperEnding(text);
    
    // Final validation: ensure we didn't create an incomplete sentence
    if (text.endsWith('...') || text.endsWith('…') || text.match(/\.\.\.$/)) {
      console.warn(`[ContentGenerator] Content ends with ellipsis, attempting to fix...`);
      // Try to find a complete sentence before the ellipsis
      const lastSentenceEnd = Math.max(
        text.lastIndexOf('.'),
        text.lastIndexOf('!'),
        text.lastIndexOf('?')
      );
      if (lastSentenceEnd > text.length * 0.5) {
        text = text.slice(0, lastSentenceEnd + 1).trim();
      } else {
        // If no good sentence end, just remove ellipsis and add period
        text = text.replace(/\.\.\.+$/, '').replace(/…+$/, '').trim() + '.';
      }
    }
    
    console.log(`[ContentGenerator] Generated ${contentType} successfully`);
    return text;
    
  } catch (err) {
    if (err instanceof ContentGenerationError) {
      throw err;
    }
    throw new ContentGenerationError(
      `Failed to generate ${contentType}`,
      { contentType, originalError: err.message }
    );
  }
}

/**
 * Build prompt based on content type
 */
function buildPrompt(contentType, context) {
  switch (contentType) {
    case CONTENT_TYPES.DAILY:
      return buildDailyPrompt(context.event);
    
    case CONTENT_TYPES.QUICK_FACT:
      return buildQuickFactPrompt();
    
    case CONTENT_TYPES.EVENING_FACT:
      return buildEveningFactPrompt();
    
    case CONTENT_TYPES.REPLY:
      return buildReplyPrompt(context.event);
    
    case CONTENT_TYPES.THREAD:
      return buildThreadPrompt(context.event);
    
    case CONTENT_TYPES.WHAT_IF:
      return buildWhatIfPrompt();
    
    case CONTENT_TYPES.HIDDEN_CONNECTION:
      return buildHiddenConnectionPrompt();
    
    case CONTENT_TYPES.HISTORY_DEBUNK:
      return buildHistoryDebunkPrompt();
    
    default:
      throw new ContentGenerationError(`Unknown content type: ${contentType}`);
  }
}

/**
 * Build daily tweet prompt
 */
function buildDailyPrompt(event) {
  const { year, description, monthName, day } = event;
  const format = selectTweetFormat();
  
  const formatPrompts = {
    surprising_fact: `Create a VIRAL tweet that makes people stop scrolling and share immediately.

Event: ${description}
Year: ${year}
Date: ${monthName} ${day}

CRITICAL FOR VIRALITY:
1. First 3 words = hook that makes people stop. Use surprising/controversial angle.
2. Challenge assumptions: "Everyone thinks X, but actually Y..."
3. Include what happened - be specific with surprising details
4. End with something that makes people want to reply or share
5. Complete your thought - never end with "..." or cut off mid-sentence

VIRAL HOOK OPTIONS (pick the strongest):
- "Everyone thinks [common belief], but actually [surprising truth]"
- "This is the story you didn't learn in school..."
- "You won't believe what happened on ${monthName} ${day}, ${year}:"
- "This changes everything you thought you knew about [topic]"
- "${monthName} ${day}, ${year}: [Surprising fact that challenges assumptions]"

Format:
- Start with STRONG hook that challenges assumptions or reveals surprising truth
- Include date: ${monthName} ${day}, ${year}
- State what happened with specific, surprising details
- Add a detail that makes it shareable (connection to today, surprising consequence, etc.)
- End with hook that invites engagement (question, thought-provoking statement, or "this is why...")
- Under 140 characters TOTAL
- Use 1 emoji strategically if it adds emphasis
- Be conversational and engaging
- NEVER use em dashes (—) – use commas, periods, or regular hyphens
- NEVER end with "..." - always complete the sentence

Example structure:
"Everyone thinks [common belief], but on ${monthName} ${day}, ${year}, [surprising truth]. [Why this matters/connects to today]."`,

    human_story: `Tell a COMPELLING human story that makes people feel something. Focus on the people, their emotions, their decisions.

Event: ${description}
Year: ${year}
Date: ${monthName} ${day}

CRITICAL: 
1. Human stories with emotion get shared. Make people feel something.
2. You MUST include what actually happened - don't just describe feelings.
3. Complete your thought - never end with "..." or cut off mid-sentence.

Format:
- Start with a hook about the person or moment: "[Person] was [age] when..." or "In ${year}, [person] made a decision that changed everything"
- Include the date naturally: ${monthName} ${day}, ${year}
- State what actually happened - be specific about the event
- Focus on the human element - emotions, struggles, triumphs
- Make it relatable - connect to experiences everyone understands
- End with impact - what changed for them or others
- Under 140 characters TOTAL
- Use 1 emoji if it adds emotion
- Be conversational, like telling a friend a story
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead
- NEVER end with "..." - always complete the sentence

Example structure:
"[Person] was [age] when ${monthName} ${day}, ${year} changed everything. [What happened]. [Impact]."`,

    moment_of_change: `This event was a turning point. Show what changed and why it mattered.

Event: ${description}
Year: ${year}
Date: ${monthName} ${day}

CRITICAL:
1. You MUST state what actually happened - don't just say "everything changed"
2. Complete your thought - never end with "..." or cut off mid-sentence

Format:
- Start with the date: ${monthName} ${day}, ${year}
- State what actually happened - be specific about the event
- Emphasize what changed - the before and after, the shift, the impact
- Make it clear why this moment was significant
- Under 140 characters TOTAL
- Use 1 emoji if it adds emphasis
- Be direct and powerful
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead
- NEVER end with "..." - always complete the sentence

Example structure:
"${monthName} ${day}, ${year}: [What happened]. [What changed]. [Why it mattered]."`,

    relatable_connection: `Create a VIRAL tweet that connects this historical event to something people experience TODAY.

Event: ${description}
Year: ${year}
Date: ${monthName} ${day}

CRITICAL FOR VIRALITY:
1. Connections to today make content EXTREMELY shareable
2. Make the parallel obvious and surprising
3. Use specific examples people can relate to
4. End with insight that makes people think "this is so true"

Format:
- Start with STRONG hook: "${year}: [Event]. 2024: [Surprising parallel]" or "History is repeating itself..."
- Include date: ${monthName} ${day}, ${year}
- Show clear, surprising connection - make it obvious and relatable
- Use parallel structure for impact
- Make it specific - not vague ("This is like..." → "This is exactly like [specific modern situation]")
- End with insight that makes people want to share
- Under 140 characters TOTAL
- Use 1 emoji if it emphasizes the connection
- Be conversational and relatable
- NEVER use em dashes (—) – use commas, periods, or regular hyphens
- NEVER end with "..." - always complete the sentence

Example structure:
"${year}: [Event]. 2024: [Surprising modern parallel]. History doesn't repeat, but it rhymes. ${monthName} ${day} shows us [insight]."`,

    dramatic_scene: `Paint a vivid scene BUT always include what actually happened. Don't just describe - tell the story.

Event: ${description}
Year: ${year}
Date: ${monthName} ${day}

CRITICAL: You MUST mention what actually happened. Scene-setting is great, but the historical fact is essential.

Format:
- Start with the date: ${monthName} ${day}, ${year}
- Paint a brief vivid scene (1-2 sentences max) - what did it look like?
- THEN immediately state what happened: "[What actually occurred]"
- Make it clear what the historical event was
- Under 140 characters TOTAL
- Use 1 emoji if it adds to the scene
- Be evocative but informative
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead
- NEVER end with "..." or cut off mid-sentence - always complete the thought

Example structure:
"${monthName} ${day}, ${year}: [Brief scene description]. [What actually happened - the historical fact]."`,

    question_hook: `Create a tweet with a question hook that SPARKS DISCUSSION and gets replies.

Event: ${description}
Year: ${year}
Date: ${monthName} ${day}

CRITICAL FOR ENGAGEMENT:
1. Questions that make people want to reply get algorithm boost
2. Make it thought-provoking, not obvious
3. Challenge assumptions or reveal surprising angle
4. End with something that invites discussion

QUESTION HOOK OPTIONS (pick the strongest):
- "What if [event] had gone differently? Everything changes..."
- "Why did [person/group] do [action]? The real reason will surprise you."
- "What would you have done? On ${monthName} ${day}, ${year}, [person] faced [dilemma]..."
- "How did [seemingly impossible thing] happen? ${monthName} ${day}, ${year} reveals the answer."
- "What's the story behind [famous event]? It's wilder than you think."

Format:
- Start with STRONG question that makes people curious
- Include date: ${monthName} ${day}, ${year}
- Reveal surprising answer or key fact
- End with hook that invites replies (question, "what do you think?", or thought-provoking statement)
- Under 140 characters TOTAL
- Use 1 emoji if it adds to engagement
- Be conversational and thought-provoking
- NEVER use em dashes (—) – use commas, periods, or regular hyphens
- NEVER end with "..." - always complete the sentence

Example structure:
"What if [event] had never happened? ${monthName} ${day}, ${year} changed everything. [Surprising detail]. What do you think would be different today?"`,

    simple_statement: `Make a direct, powerful statement about this event.

Event: ${description}
Year: ${year}
Date: ${monthName} ${day}

Format:
- Start with the date: ${monthName} ${day}, ${year}
- Make a clear, impactful statement about what happened
- Be direct and powerful - every word should matter
- Under 140 characters
- Use 1 emoji if it adds emphasis
- Be concise and memorable
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead`
  };
  
  return formatPrompts[format] || formatPrompts.simple_statement;
}

/**
 * Build quick fact prompt
 */
function buildQuickFactPrompt() {
  const period = getDailyPeriod();
  const format = Math.random() < 0.5 ? 'surprising' : 'insightful';
  
  if (format === 'surprising') {
    return `Write a VIRAL tweet with a surprising historical fact that makes people go "wait, what?!"

Focus period: ${period.label} (${period.description})

CRITICAL: The hook is everything. First 3 words determine engagement.

Hook Options (pick strongest):
- "Did you know..." (classic)
- "This is wild:" (attention-grabbing)
- "Wait until you hear..." (curiosity)
- "You won't believe..." (shareable)
- "[Year]: [Surprising fact]" (direct)

Requirements:
- Start with a POWERFUL hook (first 3 words are critical)
- Share a surprising, little-known fact that makes people want to share
- Add context: why this matters or what it led to
- Make it shareable - something people will retweet
- Under 240 characters
- Use 1 emoji if it adds emotion or emphasis
- Be conversational, not academic
- Avoid World War I, World War II, Treaty of Versailles unless necessary
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead

Structure: Hook → Fact → Why it matters`;
  } else {
    return `Write an engaging tweet that shares a historical insight that still matters today.

Focus period: ${period.label} (${period.description})

Requirements:
- Share a historical event or pattern from this period
- Connect it to something people can relate to (human nature, patterns, lessons)
- Make it thought-provoking
- Under 240 characters
- Use 1 emoji if it adds meaning
- Be conversational, not academic
- Avoid World War I, World War II, Treaty of Versailles unless necessary
- Don't force a "Lesson:" format - be natural
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead`;
  }
}

/**
 * Build evening fact prompt
 */
function buildEveningFactPrompt() {
  const period = getDailyPeriod();
  return `You are a historian who makes history engaging and thought-provoking.

Focus period: ${period.label} (${period.description})

Create one engaging tweet about a historical event from this period.

Requirements:
- 1-2 sentences, under 250 characters total
- Share an interesting event, moment, or pattern from this period
- Make it engaging: focus on what's surprising, relatable, or thought-provoking
- Connect it to something people can understand (human nature, patterns, consequences)
- Stay within the described period focus
- Avoid World War I, World War II, Treaty of Versailles unless necessary
- Conversational tone - write like you're sharing something interesting with a friend
- Use 1 emoji if it adds emotion or emphasis
- Don't force a "Lesson:" format - be natural and engaging
- Must be factually correct
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead

Make it something people will want to read and share.`;
}

/**
 * Build reply prompt
 */
function buildReplyPrompt(event) {
  return `You are a historian who makes history engaging and relatable.

Event: ${event.description}
Year: ${event.year}

This is a REPLY to the main tweet. The main tweet already introduced the event. Your job is to add context, depth, and meaning.

Requirements:
- 2-3 short sentences, under 270 characters total.
- Add interesting context: what led to this? What happened next? Why did it matter?
- Make it engaging: use vivid details, human elements, or surprising connections.
- Show the impact: how did this change things? What were the consequences?
- End with a brief insight or connection (but don't force a "Lesson:" format - be natural).
- Conversational tone - write like you're explaining to a curious friend.
- You can use 1 emoji if it adds emotion or clarity.
- Connect to human experiences when relevant, but avoid current politics.
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead.
- Write naturally - don't sound like a textbook or AI.

Make it interesting, not formulaic.`;
}

/**
 * Build thread prompt
 */
function buildThreadPrompt(event) {
  return `You are a historian who makes history engaging through storytelling.

Event: ${event.description}
Year: ${event.year}

Create a 5-7 tweet thread that tells a COMPELLING story people will read to the end.

CRITICAL: Thread structure determines engagement. Each tweet must make people want to read the next.

Thread Structure:
- Tweet 1: HOOK - Start with the most surprising/interesting aspect. Make people want to read more.
- Tweet 2: SETUP - What was happening before? Set the scene and build context.
- Tweets 3-5: STORY - What happened? Who was involved? Build suspense. Reveal details progressively.
- Final tweet: IMPACT - Why this matters today. End with a thought-provoking question or insight.

Requirements:
- Tweet 1 MUST have a strong hook - first 3 words are critical
- Each tweet should end with something that makes people want to read the next
- Build suspense - don't reveal everything at once
- Use cliffhangers between tweets when possible
- Make it engaging and thought-provoking
- Conversational tone, like telling a story to a friend
- Use 1-2 emojis total across the thread if they add emotion
- Each tweet should stand alone but build the story
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead

Example Tweet 1 structure:
"In ${event.year}, [surprising hook]. This is the story of [what happened]..."

Format: each tweet on a new line, with no numbering.`;
}

/**
 * Build What If prompt
 */
function buildWhatIfPrompt() {
  return `You are a historian who makes history engaging through storytelling.

Create a 5-7 tweet "What If" thread that explores an alternate history scenario.

Requirements:
- Tweet 1: Hook - "What if [event] had gone differently?"
- Tweet 2: Set the scene - what actually happened (briefly)
- Tweets 3-5: Explore the alternate path - what might have changed? Show the ripple effects.
- Final tweet: What this teaches us about how history works (but be natural, don't force "Lesson:" format)
- Make it engaging and thought-provoking - people should want to read the whole thread
- Conversational tone, like telling a story
- Use 1-2 emojis total across the thread if they add emotion
- Avoid modern political references, keep it historical
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead

Format: each tweet on a new line, with no numbering. Make each tweet stand alone but build the story.`;
}

/**
 * Build hidden connection prompt
 */
function buildHiddenConnectionPrompt() {
  return `You are a historian who finds surprising connections in history.

Write one engaging tweet that reveals a surprising connection between two historical events.

Requirements:
- Choose two real, significant events that seem unrelated but share a pattern
- Show the connection in an interesting way - make people go "wow, I never thought of that"
- Explain what they have in common (patterns, causes, consequences, human nature)
- Under 270 characters
- Be conversational and engaging - like sharing a cool discovery
- Use 1 emoji if it adds emphasis
- Make it shareable - something people will want to retweet
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead
- Don't force "Pattern:" or "Lesson:" - be natural

Example style: "Here's something wild: [Event 1] and [Event 2] seem totally different, but they both show [connection]. [Why this matters]."`;
}

/**
 * Build history debunk prompt
 */
function buildHistoryDebunkPrompt() {
  return `You are a historian who corrects misconceptions in an engaging way.

Write one tweet that debunks a common historical myth or misconception.

Requirements:
- Start with a hook: "Myth:", "Actually:", "Here's what really happened:", or similar
- State the common misconception briefly
- Give the accurate version - what really happened
- Explain why the misconception exists or what it teaches us (but be natural, don't force "Lesson:" format)
- Under 260 characters
- Be conversational and engaging - like sharing a cool correction
- Use 1 emoji if it adds emphasis
- Make it shareable - people love myth-busting content
- Avoid World War I, World War II, Treaty of Versailles unless necessary
- NEVER use em dashes (—) – use commas, periods, or regular hyphens instead

Example style: "Myth: [misconception]. Actually, [truth]. [Why this misconception exists or what it shows]."`;
}

/**
 * Get model for content type
 */
function getModelForType(contentType) {
  // Use GPT-4o for longer content, GPT-4o-mini for shorter
  if (contentType === CONTENT_TYPES.THREAD || contentType === CONTENT_TYPES.WHAT_IF) {
    return "gpt-4o";
  }
  return "gpt-4o-mini";
}

/**
 * Get temperature for content type
 */
function getTemperatureForType(contentType) {
  const temps = {
    [CONTENT_TYPES.DAILY]: 0.5,
    [CONTENT_TYPES.QUICK_FACT]: 0.8,
    [CONTENT_TYPES.EVENING_FACT]: 0.8,
    [CONTENT_TYPES.REPLY]: 0.7,
    [CONTENT_TYPES.THREAD]: 0.8,
    [CONTENT_TYPES.WHAT_IF]: 0.8,
    [CONTENT_TYPES.HIDDEN_CONNECTION]: 0.7,
    [CONTENT_TYPES.HISTORY_DEBUNK]: 0.7,
  };
  return temps[contentType] || 0.7;
}

/**
 * Get max tokens for content type
 */
function getMaxTokensForType(contentType) {
  const tokens = {
    [CONTENT_TYPES.DAILY]: 220,
    [CONTENT_TYPES.QUICK_FACT]: 150,
    [CONTENT_TYPES.EVENING_FACT]: 160,
    [CONTENT_TYPES.REPLY]: 220,
    [CONTENT_TYPES.THREAD]: 800,
    [CONTENT_TYPES.WHAT_IF]: 800,
    [CONTENT_TYPES.HIDDEN_CONNECTION]: 250,
    [CONTENT_TYPES.HISTORY_DEBUNK]: 250,
  };
  return tokens[contentType] || 200;
}

/**
 * Process thread content (split into array)
 */
function processThread(text, config) {
  const tweets = text
    .split("\n")
    .map(l => cleanAIContent(l.trim()))
    .filter(l => l.length > 0 && !l.match(/^Tweet \d+:/i))
    .slice(0, config.maxTweets || 7);
  
  if (tweets.length < (config.minTweets || 3)) {
    throw new ContentGenerationError(`Not enough tweets in thread (got ${tweets.length})`);
  }
  
  return tweets;
}

/**
 * Truncate text intelligently - but NEVER cut off mid-sentence
 */
function truncateIntelligently(text, maxLength) {
  if (text.length <= maxLength) return text;
  
  // Try to cut at sentence boundary first (preferred)
  const sentenceEndings = ['. ', '! ', '? '];
  for (const ending of sentenceEndings) {
    const lastIndex = text.lastIndexOf(ending, maxLength);
    if (lastIndex > maxLength * 0.6) { // Lower threshold to prefer complete sentences
      return text.slice(0, lastIndex + 1).trim();
    }
  }
  
  // Try word boundary (avoid cutting mid-word)
  const lastSpace = text.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength * 0.7) {
    // Don't add ellipsis if we're cutting - just end at word boundary
    return text.slice(0, lastSpace).trim();
  }
  
  // Last resort: hard cut, but try to avoid it
  // If we have to hard cut, it means the content is way too long
  console.warn(`[ContentGenerator] Content too long (${text.length} chars), had to hard cut to ${maxLength}`);
  return text.slice(0, maxLength - 1).trim();
}

/**
 * Ensure text ends properly
 */
function ensureProperEnding(text) {
  const lastChar = text[text.length - 1];
  if (['.', '!', '?', '…', ':', ')', '"', "'"].includes(lastChar)) {
    return text;
  }
  
  // Try to find sentence end
  const lastSentenceEnd = Math.max(
    text.lastIndexOf('.'),
    text.lastIndexOf('!'),
    text.lastIndexOf('?')
  );
  
  if (lastSentenceEnd > text.length * 0.7) {
    return text.slice(0, lastSentenceEnd + 1);
  }
  
  return text.trim() + '.';
}

