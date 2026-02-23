# CardGuard 🛡️

A modern web application for managing your cards (ID cards, passports, credit cards, etc.) with expiry tracking and cloud storage.

## Features

- 🔐 **Google OAuth Authentication** - Secure login with your Google account
- ☁️ **Cloud Storage** - All data saved to Supabase (free tier)
- 📱 **Mobile Responsive** - Works perfectly on phones and tablets
- � **Multi-file Upload (Front/Back + PDF)** - Upload multiple images for both sides of an ID card, and store PDFs
- ⏰ **Expiry Tracking** - Never miss an expiry date
- 🔔 **Multiple Reminders** - Set reminders at 30/14/7/1 days before expiry per card
- 🗓️ **Calendar Integration** - Add renewal events to Google/Apple Calendar or download an `.ics`
- ✅ **Renewal Steps / Checklist** - Track renewal requirements (required/optional steps + completion)
- 🔗 **Renewal Providers + Instructions** - Deep link to renewal portals with saved search instructions
- 👨‍👩‍👧‍👦 **Profiles / Dependents** - Organize cards profile-wise (Personal, Dad, Wife, etc.)
- ✏️ **Rename Profiles** - Edit profile names anytime
- 🔒 **App Lock (PIN)** - Optional 6-digit PIN lock and encrypted notes
- 📷 **OCR Scanning** - Scan card images to detect key details (like expiry date)
- 🌐 **Cross-Device Sync** - Access your cards from any device
- 📊 **Visitor Analytics (Vercel)** - Track page views and visitors in the Vercel dashboard

## Quick Start

1. **Open the app**: `https://cardguard-8q41.vercel.app/`
2. **Login with Google** - Click "Continue with Google"
3. **Add your first card** - Click the "+" button
4. **Done!** Your cards are safely stored in the cloud

---

## 🚀 Deployment Guide

### Prerequisites

- Node.js installed on your computer
- Git installed
- GitHub account
- Vercel account
- Supabase account

### Step 1: Clone or Download

```bash
# If you have the code locally, you're already set!
# Otherwise clone the repository:
git clone https://github.com/Rettey-G/cardguard.git
cd cardguard
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Make Changes

Edit any files in the `src/` directory:
- `src/App.tsx` - Main application logic
- `src/components/` - React components
- `src/lib/` - Database and utility functions
- `public/` - Static files and images

### Step 4: Test Locally

```bash
npm run dev
```

Open `http://localhost:5173` in your browser to test your changes.

### Step 5: Deploy to Vercel

#### Option A: Using the deploy script (Recommended)

```bash
# On Windows
deploy.bat

# On Mac/Linux
chmod +x deploy.sh
./deploy.sh
```

#### Option B: Manual deployment

```bash
# Add all changes
git add .

# Commit changes
git commit -m "Your change description"

# Push to GitHub
git push

# Go to https://vercel.com and your app will auto-deploy
```

---

## 🧑‍💻 How to Push to GitHub (Windows)

Run these commands inside the project folder (example: `...\CardGuard`).

### First-time setup (only once)

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### Daily workflow (edit -> test -> commit -> push)

```bash
# 1) Check what changed
git status

# 2) Stage changes
git add .

# 3) Commit
git commit -m "feat: short description of what you changed"

# 4) Push to GitHub
git push origin master
```

### If you see: “LF will be replaced by CRLF”

That message is a **warning** on Windows and is safe to ignore.

### If push asks for login

Use one of these:

- **GitHub Desktop** (easiest)
- **Personal Access Token (PAT)** when Git asks for password

---

## 🎥 Video / Demo Script (Full Feature Walkthrough)

Use this as a script for a screen-recorded demo. Target length: ~2–4 minutes.

### 1) Intro (10s)

- Open the app.
- “This is **CardGuard**, a secure card manager to store ID cards, passports, licenses, and credit cards with expiry tracking and renewal workflow.”

### 2) Login + Security (15–25s)

- Click **Continue with Google**.
- Show **App Lock (PIN)** in Settings.
- “Notes can be encrypted when App Lock is enabled.”

### 3) Add a Card (30–45s)

- Click **Add card**.
- Fill:
  - Type
  - Expiry date
  - Profile (optional)
  - Title + Issuer
  - Renew link (optional)
  - Renewal provider (optional)
- Upload:
  - Front image
  - Back image
  - PDF (optional)
- Optional: click **Scan image** to OCR and auto-detect expiry/details.
- Save.

