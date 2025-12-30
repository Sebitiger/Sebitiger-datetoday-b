#!/usr/bin/env node

/**
 * REVIEW QUEUE MANAGER CLI
 * 
 * Command-line tool for reviewing queued content.
 * 
 * Usage:
 *   node verification/reviewCLI.js list              - List pending items
 *   node verification/reviewCLI.js show <id>         - Show specific item
 *   node verification/reviewCLI.js approve <id>      - Approve item
 *   node verification/reviewCLI.js reject <id>       - Reject item
 *   node verification/reviewCLI.js stats             - Show queue statistics
 *   node verification/reviewCLI.js insights          - Show learning insights
 */

import {
  getQueue,
  getQueueItem,
  approveItem,
  rejectItem,
  getQueueStats
} from './reviewQueue.js';

import { getInsights, getGuidance } from './learningSystem.js';

const command = process.argv[2];
const arg = process.argv[3];

async function main() {
  try {
    switch (command) {
      case 'list':
        await listQueue();
        break;
      
      case 'show':
        if (!arg) {
          console.error('Usage: node reviewCLI.js show <id>');
          process.exit(1);
        }
        await showItem(arg);
        break;
      
      case 'approve':
        if (!arg) {
          console.error('Usage: node reviewCLI.js approve <id>');
          process.exit(1);
        }
        await approve(arg);
        break;
      
      case 'reject':
        if (!arg) {
          console.error('Usage: node reviewCLI.js reject <id> [reason]');
          process.exit(1);
        }
        await reject(arg, process.argv[4]);
        break;
      
      case 'stats':
        await showStats();
        break;
      
      case 'insights':
        await showInsights();
        break;
      
      default:
        showHelp();
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Review Queue Manager

Commands:
  list              List all pending items
  show <id>         Show details of specific item
  approve <id>      Approve item for posting
  reject <id>       Reject item
  stats             Show queue statistics
  insights          Show learning insights and guidance

Examples:
  node verification/reviewCLI.js list
  node verification/reviewCLI.js show abc123
  node verification/reviewCLI.js approve abc123
  node verification/reviewCLI.js reject abc123
`);
}

async function listQueue() {
  const items = await getQueue();
  
  if (items.length === 0) {
    console.log('✅ Queue is empty!');
    return;
  }
  
  console.log(`\n📋 Review Queue (${items.length} items)\n`);
  
  items.forEach((item, index) => {
    const confidence = item.verification?.confidence || 'N/A';
    const verdict = item.verification?.verdict || 'N/A';
    const preview = item.content.substring(0, 60) + '...';
    
    console.log(`${index + 1}. ID: ${item.id}`);
    console.log(`   Confidence: ${confidence}% | Verdict: ${verdict}`);
    console.log(`   Content: ${preview}`);
    console.log(`   Added: ${new Date(item.addedAt).toLocaleString()}`);
    
    if (item.verification?.concerns && item.verification.concerns.length > 0) {
      console.log(`   ⚠️  Concerns: ${item.verification.concerns.join(', ')}`);
    }
    console.log('');
  });
  
  console.log(`Use 'show <id>' to see full details`);
}

async function showItem(id) {
  const item = await getQueueItem(id);
  
  if (!item) {
    console.error(`Item ${id} not found`);
    process.exit(1);
  }
  
  console.log(`\n📄 Item Details\n`);
  console.log(`ID: ${item.id}`);
  console.log(`Added: ${new Date(item.addedAt).toLocaleString()}`);
  console.log(`Status: ${item.status}`);
  console.log('');
  
  console.log('CONTENT:');
  console.log('─'.repeat(60));
  console.log(item.content);
  console.log('─'.repeat(60));
  console.log('');
  
  if (item.context) {
    console.log('CONTEXT:');
    console.log(JSON.stringify(item.context, null, 2));
    console.log('');
  }
  
  if (item.verification) {
    console.log('VERIFICATION:');
    console.log(`  Confidence: ${item.verification.confidence}%`);
    console.log(`  Verdict: ${item.verification.verdict}`);
    
    if (item.verification.concerns && item.verification.concerns.length > 0) {
      console.log(`  Concerns:`);
      item.verification.concerns.forEach(c => console.log(`    - ${c}`));
    }
    
    if (item.verification.corrections && item.verification.corrections.length > 0) {
      console.log(`  Suggested Corrections:`);
      item.verification.corrections.forEach(c => console.log(`    - ${c}`));
    }
    
    if (item.verification.missing_context && item.verification.missing_context.length > 0) {
      console.log(`  Missing Context:`);
      item.verification.missing_context.forEach(c => console.log(`    - ${c}`));
    }
  }
  
  console.log('');
  console.log('Actions:');
  console.log(`  Approve: node verification/reviewCLI.js approve ${item.id}`);
  console.log(`  Reject:  node verification/reviewCLI.js reject ${item.id}`);
}

async function approve(id) {
  const item = await getQueueItem(id);
  if (!item) {
    console.error(`Item ${id} not found`);
    process.exit(1);
  }
  
  await approveItem(id);
  console.log(`✅ Approved item ${id}`);
  console.log('Content is now available for posting');
}

async function reject(id, reason) {
  const item = await getQueueItem(id);
  if (!item) {
    console.error(`Item ${id} not found`);
    process.exit(1);
  }
  
  await rejectItem(id, reason);
  console.log(`❌ Rejected item ${id}`);
  if (reason) {
    console.log(`Reason: ${reason}`);
  }
}

async function showStats() {
  const stats = await getQueueStats();
  
  console.log(`\n📊 Queue Statistics\n`);
  console.log(`Pending review:     ${stats.pending}`);
  console.log(`Approved (unposted): ${stats.approved}`);
  console.log(`Posted:             ${stats.posted}`);
  console.log(`Rejected:           ${stats.rejected}`);
  console.log(`Total processed:    ${stats.totalProcessed}`);
  console.log('');
  
  if (stats.totalProcessed > 0) {
    const approvalRate = ((stats.posted + stats.approved) / stats.totalProcessed * 100).toFixed(1);
    console.log(`Approval rate: ${approvalRate}%`);
  }
}

async function showInsights() {
  const insights = await getInsights();
  const guidance = await getGuidance();
  
  console.log(`\n🧠 Learning Insights\n`);
  
  console.log('Statistics:');
  console.log(`  Total generated:     ${insights.statistics.totalGenerated}`);
  console.log(`  Approved:            ${insights.statistics.totalApproved}`);
  console.log(`  Queued:              ${insights.statistics.totalQueued}`);
  console.log(`  Rejected:            ${insights.statistics.totalRejected}`);
  console.log(`  Approval rate:       ${insights.statistics.approvalRate}`);
  console.log(`  Avg confidence:      ${insights.statistics.averageConfidence.toFixed(1)}%`);
  console.log('');
  
  if (insights.topConcerns.length > 0) {
    console.log('Top Concerns:');
    insights.topConcerns.forEach(({ concern, count }) => {
      console.log(`  - ${concern} (${count} times)`);
    });
    console.log('');
  }
  
  if (insights.commonErrors.length > 0) {
    console.log('Common Errors:');
    insights.commonErrors.forEach(({ concern, count }) => {
      console.log(`  - ${concern} (${count} times)`);
    });
    console.log('');
  }
  
  if (guidance.recommendations.length > 0) {
    console.log('Recommendations:');
    guidance.recommendations.forEach(rec => {
      console.log(`  ${rec}`);
    });
    console.log('');
  }
  
  if (guidance.preferTopics.length > 0) {
    console.log(`✅ Reliable topics: ${guidance.preferTopics.join(', ')}`);
  }
  
  if (guidance.avoidTopics.length > 0) {
    console.log(`⚠️  Problematic topics: ${guidance.avoidTopics.join(', ')}`);
  }
}

main();
