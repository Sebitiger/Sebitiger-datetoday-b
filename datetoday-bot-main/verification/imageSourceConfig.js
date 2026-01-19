/**
 * Image Source Configuration
 * Premium historical archives prioritized for quality and accuracy
 */

export const IMAGE_SOURCE_CONFIG = {
  // SOURCE PRIORITY ORDER (highest to lowest quality)
  priority: [
    'Library of Congress',  // #1: Best for US history, primary sources
    'Smithsonian',          // #2: Museum-quality, global history
    'Wikimedia Commons',    // #3: Full-res, community curated
    'Wikipedia',            // #4: Thumbnail fallback
    'Unsplash',            // #5: Generic historical vibes
  ],

  // VERIFICATION SETTINGS
  verification: {
    enabled: true,              // Use GPT-4 Vision verification
    confidenceThreshold: 65,    // Accept images with 65%+ confidence (more permissive for global content)
    rejectBelow: 50,           // Hard reject below 50% (lowered to increase image success rate)

    // Scoring weights
    scoring: {
      historicalAccuracy: 0.55,  // 55% weight on accuracy (slightly lowered)
      imageQuality: 0.20,        // 20% weight on resolution/quality (lowered - accept more thumbnails)
      sourceReliability: 0.25,   // 25% weight on source trustworthiness (increased - trust quality sources)
    },

    // Special handling
    allowModernLogos: false,     // Reject logos/symbols for historical events
    preferPhotographs: true,     // Prefer actual photos over illustrations (when available)
    requirePeriodAppropriate: true, // Image must be from correct era
  },

  // SOURCE-SPECIFIC SETTINGS
  sources: {
    'Library of Congress': {
      enabled: true,
      priority: 1,
      reliabilityScore: 95,
      timeout: 15000,
      description: 'Primary source historical photos, high-res scans',
    },
    'Smithsonian': {
      enabled: true,
      priority: 2,
      reliabilityScore: 93,
      timeout: 15000,
      description: 'Museum-quality artifacts and historical images',
    },
    'Wikimedia Commons': {
      enabled: true,
      priority: 3,
      reliabilityScore: 85,
      timeout: 12000,
      description: 'Full-resolution, community curated images',
    },
    'Wikipedia': {
      enabled: true,
      priority: 4,
      reliabilityScore: 75,
      timeout: 10000,
      description: 'Thumbnail images, reliable but lower quality',
    },
    'Unsplash': {
      enabled: false,  // Disabled by default for history content
      priority: 5,
      reliabilityScore: 60,
      timeout: 10000,
      description: 'Generic stock photos, use only as last resort',
    },
  },

  // PARALLEL FETCHING
  parallel: {
    enabled: true,              // Fetch from multiple sources simultaneously
    topSourcesCount: 3,         // Fetch from top 3 sources in parallel
    timeout: 20000,             // Max time for parallel fetch
    selectBest: true,           // Use GPT-4 Vision to pick best of candidates
  },

  // FALLBACK BEHAVIOR
  fallback: {
    acceptFirstQuality: false,  // Don't accept first image - evaluate all
    allowTextOnly: true,        // Post without image if none found
    retryOnRejection: true,     // Try next source if GPT-4 rejects
    maxRetries: 3,              // Max sources to try
  },

  // IMAGE QUALITY REQUIREMENTS
  quality: {
    minWidth: 600,              // Minimum 600px width (lowered from 800 for more acceptance)
    minHeight: 400,             // Minimum 400px height (lowered from 600 for thumbnails)
    maxFileSize: 5 * 1024 * 1024,  // 5MB max
    preferredFormats: ['jpg', 'jpeg', 'png'],
    rejectFormats: ['svg'],     // Reject SVGs (often logos)
  },
};

/**
 * Get enabled sources in priority order
 */
export function getEnabledSources() {
  return IMAGE_SOURCE_CONFIG.priority.filter(
    sourceName => IMAGE_SOURCE_CONFIG.sources[sourceName]?.enabled
  );
}

/**
 * Get top N sources for parallel fetching
 */
export function getTopSources(count = 3) {
  const enabled = getEnabledSources();
  return enabled.slice(0, count);
}

/**
 * Get source configuration
 */
export function getSourceConfig(sourceName) {
  return IMAGE_SOURCE_CONFIG.sources[sourceName] || null;
}

/**
 * Calculate combined score for an image
 */
export function calculateImageScore(accuracyScore, qualityScore, sourceName) {
  const weights = IMAGE_SOURCE_CONFIG.verification.scoring;
  const sourceConfig = getSourceConfig(sourceName);
  const sourceScore = sourceConfig?.reliabilityScore || 50;

  const combinedScore =
    (accuracyScore * weights.historicalAccuracy) +
    (qualityScore * weights.imageQuality) +
    (sourceScore * weights.sourceReliability);

  return Math.round(combinedScore);
}
