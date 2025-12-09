# 🔧 How to Update the Workflow YAML File

## Method 1: Edit Directly on GitHub (Easiest)

### Step 1: Find the File
1. Go to your GitHub repository
2. Navigate to `.github/workflows/datetoday.yml`
   - Click on `.github` folder
   - Click on `workflows` folder
   - Click on `datetoday.yml`

### Step 2: Edit the File
1. Click the **pencil icon** (Edit this file) - top right
2. **Delete all the old content**
3. **Copy and paste the new content** (see below)
4. Scroll down
5. Write commit message: "Update workflow with all new features"
6. Click **"Commit changes"** (green button)

---

## Method 2: Replace via Upload

### Step 1: Upload New File
1. Go to your repository
2. Click **"Add file"** → **"Upload files"**
3. Navigate to `.github/workflows/` folder
4. Upload `datetoday.yml`
5. GitHub will ask: "This file already exists. Replace it?"
6. Click **"Replace it"**
7. Commit changes

---

## 📋 Complete Updated Workflow File

Copy this entire content into the file:

```yaml
name: DateToday Bot

on:
  schedule:
    - cron: "0 9 * * *"     # Daily main tweet – 09:00 UTC
    - cron: "0 12 * * 3"    # What If thread – Wednesday 12:00 UTC
    - cron: "0 14 * * 2,4"  # Polls – Tuesday & Thursday 14:00 UTC
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
          elif [ "${{ github.event.schedule }}" = "0 12 * * 3" ]; then
            echo "Cron 12:00 UTC Wednesday → WHAT IF"
            node -e "import('./viralContent.js').then(m => m.postWhatIfThread())"
          elif [ "${{ github.event.schedule }}" = "0 14 * * 2,4" ]; then
            echo "Cron 14:00 UTC Tue/Thu → POLL"
            node -e "import('./polls.js').then(m => m.postPoll())"
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

## ✅ What's New in This Workflow

1. ✅ **Auto-detects file location** (root or subfolder)
2. ✅ **Includes all new schedules:**
   - What If threads (Wednesday 12:00 UTC)
   - Hidden Connections (Friday 15:00 UTC)
3. ✅ **Works in both locations** (root or subfolder)
4. ✅ **All features included**

---

## 🎯 Quick Steps

1. Go to `.github/workflows/datetoday.yml` in your repo
2. Click **pencil icon** (Edit)
3. **Delete all old content**
4. **Paste the new content above**
5. Click **"Commit changes"**
6. Done!

---

## ⚠️ Important Notes

- The workflow now **automatically detects** if files are in root or subfolder
- All new schedules are included
- Works with all new features (analytics, logging, etc.)

**Just copy, paste, and commit!** ✅


