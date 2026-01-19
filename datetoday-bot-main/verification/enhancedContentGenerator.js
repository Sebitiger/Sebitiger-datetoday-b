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

// STRATEGIC VOICE - Historical patterns for modern leaders
const VOICE_SYSTEM_PROMPT = `You are a strategic analyst who identifies historical patterns that repeat in business, markets, and leadership.

TARGET AUDIENCE: Founders, investors, executives, strategists (Premium X users)

CRITICAL RULES:
- MAXIMUM 280 characters per tweet
- ALWAYS connect historical event to modern business/strategy pattern
- NO hashtags, NO emojis
- NO rhetorical questions - use DECLARATIVE statements only
- Authoritative, analytical tone

STRUCTURE:
1. PATTERN STATEMENT (What repeats)
2. HISTORICAL EXAMPLE (Specific case with dates/names)
3. MODERN RELEVANCE (Why founders/investors should care)

VOICE:
- Analytical, not storytelling
- Pattern-focused, not narrative
- Specific names, dates, numbers
- "This pattern repeats" not "This is interesting"
- Actionable insights for decision-makers

PERFECT EXAMPLES:
"Every market collapse follows the same 3-phase pattern. 1929, 2008, 2022 all started with leverage, euphoria, then sudden liquidity crisis. Smart money watches debt levels, not valuations."

"Failed empires always ignore logistics. Rome, Napoleon, Germany in Russia. Modern companies do the same - chase growth, forget supply chain. Distribution beats product every time."

"Monopolies collapse when they stop innovating. Kodak invented digital cameras in 1975, then buried it to protect film sales. Filed bankruptcy 2012. Disruption comes from within."

WHAT FOUNDERS/INVESTORS CARE ABOUT:
- Market cycles and crashes
- Why empires/companies fail
- Competitive strategy lessons
- Timing and opportunity windows
- Resource allocation mistakes
- Leadership decision patterns
- Innovation vs. execution
- Network effects and scale

AVOID:
- Pure historical trivia
- "Fun facts" with no application
- Academic historical analysis
- Modern politics or controversy
- Anything irrelevant to strategy/business

Your job: Extract repeating patterns that help modern leaders make better decisions.`;

// STRATEGIC CATEGORIES - Business patterns that repeat
const CONTENT_CATEGORIES = {
  MARKET_CYCLE: {
    name: "Market Cycle Pattern",
    description: "Economic booms, crashes, recoveries that repeat",
    engagementScore: 98,
    examples: ["Tulip mania", "1929 crash", "Dot-com bubble", "2008 crisis"]
  },
  EMPIRE_COLLAPSE: {
    name: "Why Empires/Companies Fail",
    description: "Patterns in organizational decline",
    engagementScore: 95,
    examples: ["Rome ignored barbarians", "Kodak killed its own innovation", "Blockbuster rejected Netflix"]
  },
  COMPETITIVE_STRATEGY: {
    name: "Competitive Advantage",
    description: "How underdogs win against giants",
    engagementScore: 94,
    examples: ["David vs Goliath tactics", "Asymmetric warfare", "Market disruption"]
  },
  INNOVATION_TIMING: {
    name: "Innovation & Timing",
    description: "Breakthroughs and why timing matters",
    engagementScore: 92,
    examples: ["Too early inventions", "First mover advantage", "Network effects"]
  },
  RESOURCE_ALLOCATION: {
    name: "Resource Allocation Failure",
    description: "Misallocation of capital, talent, attention",
    engagementScore: 90,
    examples: ["Betting on wrong technology", "Ignoring emerging threat", "Overinvesting in legacy"]
  },
  LEADERSHIP_DECISION: {
    name: "Leadership Decision Pattern",
    description: "Critical moments where leaders made/avoided mistakes",
    engagementScore: 88,
    examples: ["CEO succession", "Pivot decisions", "Risk management failures"]
  },
  NETWORK_EFFECTS: {
    name: "Network Effects & Scale",
    description: "How dominant players emerge and fall",
    engagementScore: 85,
    examples: ["Standard wars", "Platform dominance", "Metcalfe's Law in action"]
  },
  GEOPOLITICAL_SHIFT: {
    name: "Geopolitical/Trade Pattern",
    description: "Power shifts, trade routes, resource control",
    engagementScore: 82,
    examples: ["Currency collapse", "Trade war outcomes", "Supply chain shifts"]
  }
};

