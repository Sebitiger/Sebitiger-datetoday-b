# ⚡ Quick Start - GitHub Actions Setup

## Step 1: Push to GitHub

```bash
cd /Users/sebastiendero/Desktop/datetoday-bot-main

# Initialize git (if needed)
git init
git add .
git commit -m "DateToday bot ready for GitHub Actions"

# Create repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/datetoday-bot.git
git branch -M main
git push -u origin main
```

**Replace `YOUR_USERNAME` with your GitHub username**

---

## Step 2: Add Secrets

1. Go to your GitHub repo
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these 6 secrets:

```
API_KEY = (from your .env file)
API_SECRET = (from your .env file)
ACCESS_TOKEN = (from your .env file)
ACCESS_SECRET = (from your .env file)
OPENAI_KEY = (from your .env file)
BOT_USERNAME = DateToday
```

---

## Step 3: Enable Actions

1. Go to **Actions** tab
2. Click **"I understand my workflows, enable them"**

---

## Step 4: Test It!

1. Go to **Actions** tab
2. Click **"DateToday Bot"** workflow
3. Click **"Run workflow"** button
4. Select **main** branch
5. Click **"Run workflow"**
6. Watch it post a tweet! 🎉

---

## ✅ Automatic Schedule

Once set up, your bot will automatically:
- **09:00 UTC** - Daily tweet
- **14:00 UTC (Tue/Thu)** - Polls
- **18:00 UTC** - Evening fact
- **16:00 UTC (Sunday)** - Weekly thread

**No server needed! Everything runs on GitHub!** 🚀

---

## 📝 Notes

- GitHub Actions is **free** (2,000 minutes/month)
- Runs **only on schedule** (not 24/7)
- Perfect for scheduled posts
- Check **Actions** tab to see logs

---

**That's it! Your bot is live on GitHub!** 🎉


