/**
 * VIRAL CONTENT SELECTOR
 *
 * AI-powered event selection based on viral potential and global appeal
 * Replaces keyword-based "iconic event" detection with engagement-focused scoring
 */

import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

const DIVERSITY_FILE = path.join(process.cwd(), 'data', 'regional-diversity.json');

// VIRAL CATEGORIES (engagement-based, not topic-based)
export const VIRAL_CATEGORIES = {
  HUMAN_DRAMA: {
    description: "Personal stories of betrayal, courage, sacrifice",
    engagementScore: 95,
    examples: ["Benedict Arnold's betrayal", "Harriet Tubman's escapes", "Joan of Arc's trial"]
  },

  BIZARRE_FACTS: {
    description: "Mind-blowing unexpected truths that stop the scroll",
    engagementScore: 98,
    examples: ["Cleopatra closer to iPhone than pyramids", "Sharks older than trees"]
  },

  EPIC_SCALE: {
    description: "Huge numbers, massive events, overwhelming scope",
    engagementScore: 92,
    examples: ["Library of Alexandria burning (400k scrolls)", "Genghis Khan's empire spanning continents"]
  },

  HIDDEN_CONNECTIONS: {
    description: "Simultaneous events that blow minds",
    engagementScore: 94,
    examples: ["Nintendo founded during Jack the Ripper era", "Last woolly mammoth died when pyramids already ancient"]
  },

  UNDERDOG_VICTORIES: {
    description: "Against-all-odds triumphs that inspire",
    engagementScore: 90,
    examples: ["Battle of Thermopylae", "Haitian Revolution", "Inca engineering marvels"]
  },

  MYSTERIES: {
    description: "Unsolved puzzles, intrigue, lost civilizations",
    engagementScore: 93,
    examples: ["Voynich Manuscript", "Lost colony of Roanoke", "Antikythera mechanism"]
  },

  INVENTIONS_FIRSTS: {
    description: "Revolutionary breakthroughs that changed everything",
    engagementScore: 88,
    examples: ["First flight", "Printing press", "Compass navigation"]
  },

  CULTURAL_IMPACT: {
    description: "Art, music, literature that shaped civilizations",
    engagementScore: 85,
    examples: ["Shakespeare's first performance", "Sistine Chapel completion", "Gutenberg Bible"]
  }
};

// WORLD REGIONS for diversity tracking
export const WORLD_REGIONS = {
  'Asia': ['china', 'japan', 'india', 'korea', 'mongol', 'persia', 'vietnam', 'thailand', 'indonesia', 'philippines'],
  'Africa': ['egypt', 'mali', 'ethiopia', 'zulu', 'ashanti', 'carthage', 'nubia', 'kush', 'zimbabwe', 'morocco'],
  'Europe': ['rome', 'greece', 'france', 'britain', 'spain', 'germany', 'italy', 'russia', 'viking', 'celtic'],
  'Americas': ['aztec', 'maya', 'inca', 'olmec', 'native american', 'brazil', 'mexico', 'peru', 'argentina'],
  'Middle East': ['babylon', 'mesopotamia', 'sumeria', 'ottoman', 'arabia', 'jerusalem', 'baghdad', 'damascus'],
  'Oceania': ['aboriginal', 'polynesian', 'maori', 'hawaii', 'easter island', 'australia', 'new zealand'],
  'Global': ['trade', 'exploration', 'discovery', 'epidemic', 'climate', 'astronomy', 'mathematics']
};

/**
 * AI-POWERED VIRAL POTENTIAL SCORING
 * Uses GPT-4 to evaluate events for engagement potential
 */