/**
 * Analyze event and choose best strategic category
 * PRIORITIZES business-relevant patterns over trivia
 */
function selectContentCategory(event) {
  // Safety check: default to market cycle if no description
  if (!event.description || typeof event.description !== 'string') {
    return CONTENT_CATEGORIES.MARKET_CYCLE;
  }

  const desc = event.description.toLowerCase();
  const year = event.year;

  // PRIORITY 1: Market cycles, financial crises, economic patterns
  if (desc.includes('crash') || desc.includes('panic') || desc.includes('depression') ||
      desc.includes('bubble') || desc.includes('mania') || desc.includes('crisis') ||
      desc.includes('collapse') || desc.includes('bankrupt') || desc.includes('recession') ||
      desc.includes('inflation') || desc.includes('stock') || desc.includes('market')) {
    return CONTENT_CATEGORIES.MARKET_CYCLE;
  }

  // PRIORITY 2: Empire/company collapses and organizational failure
  if (desc.includes('fall of') || desc.includes('end of') || desc.includes('dissolved') ||
      desc.includes('collapse') || desc.includes('defeated') || desc.includes('conquered') ||
      desc.includes('failed') || desc.includes('abolished') || desc.includes('extinct')) {
    return CONTENT_CATEGORIES.EMPIRE_COLLAPSE;
  }

  // PRIORITY 3: Innovation, technology, breakthroughs
  if (desc.includes('invented') || desc.includes('invention') ||
      desc.includes('discovered') || desc.includes('discovery') ||
      desc.includes('first') || desc.includes('breakthrough') ||
      desc.includes('patent') || desc.includes('technology')) {
    return CONTENT_CATEGORIES.INNOVATION_TIMING;
  }

  // PRIORITY 4: Competitive strategy, warfare, asymmetric tactics
  if (desc.includes('battle') || desc.includes('war') || desc.includes('defeated') ||
      desc.includes('victory') || desc.includes('strategy') || desc.includes('tactic')) {
    return CONTENT_CATEGORIES.COMPETITIVE_STRATEGY;
  }

  // PRIORITY 5: Geopolitical shifts, trade, treaties
  if (desc.includes('treaty') || desc.includes('trade') || desc.includes('alliance') ||
      desc.includes('empire') || desc.includes('independence') || desc.includes('territory') ||
      desc.includes('founded') || desc.includes('established')) {
    return CONTENT_CATEGORIES.GEOPOLITICAL_SHIFT;
  }

  // PRIORITY 6: Leadership decisions and succession
  if (desc.includes('emperor') || desc.includes('king') || desc.includes('queen') ||
      desc.includes('president') || desc.includes('leader') || desc.includes('throne') ||
      desc.includes('crowned') || desc.includes('proclaimed')) {
    return CONTENT_CATEGORIES.LEADERSHIP_DECISION;
  }

  // PRIORITY 7: Resource allocation and investment mistakes
  if (desc.includes('built') || desc.includes('invested') || desc.includes('spent') ||
      desc.includes('allocated') || desc.includes('project') || desc.includes('construction')) {
    return CONTENT_CATEGORIES.RESOURCE_ALLOCATION;
  }

  // PRIORITY 8: Network effects, standards, scale
  if (desc.includes('network') || desc.includes('standard') || desc.includes('adopted') ||
      desc.includes('spread') || desc.includes('expansion')) {
    return CONTENT_CATEGORIES.NETWORK_EFFECTS;
  }

  // Default to market cycle (most relevant for founders/investors)
  return CONTENT_CATEGORIES.MARKET_CYCLE;
}

