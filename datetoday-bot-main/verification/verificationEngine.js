/**
 * VERIFICATION ENGINE
 * 
 * This system verifies AI-generated historical content for accuracy
 * before posting. It uses a multi-step verification process:
 * 
 * 1. Historical accuracy check
 * 2. Confidence scoring (High/Medium/Low)
 * 3. Source quality assessment
 * 4. Fact-checking against known issues
 * 5. Learning from corrections
 */

import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// Known problematic patterns that need extra scrutiny
const RISKY_PATTERNS = [
  /galileo/i,
  /bruno/i,
  /einstein.*fail/i,
  /medieval.*dirty/i,
  /columbus.*proved/i,
  /napoleon.*short/i,
  /vikings.*horned/i,
  /library.*alexandria.*fire/i,
  /carrots.*eyesight/i,
  /great wall.*space/i
];

// Verification prompt - designed to catch inaccuracies
const VERIFICATION_PROMPT = `You are a rigorous historical fact-checker. Your job is to verify the accuracy of historical claims.

CRITICAL INSTRUCTIONS:
1. Check for historical accuracy
2. Identify any oversimplifications or misleading statements
3. Flag common historical myths
4. Note any missing context that would change the meaning
5. Be STRICT - err on the side of caution

For the given historical content, provide:
1. ACCURACY_SCORE: 0-100 (how accurate is this?)
2. CONFIDENCE_LEVEL: HIGH, MEDIUM, or LOW
3. ISSUES: List any factual problems, oversimplifications, or misleading statements
4. CORRECTIONS: What should be fixed?
5. REASONING: Explain your assessment

Response format (JSON):
{
  "accuracyScore": 85,
  "confidenceLevel": "HIGH",
  "issues": ["Issue 1", "Issue 2"],
  "corrections": ["Correction 1", "Correction 2"],
  "reasoning": "Your detailed reasoning",
  "recommendAction": "APPROVE" | "REVIEW" | "REJECT"
}

SCORING GUIDELINES:
- 90-100: Highly accurate, well-nuanced, properly contextualized
- 70-89: Generally accurate but may lack some nuance or context
- 50-69: Contains some inaccuracies or significant oversimplifications
- Below 50: Misleading or factually incorrect

Be especially careful with:
- Galileo trial claims
- Einstein "failing math" myths
- Medieval "dark ages" stereotypes
- Columbus "proving Earth round" myths
- Napoleon's height
- Viking helmets
- Any "first" claims (often debatable)`;

/**
 * Verify historical content for accuracy
 */
export async function verifyContent(content, eventData = null) {
  try {
    // Check for known risky patterns
    const hasRiskyPattern = RISKY_PATTERNS.some(pattern => 
      pattern.test(content)
    );

    const messages = [
      {
        role: "system",
        content: VERIFICATION_PROMPT
      },
      {
        role: "user",
        content: `Please verify this historical content:

CONTENT TO VERIFY:
"${content}"

${eventData ? `
ORIGINAL EVENT DATA:
Year: ${eventData.year}
Description: ${eventData.description}
` : ''}

Provide your verification assessment in JSON format.`
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3, // Lower temperature for more consistent verification
      response_format: { type: "json_object" }
    });

    const verification = JSON.parse(response.choices[0].message.content);

    // Add risk flag if contains known problematic patterns
    verification.hasRiskyPattern = hasRiskyPattern;

    // Adjust confidence if risky pattern detected
    if (hasRiskyPattern && verification.confidenceLevel === "HIGH") {
      verification.confidenceLevel = "MEDIUM";
      verification.reasoning += " [Downgraded from HIGH due to historically problematic topic]";
    }

    // Log verification
    await logVerification(content, verification);

    return verification;

  } catch (error) {
    console.error("[Verification] Error:", error);
    
    // On error, fail safe - mark as needs review
    return {
      accuracyScore: 50,
      confidenceLevel: "LOW",
      issues: ["Verification system error"],
      corrections: [],
      reasoning: "System error during verification",
      recommendAction: "REVIEW",
      error: error.message
    };
  }
}

/**
 * Determine if content should be auto-posted, queued for review, or rejected
 */
