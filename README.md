# Journai - AI Mentor Application

A journaling-style AI companion app with two distinct modes: empathetic daily vent sessions and analytical weekly mentor sessions. Built with SvelteKit, Firebase, and AI integration.

## 📋 Project Status

### ✅ What Has Been Done

#### Core Infrastructure
- **Authentication System**: Firebase Google Sign-In integration with automatic user document creation
- **Session Management**: Real-time session state management with Svelte stores
- **Timer System**: Continuous countdown timer that persists across page refreshes
- **Session Persistence**: Draft system that saves and restores active sessions when users close/reopen the app
- **Cooldown System**: 12-hour cooldown between vent sessions to prevent overuse

#### Data Architecture
- **Firestore Database Structure**: Complete data model with users, weeks, vent sessions, drafts, and mentor entries
- **Server-Side Operations**: Firebase Admin SDK integration for secure server-side Firestore operations
- **Week-Based Organization**: ISO week-based data organization (`YYYY-Www` format)
- **Vent Session Tracking**: Automatic counting of vent sessions per week with metadata tracking

#### User Interface
- **Responsive Layout**: Mobile-friendly design with proper viewport handling
- **Global Header**: Home navigation and sign-out functionality
- **Session Cards**: Dashboard with vent and mentor session cards
- **Progress Tracking**: Visual feedback showing vent session progress (X/5 sessions)
- **Mentor Session Gating**: Mentor sessions unlock after 5 vent sessions are completed in a week
- **Chat Interface**: Message list and input components with proper scrolling and visibility

#### API Endpoints
- **Chat Endpoint** (`/api/chat`): Routes messages to appropriate AI agents
- **Logs Endpoint** (`/api/logs`): Saves and retrieves session data
- **Server-Side Validation**: Proper error handling and data validation

### 🚧 What Needs To Be Done

#### High Priority
1. **Gemini AI Integration**
   - Replace OpenAI API calls with Google Gemini API
   - Update `src/lib/server/llm.ts` to use Gemini SDK
   - Configure Gemini API key in environment variables
   - Test both Vent and Mentor agent prompts with Gemini

2. **AI Prompts & System Instructions**
   - **Vent Agent Prompt**: Refine empathetic listening prompts for Gemini
   - **Mentor Agent Prompt**: Develop pattern recognition and advice prompts
   - Add context window management for weekly mentor sessions
   - Implement prompt versioning for A/B testing

3. **Error Handling & Edge Cases**
   - Handle API rate limits and errors gracefully
   - Add retry logic for failed API calls
   - Implement fallback responses when AI is unavailable
   - Add user-facing error messages

#### Medium Priority
4. **Session Analytics**
   - Track session completion rates
   - Monitor average session duration
   - Analyze message patterns

5. **User Experience Enhancements**
   - Loading states for all async operations
   - Better error messages and recovery flows
   - Session history view
   - Export functionality for sessions

6. **Testing**
   - Unit tests for Firestore operations
   - Integration tests for API endpoints
   - E2E tests for session flows

#### Low Priority
7. **Performance Optimization**
   - Optimize Firestore queries
   - Implement pagination for session history
   - Add caching where appropriate

8. **Additional Features**
   - Email notifications for weekly summaries
   - Mobile app (React Native/Flutter)
   - Admin dashboard for monitoring

## 🗄️ Firestore Database Structure

This section documents the complete Firestore structure for new engineers to understand the data model.

### Collection Hierarchy

```
/users/{uid}/
  ├── (user document)
  └── /weeks/{weekId}/
      ├── (week document)
      ├── /ventSessions/{sessionId}/
      │   └── (vent session document)
      ├── /drafts/{date}/
      │   └── (draft document)
      └── /entries/{entryId}/
          └── (mentor entry document)
```

### Document Schemas

#### 1. User Document
**Path**: `/users/{uid}`

**Schema**:
```typescript
{
  uid: string;                    // Firebase user ID
  email: string | null;            // User email
  displayName: string | null;      // User display name
  photoURL: string | null;         // Profile photo URL
  createdAt: Timestamp;            // First login timestamp
  lastLoginAt: Timestamp;          // Most recent login timestamp
}
```

**Created**: Automatically when user authenticates for the first time
**Updated**: On each login (updates `lastLoginAt`)

**Example**:
```json
{
  "uid": "FXrSF8fDJlaB9bE0HYDpVu9GT5u2",
  "email": "user@example.com",
  "displayName": "John Doe",
  "photoURL": "https://...",
  "createdAt": "2025-11-06T12:39:13Z",
  "lastLoginAt": "2025-11-06T12:55:14Z"
}
```

