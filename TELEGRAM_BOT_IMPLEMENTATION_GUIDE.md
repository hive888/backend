# Telegram Bot Implementation Guide

## Step-by-Step Implementation

### Step 1: Run Database Migration ✅

**File:** `migrations/telegram_integration.sql`

```bash
# Connect to MySQL and run:
mysql -u your_user -p ptgr_db < migrations/telegram_integration.sql
```

This adds:
- `telegram_user_id` and `telegram_username` fields to `customers` table
- `telegram_verification_codes` table for email verification
- `telegram_channels` table for channel management

---

### Step 2: Get Telegram Bot Token

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow instructions to create your bot
4. Copy the bot token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
5. Save it for Step 7 (environment variables)

---

### Step 3: Set Up Bot in Telegram

1. **Create Private Supergroup:**
   - Create a new Telegram supergroup (not a channel)
   - Make it private
   - Enable "Topics" feature (requires Telegram Premium or supergroup settings)
   - Add your bot as an administrator

2. **Create Two Topics:**
   - **Private List Topic:** Closed topic (only admins can post)
   - **Public List Topic:** Open topic (all members can post)
   
3. **Get Group ID and Topic IDs:**
   - Add `@userinfobot` to your group to get the chat ID (negative number)
   - Get topic IDs (message_thread_id) when topics are created
   - Save these IDs for configuration

---

### Step 4: Environment Variables

Add to your `.env` file:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=8545324971:AAFWhxQBqU5UFN4UDQWR7sPnY8laYVo32xY
TELEGRAM_PRIVATE_GROUP_ID=-1003539951858
TELEGRAM_PRIVATE_TOPIC_ID=3
TELEGRAM_PUBLIC_TOPIC_ID=4

# Telegram Webhook (optional - for production)
TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook
```

---

### Step 5: Install Dependencies (Already Installed ✅)

The following packages are already in your `package.json`:
- `node-telegram-bot-api` ✅
- `grammy` ✅ (alternative library)

---

### Step 6: Implementation Status

✅ **Completed:**
- Database migration
- Customer model methods (findByTelegramId, linkTelegramAccount)
- Telegram verification code model
- Telegram verification email utility

🔨 **In Progress:**
- API endpoints for Telegram integration
- Bot service and handlers

⏳ **Pending:**
- Bot commands implementation
- Channel management
- User registration flow
- Integration testing

---

## Next Steps

1. **Run the migration** (Step 1)
2. **Create your bot** (Step 2)
3. **Set up channels** (Step 3)
4. **Configure environment variables** (Step 4)
5. **Continue with API endpoints and bot service implementation**

---

## Architecture Overview

```
Telegram User
    ↓
Bot receives message/command
    ↓
Check if user exists (telegram_user_id in customers table)
    ↓
┌─────────────┬──────────────┐
│   Exists?   │   New User?  │
│   YES       │   NO         │
└─────────────┴──────────────┘
    ↓                ↓
Grant access    Registration flow
to channels         ↓
                Request email
                Send verification code
                Link account
                Grant access
```

---

## Commands to Implement

- `/start` - Welcome and check registration status
- `/register` - Start new user registration
- `/link` - Link Telegram to existing account
- `/status` - Check registration/access status
- `/help` - Show available commands

