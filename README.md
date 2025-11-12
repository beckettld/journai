# Journai - AI Mentor Application

AI journaling app with daily vent sessions and weekly mentor sessions. Built with SvelteKit, Firebase, and AI integration.

## 🚀 Quick Start

To start the development server:

```bash
npx vite --port 5174
```

## 📋 Status

### ✅ Done

- Firebase auth with auto user creation
- Session management with persistent timers
- 12-hour cooldown between vent sessions
- Session persistence (drafts auto-save every 5s)
- Mentor session gating (unlocks after 5 vent sessions/week)
- Firestore structure with server-side operations
- API endpoints for chat and logs

### 🚧 TODO

1. **Gemini Integration** - Replace OpenAI with Google Gemini API in `src/lib/server/llm.ts`
2. **AI Prompts** - Refine Vent and Mentor agent prompts for Gemini
3. **Error Handling** - Add retry logic, rate limit handling, fallback responses

## 🗄️ Firestore Structure

```
/users/{uid}/
  ├── (user document)
  └── /weeks/{weekId}/
      ├── (week document)
      ├── /ventSessions/{sessionId}/  # Completed vent sessions
      ├── /drafts/{date}/              # Active session drafts
      └── /entries/{entryId}/          # Mentor sessions
```

### Document Schemas

**User** (`/users/{uid}`)

```typescript
{
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}
```

**Week** (`/users/{uid}/weeks/{weekId}`)

- Week ID format: `YYYY-Www` (e.g., `2025-W45`)

```typescript
{
  weekId: string;
  ventEntryCount: number;          // Must reach 5 to unlock mentor
  lastVentSessionAt?: Timestamp;  // Used for 12-hour cooldown
  createdAt: Timestamp;
  lastUpdated: Timestamp;
}
```

**Vent Session** (`/users/{uid}/weeks/{weekId}/ventSessions/{sessionId}`)

- Session ID format: `YYYY-MM-DD_HH-MM-SS` (e.g., `2025-11-06_12-42-06`)

```typescript
{
  startTime: number;               // Unix timestamp (ms)
  durationMinutes: number;         // Usually 30
  messages: Message[];
  completedAt: Timestamp;
  createdAt: Timestamp;
  lastUpdated: Timestamp;
}
```

**Draft** (`/users/{uid}/weeks/{weekId}/drafts/{date}`)

- Date format: `YYYY-MM-DD`
- Auto-saves every 5 seconds during active session
- Deleted when session completes

```typescript
{
  mode: 'vent' | 'mentor';
  messages: Message[];
  startTime: number;
  durationMinutes: number;
  lastUpdated: Timestamp;
}
```

**Mentor Entry** (`/users/{uid}/weeks/{weekId}/entries/{entryId}`)

- Entry ID: Always `"mentor"`

```typescript
{
  id: "mentor";
  mode: "mentor";
  timestamp: number;
  messages: Message[];
  summary?: string;
  lastUpdated: Timestamp;
}
```

**Message Type**

```typescript
{
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}
```

## 🚀 Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Firebase**

   - Create Firebase project
   - Enable Google Sign-In auth
   - Enable Firestore
   - Download service account key

3. **Environment variables** (`.env.local`)

```env
   # Firebase Client
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

   # Firebase Admin
FIREBASE_PROJECT_ID=...
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=...

   # AI (TODO: Replace with Gemini)
OPENAI_API_KEY=...
```

4. **Run dev server**

```bash
   npm run dev
```

## 🔌 API Endpoints

**POST `/api/chat`** - Send message, get AI response

```json
{
  "message": "...",
  "mode": "vent" | "mentor",
  "history": [...],
  "uid": "...",
  "weekId": "2025-W45"
}
```

**POST `/api/logs`** - Save session

```json
{
  "uid": "...",
  "weekId": "...",
  "entryId": "2025-11-06_12-42-06" | "mentor",
  "mode": "vent" | "mentor",
  "messages": [...],
  "startTime": 1762451717991,
  "durationMinutes": 30
}
```

**GET `/api/logs`** - Get sessions

- Query params: `uid`, `weekId`, `type` (optional: "vent" | "all")

## 🛠 Tech Stack

- SvelteKit + TypeScript
- Firebase Auth + Firestore
- Firebase Admin SDK (server-side)
- OpenAI API (needs Gemini migration)

## 📁 Key Files

- `src/lib/services/firestore.ts` - Client-side Firestore ops
- `src/lib/services/firestore-server.ts` - Server-side Firestore ops
- `src/lib/server/llm.ts` - **AI integration (needs Gemini)**
- `src/routes/api/chat/+server.ts` - Chat endpoint
- `src/routes/api/logs/+server.ts` - Logs endpoint
