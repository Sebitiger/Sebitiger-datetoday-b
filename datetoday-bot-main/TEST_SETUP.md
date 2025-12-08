# 🧪 Testing Your Bot Setup

## Step 1: Install Dependencies

First, make sure you have Node.js installed, then install dependencies:

```bash
npm install
```

This will install all required packages:
- twitter-api-v2
- openai
- dotenv
- axios
- node-cron
- sharp

## Step 2: Verify .env File

Check that your `.env` file has all required variables:

```bash
# Quick check (should show all variables are set)
node -e "require('dotenv').config(); console.log('API_KEY:', process.env.API_KEY ? '✓ Set' : '✗ Missing'); console.log('OPENAI_KEY:', process.env.OPENAI_KEY ? '✓ Set' : '✗ Missing');"
```

## Step 3: Test Individual Functions

### Test Daily Tweet
```bash
node runDaily.js
```

This will:
- Fetch a historical event
- Generate a tweet
- Try to fetch an image
- Post to Twitter (if credentials are valid)

### Test Evening Fact
```bash
node runEvening.js
```

### Test Weekly Thread
```bash
node runWeekly.js
```

## Step 4: Test Full Bot (with cron)

```bash
npm start
```

This starts the bot with all cron schedules. It will:
- Wait for scheduled times
- Post daily tweets at 09:00 UTC
- Post evening facts at 18:00 UTC
- Post weekly threads on Sunday 16:00 UTC
- Check for mentions every 15 minutes

**Press Ctrl+C to stop**

## Common Issues

### "Missing required environment variable"
- Check your `.env` file has all variables
- Make sure there are no extra spaces
- Variables should be: `KEY=value` (no spaces around =)

### "Twitter API Error"
- Verify your Twitter API credentials are correct
- Check if your API key has the right permissions
- Make sure you're using Twitter API v2 credentials

### "OpenAI API Error"
- Verify your OpenAI API key is correct
- Check if you have credits in your OpenAI account
- Make sure the key starts with `sk-`

### "Module not found"
- Run `npm install` to install dependencies
- Make sure you're in the project directory

## Next Steps

Once testing works locally:
1. ✅ Push to GitHub
2. ✅ Deploy to Railway/Render
3. ✅ Add environment variables in hosting platform
4. ✅ Monitor logs

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.

