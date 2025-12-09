# 🔧 Create Workflow in GitHub (Web Interface)

Since the `.github` folder might not have uploaded, create it manually in GitHub:

## Step 1: Create the Workflow File in GitHub

1. Go to your GitHub repository
2. Click **"Add file"** → **"Create new file"**
3. In the file path box, type exactly:
   ```
   .github/workflows/datetoday.yml
   ```
   (GitHub will automatically create the `.github` and `workflows` folders)

## Step 2: Copy This Content

Copy and paste this entire content into the file:

```yaml
name: DateToday Bot

on:
  schedule:
    - cron: "0 9 * * *"     # Daily main tweet – 09:00 UTC
    - cron: "0 14 * * 2,4"  # Polls – Tuesday & Thursday 14:00 UTC
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

      - name: Install dependencies
        run: npm install

      - name: Run correct script
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "Manual run → running DAILY script"
            node runDaily.js
          elif [ "${{ github.event.schedule }}" = "0 9 * * *" ]; then
            echo "Cron 09:00 UTC → DAILY"
            node runDaily.js
          elif [ "${{ github.event.schedule }}" = "0 14 * * 2,4" ]; then
            echo "Cron 14:00 UTC Tue/Thu → POLL"
            node -e "import('./polls.js').then(m => m.postPoll())"
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

## Step 3: Commit the File

1. Scroll down
2. Click **"Commit new file"** (or "Commit directly to the main branch")
3. Click the green **"Commit new file"** button

## Step 4: Verify It Worked

1. Go to **Actions** tab
2. You should now see **"DateToday Bot"** workflow appear!
3. Click on it
4. Click **"Run workflow"** to test

---

**That's it! The workflow should now appear in Actions!** 🎉