---

#### 2. Week Document
**Path**: `/users/{uid}/weeks/{weekId}`

**Week ID Format**: `YYYY-Www` (e.g., `2025-W45`)
- `YYYY`: 4-digit year
- `W`: Literal "W"
- `ww`: 2-digit ISO week number (01-53)

**Schema**:
```typescript
{
  weekId: string;                  // Format: "2025-W45"
  ventEntryCount: number;          // Number of completed vent sessions this week
  lastVentSessionAt?: Timestamp;  // Timestamp of last completed vent session
  createdAt: Timestamp;            // Week document creation timestamp
  lastUpdated: Timestamp;          // Last update timestamp
}
```

**Created**: When first vent session of the week starts
**Updated**: When vent sessions are completed (increments `ventEntryCount`)

**Example**:
```json
{
  "weekId": "2025-W45",
  "ventEntryCount": 3,
  "lastVentSessionAt": "2025-11-06T12:57:06Z",
  "createdAt": "2025-11-06T12:42:06Z",
  "lastUpdated": "2025-11-06T12:57:06Z"
}
```

**Business Logic**:
- `ventEntryCount` must reach 5 before mentor session is unlocked
- `lastVentSessionAt` is used to enforce 12-hour cooldown between vent sessions

---

#### 3. Vent Session Document
**Path**: `/users/{uid}/weeks/{weekId}/ventSessions/{sessionId}`

**Session ID Format**: `YYYY-MM-DD_HH-MM-SS` (e.g., `2025-11-06_12-42-06`)
- Granular date and time for better organization and readability

**Schema**:
```typescript
{
  startTime: number;               // Unix timestamp in milliseconds when session started
  durationMinutes: number;         // Session duration (typically 30 minutes)
  messages: Message[];             // Array of chat messages
  completedAt: Timestamp;          // When session was completed
  createdAt: Timestamp;            // Document creation timestamp
  lastUpdated: Timestamp;          // Last update timestamp
}
```

**Message Type**:
```typescript
{
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;              // Optional Unix timestamp in milliseconds
}
```

**Created**: When a vent session is completed (not during active session)
**Updated**: Never (sessions are immutable once completed)

**Example**:
```json
{
  "startTime": 1762451717991,
  "durationMinutes": 30,
  "messages": [
    {
      "role": "user",
      "content": "I had a tough day at work...",
      "timestamp": 1762451738527
    },
    {
      "role": "assistant",
      "content": "That sounds really challenging. Tell me more about what happened.",
      "timestamp": 1762451741234
    }
  ],
  "completedAt": "2025-11-06T12:57:06Z",
  "createdAt": "2025-11-06T12:42:06Z",
  "lastUpdated": "2025-11-06T12:57:06Z"
}
```

**Important Notes**:
- Vent sessions are saved to `ventSessions` collection, NOT `entries`
- Only completed sessions are saved here
- Active sessions are saved to `drafts` collection (see below)

---

#### 4. Draft Document
**Path**: `/users/{uid}/weeks/{weekId}/drafts/{date}`

**Date Format**: `YYYY-MM-DD` (e.g., `2025-11-06`)

**Schema**:
```typescript
{
  mode: 'vent' | 'mentor';        // Session type
  messages: Message[];             // Current chat messages
  startTime: number;               // Unix timestamp in milliseconds
  durationMinutes: number;         // Session duration
  lastUpdated: Timestamp;          // Last auto-save timestamp
}
```

**Created**: When a session starts
**Updated**: Every 5 seconds during active session (auto-save)
**Deleted**: When session is completed or manually ended

**Purpose**: Allows users to close/reopen the app and continue their session

**Example**:
```json
{
  "mode": "vent",
  "messages": [
    {
      "role": "user",
      "content": "Test",
      "timestamp": 1762451738527
    }
  ],
  "startTime": 1762451717991,
  "durationMinutes": 30,
  "lastUpdated": "2025-11-06T12:57:12Z"
}
```

---

#### 5. Mentor Entry Document
**Path**: `/users/{uid}/weeks/{weekId}/entries/{entryId}`

**Entry ID**: Always `"mentor"` (one mentor session per week)

