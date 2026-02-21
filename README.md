# CardGuard 🛡️

A modern web application for managing your cards (ID cards, passports, credit cards, etc.) with expiry tracking and cloud storage.

## Features

- 🔐 **Google OAuth Authentication** - Secure login with your Google account
- ☁️ **Cloud Storage** - All data saved to Supabase (free tier)
- 📱 **Mobile Responsive** - Works perfectly on phones and tablets
- 📸 **Image Upload** - Add photos of your cards
- ⏰ **Expiry Tracking** - Never miss an expiry date
- 🔔 **Notifications** - Get reminded before cards expire
- 🌐 **Cross-Device Sync** - Access your cards from any device

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
- **Images**: Stored in Supabase Storage
- **Settings**: User preferences in database
- **Local Fallback**: IndexedDB when offline

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
