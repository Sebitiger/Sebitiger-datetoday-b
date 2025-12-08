# 🚀 Deployment Guide - Making DateToday Bot Live

## Quick Start Options

### Option 1: Railway (Recommended - Easiest) ⭐
### Option 2: Render (Free Tier Available)
### Option 3: GitHub Actions (Free, but limited)
### Option 4: Your Own Server (VPS)

---

## 🎯 Option 1: Railway (Recommended)

**Why Railway?**
- ✅ Free tier available
- ✅ Easy GitHub integration
- ✅ Automatic deployments
- ✅ Built-in environment variables
- ✅ No credit card needed for basic use

### Step-by-Step:

#### 1. Prepare Your Code
```bash
# Make sure everything is committed to GitHub
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### 2. Sign Up for Railway
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `datetoday-bot` repository

#### 3. Configure Environment Variables
In Railway dashboard:
1. Go to your project → **Variables** tab
2. Add these variables:
   ```
   API_KEY=your_twitter_api_key
   API_SECRET=your_twitter_api_secret
   ACCESS_TOKEN=your_access_token
   ACCESS_SECRET=your_access_secret
   OPENAI_KEY=your_openai_key
   BOT_USERNAME=DateToday
   ```

#### 4. Configure Build Settings
1. Go to **Settings** → **Build & Deploy**
2. Set **Start Command:** `node index.js`
3. Railway will auto-detect Node.js

#### 5. Deploy!
- Railway will automatically deploy when you push to GitHub
- Check **Deployments** tab for status
- View logs in **Logs** tab

#### 6. Keep It Running
- Railway free tier may sleep after inactivity
- For 24/7 operation, consider Railway Pro ($5/month)
- Or use Render (see Option 2)

---

## 🎯 Option 2: Render (Free 24/7 Option)

**Why Render?**
- ✅ Free tier with 24/7 uptime
- ✅ Easy setup
- ✅ Automatic SSL
- ✅ GitHub integration

### Step-by-Step:

#### 1. Sign Up
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

#### 2. Create New Web Service
1. Click **New +** → **Web Service**
2. Connect your GitHub repo
3. Select your `datetoday-bot` repository

#### 3. Configure Service
- **Name:** `datetoday-bot`
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `node index.js`
- **Plan:** Free (or paid for better performance)

#### 4. Add Environment Variables
In **Environment** section, add:
```
API_KEY=your_twitter_api_key
API_SECRET=your_twitter_api_secret
ACCESS_TOKEN=your_access_token
ACCESS_SECRET=your_access_secret
OPENAI_KEY=your_openai_key
BOT_USERNAME=DateToday
```

#### 5. Deploy
- Click **Create Web Service**
- Render will build and deploy automatically
- Check logs to ensure it's running

---

## 🎯 Option 3: GitHub Actions (Free, Scheduled Only)

**Why GitHub Actions?**
- ✅ Completely free
- ✅ No server needed
- ✅ Runs on schedule
- ⚠️ Not 24/7 (runs only on schedule)

### Step-by-Step:

#### 1. Add Secrets to GitHub
1. Go to your GitHub repo
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:
   - `API_KEY`
   - `API_SECRET`
   - `ACCESS_TOKEN`
   - `ACCESS_SECRET`
   - `OPENAI_KEY`
   - `BOT_USERNAME`

#### 2. Enable GitHub Actions
1. Go to **Actions** tab in your repo
2. The workflow file (`.github/workflows/datetoday.yml`) should already exist
3. If not, create it (see below)

#### 3. Test the Workflow
1. Go to **Actions** tab
2. Click **Run workflow** (manual trigger)
3. Watch it run!

**Note:** GitHub Actions runs on schedule, not 24/7. Good for scheduled posts, but won't monitor mentions continuously.

---

## 🎯 Option 4: Your Own Server (VPS)

### Using DigitalOcean, AWS, etc.

#### 1. Set Up Server
```bash
# SSH into your server
ssh user@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2
```

#### 2. Clone and Setup
```bash
# Clone your repo
git clone https://github.com/yourusername/datetoday-bot.git
cd datetoday-bot