/**
 * Generate strategic content prompts by category
 * ALL PROMPTS MUST CONNECT TO MODERN BUSINESS/LEADERSHIP PATTERNS
 */
function buildViralPrompt(event, category) {
  // CRITICAL DEBUG: Log what we're building the prompt with
  console.log(`[EnhancedGen] 🔍 BUILDING PROMPT WITH:`);
  console.log(`[EnhancedGen]    Event.description: "${event.description?.slice(0, 80)}..."`);

  const baseInfo = `Year: ${event.year}
Event: ${event.description}
Date: ${event.monthName} ${event.day}`;

  const categoryPrompts = {
    [CONTENT_CATEGORIES.MARKET_CYCLE.name]: `${baseInfo}

Extract the REPEATING PATTERN from this economic/market event and connect to modern markets.

RULES:
- MAXIMUM 280 characters
- Pattern FIRST, then historical example, then modern relevance
- No trivia - only actionable insights
- Authoritative, analytical tone

STRUCTURE:
1. STATE THE PATTERN ("Every market collapse follows [pattern]")
2. HISTORICAL CASE (specific dates, numbers, names)
3. MODERN APPLICATION ("Smart money watches [X], not [Y]")

EXAMPLE:
"Every market collapse follows the same 3-phase pattern. 1929, 2008, 2022 all started with leverage, euphoria, then sudden liquidity crisis. Smart money watches debt levels, not valuations."

Focus on: Cycles, crashes, manias, liquidity, leverage, timing.`,

    [CONTENT_CATEGORIES.EMPIRE_COLLAPSE.name]: `${baseInfo}

Extract why empires/organizations fail - connect to modern companies.

RULES:
- MAXIMUM 280 characters
- Failure pattern FIRST, then historical case, then modern lesson
- Authoritative, analytical

STRUCTURE:
1. FAILURE PATTERN ("Failed empires always ignore [X]")
2. HISTORICAL CASE (Rome, Napoleon, specific example)
3. MODERN LESSON ("Modern companies do the same")

EXAMPLE:
"Failed empires always ignore logistics. Rome, Napoleon, Germany in Russia. Modern companies do the same - chase growth, forget supply chain. Distribution beats product every time."

Focus on: Why dominance ends, organizational decay, complacency, disruption.`,

    [CONTENT_CATEGORIES.COMPETITIVE_STRATEGY.name]: `${baseInfo}

Extract asymmetric strategy - how underdogs win.

RULES:
- MAXIMUM 280 characters
- Strategy FIRST, then historical example, then business application
- Tactical, not emotional

STRUCTURE:
1. STRATEGY PRINCIPLE ("Asymmetric warfare works when [pattern]")
2. HISTORICAL CASE (specific battle, names, dates)
3. BUSINESS APPLICATION ("Startups beat incumbents the same way")

EXAMPLE:
"Guerrilla tactics work when you control timing and terrain. Vietnam beat France, then the US. Startups do the same - pick battles, own the niche. Don't fight on incumbent's turf."

Focus on: David vs Goliath tactics, resource constraints, asymmetric advantages.`,

    [CONTENT_CATEGORIES.INNOVATION_TIMING.name]: `${baseInfo}

Extract innovation timing pattern - why ideas succeed or fail.

RULES:
- MAXIMUM 280 characters
- Timing pattern FIRST, then historical case, then modern implication
- Focus on when, not just what

STRUCTURE:
1. TIMING PRINCIPLE ("Too-early innovations die because [reason]")
2. HISTORICAL CASE (invention, year, outcome)
3. MODERN LESSON ("Watch for [market condition]")

EXAMPLE:
"Monopolies collapse when they stop innovating. Kodak invented digital cameras in 1975, then buried it to protect film sales. Filed bankruptcy 2012. Disruption comes from within."

Focus on: First mover vs. fast follower, market readiness, adoption curves.`,

    [CONTENT_CATEGORIES.RESOURCE_ALLOCATION.name]: `${baseInfo}

Extract resource allocation mistake - capital, talent, attention.

RULES:
- MAXIMUM 280 characters
- Mistake pattern FIRST, then historical case, then lesson
- Focus on misallocated resources

STRUCTURE:
1. ALLOCATION MISTAKE ("Leaders always overinvest in [yesterday's winner]")
2. HISTORICAL CASE (empire, company, specific numbers/dates)
3. MODERN WARNING ("Watch where capital flows")

EXAMPLE:
"France built the Maginot Line for $9B in 1930s. Impenetrable static defense. Germany went around it in 3 days. Fighting the last war is always expensive."

Focus on: Sunk cost fallacy, betting on legacy, misreading threats.`,

    [CONTENT_CATEGORIES.LEADERSHIP_DECISION.name]: `${baseInfo}

Extract leadership decision pattern - critical moments that matter.

RULES:
- MAXIMUM 280 characters
- Decision pattern FIRST, then historical case, then modern relevance
- Focus on the choice, not the person

STRUCTURE:
1. DECISION PATTERN ("Succession crises happen when [reason]")
2. HISTORICAL CASE (leader, year, outcome)
3. MODERN APPLICATION ("CEOs face same choice")

EXAMPLE:
"Leadership transitions fail when founders hold too long. Alexander the Great died at 32 with no heir. Empire split into civil war. Succession planning beats genius."

Focus on: Succession, pivots, crisis decisions, CEO mistakes.`,

    [CONTENT_CATEGORIES.NETWORK_EFFECTS.name]: `${baseInfo}

Extract network effects pattern - how winners emerge and dominate.

RULES:
- MAXIMUM 280 characters
- Network pattern FIRST, then historical case, then modern parallel
- Focus on scale and standards

STRUCTURE:
1. NETWORK PRINCIPLE ("[Winner] dominated because of [network effect]")
2. HISTORICAL CASE (railroad gauge, currency, standard)
3. MODERN PARALLEL ("Same dynamic in [tech/crypto/AI]")

EXAMPLE:
"Standard wars create monopolies. QWERTY keyboard won in 1878 not because it was best, but because typists learned it first. Switching costs locked it in. Network effects beat quality."

Focus on: Standards, platforms, locked-in effects, switching costs.`,

    [CONTENT_CATEGORIES.GEOPOLITICAL_SHIFT.name]: `${baseInfo}

Extract geopolitical pattern - power shifts, trade, resources.

RULES:
- MAXIMUM 280 characters
- Shift pattern FIRST, then historical case, then modern implication
- Focus on macro forces

STRUCTURE:
1. SHIFT PATTERN ("Empires rise when they control [resource/route]")
2. HISTORICAL CASE (trade route, treaty, territorial shift)
3. MODERN LENS ("Today's version: [AI chips/semiconductors/energy]")

EXAMPLE:
"Naval powers control trade. Venice dominated Mediterranean 1000-1500. Then Atlantic routes opened. Spain rose, Venice fell. Geography shifts power. Today: whoever controls data wins."

Focus on: Trade routes, resource control, currency dominance, supply chains.`,
  };

  return categoryPrompts[category.name] || categoryPrompts[CONTENT_CATEGORIES.MARKET_CYCLE.name];
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

  let content = response.choices[0].message.content.trim();

  // CRITICAL: Remove any hashtags that slip through
  content = content.replace(/#\w+/g, '').trim();

  // Remove double spaces created by hashtag removal
  content = content.replace(/\s+/g, ' ').trim();

  return content;
}

/**
 * Generate enhanced tweet with category selection
 */
export async function generateEnhancedTweet(event, options = {}) {
  // CRITICAL DEBUG: Log the exact event we received
  console.log(`[EnhancedGen] 🔍 RECEIVED EVENT:`);
  console.log(`[EnhancedGen]    Year: ${event.year}`);
  console.log(`[EnhancedGen]    Description: "${event.description?.slice(0, 80)}..."`);

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
