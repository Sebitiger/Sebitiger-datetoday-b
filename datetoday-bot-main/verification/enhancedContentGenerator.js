/**
 * ENHANCED CONTENT GENERATOR - VIRAL HISTORY EDITION
 *
 * This system generates highly engaging, emotional historical content
 * optimized for maximum engagement and virality.
 *
 * Focus: Human stories, visual language, emotional impact
 */

import { openai } from '../openaiCommon.js';
import { verifyAndDecide, buildCorrectionPrompt } from './factChecker.js';
import { addToQueue } from './reviewQueue.js';

// ENHANCED VOICE - Storyteller, not analyst
const VOICE_SYSTEM_PROMPT = `You are a master historical storyteller. Your goal: make history feel ALIVE.

VOICE CHARACTERISTICS:
- Cinematic and visual - paint scenes
- Intimate and human - focus on PEOPLE
- Suspenseful - create tension
- Deadpan delivery - no enthusiasm, let facts shock
- Conversational - write like talking to a friend
- NO hashtags, NO emojis, NO exclamation marks
- NO modern parallels unless absolutely essential (overused)
- NO em dashes (—), use regular dashes (-) or periods

WRITING RULES:
1. SHORT SENTENCES. Punchy. Like this.
2. Use SPECIFIC VISUAL details (colors, sounds, actions)
3. Focus on ONE person or ONE moment
4. Include emotional stakes (what could be lost/gained)
5. Make readers FEEL something (shock, awe, injustice, triumph)
6. Write what HAPPENED, not what you think about it

AVOID:
- Generic statements ("This was important...")
- Modern preachy parallels ("Just like today...")
- Analytical language ("This demonstrates...")
- Vague descriptions ("Some people..." "Many believed...")

EMULATE:
- War correspondent describing a scene
- Friend telling you an insane story
- Documentary narrator (Ken Burns style)

Your job: Make history UNFORGETTABLE.`;

// CONTENT CATEGORIES
const CONTENT_CATEGORIES = {
  HUMAN_DRAMA: {
    name: "Human Drama",
    description: "Personal stories with high emotional stakes",
    engagementScore: 95,
    examples: ["Last words", "Final moments", "Personal sacrifices"]
  },
  SHOCKING_DETAIL: {
    name: "Shocking Detail",
    description: "Unknown details about famous events",
    engagementScore: 90,
    examples: ["Hidden facts about known events", "What they never told you"]
  },
  ALMOST_HAPPENED: {
    name: "Almost Happened",
    description: "Near-misses and alternate histories",
    engagementScore: 88,
    examples: ["Close calls", "What if moments", "Prevented disasters"]
  },
  OBJECT_STORIES: {
    name: "Object Stories",
    description: "Objects that changed history",
    engagementScore: 85,
    examples: ["Letters", "Weapons", "Documents", "Artifacts"]
  },
  STRANGE_COINCIDENCE: {
    name: "Strange Coincidence",
    description: "Coincidences too bizarre to believe",
    engagementScore: 87,
    examples: ["Impossible timing", "Eerie connections", "Synchronicities"]
  },
  NUMBERS_SHOCK: {
    name: "Numbers That Shock",
    description: "Data-driven emotional impact",
    engagementScore: 82,
    examples: ["Death tolls", "Timespans", "Scale comparisons"]
  },
  INJUSTICE: {
    name: "Historical Injustice",
    description: "Wrongs that make you angry",
    engagementScore: 91,
    examples: ["Coverups", "Forgotten victims", "Systemic failures"]
  },
  MICRO_STORY: {
    name: "Micro-Story",
    description: "Complete narrative in 280 characters",
    engagementScore: 93,
    examples: ["Beginning, middle, end", "Character arc", "Plot twist"]
  }
};

/**
 * Analyze event and choose best content category
 */
function selectContentCategory(event) {
  const desc = event.description.toLowerCase();
  const year = event.year;

  // Check for category indicators
  if (desc.includes('died') || desc.includes('killed') || desc.includes('assassin') || desc.includes('execution')) {
    return CONTENT_CATEGORIES.HUMAN_DRAMA;
  }

  if (desc.includes('almost') || desc.includes('prevented') || desc.includes('avoided')) {
    return CONTENT_CATEGORIES.ALMOST_HAPPENED;
  }

  if (desc.includes('letter') || desc.includes('document') || desc.includes('telegram') || desc.includes('wrote')) {
    return CONTENT_CATEGORIES.OBJECT_STORIES;
  }

  // Famous events get "Shocking Detail" treatment
  const famousKeywords = ['world war', 'revolution', 'independence', 'assassination', 'battle of'];
  if (famousKeywords.some(kw => desc.includes(kw))) {
    return CONTENT_CATEGORIES.SHOCKING_DETAIL;
  }

  // Default to micro-story
  return CONTENT_CATEGORIES.MICRO_STORY;
}

