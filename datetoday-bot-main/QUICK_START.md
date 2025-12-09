# ⚡ Quick Start - Get Your Bot Live in 5 Minutes

## 🎯 Fastest Way: Railway (Recommended)

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready to deploy"
git push origin main
```

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app)
2. Click **"Start a New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will auto-detect Node.js

### Step 3: Add Environment Variables
In Railway dashboard → **Variables** tab, add:
```
API_KEY=your_key_here
API_SECRET=your_secret_here
ACCESS_TOKEN=your_token_here
ACCESS_SECRET=your_secret_here
OPENAI_KEY=your_openai_key_here
BOT_USERNAME=DateToday
```

### Step 4: Deploy!
- Railway auto-deploys on push
- Check **Logs** tab to see it running
- Your bot is live! 🎉

---

## 🆓 Free Option: GitHub Actions

### Step 1: Add Secrets
1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:
   - `API_KEY`
   - `API_SECRET`
   - `ACCESS_TOKEN`
   - `ACCESS_SECRET`
   - `OPENAI_KEY`
   - `BOT_USERNAME`

### Step 2: Enable Actions
1. Go to **Actions** tab
2. Click **"I understand my workflows"**
3. Workflow will run on schedule automatically

**Note:** GitHub Actions runs on schedule only (not 24/7 for mentions)

---

## 🧪 Test Before Going Live

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cat > .env << EOF
API_KEY=your_key
API_SECRET=your_secret
ACCESS_TOKEN=your_token
ACCESS_SECRET=your_secret
OPENAI_KEY=your_key
BOT_USERNAME=DateToday
EOF

# 3. Test a tweet
node runDaily.js
```

If it works locally, it will work in production! ✅

---

## 📋 What Happens When Live

Your bot will automatically:
- ✅ Post daily tweet at 09:00 UTC
- ✅ Post evening fact at 18:00 UTC  
- ✅ Post weekly thread on Sunday 16:00 UTC
- ✅ Post polls on Tuesday/Thursday 14:00 UTC
- ✅ Check for mentions every 15 minutes

---

## 🐛 Troubleshooting

**Bot not posting?**
- Check logs in Railway/Render dashboard
- Verify all environment variables are set
- Check Twitter API credentials are valid

**Need help?**
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guide
- Check logs for error messages
- Verify API keys are correct

---

**That's it! Your bot is ready to go live! 🚀**


