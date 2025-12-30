#!/usr/bin/env node

/**
 * TEST VERIFICATION SYSTEM
 * 
 * Tests the complete verification workflow
 */

import { getRandomEvent } from '../fetchEvents.js';
import { generateVerifiedTweet, generateVerifiedThread } from './verifiedGenerator.js';
import { getQueueStats } from './reviewQueue.js';
import { getInsights } from './learningSystem.js';

console.log('🧪 Testing Verification System\n');

async function testSingleTweet() {
  console.log('1️⃣ Testing Single Tweet Generation with Verification\n');
  
  try {
    const event = await getRandomEvent();
    console.log('Event:', `${event.year}: ${event.description.substring(0, 60)}...`);
    console.log('');
    
    const result = await generateVerifiedTweet(event, {
      maxRetries: 2,
      minConfidence: 85, // Lower threshold for testing
      queueMedium: true
    });
    
    console.log('Status:', result.status);
    console.log('Confidence:', result.verification.confidence + '%');
    console.log('Verdict:', result.verification.verdict);
    console.log('');
    
    if (result.verification.concerns && result.verification.concerns.length > 0) {
      console.log('Concerns:');
      result.verification.concerns.forEach(c => console.log('  -', c));
      console.log('');
    }
    
    if (result.verification.corrections && result.verification.corrections.length > 0) {
      console.log('Suggested Corrections:');
      result.verification.corrections.forEach(c => console.log('  -', c));
      console.log('');
    }
    
    console.log('Generated Content:');
    console.log('─'.repeat(60));
    console.log(result.content);
    console.log('─'.repeat(60));
    console.log('');
    
    if (result.status === 'APPROVED') {
      console.log('✅ Ready to post automatically!');
    } else if (result.status === 'QUEUED') {
      console.log(`⚠️  Added to review queue (ID: ${result.queueId})`);
      console.log('Use: node verification/reviewCLI.js show', result.queueId);
    } else {
      console.log('❌ Rejected - needs regeneration');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

async function testThread() {
  console.log('2️⃣ Testing Thread Generation with Verification\n');
  
  try {
    const event = await getRandomEvent();
    console.log('Event:', `${event.year}: ${event.description.substring(0, 60)}...`);
    console.log('');
    
    const result = await generateVerifiedThread(event, {
      maxRetries: 2,
      minConfidence: 85,
      queueMedium: true
    });
    
    console.log('Status:', result.status);
    console.log('Confidence:', result.verification.confidence + '%');
    console.log('Verdict:', result.verification.verdict);
    console.log('');
    
    console.log('Generated Thread:');
    console.log('─'.repeat(60));
    const tweets = result.content.split('\n\n').filter(t => t.trim());
    tweets.forEach((tweet, i) => {
      console.log(`Tweet ${i + 1}:`);
      console.log(tweet);
      console.log('');
    });
    console.log('─'.repeat(60));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

async function showStats() {
  console.log('3️⃣ Queue & Learning Statistics\n');
  
  try {
    const queueStats = await getQueueStats();
    console.log('Queue Stats:');
    console.log('  Pending:', queueStats.pending);
    console.log('  Approved:', queueStats.approved);
    console.log('  Posted:', queueStats.posted);
    console.log('  Rejected:', queueStats.rejected);
    console.log('');
    
    const insights = await getInsights();
    console.log('Learning Stats:');
    console.log('  Total generated:', insights.statistics.totalGenerated);
    console.log('  Approval rate:', insights.statistics.approvalRate);
    console.log('  Avg confidence:', insights.statistics.averageConfidence.toFixed(1) + '%');
    console.log('');
    
    if (insights.topConcerns.length > 0) {
      console.log('Top Concerns:');
      insights.topConcerns.slice(0, 3).forEach(({ concern, count }) => {
        console.log(`  - ${concern} (${count}x)`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

async function runTests() {
  await testSingleTweet();
  await testThread();
  await showStats();
  
  console.log('✅ Test Complete!\n');
  console.log('Next Steps:');
  console.log('  1. Review queued items: node verification/reviewCLI.js list');
  console.log('  2. Approve/reject items: node verification/reviewCLI.js show <id>');
  console.log('  3. View insights: node verification/reviewCLI.js insights');
}

runTests().catch(console.error);
