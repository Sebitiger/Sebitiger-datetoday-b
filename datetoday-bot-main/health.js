// health.js
// Health check and monitoring system

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { client } from "./twitterClient.js";
import { openai } from "./openaiCommon.js";
import { info, error, warn } from "./logger.js";
import { getAnalyticsSummary } from "./analytics.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HEALTH_FILE = path.join(__dirname, "data", "health.json");

// Health check status
let healthStatus = {
  status: "unknown",
  lastCheck: null,
  checks: {},
  uptime: process.uptime(),
};

/**
 * Save health status
 */
async function saveHealthStatus() {
  try {
    await fs.mkdir(path.dirname(HEALTH_FILE), { recursive: true });
    await fs.writeFile(HEALTH_FILE, JSON.stringify(healthStatus, null, 2), "utf-8");
  } catch (err) {
    error("Error saving health status", { error: err.message });
  }
}

/**
 * Check Twitter API health
 */
async function checkTwitterAPI() {
  try {
    const me = await client.v2.me();
    return {
      status: "healthy",
      responseTime: Date.now(),
      details: { userId: me.data.id },
    };
  } catch (err) {
    return {
      status: "unhealthy",
      error: err.message,
    };
  }
}

/**
 * Check OpenAI API health
 */
async function checkOpenAIApi() {
  try {
    const start = Date.now();
    // Simple test - just check if we can create a client
    const testCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "test" }],
      max_tokens: 5,
    });
    const responseTime = Date.now() - start;
    
    return {
      status: "healthy",
      responseTime: `${responseTime}ms`,
      details: { model: "gpt-4o-mini" },
    };
  } catch (err) {
    return {
      status: "unhealthy",
      error: err.message,
    };
  }
}

/**
 * Check file system health
 */
async function checkFileSystem() {
  try {
    const dataDir = path.join(__dirname, "data");
    await fs.access(dataDir);
    const stats = await fs.stat(dataDir);
    
    return {
      status: "healthy",
      details: {
        dataDir: dataDir,
        writable: true,
      },
    };
  } catch (err) {
    return {
      status: "unhealthy",
      error: err.message,
    };
  }
}

/**
 * Check memory usage
 */
function checkMemory() {
  const usage = process.memoryUsage();
  const mb = (bytes) => Math.round(bytes / 1024 / 1024 * 100) / 100;

  return {
    status: usage.heapUsed < 500 * 1024 * 1024 ? "healthy" : "warning", // 500MB threshold
    details: {
      heapUsed: `${mb(usage.heapUsed)}MB`,
      heapTotal: `${mb(usage.heapTotal)}MB`,
      rss: `${mb(usage.rss)}MB`,
    },
  };
}

/**
 * Run all health checks
 */
export async function runHealthChecks() {
  info("Running health checks...");
  
  const checks = {
    twitter: await checkTwitterAPI(),
    openai: await checkOpenAIApi(),
    filesystem: await checkFileSystem(),
    memory: checkMemory(),
  };

  // Determine overall status
  const allHealthy = Object.values(checks).every(c => c.status === "healthy");
  const hasWarnings = Object.values(checks).some(c => c.status === "warning");
  
  healthStatus = {
    status: allHealthy ? "healthy" : hasWarnings ? "degraded" : "unhealthy",
    lastCheck: new Date().toISOString(),
    checks,
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
  };

  await saveHealthStatus();

  if (healthStatus.status === "healthy") {
    info("Health checks passed", { checks });
  } else if (healthStatus.status === "degraded") {
    warn("Health checks show warnings", { checks });
  } else {
    error("Health checks failed", { checks });
  }

  return healthStatus;
}

/**
 * Get current health status
 */
export async function getHealthStatus() {
  // Return cached status if recent (within 5 minutes)
  if (healthStatus.lastCheck) {
    const lastCheck = new Date(healthStatus.lastCheck);
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    
    if (lastCheck.getTime() > fiveMinutesAgo) {
      return healthStatus;
    }
  }

  // Otherwise run fresh checks
  return await runHealthChecks();
}

/**
 * Format uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Get detailed health report
 */
export async function getHealthReport() {
  const health = await getHealthStatus();
  const analytics = await getAnalyticsSummary();

  return {
    ...health,
    analytics: {
      totalPosts: analytics.totalPosts,
      averageEngagementRate: analytics.averageEngagementRate,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Health check endpoint (for web monitoring)
 */
export async function healthCheckEndpoint() {
  const health = await getHealthStatus();
  
  return {
    status: health.status,
    timestamp: health.lastCheck,
    uptime: health.uptimeFormatted,
    checks: Object.entries(health.checks).map(([name, check]) => ({
      name,
      status: check.status,
    })),
  };
}

