# AI Mentor - Setup Guide

Complete instructions for setting up the AI Mentor app with Firebase and OpenAI.

## Prerequisites

- Node.js 18+ (check with `node --version`)
- npm or yarn
- A Google account (for Firebase)
- An OpenAI API account with valid API key

## Step 1: Create Firebase Project

### 1a. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** or **"Add project"**
3. Enter project name: `ai-mentor` (or your choice)
4. Select your region
5. Click **Create project**
6. Wait for initialization to complete

### 1b. Enable Google Sign-In

1. In Firebase Console, go to **Build** → **Authentication**
2. Click **Get started**
3. Select **Google** provider
4. Toggle **Enable** to turn it on
5. Set public-facing name to "AI Mentor"
6. Add email (your email)
7. Click **Save**

### 1c. Create Firestore Database

1. Go to **Build** → **Firestore Database**
2. Click **Create database**
3. Select **Start in test mode** (for development; use production rules in production)
4. Select your region
5. Click **Create**

### 1d. Get Firebase Config

1. Go to **Project Settings** (gear icon at top)
2. Click **Your apps** → **Add app** (or see existing web app)
3. Select **Web** app type
4. Register app name: `ai-mentor-web`
5. Copy the config object that appears:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

Save these values for `.env.local`.

### 1e. Create Firebase Admin SDK Key

1. Go to **Project Settings** → **Service Accounts**
2. Click **Generate new private key**
3. A JSON file will download - keep it safe!
4. Extract these fields:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (with `\n` preserved)
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

## Step 2: Set Up OpenAI

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Click **API keys** in sidebar
3. Click **Create new secret key**
4. Copy the key (it won't be shown again!)
5. Save as `OPENAI_API_KEY` in `.env.local`

## Step 3: Configure Environment Variables

1. In your project root, create `.env.local`:

```env
# ==========================================
# FIREBASE CLIENT (Frontend)
# ==========================================
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456

# ==========================================
# FIREBASE ADMIN (Server-side)
# ==========================================
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com

# ==========================================
# OPENAI
# ==========================================
OPENAI_API_KEY=sk-...
```

**Important**: The private key needs literal `\n` characters (not newlines). From the JSON file:
- Original: `"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"`
- In `.env`: Keep the `\n` as-is

## Step 4: Install Dependencies

```bash
# Navigate to project
cd /path/to/journai

# Install all dependencies
npm install
```

## Step 5: Run Development Server

```bash
npm run dev
```

This will start:
- **Frontend**: http://localhost:5173
- **Backend API**: Same server (SvelteKit)

Open http://localhost:5173 in your browser.

## Step 6: Test the App

### 6a. Sign In

1. Click **Sign in with Google**
2. Choose your Google account
3. Grant permissions if prompted
4. You should be redirected to dashboard

### 6b. Test Daily Vent Session

1. Click **Start Daily Vent Session**
2. You should see:
   - 30-minute timer at top
   - Empty message list
   - Input field at bottom
3. Type a message like "I had a great day at work!"
4. Click **Send** (or Ctrl+Enter)
5. AI should respond with empathetic, reflective message
6. Messages appear in chat
7. Timer counts down
8. Messages are saved to Firestore after session ends

### 6c. Test Weekly Mentor Session

1. Go back to dashboard
2. Click **Start Weekly Mentor Session**
3. You should see:
   - 60-minute timer
   - Opening message from AI
4. Type a message
5. AI should respond with insights (if vent messages exist)
6. After session ends, redirects to dashboard

### 6d. Verify Firestore Saving

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Go to **Firestore Database**
3. Navigate to `users` → `{your-user-id}` → `weeks` → `{current-week}` → `entries`
4. You should see documents with names like `2025-11-05` (daily) and `mentor` (weekly)
5. Click to view the stored messages

## Step 7: Configure Firestore Security Rules (Production)

For production, update Firestore rules to only allow authenticated users to read/write their own data:

1. In Firebase Console, go to **Firestore Database** → **Rules**
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own user documents
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth.uid == uid;
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

3. Click **Publish**

## Step 8: Build for Production

```bash
npm run build
```

This creates an optimized build in the `build/` directory.

## Troubleshooting

### "Firebase app not initialized"

**Problem**: App crashes on load
**Solution**:
1. Check `.env.local` exists
2. Verify `VITE_FIREBASE_*` variables are set
3. Run `npm run dev` again
4. Check browser console for errors

### "User not authenticated"

**Problem**: Can't access chat sessions
**Solution**:
1. Click **Sign out** and sign in again
2. Check Firebase Console → Authentication → see if user exists
3. Verify Google Sign-In is enabled in Authentication settings

### "OpenAI API error"

**Problem**: Chat returns error
**Solution**:
1. Check `OPENAI_API_KEY` is set in `.env.local`
2. Verify API key is valid at [platform.openai.com](https://platform.openai.com/)
3. Check API usage/quota doesn't exceed plan limits
4. Ensure model name in `llm.ts` matches available models (default: `gpt-4o-mini`)

### "Messages not saving to Firestore"

**Problem**: Chat works but messages don't appear in Firestore
**Solution**:
1. Check Firestore security rules (use test mode for development)
2. Verify `FIREBASE_PROJECT_ID` and `FIREBASE_PRIVATE_KEY` are correct
3. Check server logs for Firebase errors
4. Ensure Firestore database is created

### "Timer not counting down"

**Problem**: Timer shows but doesn't update
**Solution**:
1. Open browser console → check for JavaScript errors
2. Try refreshing the page
3. Check browser's system clock is correct
4. Verify Svelte store subscriptions are working

### "Can't load app on another device"

**Problem**: Works on one machine but not another
**Solution**:
1. Verify environment variables are set on new machine
2. Ensure Node.js version is 18+
3. Run `npm install` again
4. Clear browser cache (or use incognito window)

## Development Tips

### Useful Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Clean install (if dependencies are broken)
rm -rf node_modules
npm install
```

### Debug Firestore Queries

Add logging to `src/lib/services/firestore.ts`:

```typescript
export async function getWeeklyVentEntries(uid: string, weekId: string) {
  console.log(`Fetching vents for ${uid} week ${weekId}`);
  const entriesRef = collection(db, `users/${uid}/weeks/${weekId}/entries`);
  // ... rest of code
  console.log('Entries fetched:', snapshot.docs.length);
  return snapshot.docs.map(/* ... */);
}
```

### Test with Firebase Emulator

For local testing without affecting live Firestore:

1. Install Firebase emulators:
   ```bash
   npm install -g firebase-tools
   firebase init emulators
   ```

2. Start emulator:
   ```bash
   firebase emulators:start
   ```

3. Code in `src/lib/firebase/client.ts` already has emulator setup (commented out)

### Check API Calls

Open browser DevTools → Network tab to see:
- `POST /api/chat` requests and responses
- `POST /api/logs` save requests
- `GET /api/logs` fetch requests

## Next Steps

1. **Customize UI**: Update colors and fonts in `src/styles/globals.css`
2. **Modify prompts**: Edit system prompts in `src/lib/server/llm.ts`
3. **Add analytics**: Track user engagement and session patterns
4. **Export summaries**: Generate weekly PDF reports
5. **Mobile app**: Build native iOS/Android version using React Native

## Support & Resources

- **SvelteKit Docs**: https://kit.svelte.dev/
- **Firebase Docs**: https://firebase.google.com/docs
- **OpenAI API Docs**: https://platform.openai.com/docs
- **Project Repo**: Your Git repository URL

## License

MIT