**Schema**:
```typescript
{
  id: "mentor";                    // Always "mentor"
  mode: "mentor";                  // Always "mentor"
  timestamp: number;               // Unix timestamp in milliseconds
  messages: Message[];             // Chat messages
  summary?: string;                // Optional AI-generated summary
  lastUpdated: Timestamp;          // Last update timestamp
}
```

**Created**: When mentor session is completed
**Updated**: Never (sessions are immutable once completed)

**Example**:
```json
{
  "id": "mentor",
  "mode": "mentor",
  "timestamp": 1762452000000,
  "messages": [
    {
      "role": "assistant",
      "content": "Let me review your week...",
      "timestamp": 1762452001000
    },
    {
      "role": "user",
      "content": "I've been feeling stressed...",
      "timestamp": 1762452005000
    }
  ],
  "summary": "This week showed patterns of work stress...",
  "lastUpdated": "2025-11-06T13:00:00Z"
}
```

---

### Data Flow Examples

#### Starting a Vent Session
1. User clicks "Start Daily" on dashboard
2. System checks cooldown: `canStartVentSession(uid, weekId)`
3. If allowed:
   - Create/update week document: `createOrUpdateWeek(uid, weekId)`
   - Check for existing draft: `getSessionDraft(uid, weekId, currentDate)`
   - If draft exists: Restore session from draft
   - If no draft: Start new session with `sessionStore.startSession('vent', 30)`
4. Auto-save draft every 5 seconds: `saveSessionDraft(...)`

#### Completing a Vent Session
1. Timer expires or user manually ends session
2. Generate session ID: `YYYY-MM-DD_HH-MM-SS` format
3. Save to `ventSessions`: `saveVentSessionServer(uid, weekId, sessionId, data)`
   - This uses Firebase Admin SDK (server-side)
4. Delete draft: `deleteSessionDraft(uid, weekId, currentDate)`
5. Update week document: Increment `ventEntryCount`, update `lastVentSessionAt`

#### Starting a Mentor Session
1. User clicks "Start Weekly" on dashboard
2. System checks: `getWeekVentCount(uid, weekId) >= 5`
3. If unlocked:
   - Start session: `sessionStore.startSession('mentor', 60)`
   - Fetch week's vent sessions: `getWeeklyVentSessions(uid, weekId)`
   - Include vent sessions as context in first AI message

#### Completing a Mentor Session
1. Timer expires or user manually ends session
2. Save to `entries`: `saveChatEntry(uid, weekId, 'mentor', data)`
3. Session is immutable once saved

---

### Query Patterns

#### Get All Vent Sessions for a Week
```typescript
const ventSessionsRef = collection(
  db,
  `users/${uid}/weeks/${weekId}/ventSessions`
);
const snapshot = await getDocs(ventSessionsRef);
const sessions = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

#### Get Week Document
```typescript
const weekRef = doc(db, `users/${uid}/weeks`, weekId);
const weekDoc = await getDoc(weekRef);
if (weekDoc.exists()) {
  const weekData = weekDoc.data() as WeekDocument;
}
```

#### Check for Active Draft
```typescript
const draftRef = doc(db, `users/${uid}/weeks/${weekId}/drafts`, currentDate);
const draftDoc = await getDoc(draftRef);
if (draftDoc.exists()) {
  const draft = draftDoc.data();
  // Restore session
}
```

---

## 🛠 Tech Stack

- **Frontend**: SvelteKit + TypeScript
- **Backend**: SvelteKit server routes
- **Authentication**: Firebase Auth (Google Sign-In)
- **Database**: Firestore (Cloud) with Firebase Admin SDK for server operations
- **AI**: OpenAI API (currently) - **Needs to be migrated to Gemini**
- **Styling**: CSS with warm, journal-like aesthetic

## 📁 Project Structure

```
src/
├── routes/
│   ├── +layout.svelte          # Global layout with header
│   ├── +page.svelte            # Landing page & dashboard
│   ├── api/
│   │   ├── chat/+server.ts     # Chat orchestrator endpoint
│   │   └── logs/+server.ts     # Chat log save/retrieve endpoints
│   └── session/
│       ├── daily/+page.svelte  # Daily vent session UI
│       └── weekly/+page.svelte # Weekly mentor session UI
├── lib/
│   ├── firebase/
│   │   ├── client.ts           # Firebase client initialization
│   │   └── admin.ts            # Firebase Admin SDK initialization
│   ├── stores/
│   │   ├── authStore.ts        # Auth state management
│   │   └── sessionStore.ts     # Session state & timers
│   ├── services/
│   │   ├── firestore.ts        # Client-side Firestore operations
│   │   └── firestore-server.ts # Server-side Firestore operations
│   ├── server/
│   │   └── llm.ts              # LLM API wrapper + prompts (needs Gemini)
│   └── components/
│       ├── TimerBar.svelte     # Session countdown timer
│       ├── MessageList.svelte  # Chat message display
│       ├── MessageInput.svelte # Input textarea + send button
│       └── ModeBanner.svelte   # Session mode header
└── styles/
    └── globals.css             # Global styles
