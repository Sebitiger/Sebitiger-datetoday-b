# DateToday Bot (Advanced) 🚀

**A fully automated historian persona** that brings history to life on X (Twitter).

## Features

### Core Content
- 📅 Daily "On this day" history tweets at 09:00 UTC
- 🌙 Evening historical facts at 18:00 UTC
- 🧵 Weekly deep-dive threads every Sunday at 16:00 UTC

### Viral & Engagement Features ✨
- 💬 **Auto-engagement:** Replies to mentions and questions
- 📊 **Interactive polls:** Historical quizzes (Tuesday & Thursday)
- 🎭 **Personality-driven:** Curious, witty, passionate historian voice
- 🔥 **Trending connections:** Links current events to history
- 🖼️ **Smart images:** Auto-fetches and optimizes historical images
- 🔄 **Retry logic:** Resilient API calls with exponential backoff

## Environment variables

Set these in Railway (Service → Variables) or your `.env` file:

**Required:**
- `API_KEY`: X API key
- `API_SECRET`: X API secret
- `ACCESS_TOKEN`: X access token
- `ACCESS_SECRET`: X access secret
- `OPENAI_KEY`: OpenAI API key

**Optional:**
- `BOT_USERNAME`: Your Twitter handle (without @) - for mention monitoring

## Run locally (optional)

1. Create a `.env` file:

   API_KEY=...
   API_SECRET=...
   ACCESS_TOKEN=...
   ACCESS_SECRET=...
   OPENAI_KEY=...

2. Install dependencies:

   npm install

3. Start the bot:

   npm start

## Schedule

All times are in UTC:
- **09:00** - Daily "On this day" tweet
- **14:00** (Tue/Thu) - Interactive polls
- **18:00** - Evening historical fact
- **16:00** (Sunday) - Weekly deep-dive thread
- **Every 15 min** - Check for mentions and engage

## Documentation

- **[QUICK_START.md](./QUICK_START.md)** - ⚡ Get live in 5 minutes
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[IMPROVEMENTS.md](./IMPROVEMENTS.md)** - Complete roadmap for viral growth
- **[VIRAL_FEATURES.md](./VIRAL_FEATURES.md)** - Implementation guide for new features

## Making It Viral

This bot is designed to grow organically through:
- ✅ Authentic engagement with followers
- ✅ Interactive content (polls, questions)
- ✅ Personality-driven storytelling
- ✅ Timely connections to current events
- ✅ Consistent, valuable content

See [IMPROVEMENTS.md](./IMPROVEMENTS.md) for the complete growth strategy.

---

Cron schedules use UTC by default. Adjust them in `index.js` if you want different times or time zones.
