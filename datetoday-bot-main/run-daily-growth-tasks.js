/**
 * DAILY GROWTH TASKS
 *
 * Run once per day to:
 * - Identify viral posts
 * - Run strategic reply campaigns
 * - Remix top content
 * - Generate community stats
 */

import { runDailyGrowthTasks, getGrowthDashboard } from "./growth/growthEngine.js";
import { info, error } from "./logger.js";

(async () => {
  try {
    console.log('\n═══════════════════════════════════════');
    console.log('🚀 DAILY GROWTH TASKS');
    console.log('═══════════════════════════════════════\n');

    // Run all daily growth tasks
    await runDailyGrowthTasks();

    // Show growth dashboard
    console.log('\n═══════════════════════════════════════');
    console.log('📊 GROWTH DASHBOARD');
    console.log('═══════════════════════════════════════\n');

    const dashboard = await getGrowthDashboard();

    console.log(`Community:`);
    console.log(`  🌟 Superfans: ${dashboard.community.superfans || 0}`);
    console.log(`  ⭐ Engaged: ${dashboard.community.engaged || 0}`);
    console.log(`  ✨ Active: ${dashboard.community.active || 0}`);
    console.log(`  👋 Total Users: ${dashboard.community.totalUsers || 0}\n`);

    console.log(`Performance:`);
    console.log(`  🔥 Viral Posts Today: ${dashboard.viralPostsToday || 0}`);
    console.log(`  🧵 Active Threads: ${dashboard.activeThreads || 0}\n`);

    console.log(`Trending:`);
    console.log(`  📈 Opportunities: ${dashboard.trending.opportunities || 0}\n`);

    console.log('═══════════════════════════════════════');
    console.log('✅ DAILY TASKS COMPLETE');
    console.log('═══════════════════════════════════════\n');

    info('[Growth] Daily tasks completed successfully');
    process.exit(0);

  } catch (err) {
    error('[Growth] Daily tasks failed:', err.message || err);
    console.error(err);
    process.exit(1);
  }
})();