```

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone <repository-url>
cd journai
npm install
```

### 2. Configure Firebase

1. Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable:
   - **Authentication**: Enable Google Sign-In provider
   - **Firestore Database**: Create in production mode
3. Get your config values from **Project Settings**:
   - API Key, Auth Domain, Project ID, Storage Bucket, Sender ID, App ID
4. Download service account key:
   - Go to Project Settings → Service Accounts
   - Click "Generate New Private Key"
   - Save as `journai-faff1-firebase-adminsdk-fbsvc-4cc82197a5.json` (or update path in `admin.ts`)

### 3. Set Environment Variables

Create a `.env.local` file in the project root:

```env
# Firebase Client (for frontend)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456

# Firebase Admin (for server-side operations)
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com

# OpenAI (temporary - needs to be replaced with Gemini)
OPENAI_API_KEY=sk-your-api-key

# TODO: Add Gemini API Key
# GEMINI_API_KEY=your-gemini-api-key
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

## 🔌 API Endpoints

### POST `/api/chat`

Routes messages to the appropriate AI agent (Vent or Mentor).

**Request:**
```json
{
  "message": "I had a tough day...",
  "mode": "vent" | "mentor",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "uid": "firebase_user_id",
  "weekId": "2025-W45"
}
```

**Response:**
```json
{
  "reply": "That sounds really challenging. Tell me more...",
  "success": true
}
```

### POST `/api/logs`

Saves a complete chat session to Firestore.

**Request:**
```json
{
  "uid": "firebase_user_id",
  "weekId": "2025-W45",
  "entryId": "2025-11-06_12-42-06" | "mentor",
  "mode": "vent" | "mentor",
  "messages": [...],
  "startTime": 1762451717991,
  "durationMinutes": 30
}
```

**Response:**
```json
{
  "success": true,
  "entryId": "2025-11-06_12-42-06"
}
```

### GET `/api/logs`

Retrieves chat entries for a specific week.

**Query Parameters:**
- `uid` (required): Firebase user ID
- `weekId` (required): Week ID in format `YYYY-Www`
- `type` (optional): `"vent"` (default) or `"all"` for all entries

## 🔐 Authentication Flow

1. User lands on `/`
2. Firebase auth listener checks if user is logged in
3. If not logged in, show "Sign in with Google" button
4. After login, user document is automatically created in Firestore
5. Dashboard shows "Start Daily" / "Start Weekly" buttons
6. User is required to stay logged in during sessions

## 💾 Session Lifecycle

### Daily Vent Session

1. User clicks "Start Daily" → navigate to `/session/daily`
2. System checks 12-hour cooldown
3. If allowed, check for existing draft (session persistence)
4. Start or restore session: `sessionStore.startSession('vent', 30)`
5. Auto-save draft every 5 seconds
6. User sends messages → each message calls `/api/chat` with mode='vent'
7. After 30 minutes or manual end → save to `ventSessions` collection
8. Delete draft and update week document

### Weekly Mentor Session

1. User clicks "Start Weekly" → navigate to `/session/weekly`
2. System checks if 5 vent sessions completed this week
3. If unlocked, start session: `sessionStore.startSession('mentor', 60)`
4. Fetch week's vent sessions and include as context
5. User sends messages → each message calls `/api/chat` with mode='mentor'
6. After 60 minutes → session saved to `entries/mentor`

## 🎨 Design System

### Color Palette
- **Primary Brown**: `#8b7355` (warm, earthy)
- **Light Background**: `#f5f3f0` - `#faf8f6` (soft cream gradient)
- **Border**: `#e0d5c7` (soft tan)
- **Text**: `#2c2c2c` (dark charcoal)
- **Accent**: `#d4a574` (gold)

### Typography
- **Font**: Georgia, Garamond, serif (warm, journalistic feel)
- **H1-H6**: 600 weight, color `#8b7355`
- **Body**: 0.95-1.1rem, line-height 1.6

## 📝 License

MIT
