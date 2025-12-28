// moderation.js
// Content moderation and safety checks

import { openai, SYSTEM_PROMPT } from "./openaiCommon.js";
import { withTimeout, retryWithBackoff } from "./utils.js";
import { warn, error } from "./logger.js";

const OPENAI_TIMEOUT = 15000; // 15 seconds for moderation

// Sensitive topics to filter
const SENSITIVE_TOPICS = [
  "genocide",
  "holocaust",
  "massacre",
  "torture",
  "atrocity",
  "war crime",
  "ethnic cleansing",
];

// Keywords that might need careful handling
const SENSITIVE_KEYWORDS = [
  "nazi",
  "hitler",
  "concentration camp",
  "slavery",
  "lynching",
  "execution",
];

/**
 * Check if content contains sensitive topics
 */
export function containsSensitiveContent(text) {
  const lowerText = text.toLowerCase();
  
  return {
    hasSensitive: SENSITIVE_TOPICS.some(topic => lowerText.includes(topic)),
    hasKeywords: SENSITIVE_KEYWORDS.some(keyword => lowerText.includes(keyword)),
    topics: SENSITIVE_TOPICS.filter(topic => lowerText.includes(topic)),
    keywords: SENSITIVE_KEYWORDS.filter(keyword => lowerText.includes(keyword)),
  };
}

/**
 * Moderate content using AI
 */
export async function moderateContent(content, contentType = "tweet") {
  try {
    const check = containsSensitiveContent(content);
    
    // If no sensitive content, approve
    if (!check.hasSensitive && !check.hasKeywords) {
      return {
        approved: true,
        reason: "No sensitive content detected",
      };
    }

    // Use AI to check if content is appropriate
    const moderationPrompt = `
You are a content moderator for a history education bot.

Content to review:
"${content}"

Content type: ${contentType}

This content mentions: ${check.topics.join(", ") || check.keywords.join(", ")}

Determine if this content is:
1. APPROPRIATE - Educational, respectful, historically accurate, suitable for general audience
2. NEEDS_REVISION - Historically important but needs careful wording
3. INAPPROPRIATE - Too graphic, offensive, or inappropriate for educational bot

Consider:
- Is it educational and historically accurate?
- Is it respectful of victims and sensitive topics?
- Is it appropriate for a general audience?
- Does it provide context and education?

Respond with ONLY one word: APPROPRIATE, NEEDS_REVISION, or INAPPROPRIATE
`;

    const completion = await retryWithBackoff(async () => {
      return await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a content moderator. Be strict but fair. Educational historical content is generally appropriate if respectful." },
            { role: "user", content: moderationPrompt },
          ],
          temperature: 0.3,
          max_tokens: 10,
        }),
        OPENAI_TIMEOUT
      );
    });

    const result = completion.choices[0]?.message?.content?.trim().toUpperCase();
    
    if (result === "APPROPRIATE") {
      warn("Sensitive content approved by moderation", { 
        topics: check.topics,
        keywords: check.keywords,
      });
      return {
        approved: true,
        reason: "AI moderation: Appropriate for educational purposes",
        flagged: true,
      };
    } else if (result === "NEEDS_REVISION") {
      warn("Content needs revision", { 
        topics: check.topics,
        keywords: check.keywords,
      });
      return {
        approved: false,
        reason: "Content needs revision for sensitive topics",
        flagged: true,
        needsRevision: true,
      };
    } else {
      error("Content rejected by moderation", { 
        topics: check.topics,
        keywords: check.keywords,
      });
      return {
        approved: false,
        reason: "Content inappropriate for educational bot",
        flagged: true,
      };
    }

  } catch (err) {
    error("Moderation check failed", { error: err.message });
    // On error, be conservative - don't approve if sensitive content detected
    const check = containsSensitiveContent(content);
    if (check.hasSensitive) {
      return {
        approved: false,
        reason: "Moderation check failed, sensitive content detected",
        flagged: true,
      };
    }
    // If no sensitive content and check failed, approve (fail open for non-sensitive)
    return {
      approved: true,
      reason: "Moderation check failed, no sensitive content detected",
    };
  }
}

/**
 * Check if event description is appropriate
 */
export async function isEventAppropriate(event) {
  const description = event.description || "";
  const moderation = await moderateContent(description, "historical event");
  return moderation.approved;
}

/**
 * Filter sensitive content from tweet
 */
export function filterSensitiveContent(text) {
  // This is a simple filter - in production, use more sophisticated filtering
  let filtered = text;
  
  // Replace potentially offensive terms with alternatives (if needed)
  // For now, just return as-is since we're doing AI moderation
  
  return filtered;
}

/**
 * Check if content is safe to post
 */
export async function isContentSafe(content, contentType = "tweet") {
  // Quick keyword check first
  const check = containsSensitiveContent(content);
  
  if (!check.hasSensitive && !check.hasKeywords) {
    return { safe: true, reason: "No sensitive content" };
  }

  // Run AI moderation
  const moderation = await moderateContent(content, contentType);
  
  return {
    safe: moderation.approved,
    reason: moderation.reason,
    flagged: moderation.flagged,
    needsRevision: moderation.needsRevision,
  };
}



