/**
 * PREDICTIVE SCHEDULER
 *
 * Uses ML and historical data to determine optimal posting times
 * Maximizes reach by posting when audience is most active
 */

import fs from 'fs/promises';
import path from 'path';

const SCHEDULE_DATA_FILE = path.join(process.cwd(), 'data', 'schedule-analytics.json');

/**
 * Get optimal posting time based on historical performance
 */
export async function getOptimalPostTime(contentCategory = 'general') {
  const analytics = await loadScheduleAnalytics();

  // Get historical best times for this category
  const categoryData = analytics.byCategory?.[contentCategory] || analytics.overall || {};

  const bestHour = categoryData.bestHour || 12; // Default noon UTC
  const confidence = categoryData.confidence || 0.5;

  return {
    hour: bestHour,
    confidence,
    reasoning: `Best hour for ${contentCategory}: ${bestHour}:00 UTC (${(confidence * 100).toFixed(0)}% confidence)`
  };
}

/**
 * Record post performance by time
 */
export async function recordPostTime(hour, category, engagement) {
  const analytics = await loadScheduleAnalytics();

  if (!analytics.hourly) analytics.hourly = {};
  if (!analytics.byCategory) analytics.byCategory = {};

  // Record overall
  if (!analytics.hourly[hour]) {
    analytics.hourly[hour] = { posts: 0, totalEngagement: 0 };
  }

  analytics.hourly[hour].posts++;
  analytics.hourly[hour].totalEngagement += engagement;

  // Record by category
  if (!analytics.byCategory[category]) {
    analytics.byCategory[category] = { hourly: {} };
  }

  if (!analytics.byCategory[category].hourly[hour]) {
    analytics.byCategory[category].hourly[hour] = { posts: 0, totalEngagement: 0 };
  }

  analytics.byCategory[category].hourly[hour].posts++;
  analytics.byCategory[category].hourly[hour].totalEngagement += engagement;

  // Calculate best hours
  analytics.overall = calculateBestTimes(analytics.hourly);
  analytics.byCategory[category] = {
    ...analytics.byCategory[category],
    ...calculateBestTimes(analytics.byCategory[category].hourly)
  };

  await saveScheduleAnalytics(analytics);
}

/**
 * Calculate best posting times from data
 */
function calculateBestTimes(hourlyData) {
  const hours = Object.keys(hourlyData).map(Number);

  if (hours.length === 0) {
    return { bestHour: 12, confidence: 0 };
  }

  // Calculate average engagement per hour
  const avgEngagement = hours.map(h => ({
    hour: h,
    avg: hourlyData[h].totalEngagement / hourlyData[h].posts,
    posts: hourlyData[h].posts
  }));

  // Sort by engagement
  avgEngagement.sort((a, b) => b.avg - a.avg);

  const best = avgEngagement[0];

  // Confidence based on sample size
  const confidence = Math.min(best.posts / 100, 1.0); // 100 posts = 100% confidence

  return {
    bestHour: best.hour,
    avgEngagement: best.avg,
    confidence,
    top3Hours: avgEngagement.slice(0, 3).map(h => h.hour)
  };
}

/**
 * Get follower timezone distribution (estimated from engagement patterns)
 */
export async function estimateFollowerTimezones() {
  const analytics = await loadScheduleAnalytics();

  if (!analytics.hourly) {
    return { 'UTC': 1.0 };
  }

  // Estimate timezone distribution from engagement patterns
  const hourlyEngagement = Object.entries(analytics.hourly)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      engagement: data.totalEngagement / data.posts
    }))
    .sort((a, b) => a.hour - b.hour);

  // Peak hours indicate likely timezones
  const peaks = hourlyEngagement
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 3);

  const timezones = {};

  peaks.forEach(peak => {
    // Convert peak hour to likely timezone
    if (peak.hour >= 9 && peak.hour <= 11) {
      timezones['America/New_York'] = (timezones['America/New_York'] || 0) + peak.engagement;
    } else if (peak.hour >= 12 && peak.hour <= 14) {
      timezones['Europe/London'] = (timezones['Europe/London'] || 0) + peak.engagement;
    } else if (peak.hour >= 15 && peak.hour <= 17) {
      timezones['America/Los_Angeles'] = (timezones['America/Los_Angeles'] || 0) + peak.engagement;
    } else if (peak.hour >= 0 && peak.hour <= 2) {
      timezones['Asia/Tokyo'] = (timezones['Asia/Tokyo'] || 0) + peak.engagement;
    }
  });

  // Normalize
  const total = Object.values(timezones).reduce((a, b) => a + b, 0);
  Object.keys(timezones).forEach(tz => {
    timezones[tz] /= total;
  });

  return timezones;
}

async function loadScheduleAnalytics() {
  try {
    const content = await fs.readFile(SCHEDULE_DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { hourly: {}, byCategory: {}, overall: {} };
  }
}

async function saveScheduleAnalytics(analytics) {
  await fs.writeFile(SCHEDULE_DATA_FILE, JSON.stringify(analytics, null, 2));
}

export default {
  getOptimalPostTime,
  recordPostTime,
  estimateFollowerTimezones
};
