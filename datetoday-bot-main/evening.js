import { generateEveningFact } from "./generateFact.js";
import { postTweet, postTweetWithImage } from "./twitterClient.js";
import { fetchImageForText } from "./fetchImage.js";
import { isContentDuplicate, markContentPosted, isImageDuplicate, markTopicPosted } from "./database.js";

export async function postEveningFact() {
  console.log("[Evening] Starting evening fact job...");
  try {
    // Generate fact and check for duplicates (retry up to 5 times)
    let fact = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      fact = await generateEveningFact();
      
      if (!fact || !fact.trim().length) {
        attempts++;
        continue;
      }
      
      // Check if similar content was posted recently (60 days - very strict for facts)
      const isDuplicate = await isContentDuplicate(fact, 60); // Check last 60 days
      if (!isDuplicate) {
        break; // Found unique content
      }
      
      console.log(`[Evening] Generated fact is similar to recent post, generating new one... (attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
    }
    
    if (!fact || !fact.trim().length) {
      throw new Error("Failed to generate unique evening fact after multiple attempts");
    }

    // Fetch an image based on the fact content (REQUIRED - retry until found, check for duplicates)
    let imageBuffer = null;
    let imageAttempts = 0;
    const maxImageAttempts = 10; // Increased attempts to find unique image
    let factAttempts = 0;
    const maxFactAttempts = 5; // Try different facts if images are duplicates
    
    while (!imageBuffer && factAttempts < maxFactAttempts) {
      imageAttempts = 0;
      
      while (!imageBuffer && imageAttempts < maxImageAttempts) {
        try {
          console.log(`[Evening] Attempting to fetch image (attempt ${imageAttempts + 1}/${maxImageAttempts})...`);
          const fetchedImage = await fetchImageForText(fact, true); // requireImage = true
          
          if (fetchedImage) {
            // Check if image was already posted
            const isImageDup = await isImageDuplicate(fetchedImage, 90);
            if (isImageDup) {
              console.warn(`[Evening] Image is duplicate, trying different fact...`);
              // Generate new fact and try again
              fact = await generateEveningFact();
              const isFactDup = await isContentDuplicate(fact, 60);
              if (isFactDup) {
                factAttempts++;
                continue;
              }
              imageAttempts = 0; // Reset image attempts for new fact
              continue;
            }
            
            imageBuffer = fetchedImage;
            console.log("[Evening] Image fetched successfully and verified as unique.");
            break;
          } else {
            console.warn(`[Evening] No image found on attempt ${imageAttempts + 1}, retrying...`);
            imageAttempts++;
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (imgErr) {
          console.error(`[Evening] Image fetch error (attempt ${imageAttempts + 1}):`, imgErr.message || imgErr);
          imageAttempts++;
          if (imageAttempts < maxImageAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (!imageBuffer && factAttempts < maxFactAttempts - 1) {
        console.warn(`[Evening] Could not find unique image, trying different fact...`);
        factAttempts++;
        fact = await generateEveningFact();
        const isFactDup = await isContentDuplicate(fact, 60);
        if (isFactDup) {
          continue;
        }
      } else {
        break;
      }
    }
    
    if (!imageBuffer) {
      console.error("[Evening] CRITICAL: Could not fetch unique image after multiple attempts. Posting will fail.");
      throw new Error("Failed to fetch required unique image for evening fact");
    }

    // Final check: verify content is still unique before posting
    const finalDuplicateCheck = await isContentDuplicate(fact, 60);
    if (finalDuplicateCheck) {
      throw new Error("Content became duplicate during image fetching - aborting post");
    }

    // Post with image (REQUIRED)
    const tweetId = await postTweetWithImage(fact, imageBuffer, null);
    
    // Mark content AND image as posted to prevent duplicates
    await markContentPosted(fact, tweetId, imageBuffer);
    
    // Mark topic as posted (for cooldown)
    await markTopicPosted(fact);
    
    console.log("[Evening] Evening fact job completed successfully.");
  } catch (err) {
    console.error("[Evening] Job failed:", err.message || err);
    console.error("[Evening] Stack:", err.stack);
    throw err; // Re-throw to allow caller to handle
  }
}
