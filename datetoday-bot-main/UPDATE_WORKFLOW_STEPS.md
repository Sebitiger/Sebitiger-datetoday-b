# 🔄 Update Workflow File on GitHub - Step by Step

## Method 1: Edit the Workflow File Directly (Easiest)

### Step 1: Navigate to the File
1. Go to your GitHub repository
2. Click on `.github` folder
3. Click on `workflows` folder
4. Click on `datetoday.yml` file

### Step 2: Edit the File
1. Click the **pencil icon** (Edit this file) - top right corner
2. **Select all** (Ctrl+A or Cmd+A) and **delete** the old content
3. **Copy the entire new content** from below
4. **Paste** it into the editor
5. Scroll down
6. Write commit message: **"Update workflow with optimized schedule - 25 posts/week"**
7. Click **"Commit changes"** (green button)

---

## 📋 Complete Updated Workflow File

Copy this ENTIRE content:

```yaml
name: DateToday Bot

on:
  schedule:
    - cron: "0 9 * * *"     # Daily main tweet – 09:00 UTC
    - cron: "0 12 * * 1"    # Quick Fact – Monday 12:00 UTC
    - cron: "0 12 * * 3"    # What If thread – Wednesday 12:00 UTC
    - cron: "0 12 * * 6"    # Quick Fact – Saturday 12:00 UTC
    - cron: "0 14 * * 2,4"  # Polls – Tuesday & Thursday 14:00 UTC
    - cron: "0 15 * * 1"    # History Debunk – Monday 15:00 UTC
    - cron: "0 15 * * 5"    # Hidden Connection – Friday 15:00 UTC
    - cron: "0 18 * * *"    # Evening extra fact – 18:00 UTC
    - cron: "0 16 * * 0"    # Weekly thread – Sunday 16:00 UTC
  workflow_dispatch:         # Allows manual test run

jobs:
  run-bot:
    runs-on: ubuntu-latest

    env:
      API_KEY: ${{ secrets.API_KEY }}
      API_SECRET: ${{ secrets.API_SECRET }}
      ACCESS_TOKEN: ${{ secrets.ACCESS_TOKEN }}
      ACCESS_SECRET: ${{ secrets.ACCESS_SECRET }}
      OPENAI_KEY: ${{ secrets.OPENAI_KEY }}
      BOT_USERNAME: ${{ secrets.BOT_USERNAME }}

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Check if files are in subfolder
        id: check_location
        run: |
          if [ -f "package.json" ]; then
            echo "location=root" >> $GITHUB_OUTPUT
          elif [ -f "datetoday-bot-main/package.json" ]; then
            echo "location=subfolder" >> $GITHUB_OUTPUT
          else
            echo "location=unknown" >> $GITHUB_OUTPUT
          fi

      - name: Install dependencies
        run: |
          if [ "${{ steps.check_location.outputs.location }}" = "subfolder" ]; then
            cd datetoday-bot-main
          fi
          npm install

      - name: Run correct script
        run: |
          if [ "${{ steps.check_location.outputs.location }}" = "subfolder" ]; then
            cd datetoday-bot-main
          fi
          
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "Manual run → running DAILY script"
            node runDaily.js
          elif [ "${{ github.event.schedule }}" = "0 9 * * *" ]; then
            echo "Cron 09:00 UTC → DAILY"
            node runDaily.js
          elif [ "${{ github.event.schedule }}" = "0 12 * * 1" ]; then
            echo "Cron 12:00 UTC Monday → QUICK FACT"
            node -e "import('./viralContent.js').then(m => m.postQuickFact())"
          elif [ "${{ github.event.schedule }}" = "0 12 * * 3" ]; then
            echo "Cron 12:00 UTC Wednesday → WHAT IF"
            node -e "import('./viralContent.js').then(m => m.postWhatIfThread())"
          elif [ "${{ github.event.schedule }}" = "0 12 * * 6" ]; then
            echo "Cron 12:00 UTC Saturday → QUICK FACT"
            node -e "import('./viralContent.js').then(m => m.postQuickFact())"
          elif [ "${{ github.event.schedule }}" = "0 14 * * 2,4" ]; then
            echo "Cron 14:00 UTC Tue/Thu → POLL"
            node -e "import('./polls.js').then(m => m.postPoll())"
          elif [ "${{ github.event.schedule }}" = "0 15 * * 1" ]; then
            echo "Cron 15:00 UTC Monday → HISTORY DEBUNK"
            node -e "import('./viralContent.js').then(m => m.postHistoryDebunk())"
          elif [ "${{ github.event.schedule }}" = "0 15 * * 5" ]; then
            echo "Cron 15:00 UTC Friday → HIDDEN CONNECTION"
            node -e "import('./viralContent.js').then(m => m.postHiddenConnection())"
          elif [ "${{ github.event.schedule }}" = "0 18 * * *" ]; then
            echo "Cron 18:00 UTC → EVENING"
            node runEvening.js
          elif [ "${{ github.event.schedule }}" = "0 16 * * 0" ]; then
            echo "Cron Sunday 16:00 → WEEKLY THREAD"
            node runWeekly.js
          else
            echo "Unknown trigger – defaulting to DAILY"
            node runDaily.js
          fi
```

---

## Method 2: Upload All Updated Files

If you want to update everything at once:

1. Go to your GitHub repository
2. Click **"Add file"** → **"Upload files"**
3. Select ALL files from your `datetoday-bot-main` folder
4. GitHub will ask: "Some files already exist. Replace them?"
5. Click **"Replace existing files"**
6. Commit: "Complete update - optimized schedule, all features"
7. Done!

---

## ✅ What's New in This Update

- ✅ **More schedules** - 9 different cron schedules
- ✅ **New content types** - Quick Facts, History Debunks
- ✅ **25 posts per week** - Up from 19
- ✅ **Auto-detects file location** - Works in root or subfolder
- ✅ **All features included** - Analytics, logging, moderation, etc.

---

## 🎯 Quick Steps Summary

1. Go to `.github/workflows/datetoday.yml`
2. Click **Edit** (pencil icon)
3. **Delete old content**
4. **Paste new content** (from above)
5. **Commit changes**

**That's it!** The workflow will now post 25 times per week! 🚀


