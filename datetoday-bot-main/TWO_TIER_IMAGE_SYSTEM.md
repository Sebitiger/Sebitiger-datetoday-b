# Two-Tier Image System

## 🎯 Overview

The bot now uses a **two-tier approach** to find images:

1. **TIER 1 (Strict)**: Try to find exact images of the specific event
2. **TIER 2 (Fallback)**: Find thematic/period-appropriate images that reflect the era and theme

This ensures posts **almost always have engaging historical images** instead of text-only.

---

## 📊 How It Works

### TIER 1: Exact Event Matching (Strict Standards)

**Goal**: Find the actual event/person/location

**Sources** (in priority order):
1. Library of Congress
2. Smithsonian
3. Wikimedia Commons
4. Wikipedia (fallback)

**Verification**:
- GPT-4 Vision analyzes image accuracy
- Historical Accuracy Score: 0-100
- Image Quality Score: 0-100
- Combined Score = 60% accuracy + 25% quality + 15% source reliability

**Acceptance Threshold**:
- ✅ **APPROVED**: Combined score ≥ 75
- ⚠️ **ACCEPTABLE**: Combined score ≥ 60
- ❌ **REJECTED**: Combined score < 60

**Example**:
```
Event: "1776 Norfolk burning"
Search: "Norfolk Virginia 1776", "burning of Norfolk"
Result: ❌ Not found (too specific)
→ Move to TIER 2
```

---

### TIER 2: Thematic Fallback (Relaxed Standards)

**Goal**: Find visually engaging images that reflect the era, theme, and keywords

**Thematic Search Terms** (auto-generated from event):

1. **Era-based**:
   - Ancient (< 500)
   - Medieval (500-1500)
   - Renaissance (1500-1800)
   - 19th century (1800-1900)
   - Early 20th century (1900-1950)
   - Modern (1950+)

2. **War/Conflict themes**:
   - "World War 1", "WW1", "trenches", "Great War"
   - "World War 2", "WW2", "WW2 soldiers"
   - "Civil War", "American Civil War"
   - "Revolutionary War", "American Revolution"

3. **Event type themes**:
   - Treaty: "treaty signing", "diplomacy", "political leaders"
   - Discovery: "exploration", "discovery", "explorers"
   - Science: "invention", "innovation", "science history"

4. **Generic fallbacks**:
   - "1776 history", "historical 1776", "history 1770s"

**Verification** (Relaxed):
- GPT-4 Vision checks **thematic appropriateness**
- Thematic Score: 0-100
  - 80-100: Perfect fit (shows era/theme)
  - 60-79: Good fit (period-appropriate)
  - 40-59: Acceptable (roughly right era)
  - 0-39: Not appropriate

**Acceptance Threshold**:
- ✅ **APPROVED**: Thematic score ≥ 50 (much lower than Tier 1!)

**Example**:
```
Event: "1776 Norfolk burning"
Generated Terms:
1. "revolutionary war" ← Try this
2. "american revolution"
3. "colonial america"
4. "18th century"
5. "1776 history"

Search: "revolutionary war" on Library of Congress
Result: ✅ Found Revolutionary War battle painting
Thematic Score: 72/100 → APPROVED!
→ Post with this image
```

---

## 🔄 Complete Workflow

```
┌─────────────────────────────────────┐
│ Event: "1945 Operation Bodenplatte" │
└─────────────────────────────────────┘
                 ↓
    ┌────────────────────────────┐
    │ TIER 1: Exact Match Search │
    └────────────────────────────┘
                 ↓
    Search: "Operation Bodenplatte 1945"
    Fetch from: LOC, Smithsonian, Wikimedia
                 ↓
    Found: Theodore Roosevelt letter (wrong)
    GPT-4 Vision: Accuracy 30/100 → REJECTED
                 ↓
    ┌────────────────────────────┐
    │ TIER 2: Thematic Fallback  │
    └────────────────────────────┘
                 ↓
    Generated Terms:
    1. "world war 2"
    2. "ww2"
    3. "luftwaffe"
    4. "1945 history"
                 ↓
    Search: "world war 2" on Library of Congress
    Found: WW2 aircraft photo
    GPT-4 Vision: Thematic 75/100 → APPROVED!
                 ↓
         ✅ POST WITH IMAGE
```

---

## 📈 Expected Results

### Before (Single Tier):
- ❌ Many text-only posts (images rejected as inaccurate)
- ❌ Logos/symbols incorrectly matched (US Army logo for 1781 event)
- ❌ Low engagement (no visuals)

### After (Two Tier):
- ✅ Almost always has an image
- ✅ No logos (Tier 1 rejects them, Tier 2 finds real photos)
- ✅ Period-appropriate visuals even if not exact event
- ✅ Higher engagement (visual content performs better)
- ✅ Still historically credible (images reflect the era/theme)

---

## 🎨 Philosophy

**Better to have**:
- A **Revolutionary War battle scene** for a 1776 Norfolk event
- A **WW2 aircraft photo** for a 1945 Luftwaffe operation
- A **Civil War soldiers photo** for an 1863 battle

**Than**:
- No image (text-only post)
- A logo/symbol (US Army badge)
- A completely wrong modern photo

**The goal**: Be a **visually engaging history account** that's still historically credible.

---

## ⚙️ Configuration

### Adjust Thresholds

Edit `verification/enhancedImageVerifier.js`:

```javascript
// Tier 1: Exact match threshold
if (thematicVerification.thematicScore >= 50) {  // Lower = more permissive
  return fallbackCandidate.buffer;
}
```

Edit `verification/imageSourceConfig.js`:

```javascript
verification: {
  confidenceThreshold: 75,  // Tier 1 acceptance
  rejectBelow: 60,          // Tier 1 hard reject
}
```

### Customize Thematic Terms

Edit `verification/thematicFallback.js`:

```javascript
function extractThematicTerms(event) {
  // Add your own era categories
  // Add custom war/event mappings
  // Adjust search term generation
}
```

---

## 🧪 Testing

**Test Tier 1** (should find exact images):
- Events with famous people/locations
- Major battles with photos
- Well-documented historical moments

**Test Tier 2** (should find thematic images):
- Obscure events from well-known eras
- Generic historical moments
- Events with no surviving photos

**Monitor logs**:
```
[EnhancedVerifier] 📡 TIER 1: Fetching exact-match images...
[EnhancedVerifier] ❌ All exact-match images REJECTED
[EnhancedVerifier] → Trying THEMATIC FALLBACK...
[ThematicFallback] 🎨 Searching for period-appropriate thematic image...
[ThematicFallback] ✅ Found from Library of Congress: "world war 2"
[EnhancedVerifier] ✅ THEMATIC FALLBACK APPROVED (score: 72/100)
```

---

## ✅ Success Criteria

A successful two-tier system means:

1. ✅ **90%+ posts have images** (vs 50% before)
2. ✅ **Zero logos posted** (Tier 2 finds real photos)
3. ✅ **Images are period-appropriate** (verified by GPT-4 Vision)
4. ✅ **Better engagement** (visual content performs better)
5. ✅ **Maintained credibility** (no completely wrong images)

The system automatically logs when using fallback vs exact match, so you can monitor the balance.