/**
 * Generate viral-optimized content prompts by category
 */
function buildViralPrompt(event, category) {
  const baseInfo = `Year: ${event.year}
Event: ${event.description}
Date: ${event.monthName} ${event.day}`;

  const categoryPrompts = {
    [CONTENT_CATEGORIES.HUMAN_DRAMA.name]: `${baseInfo}

GOAL: Tell ONE person's emotional story

STRUCTURE:
1. WHO: One person at the center
2. MOMENT: Specific moment of high stakes
3. CHOICE/ACTION: What they did
4. OUTCOME: What happened (surprising if possible)

REQUIREMENTS:
- Focus on ONE person's perspective
- Use visual details (what they saw, heard, felt)
- Include emotional stakes (life/death, love/loss, honor/shame)
- Be specific: names, ages, exact words if known
- 4-8 short sentences
- 280 chars max
- NO modern parallels

EXAMPLE STRUCTURE:
"[Person's name], age [X], [specific action]. [Visual detail]. [Stakes]. [Outcome]. [Final image]."`,

    [CONTENT_CATEGORIES.SHOCKING_DETAIL.name]: `${baseInfo}

GOAL: Reveal shocking unknown detail about famous event

STRUCTURE:
1. SETUP: "You know [famous event]"
2. REVEAL: "You don't know [shocking detail]"
3. EVIDENCE: Specific facts proving it
4. IMPACT: Why it matters

REQUIREMENTS:
- Contrast known vs unknown
- Use specific numbers, names, quotes
- Visual details of the hidden story
- 4-7 short sentences
- 280 chars max
- NO "this shows us" or modern parallels

EXAMPLE STRUCTURE:
"You know [event]. You don't know [detail]. [Specific fact]. [Specific fact]. [Impact]."`,

    [CONTENT_CATEGORIES.ALMOST_HAPPENED.name]: `${baseInfo}

GOAL: Show how close history came to being different

STRUCTURE:
1. WHAT ALMOST HAPPENED: Specific alternate outcome
2. HOW CLOSE: Exact margin (minutes, feet, one decision)
3. WHO/WHAT PREVENTED: Specific person or moment
4. STAKES: What was at risk

REQUIREMENTS:
- Emphasize "almost" - create tension
- Specific margins (30 minutes, 10 feet, one vote)
- Visual description of the near-miss moment
- 4-6 sentences
- 280 chars max

EXAMPLE STRUCTURE:
"[X] almost happened. [Specific margin]. [Who/what stopped it]. [What was at stake]. [Final image]."`,

    [CONTENT_CATEGORIES.OBJECT_STORIES.name]: `${baseInfo}

GOAL: Tell history through ONE specific object

STRUCTURE:
1. OBJECT: What it was (specific, visual)
2. MOMENT: When/how it was used
3. IMPACT: What changed because of it
4. FATE: What happened to the object

REQUIREMENTS:
- Focus on THE object, not general category
- Physical description (size, color, material if relevant)
- Specific numbers (170 words, 6 pages, etc.)
- Trace cause and effect
- 4-7 sentences
- 280 chars max

EXAMPLE STRUCTURE:
"One [object]. [Physical detail]. [When used]. [Impact]. [Object's fate]."`,

    [CONTENT_CATEGORIES.STRANGE_COINCIDENCE.name]: `${baseInfo}

GOAL: Highlight bizarre coincidence that seems impossible

STRUCTURE:
1. COINCIDENCE: What matched impossibly
2. SPECIFICS: Exact details that align
3. ODDS: How unlikely (if quantifiable)
4. IMPACT: Optional - if it mattered

REQUIREMENTS:
- Emphasize exact matches (same day, same hour, same place)
- Use numbers and dates precisely
- Build sense of "what are the odds?"
- 4-6 sentences
- 280 chars max
- Let the coincidence speak for itself

EXAMPLE STRUCTURE:
"[Person A] and [Person B] both [action]. Same [day/time/place]. [Specific match]. [Specific match]. [Optional reaction]."`,

    [CONTENT_CATEGORIES.NUMBERS_SHOCK.name]: `${baseInfo}

GOAL: Use numbers to create emotional impact

STRUCTURE:
1. NUMBER: The shocking statistic
2. CONTEXT: What it meant for real people
3. COMPARISON: Scale (if helpful)
4. HIDDEN TRUTH: What the numbers don't show

REQUIREMENTS:
- Lead with the number
- Translate to human impact
- Use contrasts (official vs real, counted vs uncounted)
- Specific examples of individuals in the numbers
- 4-7 sentences
- 280 chars max

EXAMPLE STRUCTURE:
"[Number] [what]. [Context about people]. [Official vs reality]. [Hidden truth]."`,

    [CONTENT_CATEGORIES.INJUSTICE.name]: `${baseInfo}

GOAL: Make readers feel the injustice

STRUCTURE:
1. WRONG: What unjust thing happened
2. VICTIM: Specific person/group affected
3. PERPETRATOR: Who did it or allowed it
4. SCALE: How bad it was
5. RESOLUTION: What happened (often: nothing)

REQUIREMENTS:
- Specific victims with names when possible
- Concrete actions and consequences
- Factual tone (let the facts create anger)
- No editorializing - facts speak for themselves
- 5-8 sentences
- 280 chars max

EXAMPLE STRUCTURE:
"[Person/group] [what happened to them]. [Who did it]. [Scale]. [What should have happened]. [What actually happened]."`,

    [CONTENT_CATEGORIES.MICRO_STORY.name]: `${baseInfo}

GOAL: Complete narrative arc in one tweet

STRUCTURE:
1. SETUP: Scene, character, situation
2. CONFLICT: Problem or tension
3. ACTION: What happened
4. RESOLUTION: Outcome (surprising if possible)

REQUIREMENTS:
- Beginning, middle, end
- One clear protagonist
- Specific visual details
- Active voice, present or past tense
- Tension and payoff
- 4-8 short sentences
- 280 chars max

EXAMPLE STRUCTURE:
"[Setup]. [Conflict]. [Action]. [Action]. [Resolution]. [Final image]."`,
  };

  return categoryPrompts[category.name] || categoryPrompts[CONTENT_CATEGORIES.MICRO_STORY.name];
}

