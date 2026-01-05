# 🚀 AI-Powered Viral Content Selection System

## Overview

Complete redesign of event selection from **keyword-based** to **AI-powered viral engagement scoring** with automatic geographic diversity.

## The Problem We Solved

**Old System:**
- ❌ Keyword matching ("revolutionary war" = iconic)
- ❌ Manual penalties for specific topics
- ❌ Western/US-biased "iconic events" list
- ❌ No understanding of what actually engages audiences
- ❌ Required constant tuning and whack-a-mole fixes

**New System:**
- ✅ AI evaluates each event for viral potential
- ✅ Scores based on universal appeal, emotion, surprise
- ✅ Automatic geographic diversity rotation
- ✅ Self-optimizing based on engagement data
- ✅ No manual intervention needed

## How It Works

### 1. AI-Powered Viral Scoring

**Every event is scored on 5 dimensions (0-100):**

```javascript
{
  "universalAppeal": 85,      // Does this transcend borders/cultures?
  "emotionalImpact": 92,      // Does this evoke strong feelings?
  "surpriseFactor": 78,       // Is this unexpected/counterintuitive?
  "visualDrama": 90,          // Can people picture this vividly?
  "storyQuality": 88,         // Does it have a narrative arc?
  "totalScore": 86,           // Average of above
  "category": "HUMAN_DRAMA",  // Engagement-based category
  "hook": "One sentence viral hook"
}
```

**Categories are engagement-based, not topic-based:**
- **HUMAN_DRAMA** (95) - Personal stories of betrayal, courage, sacrifice
- **BIZARRE_FACTS** (98) - Mind-blowing unexpected truths
- **EPIC_SCALE** (92) - Huge numbers, massive events
- **HIDDEN_CONNECTIONS** (94) - Simultaneous events that blow minds
- **UNDERDOG_VICTORIES** (90) - Against-all-odds triumphs
- **MYSTERIES** (93) - Unsolved puzzles, intrigue
- **INVENTIONS_FIRSTS** (88) - Revolutionary breakthroughs
- **CULTURAL_IMPACT** (85) - Art, music, literature

### 2. Geographic Diversity System

**Tracks posts by region for last 14 days:**
- Asia
- Africa
- Europe
- Americas
- Middle East
- Oceania
- Global
- Americas-US (tracked separately)

**Automatic balancing:**
- Underrepresented regions get +25 score boost
- Overrepresented regions get -30 penalty
- Target: ~5 posts per region per week (balanced distribution)

**US Content Limit:**
- If >50% of average regional posts are US-specific → -30 penalty
- Forces global diversity automatically

### 3. Selection Algorithm

```
1. Fetch 20+ events for today from API
2. Score top 20 candidates with GPT-4 (batch processing)
3. Detect region for each event
4. Check recent post distribution (last 7 days)
5. Apply diversity boosts/penalties
6. Sort by final score
7. Weighted random from top 3 (60% / 30% / 10%)
8. Track selected region for future diversity
```

## Data Files

### `data/regional-diversity.json`
```json
{
  "recentPosts": [
    {
      "date": "2026-01-05T10:00:00Z",
      "description": "Event description...",
      "region": "Asia",
      "year": 1453
    }
  ],
  "regionCounts": {
    "Asia": 12,
    "Africa": 8,
    "Europe": 15,
    "Americas": 10,
    "Americas-US": 3,
    "Middle East": 5,
    "Oceania": 2,
    "Global": 10
  }
}
```

## Example Selection Process

**Input:** 20 events from January 5th

**Step 1: AI Scoring**
```
Event A: "Richmond burns" → 65/100 (US content, emotionally strong but regional)
Event B: "Silk Road opens" → 88/100 (global impact, epic scale, mystery)
Event C: "Mali Empire expansion" → 82/100 (underdog, cultural impact)
```

**Step 2: Region Detection**
```
Event A: Americas-US
Event B: Global
Event C: Africa
```

**Step 3: Check Recent Distribution (last 7 days)**
```
Asia: 3 posts
Africa: 1 post  ← UNDERREPRESENTED
Europe: 6 posts
Americas-US: 4 posts ← OVERREPRESENTED
```

