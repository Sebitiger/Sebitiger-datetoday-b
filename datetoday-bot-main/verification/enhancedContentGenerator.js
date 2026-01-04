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

// VIRAL VOICE - Brief, shocking, accessible
const VOICE_SYSTEM_PROMPT = `You are a viral history storyteller. Your goal: stop the scroll.

CRITICAL RULES:
- MAXIMUM 280 characters (Twitter limit)
- 2-3 sentences MAXIMUM
- Hook FIRST (shocking fact leads)
- Global audience (not just Americans)
- NO hashtags, NO emojis, NO modern parallels
- Simple language (10th grade reading level)

STRUCTURE:
1. SHOCKING HOOK (1 sentence that stops scroll)
2. BRIEF CONTEXT (1 sentence explaining)
3. IMPACT (1 sentence showing stakes) - OPTIONAL

VOICE:
- Punchy and fast
- Specific names, dates, numbers
- Deadpan delivery (facts speak for themselves)
- Accessible to NON-historians

EXAMPLES OF PERFECT LENGTH:
"Cleopatra lived closer to the iPhone than to the pyramids. 2,500 years separated her from pyramid construction. Only 2,000 years separate us from her."

"July 4, 1776. America declared independence. The signer John Hancock made his signature massive so King George could read it without glasses."

AVOID:
- Long scene-setting
- Academic language
- "Picture this..." "Imagine..." (just tell it)
- Multiple paragraphs
- Anything over 280 characters

Your job: Make history VIRAL.`;

// CONTENT CATEGORIES - Ranked by viral potential
const CONTENT_CATEGORIES = {
  BIZARRE_FACT: {
    name: "Bizarre Fact",
    description: "Strange truths that seem impossible",
    engagementScore: 98,
    examples: ["Cleopatra/iPhone timeline", "Napoleon's height myth", "Oxford older than Aztecs"]
  },
  INVENTION_DISCOVERY: {
    name: "Invention/Discovery",
    description: "Breakthroughs that changed everything",
    engagementScore: 95,
    examples: ["First flight", "Penicillin discovered", "Printing press invented"]
  },
  UNDERDOG_TRIUMPH: {
    name: "Underdog/Comeback",
    description: "Against-all-odds victories",
    engagementScore: 94,
    examples: ["Escaped slavery", "Defeated empire", "Survived impossible odds"]
  },
  SHOCKING_DETAIL: {
    name: "Shocking Detail",
    description: "Unknown facts about famous events",
    engagementScore: 92,
    examples: ["Hidden truth about known events", "What they didn't tell you"]
  },
  NUMBERS_SHOCK: {
    name: "Mind-Blowing Numbers",
    description: "Statistics that defy belief",
    engagementScore: 90,
    examples: ["Timeline comparisons", "Scale revelations", "Unexpected quantities"]
  },
  CULTURAL_MOMENT: {
    name: "Cultural Moment",
    description: "Art, music, literature that changed culture",
    engagementScore: 85,
    examples: ["First novel", "Revolutionary artwork", "Banned book"]
  },
  HUMAN_DRAMA: {
    name: "Human Drama",
    description: "Personal stories with high emotional stakes",
    engagementScore: 88,
    examples: ["Last words", "Final choice", "Personal sacrifice"]
  },
  BATTLE_STORY: {
    name: "Battle Story",
    description: "Military conflicts (lowest priority)",
    engagementScore: 70,
    examples: ["Only if truly iconic", "Focus on human angle", "Avoid if possible"]
  }
};

/**
 * Analyze event and choose best content category
 * PRIORITIZES viral-worthy content over battles
 */
function selectContentCategory(event) {
  const desc = event.description.toLowerCase();
  const year = event.year;

  // PRIORITY 1: Bizarre facts and timeline comparisons
  if (year < 1000 || desc.includes('oldest') || desc.includes('ancient')) {
    return CONTENT_CATEGORIES.BIZARRE_FACT;
  }

  // PRIORITY 2: Inventions and discoveries
  if (desc.includes('invented') || desc.includes('invention') ||
      desc.includes('discovered') || desc.includes('discovery') ||
      desc.includes('first') || desc.includes('breakthrough') ||
      desc.includes('patent')) {
    return CONTENT_CATEGORIES.INVENTION_DISCOVERY;
  }

  // PRIORITY 3: Cultural moments (art, literature, music)
  if (desc.includes('published') || desc.includes('premiered') ||
      desc.includes('composed') || desc.includes('painted') ||
      desc.includes('exhibition') || desc.includes('artwork') ||
      desc.includes('novel') || desc.includes('opera') || desc.includes('symphony')) {
    return CONTENT_CATEGORIES.CULTURAL_MOMENT;
  }

  // PRIORITY 4: Underdog/triumph stories
  if (desc.includes('escaped') || desc.includes('survived') ||
      desc.includes('against odds') || desc.includes('defeated') ||
      desc.includes('overcame') || desc.includes('triumph')) {
    return CONTENT_CATEGORIES.UNDERDOG_TRIUMPH;
  }

  // PRIORITY 5: Mind-blowing numbers
  if (desc.match(/\d{3,}/) || desc.includes('million') || desc.includes('thousand')) {
    return CONTENT_CATEGORIES.NUMBERS_SHOCK;
  }

  // PRIORITY 6: Human drama
  if (desc.includes('died') || desc.includes('killed') || desc.includes('assassin') || desc.includes('execution')) {
    return CONTENT_CATEGORIES.HUMAN_DRAMA;
  }

  // PRIORITY 7: Shocking details about famous events
  const famousKeywords = ['world war', 'revolution', 'independence', 'assassination'];
  if (famousKeywords.some(kw => desc.includes(kw))) {
    return CONTENT_CATEGORIES.SHOCKING_DETAIL;
  }

  // LAST RESORT: Battle stories (lowest engagement)
  if (desc.includes('battle') || desc.includes('war')) {
    return CONTENT_CATEGORIES.BATTLE_STORY;
  }

  // Default to bizarre fact (most viral)
  return CONTENT_CATEGORIES.BIZARRE_FACT;
}