export function getPostingDecision(verification) {
  const { accuracyScore, confidenceLevel, recommendAction } = verification;

  // HIGH confidence + high score = auto-post
  if (confidenceLevel === "HIGH" && accuracyScore >= 85) {
    return {
      action: "APPROVE",
      reason: "High accuracy and confidence"
    };
  }

  // MEDIUM confidence or medium-high score = queue for review
  if (
    (confidenceLevel === "MEDIUM" && accuracyScore >= 70) ||
    (confidenceLevel === "HIGH" && accuracyScore >= 70)
  ) {
    return {
      action: "REVIEW",
      reason: "Needs manual review before posting"
    };
  }

  // LOW confidence or low score = reject
  return {
    action: "REJECT",
    reason: "Insufficient accuracy or confidence"
  };
}

/**
 * Log verification results for learning
 */
async function logVerification(content, verification) {
  try {
    const logDir = path.join(__dirname, '../data/verification-logs');
    await fs.mkdir(logDir, { recursive: true });

    const logEntry = {
      timestamp: new Date().toISOString(),
      content: content.substring(0, 200), // First 200 chars
      verification,
      decision: getPostingDecision(verification)
    };

    const logFile = path.join(logDir, `${new Date().toISOString().split('T')[0]}.jsonl`);
    await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');

  } catch (error) {
    console.error("[Verification] Logging error:", error);
  }
}

/**
 * Get verification stats for monitoring
 */
export async function getVerificationStats(days = 7) {
  try {
    const logDir = path.join(__dirname, '../data/verification-logs');
    const files = await fs.readdir(logDir);
    
    const recentFiles = files
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .slice(-days);

    let stats = {
      total: 0,
      approved: 0,
      reviewed: 0,
      rejected: 0,
      avgAccuracy: 0,
      confidenceLevels: { HIGH: 0, MEDIUM: 0, LOW: 0 }
    };

    let totalAccuracy = 0;

    for (const file of recentFiles) {
      const content = await fs.readFile(path.join(logDir, file), 'utf-8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        if (!line) continue;
        const entry = JSON.parse(line);
        stats.total++;
        stats[entry.decision.action.toLowerCase()]++;
        stats.confidenceLevels[entry.verification.confidenceLevel]++;
        totalAccuracy += entry.verification.accuracyScore;
      }
    }

    if (stats.total > 0) {
      stats.avgAccuracy = Math.round(totalAccuracy / stats.total);
    }

    return stats;

  } catch (error) {
    console.error("[Verification] Stats error:", error);
    return null;
  }
}

/**
 * Load manual corrections to learn from
 */
export async function loadCorrections() {
  try {
    const correctionsFile = path.join(__dirname, '../data/manual-corrections.json');
    const data = await fs.readFile(correctionsFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // No corrections file yet
    return [];
  }
}

/**
 * Save a manual correction for learning
 */
export async function saveCorrection(originalContent, correctedContent, issue) {
  try {
    const corrections = await loadCorrections();
    corrections.push({
      timestamp: new Date().toISOString(),
      original: originalContent,
      corrected: correctedContent,
      issue
    });

    const correctionsFile = path.join(__dirname, '../data/manual-corrections.json');
    await fs.writeFile(correctionsFile, JSON.stringify(corrections, null, 2));

    console.log("[Verification] Correction saved for learning");
  } catch (error) {
    console.error("[Verification] Error saving correction:", error);
  }
}

/**
 * Enhanced verification that learns from past corrections
 */
export async function verifyWithLearning(content, eventData = null) {
  const corrections = await loadCorrections();
  
  // Check if similar content was corrected before
  const similarCorrection = corrections.find(c => 
    c.original && content.toLowerCase().includes(c.original.toLowerCase().substring(0, 50))
  );

  let verification = await verifyContent(content, eventData);

  // If we've seen this mistake before, flag it
  if (similarCorrection) {
    verification.confidenceLevel = "LOW";
    verification.issues.push(`Similar content was corrected before: ${similarCorrection.issue}`);
    verification.recommendAction = "REJECT";
    verification.suggestedFix = similarCorrection.corrected;
  }

  return verification;
}