/**
 * Predict engagement potential of content
 */
async function predictEngagement(content, category) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'system',
        content: `You are an expert at predicting Twitter engagement for historical content.

Analyze content for:
1. EMOTIONAL IMPACT (shock, awe, anger, sadness, triumph)
2. VISUAL LANGUAGE (can you picture it?)
3. HUMAN CONNECTION (is there a person at the center?)
4. SURPRISE FACTOR (did you know this?)
5. SHAREABILITY (would you send this to a friend?)

Score each 0-20, total 0-100.`
      }, {
        role: 'user',
        content: `Score this historical tweet:

"${content}"

Category: ${category.name}

Respond in JSON:
{
  "emotional": 0-20,
  "visual": 0-20,
  "human": 0-20,
  "surprise": 0-20,
  "shareable": 0-20,
  "total": 0-100,
  "weakPoint": "what could be better",
  "strongPoint": "what works well"
}`
      }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('[Engagement] Prediction failed:', error.message);
    return {
      emotional: 15,
      visual: 15,
      human: 15,
      surprise: 15,
      shareable: 15,
      total: 75,
      weakPoint: 'Unknown',
      strongPoint: 'Unknown'
    };
  }
}

/**
 * Enhanced content generation with viral optimization
 */
export async function generateEnhancedContent(prompt, context = {}, options = {}) {
  const {
    maxAttempts = 3,
    targetConfidence = 95,
    minConfidence = 90,
    minEngagement = 75,
    queueMedium = true
  } = options;

  let attempt = 0;
  let content = null;
  let verification = null;
  let engagement = null;
  let bestResult = null;

  while (attempt < maxAttempts) {
    attempt++;
    console.log(`[EnhancedGen] 🎯 Attempt ${attempt}/${maxAttempts}`);

    try {
      // Generate content (or corrected version)
      if (attempt === 1) {
        content = await generateContent(prompt);
      } else if (verification?.corrections?.length > 0) {
        console.log(`[EnhancedGen] 🔧 Applying ${verification.corrections.length} corrections`);
        const correctionPrompt = buildCorrectionPrompt(content, verification);
        content = await generateContent(correctionPrompt);
      } else {
        content = await generateContent(prompt);
      }

      // Verify accuracy (GPT-4 + Wikipedia)
      verification = await verifyAndDecide(content, context);

      // Predict engagement potential
      engagement = await predictEngagement(content, context.category || CONTENT_CATEGORIES.MICRO_STORY);

      console.log(`[EnhancedGen] 📊 Accuracy: ${verification.confidence}% | Engagement: ${engagement.total}/100`);
      console.log(`[EnhancedGen] 💪 Strong: ${engagement.strongPoint}`);
      console.log(`[EnhancedGen] ⚠️  Weak: ${engagement.weakPoint}`);

      // Track best result (balance accuracy + engagement)
      const combinedScore = verification.confidence * 0.7 + engagement.total * 0.3;
      if (!bestResult || combinedScore > (bestResult.verification.confidence * 0.7 + bestResult.engagement.total * 0.3)) {
        bestResult = { content, verification, engagement, combinedScore };
      }

      // IDEAL: High accuracy + high engagement
      if (verification.confidence >= targetConfidence && engagement.total >= minEngagement) {
        console.log(`[EnhancedGen] ✅ PERFECT! Accuracy: ${verification.confidence}%, Engagement: ${engagement.total}/100`);
        return {
          content,
          verification,
          engagement,
          status: 'APPROVED',
          autoApproved: true,
          attempts: attempt,
          wikipediaVerified: verification.wikipediaVerified
        };
      }

      // GOOD: High accuracy, decent engagement
      if (verification.confidence >= minConfidence) {
        console.log(`[EnhancedGen] ✅ APPROVED (${verification.confidence}%, engagement: ${engagement.total})`);
        return {
          content,
          verification,
          engagement,
          status: 'APPROVED',
          autoApproved: true,
          attempts: attempt
        };
      }

      // MEDIUM: Try to improve
      if (verification.confidence >= 70 && attempt < maxAttempts) {
        console.log(`[EnhancedGen] 🔄 ${verification.confidence}% - improving...`);
        continue;
      }

      // LOW: Retry fresh
      if (attempt < maxAttempts) {
        console.log(`[EnhancedGen] ❌ ${verification.confidence}% - retry`);
        verification.corrections = [];
        continue;
      }

    } catch (error) {
      console.error(`[EnhancedGen] 💥 Error:`, error.message);
      if (attempt === maxAttempts) throw error;
    }
  }

  // Use best result
  if (bestResult) {
    const conf = bestResult.verification.confidence;

    if (conf >= 85 && queueMedium) {
      const queueItem = await addToQueue({
        content: bestResult.content,
        context,
        verification: bestResult.verification,
        engagement: bestResult.engagement
      });
      return {
        content: bestResult.content,
        verification: bestResult.verification,
        engagement: bestResult.engagement,
        status: 'QUEUED',
        queueId: queueItem.id,
        autoApproved: false,
        attempts: maxAttempts
      };
    } else {
      return {
        content: bestResult.content,
        verification: bestResult.verification,
        engagement: bestResult.engagement,
        status: 'REJECTED',
        autoApproved: false,
        attempts: maxAttempts
      };
    }
  }

  throw new Error('Failed to generate content');
}

