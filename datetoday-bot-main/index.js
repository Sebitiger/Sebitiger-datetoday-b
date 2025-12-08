import cron from "node-cron";
import dotenv from "dotenv";
import { postDailyTweet } from "./daily.js";
import { postEveningFact } from "./evening.js";
import { postWeeklyThread } from "./weekly.js";
import { monitorMentions } from "./engagement.js";
import { postPoll } from "./polls.js";
import { postWhatIfThread, postHiddenConnection, postQuickFact, postHistoryDebunk } from "./viralContent.js";
import { info, error, warn } from "./logger.js";
import { runHealthChecks } from "./health.js";
import { cleanOldLogs } from "./logger.js";

dotenv.config();

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
}

// Ensure required credentials exist
["API_KEY", "API_SECRET", "ACCESS_TOKEN", "ACCESS_SECRET", "OPENAI_KEY"].forEach(requireEnv);

info("[DateToday] Bot starting...");

// Enhanced global error logging
process.on("unhandledRejection", (reason) => {
  error("[UnhandledRejection]", { reason: reason?.message || reason });
});

process.on("uncaughtException", (err) => {
  error("[UncaughtException]", { error: err.message, stack: err.stack });
  process.exit(1);
});

// Run initial health check
runHealthChecks().catch(err => {
  warn("Initial health check failed", { error: err.message });
});

// Clean old logs daily
cron.schedule("0 2 * * *", async () => {
  await cleanOldLogs();
}, { timezone: "UTC" });

// Run health checks every hour
cron.schedule("0 * * * *", async () => {
  await runHealthChecks();
}, { timezone: "UTC" });

// Cron expressions are evaluated in UTC by default.
// 09:00 UTC - main On This Day tweet
cron.schedule("0 9 * * *", async () => {
  console.log("[Cron] Running daily On This Day job (09:00 UTC)");
  try {
    await postDailyTweet();
  } catch (err) {
    console.error("[Cron] Daily job failed:", err.message || err);
  }
}, { timezone: "UTC" });

// 18:00 UTC - evening extra fact
cron.schedule("0 18 * * *", async () => {
  console.log("[Cron] Running evening fact job (18:00 UTC)");
  try {
    await postEveningFact();
  } catch (err) {
    console.error("[Cron] Evening job failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Sunday 16:00 UTC - weekly deep dive thread
cron.schedule("0 16 * * 0", async () => {
  console.log("[Cron] Running weekly thread job (Sunday 16:00 UTC)");
  try {
    await postWeeklyThread();
  } catch (err) {
    console.error("[Cron] Weekly job failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Tuesday & Thursday 14:00 UTC - interactive polls
cron.schedule("0 14 * * 2,4", async () => {
  console.log("[Cron] Running poll job (Tuesday/Thursday 14:00 UTC)");
  try {
    await postPoll();
  } catch (err) {
    console.error("[Cron] Poll job failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Wednesday 12:00 UTC - "What If" viral thread
cron.schedule("0 12 * * 3", async () => {
  console.log("[Cron] Running What If thread job (Wednesday 12:00 UTC)");
  try {
    await postWhatIfThread();
  } catch (err) {
    console.error("[Cron] What If job failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Friday 15:00 UTC - Hidden Connections (viral content)
cron.schedule("0 15 * * 5", async () => {
  console.log("[Cron] Running Hidden Connection job (Friday 15:00 UTC)");
  try {
    await postHiddenConnection();
  } catch (err) {
    console.error("[Cron] Hidden Connection job failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Monday 12:00 UTC - Quick Fact (shareable, viral)
cron.schedule("0 12 * * 1", async () => {
  console.log("[Cron] Running Quick Fact job (Monday 12:00 UTC)");
  try {
    await postQuickFact();
  } catch (err) {
    console.error("[Cron] Quick Fact job failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Monday 15:00 UTC - History Debunk (correct misconceptions)
cron.schedule("0 15 * * 1", async () => {
  console.log("[Cron] Running History Debunk job (Monday 15:00 UTC)");
  try {
    await postHistoryDebunk();
  } catch (err) {
    console.error("[Cron] History Debunk job failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Saturday 12:00 UTC - Quick Fact (weekend engagement)
cron.schedule("0 12 * * 6", async () => {
  console.log("[Cron] Running Quick Fact job (Saturday 12:00 UTC)");
  try {
    await postQuickFact();
  } catch (err) {
    console.error("[Cron] Quick Fact job failed:", err.message || err);
  }
}, { timezone: "UTC" });

// Every 15 minutes - check for mentions and engage
cron.schedule("*/15 * * * *", async () => {
  console.log("[Cron] Checking for mentions...");
  try {
    await monitorMentions();
  } catch (err) {
    console.error("[Cron] Mention monitoring failed:", err.message || err);
  }
}, { timezone: "UTC" });

info("[DateToday] Schedules registered. Bot is now waiting for cron triggers.");
info("[DateToday] Engagement system active - monitoring mentions every 15 minutes.");
info("[DateToday] Health monitoring active - checks every hour.");
info("[DateToday] Analytics tracking enabled.");
info("[DateToday] Content moderation enabled.");