export async function scoreViralPotential(event) {
  try {
    const prompt = `Rate this historical event for viral social media potential:

Event: "${event.description}" (${event.year})

Score 0-100 for each dimension:

1. UNIVERSAL APPEAL - Does this transcend borders/cultures?
   - 90-100: Human story anyone worldwide can relate to
   - 70-89: Interesting to broad international audience
   - 50-69: Regional interest but still accessible
   - 0-49: Requires specific cultural context

2. EMOTIONAL IMPACT - Does this evoke strong feelings?
   - 90-100: Powerful emotions (betrayal, courage, tragedy, triumph)
   - 70-89: Interesting but less emotionally gripping
   - 50-69: Mild emotional response
   - 0-49: Dry facts, no emotional hook

3. SURPRISE FACTOR - Is this unexpected/counterintuitive?
   - 90-100: "WHAT?! I never knew that!" reaction
   - 70-89: Interesting detail most don't know
   - 50-69: Somewhat surprising
   - 0-49: Expected/well-known fact

4. VISUAL DRAMA - Can people picture this vividly?
   - 90-100: Paints extremely vivid mental picture
   - 70-89: Good visual elements
   - 50-69: Some visual imagery
   - 0-49: Abstract/hard to visualize

5. STORY QUALITY - Does it have a narrative arc?
   - 90-100: Complete story (setup, twist, resolution)
   - 70-89: Good narrative elements
   - 50-69: Basic story structure
   - 0-49: Just a date/name/fact

Return ONLY valid JSON (no markdown, no explanations):
{
  "universalAppeal": <0-100>,
  "emotionalImpact": <0-100>,
  "surpriseFactor": <0-100>,
  "visualDrama": <0-100>,
  "storyQuality": <0-100>,
  "totalScore": <average of above 5>,
  "category": "<HUMAN_DRAMA|BIZARRE_FACTS|EPIC_SCALE|HIDDEN_CONNECTIONS|UNDERDOG_VICTORIES|MYSTERIES|INVENTIONS_FIRSTS|CULTURAL_IMPACT>",
  "hook": "<One sentence viral hook for this event>",
  "reasoning": "<Brief explanation of scores>"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a viral content expert analyzing historical events for social media engagement. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 400
    });

    const result = JSON.parse(response.choices[0].message.content);

    console.log(`[Viral] "${event.description.substring(0, 60)}..." scored ${result.totalScore}/100`);
    console.log(`[Viral]   Category: ${result.category} | Hook: ${result.hook}`);

    return result;

  } catch (error) {
    console.error('[Viral] Scoring failed:', error.message);
    // Fallback to basic scoring if AI fails
    return {
      universalAppeal: 50,
      emotionalImpact: 50,
      surpriseFactor: 50,
      visualDrama: 50,
      storyQuality: 50,
      totalScore: 50,
      category: 'CULTURAL_IMPACT',
      hook: event.description,
      reasoning: 'Fallback scoring (AI unavailable)'
    };
  }
}

/**
 * BATCH SCORE EVENTS
 * Scores multiple events in parallel (with rate limiting)
 */
export async function batchScoreEvents(events, maxConcurrent = 3) {
  console.log(`[Viral] Scoring ${events.length} events...`);

  const results = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < events.length; i += maxConcurrent) {
    const batch = events.slice(i, i + maxConcurrent);
    const batchScores = await Promise.all(
      batch.map(event => scoreViralPotential(event))
    );
    results.push(...batchScores);

    // Rate limiting: wait between batches
    if (i + maxConcurrent < events.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * DETECT REGION from event description
 */
export function detectRegion(event) {
  const desc = event.description?.toLowerCase() || '';
  const year = event.year || 0;

  // AGGRESSIVE US DETECTION (for heavy penalty - target 2% content)
  // Check for US-specific keywords, people, places, events
  const usPatterns = [
    // Country names
    /\b(america|american|united states|u\.s\.|usa)\b/i,

    // Founding fathers and presidents
    /\b(washington|jefferson|lincoln|roosevelt|kennedy|madison|adams|hamilton|franklin)\b/i,
    /\b(jackson|grant|eisenhower|reagan|truman|polk|mckinley)\b/i,

    // Government/institutions
    /\b(congress|senate|president|supreme court|white house)\b/i,
    /\b(declaration of independence|bill of rights|constitution)\b/i,
    /\b(nasa|fbi|cia|pentagon)\b/i,

    // Wars/conflicts
    /\b(revolutionary war|civil war|war of 1812|mexican war|spanish.american war)\b/i,
    /\b(confederate|union|yankee|continental army|colonial america)\b/i,

    // ALL 50 US STATES (comprehensive list)
    /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware)\b/i,
    /\b(florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky)\b/i,
    /\b(louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri)\b/i,
    /\b(montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york)\b/i,
    /\b(north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island)\b/i,
    /\b(south carolina|south dakota|tennessee|texas|utah|vermont|virginia)\b/i,
    /\b(washington state|west virginia|wisconsin|wyoming)\b/i,

    // Major US cities
    /\b(boston|philadelphia|new york city|baltimore|richmond|atlanta|miami)\b/i,
    /\b(chicago|detroit|cleveland|pittsburgh|new orleans|houston|dallas|san antonio)\b/i,
    /\b(los angeles|san francisco|san diego|seattle|denver|phoenix|las vegas)\b/i,

    // US territories and historical regions
    /\b(territory of orleans|louisiana territory|texas republic|republic of texas)\b/i,
    /\b(puerto rico|guam|american samoa|u\.s\. virgin islands)\b/i,

    // Historical US figures
    /\b(harriet tubman|frederick douglass|booker t|martin luther king|malcolm x)\b/i,
    /\b(susan b\. anthony|sitting bull|geronimo|crazy horse|pocahontas)\b/i,

    // US-specific events/movements
    /\b(slave revolt|slavery|underground railroad|emancipation)\b/i,
    /\b(manifest destiny|gold rush|dust bowl|great migration)\b/i,
    /\b(wall street|stock market|federal reserve)\b/i
  ];

  for (const pattern of usPatterns) {
    if (pattern.test(desc)) {
      console.log(`[Region] 🇺🇸 US content detected: "${desc.substring(0, 60)}..."`);
      return 'Americas-US'; // Special flag for aggressive penalty
    }
  }

  // Check for US events by year (post-1776)
  if (year >= 1776 && year < 1900) {
    if (desc.match(/war|battle|treaty|declaration|act|law/i)) {
      // Check if NOT explicitly international
      if (!desc.match(/britain|france|spain|mexico|international|world/i)) {
        console.log(`[Region] 🇺🇸 Likely US event (1776-1900): "${desc.substring(0, 60)}..."`);
        return 'Americas-US';
      }
    }
  }

  // Now check for other regions
  for (const [region, keywords] of Object.entries(WORLD_REGIONS)) {
    for (const keyword of keywords) {
      if (desc.includes(keyword)) {
        return region;
      }
    }
  }

  // Check year-based regions for ancient/medieval
  if (event.year < 1500) {
    // Ancient/Medieval - check for civilizations
    if (desc.match(/rome|roman|greece|greek|sparta|athens/)) return 'Europe';
    if (desc.match(/egypt|africa|carthage/)) return 'Africa';
    if (desc.match(/china|dynasty|silk road|confucius/)) return 'Asia';
    if (desc.match(/maya|aztec|inca/)) return 'Americas';
  }

  return 'Global'; // Default if can't determine
}

/**
 * LOAD REGIONAL DIVERSITY DATA
 */
async function loadDiversityData() {
  try {
    const data = await fs.readFile(DIVERSITY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Initialize if doesn't exist
    return {
      recentPosts: [], // Last 14 days of posts with regions
      regionCounts: {
        'Asia': 0,
        'Africa': 0,
        'Europe': 0,
        'Americas': 0,
        'Americas-US': 0,
        'Middle East': 0,
        'Oceania': 0,
        'Global': 0
      }
    };
  }
}

/**
 * SAVE REGIONAL DIVERSITY DATA
 */
async function saveDiversityData(data) {
  await fs.writeFile(DIVERSITY_FILE, JSON.stringify(data, null, 2));
}

/**
 * TRACK REGIONAL POST
 * Called after each post to track regional diversity
 */
export async function trackRegionalPost(event, region) {
  const data = await loadDiversityData();

  data.recentPosts.unshift({
    date: new Date().toISOString(),
    description: event.description.substring(0, 100),
    region: region,
    year: event.year
  });

  // Keep only last 14 days (70 posts at 5/day)
  data.recentPosts = data.recentPosts.slice(0, 70);

  // Update counts
  data.regionCounts[region] = (data.regionCounts[region] || 0) + 1;

  await saveDiversityData(data);

  console.log(`[Diversity] Posted ${region} content. Recent distribution:`);
  const recent7Days = data.recentPosts.slice(0, 35); // Last 7 days
  const distribution = {};
  for (const post of recent7Days) {
    distribution[post.region] = (distribution[post.region] || 0) + 1;
  }
  console.log(`[Diversity]`, distribution);
}

/**
 * GET UNDERREPRESENTED REGIONS
 * Returns regions that need more content
 */
export async function getUnderrepresentedRegions() {
  const data = await loadDiversityData();

  // Look at last 7 days (35 posts)
  const recent = data.recentPosts.slice(0, 35);

  const regionCounts = {};
  for (const post of recent) {
    regionCounts[post.region] = (regionCounts[post.region] || 0) + 1;
  }

  // Calculate ideal distribution (excluding Americas-US as special case)
  const mainRegions = ['Asia', 'Africa', 'Europe', 'Americas', 'Middle East', 'Oceania', 'Global'];
  const avgPerRegion = recent.length / mainRegions.length; // ~5 per region in 7 days

  // Find underrepresented
  const underrepresented = mainRegions.filter(region => {
    const count = regionCounts[region] || 0;
    return count < avgPerRegion * 0.7; // Less than 70% of average
  });

  // AGGRESSIVE US PENALTY - Target 2% (max ~1 post per week out of 35)
  // ALWAYS penalize US content by default (not just after quota hit)
  const usCount = regionCounts['Americas-US'] || 0;
  const targetUSPosts = 0.7; // 2% of 35 posts = 0.7 posts per week

  // CRITICAL FIX: Always penalize US content (strategy is minimize US, not "wait until quota")
  const usOverrepresented = true; // ALWAYS apply penalty to enforce 2% target

  console.log(`[Diversity] Underrepresented regions: ${underrepresented.join(', ')}`);
  console.log(`[Diversity] US posts in last 7 days: ${usCount} (target: <1, ideal: 0)`);
  console.log(`[Diversity] 🚫 US content ALWAYS PENALIZED (2% target = minimize by default)`);

  return {
    boost: underrepresented,
    penalize: ['Americas-US'] // ALWAYS penalize US content
  };
}

/**
 * SELECT VIRAL EVENT with diversity
 * Main selection algorithm
 */
export async function selectViralEvent(events) {
  console.log(`[Viral] Selecting from ${events.length} events...`);

  // Step 1: Score all events for viral potential (batch process top candidates)
  const topCandidates = events.slice(0, 20); // Score top 20 to save API calls
  const viralScores = await batchScoreEvents(topCandidates);

  // Step 2: Detect regions
  const eventData = topCandidates.map((event, i) => ({
    event,
    viralScore: viralScores[i],
    region: detectRegion(event)
  }));

  // Step 3: Get diversity requirements
  const diversity = await getUnderrepresentedRegions();

  // Step 4: Apply diversity boost/penalty
  const scoredEvents = eventData.map(item => {
    let finalScore = item.viralScore.totalScore;

    // BOOST underrepresented regions
    if (diversity.boost.includes(item.region)) {
      finalScore += 25;
      console.log(`[Diversity] +25 boost for ${item.region}: "${item.event.description.substring(0, 50)}..."`);
    }

    // SMART US PENALTY - Quality gate for exceptional content
    if (diversity.penalize.includes(item.region)) {
      // Quality gate: Reduced penalty for truly exceptional US content
      if (item.viralScore.totalScore >= 90) {
        // Allow globally significant US events (moon landing, MLK, etc.)
        finalScore -= 30; // Reduced penalty for 90+ viral score
        console.log(`[Diversity] ⭐ -30 REDUCED penalty for exceptional US content (${item.viralScore.totalScore}/100): "${item.event.description.substring(0, 50)}..."`);
      } else {
        // Heavy penalty for typical US content (wars, politics, regional events)
        finalScore -= 75; // Heavy penalty for <90 viral score
        console.log(`[Diversity] 🚫 -75 HEAVY PENALTY for US content (${item.viralScore.totalScore}/100): "${item.event.description.substring(0, 50)}..."`);
      }
    }

    return {
      ...item,
      finalScore
    };
  });

  // Step 5: Sort by final score
  scoredEvents.sort((a, b) => b.finalScore - a.finalScore);

  // Step 6: Select from top 3 (weighted random to add variety)
  const top3 = scoredEvents.slice(0, 3);

  console.log('[Viral] Top 3 candidates:');
  top3.forEach((item, i) => {
    console.log(`  ${i + 1}. [${item.finalScore}] ${item.viralScore.category} - ${item.region}`);
    console.log(`     "${item.event.description.substring(0, 70)}..."`);
  });

  // Weighted random: 60% chance for #1, 30% for #2, 10% for #3
  const rand = Math.random();
  let selected;
  if (rand < 0.6) {
    selected = top3[0];
  } else if (rand < 0.9) {
    selected = top3[1] || top3[0];
  } else {
    selected = top3[2] || top3[1] || top3[0];
  }

  console.log(`[Viral] ✅ SELECTED: ${selected.viralScore.category} (${selected.region}) - Score: ${selected.finalScore}`);
  console.log(`[Viral]    Hook: "${selected.viralScore.hook}"`);

  // Track this post for diversity
  await trackRegionalPost(selected.event, selected.region);

  // Attach viral metadata to event
  selected.event.viralScore = selected.viralScore;
  selected.event.region = selected.region;
  selected.event.category = selected.viralScore.category;

  return selected.event;
}