**Step 4: Apply Diversity Adjustments**
```
Event A: 65 - 30 (US penalty) = 35
Event B: 88 + 0 (Global, neutral) = 88
Event C: 82 + 25 (Africa boost) = 107 ✅ WINNER
```

**Step 5: Select**
```
Top 3:
1. Event C (Africa, 107) - 60% chance
2. Event B (Global, 88) - 30% chance
3. Event A (US, 35) - 10% chance

Selected: Event C (Mali Empire expansion)
```

**Result:** Globally diverse, high engagement potential, automatic balancing.

## Benefits

### For Content Quality
- Events selected based on **what will engage**, not what's "important"
- AI understands human appeal better than keyword matching
- Viral hooks generated automatically
- Categories aligned with actual engagement patterns

### For Global Diversity
- Automatic rotation through world regions
- No manual penalties needed
- Self-balancing system
- US content naturally limited to ~15-20%

### For Growth
- Higher engagement rates from better content
- Appeals to international audience
- Stops the scroll with surprising/emotional content
- Builds reputation as THE global history account

### For Maintenance
- No more manual tuning of penalties
- System learns from actual engagement data (via growth engine)
- Geographic diversity handled automatically
- Sustainable long-term

## Integration Points

### `fetchEvents.js`
```javascript
import { selectViralEvent } from "./viralContentSelector.js";

const selectedEvent = await selectViralEvent(usableEvents);
// Returns event with viral metadata attached
```

### Event Metadata
```javascript
{
  year: 1324,
  description: "Mansa Musa's pilgrimage to Mecca...",
  viralScore: {
    totalScore: 92,
    category: "EPIC_SCALE",
    hook: "One man's generosity crashed gold markets for 12 years"
  },
  region: "Africa",
  category: "EPIC_SCALE"
}
```

### Growth Engine Integration
- Viral scores tracked alongside engagement metrics
- A/B testing can test different scoring thresholds
- Community preferences inform future selections
- Trending topics can override with historical parallels

## Monitoring

**Check logs for:**
```
[Viral] Scoring 20 events...
[Viral] "Event description..." scored 88/100
[Viral]   Category: BIZARRE_FACTS | Hook: Mind-blowing hook
[Diversity] Underrepresented regions: Africa, Middle East
[Diversity] ⚠️ US content overrepresented (4 posts in last 7 days)
[Diversity] +25 boost for Africa: "Mali Empire..."
[Diversity] -30 penalty for Americas-US: "Richmond burns..."
[Viral] Top 3 candidates:
  1. [107] EPIC_SCALE - Africa
  2. [88] GLOBAL - Global
  3. [35] HUMAN_DRAMA - Americas-US
[Viral] ✅ SELECTED: EPIC_SCALE (Africa) - Score: 107
[Events] ✅ Selected: EPIC_SCALE from Africa
[Events]    Viral Score: 92/100
```

**Check data file:**
```bash
cat data/regional-diversity.json | jq '.recentPosts | .[0:7] | group_by(.region) | map({region: .[0].region, count: length})'
```

## Success Metrics

**Week 1:**
- Baseline viral scores (avg 70-80)
- Regional distribution established
- US content reduced to 20%

**Month 1:**
- Viral scores correlate with actual engagement
- Geographic diversity maintained (20% per major region)
- Higher engagement rates vs old system

**Month 3:**
- System self-optimizing based on engagement data
- Consistent 80+ viral scores
- Balanced global content
- No manual intervention needed

## Future Enhancements

**Possible additions:**
1. **Time period diversity** - Rotate through ancient/medieval/modern
2. **Learning from engagement** - Boost categories that perform well
3. **Trending topic integration** - Viral selector picks historical parallels
4. **User preference learning** - Community manager informs selection
5. **Multi-language optimization** - Score for different language audiences

---

**Status:** ✅ **PRODUCTION READY**

**Impact:** Systematic solution to content diversity and engagement. No more whack-a-mole penalties. Self-optimizing viral content selection with automatic global diversity.
