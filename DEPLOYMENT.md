# Deploy CardGuard to Vercel with Free Database

## Prerequisites
- GitHub account
- Vercel account (free)
- Node.js installed locally

## Step 1: Prepare Your Code
1. Make sure all changes are committed to Git:
```bash
git add .
git commit -m "Add mobile navigation and Vercel Postgres support"
```

2. Push to GitHub:
```bash
git remote add origin https://github.com/yourusername/cardguard.git
git push -u origin main
```

## Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "New Project"
3. Import your CardGuard repository
4. Vercel will auto-detect it as a Vite project
5. Click "Deploy"

## Step 3: Add Free Database
1. In your Vercel project dashboard, go to "Storage" tab
2. Click "Create Database"
3. Select "Postgres" and choose the "Hobby" (free) plan
4. Create the database
5. Once created, click on your database
6. Go to "Query" tab
7. Copy and paste the contents of `schema.sql`
8. Click "Execute" to create tables

## Step 4: Connect Database to App
1. In your database dashboard, go to ".env.local" tab
2. Copy the `POSTGRES_URL` value
3. In your Vercel project, go to "Settings" → "Environment Variables"
4. Add a new variable:
   - Name: `DATABASE_URL`
   - Value: (paste the POSTGRES_URL)
5. Redeploy your project (Vercel will auto-redeploy on env var changes)

## Step 5: Update App to Use Cloud Database
To switch from local IndexedDB to cloud database, you'll need to update the imports in `src/App.tsx`:

```typescript
// Replace this import:
import { listCards, createCard, ... } from './lib/db'

// With this import (for production):
import { listCards, createCard, ... } from './lib/vercel-db'
```

You can use environment variables to switch between local and cloud:
```typescript
import * as localDb from './lib/db'
import * as cloudDb from './lib/vercel-db'

const db = import.meta.env.PROD ? cloudDb : localDb
```

## Features
✅ **Mobile Navigation**: Responsive hamburger menu for mobile devices
✅ **Free Database**: Vercel Postgres Hobby plan (free forever)
✅ **OCR Support**: Scan and extract text from card images
✅ **PWA Ready**: Works offline and can be installed as an app

## Free Plan Limits
- Vercel Postgres Hobby: 512MB storage, 60 connections/hour
- Vercel Hosting: 100GB bandwidth/month
- Perfect for personal use with hundreds of cards

## Your App URL
After deployment, your app will be available at:
`https://your-project-name.vercel.app`

## Support
If you need help:
1. Check Vercel deployment logs
2. Verify database connection in Vercel Storage dashboard
3. Make sure all environment variables are set correctly
