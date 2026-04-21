# 🌿 Bloom — Setup & Deployment Guide

Get Bloom running in ~30 minutes. Follow these steps in order.

---

## Step 1: Create Supabase Project (5 min)

1. Go to [supabase.com](https://supabase.com) → sign up / log in
2. Click **New Project**
3. **IMPORTANT:** Set region to `eu-central-1` (Frankfurt) for GDPR
4. Choose a strong database password → save it somewhere safe
5. Wait for project to be created (~2 min)
6. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJhbGc...`)

---

## Step 2: Set Up Database (5 min)

1. In Supabase, go to **SQL Editor**
2. Open the file `supabase/migrations/001_schema.sql` from this project
3. **Copy the entire contents** and paste into the SQL Editor
4. Click **Run** — this creates all tables, triggers, and security policies
5. Verify: go to **Table Editor** — you should see: `profiles`, `couples`, `check_ins`, `notes`, `moments`, `garden_stats`

---

## Step 3: Configure Auth (3 min)

1. In Supabase → **Authentication → Providers**
2. Ensure **Email** is enabled
3. Under Email provider settings:
   - **Enable "Confirm email"** = ON
   - **Enable "Secure email change"** = ON
4. Go to **Authentication → URL Configuration**
5. Add your site URL: `http://localhost:5173` (for dev)
6. Add redirect URLs:
   - `http://localhost:5173`
   - `https://your-domain.vercel.app` (add later when deployed)

---

## Step 4: Run Locally (5 min)

```bash
# 1. Clone/copy the project
cd bloom

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Edit .env — paste your Supabase URL and anon key
#    VITE_SUPABASE_URL=https://xxxxx.supabase.co
#    VITE_SUPABASE_ANON_KEY=eyJhbGc...

# 5. Start development server
npm run dev

# 6. Open http://localhost:5173
```

---

## Step 5: Test the Flow

### Test as Person 1 (you):
1. Open `http://localhost:5173`
2. Enter your name + email → click "Continue with Magic Link"
3. Check your email → click the magic link
4. Click **"Start a New Garden"**
5. You'll see a 6-digit invite code — copy it

### Test as Person 2 (use a different email):
1. Open the app in an incognito/private window
2. Enter a different name + email → sign in
3. Click **"Join My Partner's Garden"**
4. Enter the invite code from step 5
5. You're now connected! Both accounts share the same garden

### Test features:
- **Today tab:** Answer the daily question on both accounts
- **Notes:** Send a love note from one account, see it appear on the other
- **Moments:** Add memories to the shared timeline
- **Garden:** Watch flowers bloom as you check in

---

## Step 6: Deploy to Vercel (5 min)

1. Push the project to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. Set **Root Directory** to `bloom` (if inside a subfolder)
4. Add **Environment Variables**:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Click **Deploy**
6. After deployment, copy your Vercel URL
7. Go back to Supabase → **Authentication → URL Configuration**
8. Add your Vercel URL to the redirect URLs list

---

## Step 7: Custom Domain (optional)

1. Buy a domain (Namecheap, Porkbun — ~€10/yr)
2. In Vercel → **Settings → Domains** → add your domain
3. Add the DNS records Vercel provides at your registrar
4. Update Supabase redirect URLs with your custom domain

---

## Step 8: Program NFC Tags

1. Buy NTAG215 stickers (Amazon, ~€5 for a pack)
2. Download **NFC Tools** (free app, iOS + Android)
3. Open app → **Write** → **Add record** → **URL**
4. Enter: `https://your-domain.com`
5. Hold phone to NFC sticker → tap Write
6. Stick inside a card or on the fridge

---

## Project Structure

```
bloom/
├── index.html               ← Entry point
├── package.json              ← Dependencies
├── vite.config.js            ← Build config
├── vercel.json               ← Routing config
├── .env.example              ← Environment template
├── supabase/
│   └── migrations/
│       └── 001_schema.sql    ← Database schema (run in SQL Editor)
└── src/
    ├── main.jsx              ← React entry
    ├── App.jsx               ← Full app (auth, screens, all features)
    ├── index.css             ← Global styles
    └── lib/
        ├── supabase.js       ← Supabase client
        ├── db.js             ← All database operations
        └── content.js        ← Questions + daily quotes
```

---

## Troubleshooting

**"Missing Supabase credentials"** → Check your `.env` file has the right values

**Magic link doesn't arrive** → Check spam folder. In Supabase → Auth → Email Templates, you can customize the email

**"Invalid invite code"** → Codes are case-insensitive but must be exactly 6 characters. Check the `couples` table in Supabase Table Editor

**RLS errors (permission denied)** → Make sure you ran the FULL migration SQL including all the policies at the bottom

**Blank screen after magic link** → Add your local/deployed URL to Supabase → Auth → URL Configuration → Redirect URLs

---

Made with love 🌿