### 4) Reminders (20–30s)

- Open the same card in **Edit**.
- Show reminder checkboxes:
  - 30 / 14 / 7 / 1 days
- “Reminders can be configured per-card, so different documents can have different schedules.”

### 5) Renewal Workflow (30–45s)

- In the card form, add **Renewal Steps**:
  - Example: “Passport photo” (required)
  - Example: “Old passport copy” (required)
  - Example: “Appointment booking” (optional)
- Save and open card view.
- Show the steps list in the card view.

### 6) Calendar Integration (15–25s)

- Open card view.
- Click **Add to Calendar**.
- Demonstrate:
  - **Google Calendar**
  - **Apple Calendar**
  - **Download .ics**

### 7) Renewal Providers + Instructions (20–30s)

- Open **Manage**.
- Create a provider:
  - Name
  - Portal URL
  - Search instructions (what to type/click in the portal)
- Open card view and click **Renew**.
- “It deep-links to the portal and shows the saved instructions.”

### 8) Profiles / Dependents (15–25s)

- Show grouping by profile.
- Add a new profile.
- Rename/delete profiles from **Manage**.

### 9) Close (10s)

- “CardGuard keeps everything in one place: cards + files + reminders + renewal workflow + calendar export.”
- Mention: “Works on mobile, supports cloud sync (Supabase), and has local fallback.”

---

## 📁 Project Structure

```
cardguard/
├── src/
│   ├── components/
│   │   └── Auth.tsx          # Google authentication
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   ├── db-cloud.ts       # Cloud database functions
│   │   ├── db-unified.ts     # Unified database interface
│   │   └── types.ts          # TypeScript types
│   └── App.tsx               # Main app component
├── public/                   # Static files
├── package.json              # Dependencies
├── deploy.bat                # Windows deployment script
├── deploy.sh                 # Mac/Linux deployment script
└── README.md                 # This file
```

---

## 🔧 Configuration

### Environment Variables

The app uses these environment variables (already configured in Vercel):

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Database Schema

The app uses these Supabase tables:
- `cards` - User's card information
- `profiles` - User profiles
- `renewalproviders` - Renewal service providers
- `cardkinds` - Types of cards (shared)
- `settings` - User preferences

---

## 🛠️ Common Tasks

### Adding a New Feature

1. Edit the relevant file in `src/`
2. Test locally: `npm run dev`
3. Deploy: `deploy.bat` (or `./deploy.sh`)

### Fixing a Bug

1. Identify the issue
2. Edit the code
3. Test thoroughly
4. Deploy changes

### Updating Dependencies

```bash
npm update
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

---

## 🌐 How It Works

### Authentication
- Uses Google OAuth via Supabase Auth
- Each user gets isolated data
- Sessions persist across browser restarts

### Data Storage
- **Cards**: Stored in Supabase PostgreSQL
- **Files (Images + PDF)**: Stored in Supabase Storage (supports multiple attachments per card)
- **Settings**: User preferences in database
- **Local Fallback**: IndexedDB when offline

### Profiles
- Cards can be assigned to a profile (e.g., Personal / Dad / Wife)
- Home page displays cards grouped by profile
- Profiles can be renamed from the Manage panel

### Analytics
- Vercel Analytics can be enabled from the Vercel project dashboard
- After deployment, visit the site to start collecting page views

### Security
- Row Level Security (RLS) on all tables
- Users can only access their own data
- Secure file upload with policies

---

## 📱 Mobile Usage

1. Open the app on your phone
2. Login with Google
3. Add cards with photos
4. Works offline (cached data)
5. Syncs when online

---

## 🆘 Troubleshooting

### "Local storage error"
- Clear browser cache
- Use the production URL (not preview)
- Make sure you're logged in

### "Supabase not configured"
- Environment variables missing
- Check Vercel environment variables
- Redeploy the app

### Cards not saving
- Check internet connection
- Verify you're logged in
- Check browser console for errors

### Images not uploading
- Check file size (max 10MB)
- Verify internet connection
- Check Supabase storage policies

---

## 📞 Support

If you need help:
1. Check this README first
2. Look at browser console (F12) for errors
3. Make sure you're using the production URL
4. Verify all environment variables are set

---

## 📄 License

This project is open source. Feel free to contribute!

---

## 🎉 Enjoy CardGuard!

Your personal card manager is now ready. Keep your cards organized and never miss an expiry date again!