async function generateContent(prompt) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VOICE_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.9, // Higher for more creative, emotional content
    max_tokens: 500
  });

  return response.choices[0].message.content.trim();
}

/**
 * Generate enhanced tweet with category selection
 */
export async function generateEnhancedTweet(event, options = {}) {
  const category = selectContentCategory(event);
  const prompt = buildViralPrompt(event, category);

  console.log(`[EnhancedGen] 📂 Category: ${category.name} (expected engagement: ${category.engagementScore}/100)`);

  return generateEnhancedContent(prompt, {
    year: event.year,
    eventDescription: event.description,
    contentType: 'single_tweet',
    category: category
  }, options);
}

/**
 * Generate enhanced thread
 */
export async function generateEnhancedThread(event, options = {}) {
  const category = selectContentCategory(event);

  const prompt = `Year: ${event.year}
Event: ${event.description}

Create a 5-6 tweet thread that tells a STORY.

THREAD STRUCTURE:
1. HOOK: One shocking sentence that stops the scroll
2. SETUP: Scene, characters, context (visual details)
3. TENSION: What's at stake, what could go wrong
4. CLIMAX: The crucial moment (slow it down, add detail)
5. RESOLUTION: What happened (surprising if possible)
6. REFLECTION: One thought-provoking sentence (NO modern parallels unless essential)

VOICE:
- Cinematic and visual
- Short sentences. Like this.
- Focus on ONE person's experience
- Specific details (names, ages, colors, sounds)
- Create suspense
- Make readers FEEL something

AVOID:
- Starting with "On this day..."
- Modern parallels ("Just like today...")
- Analytical language
- Hashtags, emojis

FORMAT: Numbered tweets (1-6), each on new line.
Each tweet 280 chars max.
Be SPECIFIC with facts for verification.`;

  return generateEnhancedContent(prompt, {
    year: event.year,
    eventDescription: event.description,
    contentType: 'thread',
    category: category
  }, options);
}

export { CONTENT_CATEGORIES, selectContentCategory, predictEngagement };
