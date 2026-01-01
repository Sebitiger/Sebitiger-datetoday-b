/**
 * Smart Multi-Source Image Fetcher
 * Fetches from premium historical archives with intelligent selection
 */

import { fetchEventImage } from '../fetchImage.js';
import { fetchFromLibraryOfCongress, fetchFromSmithsonian, fetchFromWikimediaCommons } from '../fetchImage.js';
import { checkImageQuality } from './imageVerifier.js';
import {
  IMAGE_SOURCE_CONFIG,
  getTopSources,
  getSourceConfig,
  calculateImageScore,
} from './imageSourceConfig.js';

/**
 * Fetch from a specific source with timeout and error handling
 */
async function fetchFromSource(sourceName, event, searchTerm) {
  const config = getSourceConfig(sourceName);
  if (!config) return null;

  try {
    console.log(`[SmartFetcher] Trying ${sourceName}...`);

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), config.timeout)
    );

    let fetchPromise;

    switch (sourceName) {
      case 'Library of Congress':
        fetchPromise = fetchFromLibraryOfCongress(searchTerm, event.year, true);
        break;

      case 'Smithsonian':
        fetchPromise = fetchFromSmithsonian(searchTerm, true);
        break;

      case 'Wikimedia Commons':
        fetchPromise = fetchFromWikimediaCommons(searchTerm, true);
        break;

      case 'Wikipedia':
        fetchPromise = fetchEventImage(event, false);
        break;

      default:
        console.log(`[SmartFetcher] Unknown source: ${sourceName}`);
        return null;
    }

    const result = await Promise.race([fetchPromise, timeoutPromise]);

    if (!result) {
      console.log(`[SmartFetcher] ${sourceName} returned null`);
      return null;
    }

    // Extract buffer and metadata
    const buffer = result.buffer || result;
    const metadata = result.metadata || {
      source: sourceName,
      searchTerm: searchTerm,
    };

    if (!Buffer.isBuffer(buffer)) {
      console.log(`[SmartFetcher] ${sourceName} returned non-Buffer data`);
      return null;
    }

    console.log(`[SmartFetcher] ✅ ${sourceName} found image (${(buffer.length / 1024).toFixed(2)} KB)`);

    return {
      buffer,
      metadata: {
        ...metadata,
        source: sourceName,
        reliabilityScore: config.reliabilityScore,
      },
    };

  } catch (error) {
    console.log(`[SmartFetcher] ${sourceName} failed: ${error.message}`);
    return null;
  }
}

/**
 * Fetch from multiple sources in parallel and return all successful results
 */
async function fetchFromMultipleSources(event, searchTerm) {
  const topSources = getTopSources(IMAGE_SOURCE_CONFIG.parallel.topSourcesCount);

  console.log(`[SmartFetcher] 🚀 Fetching from top ${topSources.length} sources in parallel:`);
  console.log(`[SmartFetcher]    ${topSources.join(', ')}`);

  const fetchPromises = topSources.map(sourceName =>
    fetchFromSource(sourceName, event, searchTerm)
  );

  // Wait for all to complete (or timeout)
  const results = await Promise.allSettled(fetchPromises);

  const candidates = results
    .filter(result => result.status === 'fulfilled' && result.value !== null)
    .map(result => result.value);

  console.log(`[SmartFetcher] 📊 Found ${candidates.length} candidates from ${topSources.length} sources`);

  return candidates;
}

/**
 * Apply quality filtering to candidates
 */
async function filterByQuality(candidates) {
  const qualityConfig = IMAGE_SOURCE_CONFIG.quality;
  const filtered = [];

  for (const candidate of candidates) {
    try {
      const qualityCheck = await checkImageQuality(candidate.buffer);

      if (!qualityCheck.passed) {
        console.log(`[SmartFetcher] ❌ Quality check failed for ${candidate.metadata.source}: ${qualityCheck.reason}`);
        continue;
      }

      // Check format restrictions
      const format = qualityCheck.metadata?.format?.toLowerCase();
      if (qualityConfig.rejectFormats.includes(format)) {
        console.log(`[SmartFetcher] ❌ Rejected ${candidate.metadata.source}: Format ${format} not allowed`);
        continue;
      }

      // Calculate quality score (0-100)
      const width = qualityCheck.metadata?.width || 0;
      const height = qualityCheck.metadata?.height || 0;
      const qualityScore = Math.min(100, ((width + height) / 30)); // Simple quality metric

      filtered.push({
        ...candidate,
        qualityCheck,
        qualityScore,
      });

      console.log(`[SmartFetcher] ✅ ${candidate.metadata.source} passed quality (${width}x${height}, ${format})`);

    } catch (error) {
      console.log(`[SmartFetcher] Quality check error for ${candidate.metadata.source}: ${error.message}`);
    }
  }

  return filtered;
}

/**
 * Main function: Smart fetch with parallel sources and intelligent selection
 */
export async function smartFetchImage(event, tweetContent) {
  try {
    console.log(`[SmartFetcher] 🎯 Starting smart image fetch for event: ${event.description?.slice(0, 60)}...`);

    // Generate search term
    const searchTerm = event.description?.split(' ').slice(0, 8).join(' ');

    // Step 1: Fetch from multiple sources in parallel
    let candidates = await fetchFromMultipleSources(event, searchTerm);

    if (candidates.length === 0) {
      console.log(`[SmartFetcher] ❌ No images found from any source`);
      return null;
    }

    // Step 2: Apply quality filtering
    candidates = await filterByQuality(candidates);

    if (candidates.length === 0) {
      console.log(`[SmartFetcher] ❌ All candidates failed quality checks`);
      return null;
    }

    // Step 3: Return best candidate info for GPT-4 Vision verification
    // Sort by source reliability (already prioritized)
    candidates.sort((a, b) => {
      const scoreA = a.metadata.reliabilityScore || 0;
      const scoreB = b.metadata.reliabilityScore || 0;
      return scoreB - scoreA;
    });

    console.log(`[SmartFetcher] 📊 Returning ${candidates.length} quality candidates for verification`);

    return candidates;

  } catch (error) {
    console.error(`[SmartFetcher] Error: ${error.message}`);
    return null;
  }
}

/**
 * Simple fetch (non-parallel) - fallback mode
 */
export async function simpleFetchImage(event) {
  console.log(`[SmartFetcher] 🔄 Using simple sequential fetch (fallback mode)`);

  const sources = getTopSources(5); // Try all enabled sources

  for (const sourceName of sources) {
    const searchTerm = event.description?.split(' ').slice(0, 8).join(' ');
    const result = await fetchFromSource(sourceName, event, searchTerm);

    if (result) {
      const qualityCheck = await checkImageQuality(result.buffer);
      if (qualityCheck.passed) {
        console.log(`[SmartFetcher] ✅ Found image from ${sourceName} (sequential mode)`);
        return result.buffer;
      }
    }
  }

  console.log(`[SmartFetcher] ❌ No images found in sequential mode`);
  return null;
}
