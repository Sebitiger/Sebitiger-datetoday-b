# 📤 Upload to GitHub - Step by Step Guide

## Option 1: Using GitHub Web Interface (Easiest)

### Step 1: Prepare Files
Make sure all your files are ready in `/Users/sebastiendero/Desktop/datetoday-bot-main`

### Step 2: Go to Your GitHub Repository
1. Go to [github.com](https://github.com)
2. Navigate to your `datetoday-bot` repository (or whatever you named it)

### Step 3: Delete Old Files (if needed)
1. Click on each file/folder
2. Click the trash icon
3. Commit the deletion

**OR** just upload new files - GitHub will ask if you want to replace existing ones.

### Step 4: Upload All Files
1. Click **"Add file"** → **"Upload files"**
2. Drag and drop your entire `datetoday-bot-main` folder
3. **Important:** Make sure to include:
   - All `.js` files
   - `.github/workflows/datetoday.yml`
   - `package.json`
   - All `.md` files (documentation)
   - `.gitignore`
   - `.env.example` (if you created it)

4. Scroll down and click **"Commit changes"**
5. Write commit message: "Complete bot with all features - analytics, logging, health checks, tests, moderation"
6. Click **"Commit changes"**

### Step 5: Verify Upload
1. Check that `.github/workflows/datetoday.yml` exists
2. Check that `package.json` exists
3. Check that all new files are there (analytics.js, logger.js, health.js, etc.)

---

## Option 2: Using Terminal/Git (If you have git working)

### Step 1: Check Git Status
```bash
cd /Users/sebastiendero/Desktop/datetoday-bot-main
git status
```

### Step 2: Add All Files
```bash
git add .
```

### Step 3: Commit Changes
```bash
git commit -m "Complete bot with all features: analytics, logging, health checks, tests, moderation"
```

### Step 4: Push to GitHub
```bash
git push origin main
```

If you get an error about remote, add it first:
```bash
git remote add origin https://github.com/YOUR_USERNAME/datetoday-bot.git
git branch -M main
git push -u origin main
```

---

## ⚠️ Important: Fix the Workflow for Subfolder

Since your files might be in a `datetoday-bot-main` subfolder, you need to update the workflow:

### Update `.github/workflows/datetoday.yml`:

1. Go to your GitHub repo
2. Click on `.github/workflows/datetoday.yml`
3. Click **Edit** (pencil icon)
4. Update the "Install dependencies" step:

```yaml
      - name: Install dependencies
        run: npm install
        working-directory: ./datetoday-bot-main
```

5. Update the "Run correct script" step to start with:

```yaml
      - name: Run correct script
        run: |
          cd datetoday-bot-main
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "Manual run → running DAILY script"
            node runDaily.js
          # ... rest of the script
```

6. Save the changes

---

## ✅ Checklist Before Uploading

- [ ] All `.js` files are in the folder
- [ ] `.github/workflows/datetoday.yml` exists
- [ ] `package.json` exists and is updated
- [ ] `.gitignore` includes `data/` and `logs/`
- [ ] All new files: `analytics.js`, `logger.js`, `health.js`, `moderation.js`, `config.js`, `database.js`, `rateLimiter.js`
- [ ] `tests/` folder with test files
- [ ] All documentation files (`.md` files)

---

## 🎯 After Uploading

### 1. Verify Secrets Are Still There
- Go to **Settings** → **Secrets and variables** → **Actions**
- Make sure all 6 secrets are still there:
  - `API_KEY`
  - `API_SECRET`
  - `ACCESS_TOKEN`
  - `ACCESS_SECRET`
  - `OPENAI_KEY`
  - `BOT_USERNAME`

### 2. Test the Workflow
1. Go to **Actions** tab
2. Click **"DateToday Bot"** workflow
3. Click **"Run workflow"**
4. Watch it run - should work now!

### 3. Check for Errors
- If you see errors, check the logs
- Common issues:
  - Missing `package.json` → Make sure it's uploaded
  - Files in subfolder → Update workflow with `working-directory`
  - Missing secrets → Add them in Settings

---

## 🚀 Quick Upload (Recommended)

**Easiest method:**

1. Go to your GitHub repo
2. Click **"Add file"** → **"Upload files"**
3. Select ALL files from `datetoday-bot-main` folder
4. Click **"Commit changes"**
5. Update workflow file if files are in subfolder
6. Test with "Run workflow"

**That's it!** 🎉