# Install dependencies
npm install

# Create .env file
nano .env
# Add all your environment variables
```

#### 3. Run with PM2
```bash
# Start the bot
pm2 start index.js --name datetoday-bot

# Make it start on reboot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs datetoday-bot
```

---

## ✅ Pre-Deployment Checklist

Before going live, make sure:

- [ ] All environment variables are set
- [ ] Code is pushed to GitHub
- [ ] `.env` file is NOT committed (check `.gitignore`)
- [ ] Test locally first: `npm start`
- [ ] Twitter API credentials are valid
- [ ] OpenAI API key has credits
- [ ] Bot username is correct

---

## 🧪 Testing Before Going Live

### 1. Test Locally
```bash
# Install dependencies
npm install

# Create .env file with your credentials
# Then test:
node runDaily.js    # Test daily tweet
node runEvening.js   # Test evening fact
node runWeekly.js    # Test weekly thread
```

### 2. Test Individual Features
```bash
# Test engagement (if you have mentions)
node -e "import('./engagement.js').then(m => m.monitorMentions())"

# Test poll
node -e "import('./polls.js').then(m => m.postPoll())"
```

---

## 📊 Monitoring Your Bot

### Check Logs
- **Railway:** Dashboard → Logs tab
- **Render:** Dashboard → Logs
- **GitHub Actions:** Actions tab → Click run → View logs
- **VPS:** `pm2 logs datetoday-bot`

### Monitor Activity
- Check Twitter for new posts
- Verify cron jobs are running
- Check for errors in logs
- Monitor API usage (OpenAI, Twitter)

---

## 🐛 Troubleshooting

### Bot Not Posting
1. Check logs for errors
2. Verify environment variables are set
3. Check Twitter API credentials
4. Verify cron schedule (UTC timezone)
5. Check API rate limits

### Engagement Not Working
1. Verify `BOT_USERNAME` is set correctly
2. Check Twitter API permissions (need read access)
3. Verify mentions are being received
4. Check rate limits (20 replies/hour)

### Polls Not Working
1. Verify Twitter API v2 access
2. Check if polls are supported in your API tier
3. Review poll generation logs

---

## 💰 Cost Estimates

### Free Options:
- **Railway:** Free tier (may sleep), Pro $5/month
- **Render:** Free tier (24/7), Hobby $7/month
- **GitHub Actions:** Free (2,000 min/month)

### API Costs:
- **OpenAI:** ~$0.01-0.05 per tweet (depends on model)
- **Twitter API:** Free (Basic tier) or $100/month (Pro)

### Monthly Estimate:
- **Minimal:** $0-5 (free hosting + minimal API usage)
- **Recommended:** $10-20 (paid hosting + API usage)
- **Scale:** $50+ (high engagement, more API calls)

---

## 🚀 Quick Deploy Commands

### Railway (CLI)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Render (CLI)
```bash
npm install -g render-cli
render login
render deploy
```

---

## 📝 Recommended Setup

**For Beginners:**
1. Start with **Railway** (easiest)
2. Use free tier to test
3. Upgrade if needed

**For 24/7 Operation:**
1. Use **Render** free tier (24/7)
2. Or **Railway Pro** ($5/month)
3. Monitor costs

**For Maximum Control:**
1. Use **VPS** (DigitalOcean, $5/month)
2. Full control
3. Can run multiple bots

---

## 🎯 Next Steps After Deployment

1. ✅ Monitor first few posts
2. ✅ Check engagement is working
3. ✅ Verify polls are posting
4. ✅ Test mention replies
5. ✅ Set up monitoring/alerts
6. ✅ Track analytics
7. ✅ Iterate based on performance

---

## 📞 Need Help?

- Check logs first
- Review error messages
- Verify all environment variables
- Test API credentials separately
- Check Twitter/OpenAI API status pages

**Your bot is ready to go live! 🚀**

