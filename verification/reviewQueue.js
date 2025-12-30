/**
 * REVIEW QUEUE SYSTEM
 * 
 * Manages content that needs human review before posting.
 * Stores items with medium confidence for manual approval.
 */

import fs from 'fs/promises';
import path from 'path';

const QUEUE_FILE = path.join(process.cwd(), 'data', 'review_queue.json');
const APPROVED_FILE = path.join(process.cwd(), 'data', 'approved_content.json');
const REJECTED_FILE = path.join(process.cwd(), 'data', 'rejected_content.json');

/**
 * Ensure data directory and files exist
 */
async function ensureDataStructure() {
  try {
    await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
    
    for (const file of [QUEUE_FILE, APPROVED_FILE, REJECTED_FILE]) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify({ items: [] }, null, 2));
      }
    }
  } catch (error) {
    console.error('[ReviewQueue] Error ensuring data structure:', error.message);
  }
}

/**
 * Read a JSON file safely
 */
async function readJSON(filepath) {
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`[ReviewQueue] Error reading ${filepath}:`, error.message);
    return { items: [] };
  }
}

/**
 * Write to a JSON file safely
 */
async function writeJSON(filepath, data) {
  try {
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`[ReviewQueue] Error writing ${filepath}:`, error.message);
  }
}

/**
 * Add item to review queue
 */
export async function addToQueue(item) {
  await ensureDataStructure();
  
  const queue = await readJSON(QUEUE_FILE);
  
  const queueItem = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    content: item.content,
    context: item.context || {},
    verification: item.verification || {},
    addedAt: new Date().toISOString(),
    status: 'pending'
  };
  
  queue.items.push(queueItem);
  await writeJSON(QUEUE_FILE, queue);
  
  console.log(`[ReviewQueue] Added item ${queueItem.id} to queue`);
  return queueItem;
}

/**
 * Get all pending items in queue
 */
export async function getQueue() {
  await ensureDataStructure();
  const queue = await readJSON(QUEUE_FILE);
  return queue.items.filter(item => item.status === 'pending');
}

/**
 * Get specific item by ID
 */
export async function getQueueItem(id) {
  await ensureDataStructure();
  const queue = await readJSON(QUEUE_FILE);
  return queue.items.find(item => item.id === id);
}

/**
 * Approve item (moves to approved list, available for posting)
 */
export async function approveItem(id, corrections = null) {
  await ensureDataStructure();
  
  const queue = await readJSON(QUEUE_FILE);
  const approved = await readJSON(APPROVED_FILE);
  
  const item = queue.items.find(i => i.id === id);
  if (!item) {
    throw new Error(`Item ${id} not found in queue`);
  }
  
  // Update item
  item.status = 'approved';
  item.approvedAt = new Date().toISOString();
  if (corrections) {
    item.correctedContent = corrections;
  }
  
  // Move to approved
  approved.items.push(item);
  await writeJSON(APPROVED_FILE, approved);
  
  // Remove from queue
  queue.items = queue.items.filter(i => i.id !== id);
  await writeJSON(QUEUE_FILE, queue);
  
  console.log(`[ReviewQueue] Approved item ${id}`);
  return item;
}

/**
 * Reject item (moves to rejected list)
 */
export async function rejectItem(id, reason = null) {
  await ensureDataStructure();
  
  const queue = await readJSON(QUEUE_FILE);
  const rejected = await readJSON(REJECTED_FILE);
  
  const item = queue.items.find(i => i.id === id);
  if (!item) {
    throw new Error(`Item ${id} not found in queue`);
  }
  
  // Update item
  item.status = 'rejected';
  item.rejectedAt = new Date().toISOString();
  if (reason) {
    item.rejectionReason = reason;
  }
  
  // Move to rejected
  rejected.items.push(item);
  await writeJSON(REJECTED_FILE, rejected);
  
  // Remove from queue
  queue.items = queue.items.filter(i => i.id !== id);
  await writeJSON(QUEUE_FILE, queue);
  
  console.log(`[ReviewQueue] Rejected item ${id}`);
  return item;
}

/**
 * Get approved content ready for posting
 */
export async function getApprovedContent(limit = 10) {
  await ensureDataStructure();
  const approved = await readJSON(APPROVED_FILE);
  return approved.items
    .filter(item => !item.posted)
    .slice(0, limit);
}

/**
 * Mark approved item as posted
 */
export async function markAsPosted(id, tweetId = null) {
  await ensureDataStructure();
  const approved = await readJSON(APPROVED_FILE);
  
  const item = approved.items.find(i => i.id === id);
  if (!item) {
    throw new Error(`Approved item ${id} not found`);
  }
  
  item.posted = true;
  item.postedAt = new Date().toISOString();
  if (tweetId) {
    item.tweetId = tweetId;
  }
  
  await writeJSON(APPROVED_FILE, approved);
  console.log(`[ReviewQueue] Marked item ${id} as posted`);
  return item;
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  await ensureDataStructure();
  
  const queue = await readJSON(QUEUE_FILE);
  const approved = await readJSON(APPROVED_FILE);
  const rejected = await readJSON(REJECTED_FILE);
  
  return {
    pending: queue.items.length,
    approved: approved.items.filter(i => !i.posted).length,
    posted: approved.items.filter(i => i.posted).length,
    rejected: rejected.items.length,
    totalProcessed: approved.items.length + rejected.items.length
  };
}

/**
 * Clean up old items (optional maintenance)
 */
export async function cleanupOldItems(daysOld = 30) {
  await ensureDataStructure();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoff = cutoffDate.toISOString();
  
  const approved = await readJSON(APPROVED_FILE);
  const rejected = await readJSON(REJECTED_FILE);
  
  const originalApprovedCount = approved.items.length;
  const originalRejectedCount = rejected.items.length;
  
  // Keep only recent posted items and all unposted items
  approved.items = approved.items.filter(item => 
    !item.posted || (item.postedAt && item.postedAt > cutoff)
  );
  
  // Keep only recent rejected items
  rejected.items = rejected.items.filter(item => 
    item.rejectedAt && item.rejectedAt > cutoff
  );
  
  await writeJSON(APPROVED_FILE, approved);
  await writeJSON(REJECTED_FILE, rejected);
  
  const removedApproved = originalApprovedCount - approved.items.length;
  const removedRejected = originalRejectedCount - rejected.items.length;
  
  console.log(`[ReviewQueue] Cleanup: removed ${removedApproved} old approved, ${removedRejected} old rejected items`);
  
  return { removedApproved, removedRejected };
}