/**
 * Generate viral-optimized content prompts by category
 * ALL PROMPTS ENFORCE 280 CHARACTER LIMIT
 */
function buildViralPrompt(event, category) {
  const baseInfo = `Year: ${event.year}
Event: ${event.description}
Date: ${event.monthName} ${event.day}`;

  const categoryPrompts = {
    [CONTENT_CATEGORIES.BIZARRE_FACT.name]: `${baseInfo}

Create a viral tweet that makes people say "WHAT?!"

RULES:
- MAXIMUM 280 characters
- 2-3 sentences only
- Lead with the bizarre fact
- Simple language (global audience)
- Specific numbers/names

STRUCTURE:
1. Shocking fact FIRST
2. Brief explanation
3. Optional: why it matters

EXAMPLE:
"Oxford University existed 300 years before the Aztec Empire. Teaching started at Oxford in 1096. The Aztecs founded Tenochtitlan in 1325."`,

    [CONTENT_CATEGORIES.INVENTION_DISCOVERY.name]: `${baseInfo}

Create viral tweet about breakthrough discovery/invention.

RULES:
- MAXIMUM 280 characters
- 2-3 sentences only
- Hook first (the "wow" moment)
- Global accessible language

STRUCTURE:
1. Discovery/invention announced
2. Brief impact/significance
3. Optional: surprising detail

EXAMPLE:
"January 15, 1759. The British Museum opened to the public. First major national museum free to all. Democracy in action through knowledge."`,

    [CONTENT_CATEGORIES.UNDERDOG_TRIUMPH.name]: `${baseInfo}

Create viral underdog story - against-all-odds victory.

RULES:
- MAXIMUM 280 characters
- 2-3 sentences only
- Lead with impossible odds
- Then reveal triumph

STRUCTURE:
1. The impossible situation
2. The triumph/victory
3. Optional: impact

EXAMPLE:
"Harriet Tubman escaped slavery at 27. Then returned to the South 13 times to free 70 more. Never lost a single person. They called her Moses."`,

    [CONTENT_CATEGORIES.SHOCKING_DETAIL.name]: `${baseInfo}

Reveal shocking unknown detail about famous event.

RULES:
- MAXIMUM 280 characters
- 2-3 sentences only
- "You know X. You don't know Y." structure works well
- Specific facts only

STRUCTURE:
1. Reference famous event
2. Reveal hidden detail
3. Specific evidence

EXAMPLE:
"You know the Titanic sank in 1912. You don't know the band kept playing as it went down. All 8 musicians drowned. Not one tried to save himself."`,

    [CONTENT_CATEGORIES.NUMBERS_SHOCK.name]: `${baseInfo}

Use shocking numbers/statistics for impact.

RULES:
- MAXIMUM 280 characters
- 2-3 sentences only
- Lead with the number
- Make it human/relatable

STRUCTURE:
1. The shocking number
2. What it meant
3. Comparison for scale (optional)

EXAMPLE:
"The Great Wall of China took 2,000 years to build. Over 1 million workers died during construction. Their bodies were buried inside the wall."`,

    [CONTENT_CATEGORIES.CULTURAL_MOMENT.name]: `${baseInfo}

Create viral tweet about art/culture/literature breakthrough.

RULES:
- MAXIMUM 280 characters
- 2-3 sentences only
- Make it accessible (not academic)
- Show why it mattered

STRUCTURE:
1. The cultural moment
2. Why it was revolutionary
3. Optional: lasting impact

EXAMPLE:
"1937. Picasso unveiled Guernica. 25-foot painting of bombing horror. Changed how the world saw war art. Still hangs as anti-war symbol today."`,

    [CONTENT_CATEGORIES.HUMAN_DRAMA.name]: `${baseInfo}

Tell ONE person's dramatic moment.

RULES:
- MAXIMUM 280 characters
- 2-3 sentences only
- Focus on one person
- Emotional stakes clear

STRUCTURE:
1. Person and high-stakes moment
2. Their choice/action
3. Outcome

EXAMPLE:
"Sophie Scholl was 21 when Nazis caught her distributing anti-Hitler leaflets. Refused to recant. Executed by guillotine days later. 'Such a fine sunny day.'"`,

    [CONTENT_CATEGORIES.BATTLE_STORY.name]: `${baseInfo}

Battle story - focus on HUMAN angle, not tactics.

RULES:
- MAXIMUM 280 characters
- 2-3 sentences only
- Human stakes (not strategy)
- Accessible to non-military audience

STRUCTURE:
1. Key human moment in battle
2. Stakes/significance
3. Outcome

EXAMPLE:
"Agincourt, 1415. English longbowmen, starving and outnumbered 5 to 1, faced French knights. Mud saved them. French cavalry drowned in it. England won."`,
  };

  return categoryPrompts[category.name] || categoryPrompts[CONTENT_CATEGORIES.BIZARRE_FACT.name];
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
    temperature: 0.8, // High creativity but controlled
    max_tokens: 150  // REDUCED: Force brevity (280 chars ≈ 70 tokens)
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
