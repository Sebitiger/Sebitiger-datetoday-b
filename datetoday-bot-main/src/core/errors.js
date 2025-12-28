// src/core/errors.js
// Centralized error handling

export class BotError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'BotError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

export class ContentGenerationError extends BotError {
  constructor(message, context = {}) {
    super(message, 'CONTENT_GENERATION_ERROR', context);
    this.name = 'ContentGenerationError';
  }
}

export class MediaFetchError extends BotError {
  constructor(message, context = {}) {
    super(message, 'MEDIA_FETCH_ERROR', context);
    this.name = 'MediaFetchError';
  }
}

export class PostingError extends BotError {
  constructor(message, context = {}) {
    super(message, 'POSTING_ERROR', context);
    this.name = 'PostingError';
  }
}

export class ValidationError extends BotError {
  constructor(message, context = {}) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

/**
 * Handle errors consistently
 */
export function handleError(error, context = {}) {
  if (error instanceof BotError) {
    console.error(`[${error.code}] ${error.message}`, {
      ...error.context,
      ...context,
      timestamp: error.timestamp
    });
    return error;
  }
  
  // Unknown error - wrap it
  const botError = new BotError(
    error.message || 'Unknown error',
    'UNKNOWN_ERROR',
    { originalError: error, ...context }
  );
  
  console.error(`[UNKNOWN_ERROR] ${botError.message}`, {
    stack: error.stack,
    ...context
  });
  
  return botError;
}


