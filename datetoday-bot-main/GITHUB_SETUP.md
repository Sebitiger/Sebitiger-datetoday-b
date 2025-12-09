# 🚀 GitHub Actions Setup Guide

## Step 1: Push Your Code to GitHub

### If you haven't created a GitHub repo yet:

1. Go to [github.com](https://github.com) and sign in
2. Click the **+** icon → **New repository**
3. Name it: `datetoday-bot`
4. **Don't** check "Initialize with README"
5. Click **Create repository**

### Push your code:

```bash
cd /Users/sebastiendero/Desktop/datetoday-bot-main

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "DateToday bot - ready for GitHub Actions"

# Add your GitHub repo (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/datetoday-bot.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** (top menu)
3. Click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret one by one:

### Required Secrets:

**API_KEY**
- Name: `API_KEY`
- Value: (your Twitter API key from .env)

**API_SECRET**
- Name: `API_SECRET`
- Value: (your Twitter API secret from .env)

**ACCESS_TOKEN**
- Name: `ACCESS_TOKEN`
- Value: (your access token from .env)

**ACCESS_SECRET**
- Name: `ACCESS_SECRET`
- Value: (your access secret from .env)

**OPENAI_KEY**
- Name: `OPENAI_KEY`
- Value: (your OpenAI key from .env)

**BOT_USERNAME** (optional)
- Name: `BOT_USERNAME`
- Value: `DateToday`

---

## Step 3: Enable GitHub Actions

1. Go to your repository
2. Click **Actions** tab
3. If you see a message about enabling workflows, click **"I understand my workflows, enable them"**

---

## Step 4: Test It Works

### Manual Test:
1. Go to **Actions** tab
2. Click **DateToday Bot** workflow
3. Click **Run workflow** button (top right)
4. Select **main** branch
5. Click **Run workflow**
6. Watch it run! It will post a tweet.

### Automatic Schedule:
The bot will automatically run:
- **Daily tweet:** Every day at 09:00 UTC
- **Evening fact:** Every day at 18:00 UTC
- **Weekly thread:** Every Sunday at 16:00 UTC

---

## ⚠️ Important Notes

### What GitHub Actions CAN do:
✅ Post scheduled tweets (daily, evening, weekly)
✅ Run on schedule automatically
✅ Free (2,000 minutes/month)

### What GitHub Actions CANNOT do:
❌ Run 24/7 (only runs on schedule)
❌ Monitor mentions continuously (runs every 15 min only when scheduled)
❌ Keep the bot "always on"

**For continuous operation** (like mention monitoring), you'd need Railway/Render, but for scheduled posts, GitHub Actions is perfect!

---

## 🐛 Troubleshooting

### Workflow not running?
- Check **Actions** tab for errors
- Verify all secrets are added correctly
- Check workflow file exists: `.github/workflows/datetoday.yml`

### "Secret not found" error?
- Make sure all secrets are added in Settings → Secrets
- Check secret names match exactly (case-sensitive)

### Tweets not posting?
- Check workflow logs in Actions tab
- Verify API credentials are correct
- Check Twitter API status

---

## 📊 Monitoring

- **View runs:** Actions tab → Click on workflow run
- **View logs:** Click on a run → See detailed logs
- **Check tweets:** Visit your Twitter account

---

## ✅ You're Done!

Once set up, your bot will:
- Run automatically on schedule
- Post tweets without you doing anything
- Show logs in GitHub Actions

**No server needed! Everything runs on GitHub's infrastructure.** 🎉


