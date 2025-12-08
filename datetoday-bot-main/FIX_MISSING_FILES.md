# 🔧 Fix: Missing package.json Error

The error shows `package.json` is missing from your GitHub repository. Here's how to fix it:

## Solution: Upload package.json to GitHub

### Step 1: Create package.json in GitHub

1. Go to your GitHub repository
2. Click **"Add file"** → **"Create new file"**
3. Name it: `package.json`
4. Copy and paste this content:

```json
{
  "name": "datetoday-bot",
  "version": "1.0.0",
  "description": "Automated X (Twitter) history bot that posts daily On This Day tweets, evening facts, and weekly threads.",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "twitter-api-v2": "^1.15.0",
    "openai": "^4.0.0",
    "dotenv": "^16.4.0",
    "axios": "^1.6.0",
    "node-cron": "^3.0.2",
    "sharp": "^0.33.0"
  }
}
```

5. Click **"Commit new file"**

### Step 2: Verify All Files Are Uploaded

Make sure these essential files are in your GitHub repo:

**Required Files:**
- ✅ `package.json` (you just added this)
- ✅ `index.js`
- ✅ `daily.js`
- ✅ `evening.js`
- ✅ `weekly.js`
- ✅ `runDaily.js`
- ✅ `runEvening.js`
- ✅ `runWeekly.js`
- ✅ `twitterClient.js`
- ✅ `fetchEvents.js`
- ✅ `generateTweet.js`
- ✅ `generateReply.js`
- ✅ `generateFact.js`
- ✅ `generateThread.js`
- ✅ `fetchImage.js`
- ✅ `openaiCommon.js`
- ✅ `utils.js`
- ✅ `engagement.js`
- ✅ `polls.js`
- ✅ `personality.js`
- ✅ `trending.js`
- ✅ `.github/workflows/datetoday.yml`

**Optional but Recommended:**
- `README.md`
- `.gitignore`

### Step 3: Re-run the Workflow

1. Go to **Actions** tab
2. Click on the failed workflow run
3. Click **"Re-run all jobs"** (or create a new run)
4. It should work now!

---

## Quick Checklist

- [ ] `package.json` uploaded to GitHub
- [ ] All `.js` files uploaded
- [ ] `.github/workflows/datetoday.yml` exists
- [ ] All secrets added in Settings → Secrets
- [ ] Workflow re-run

---

**After adding package.json, the workflow should work!** 🎉

