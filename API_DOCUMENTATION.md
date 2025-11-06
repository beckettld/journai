# AI Mentor - Complete API Documentation

For UI designers and frontend developers integrating with the backend.

---

## Overview

The AI Mentor app uses three main API patterns:

1. **Chat API** - Send messages to AI agents
2. **Logs API** - Save and retrieve chat sessions
3. **Firebase Auth** - User authentication

---

## 1. Chat API

**Endpoint**: `POST /api/chat`

**Purpose**: Route user messages through the appropriate AI agent and get responses.

### Request

```typescript
{
  message: string;           // The user's input
  mode: "vent" | "mentor";   // Which agent to use
  history: Array<{           // Previous messages in this session
    role: "user" | "assistant";
    content: string;
  }>;
  uid: string;               // Firebase user ID
  weekId: string;            // Week ID (e.g., "2025-W45")
}
```

### Response

```typescript
{
  reply: string;             // AI's response
  success: boolean;          // True if successful
}
```

### Error Response

```typescript
{
  success: false;
  error: string;             // Error message
}
```

### Example Usage (Frontend)

```javascript
// Daily Vent Session
async function sendVentMessage(userMessage) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      mode: 'vent',
      history: sessionMessages,  // All previous messages
      uid: currentUser.uid,
      weekId: '2025-W45',
    }),
  });

  const data = await response.json();
  if (data.success) {
    return data.reply;
  } else {
    throw new Error(data.error);
  }
}

// Weekly Mentor Session
async function sendMentorMessage(userMessage) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      mode: 'mentor',
      history: sessionMessages,
      uid: currentUser.uid,
      weekId: '2025-W45',
    }),
  });

  const data = await response.json();
  if (data.success) {
    return data.reply;
  } else {
    throw new Error(data.error);
  }
}
```

### Behavior Differences

#### Vent Mode (`mode: "vent"`)
- Uses **VentAgent** system prompt
- AI responds empathetically without giving advice
- Typical response: 2-3 sentences reflecting or asking questions
- No context fetching needed
- Context not modified by backend

#### Mentor Mode (`mode: "mentor"`)
- Uses **MentorAgent** system prompt
- Backend automatically fetches all vent entries from the past week
- AI reviews patterns and provides personalized advice
- Typical response: Structured format with insights and suggestions
- Backend includes week's vent entries in the system context

---

## 2. Logs API

### A. Save a Chat Session

**Endpoint**: `POST /api/logs`

**Purpose**: Save a completed chat session (daily vent or weekly mentor) to Firestore.

#### Request

```typescript
{
  uid: string;                  // Firebase user ID
  weekId: string;               // Week ID (e.g., "2025-W45")
  entryId: string;              // Date for daily: "2025-11-05", "mentor" for weekly
  mode: "vent" | "mentor";      // Session type
  messages: Array<{             // Complete message history
    role: "user" | "assistant";
    content: string;
  }>;
  summary?: string;             // Optional AI-generated summary
}
```

#### Response

```typescript
{
  success: true;
  entryId: string;              // The ID that was saved
}
```

#### Error Response

```typescript
{
  success: false;
  error: string;
}
```

#### Firestore Path

```
/users/{uid}/weeks/{weekId}/entries/{entryId}
```

#### Example Usage (Frontend)

```javascript
// Save daily vent session on session end
async function saveVentSession() {
  const today = new Date().toISOString().split('T')[0]; // "2025-11-05"

  const response = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: currentUser.uid,
      weekId: '2025-W45',
      entryId: today,
      mode: 'vent',
      messages: allSessionMessages,
      // summary is optional
    }),
  });

  const data = await response.json();
  if (data.success) {
    console.log('Session saved:', data.entryId);
  }
}

// Save weekly mentor session on session end
async function saveMentorSession() {
  const response = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uid: currentUser.uid,
      weekId: '2025-W45',
      entryId: 'mentor',  // Special ID for weekly mentor session
      mode: 'mentor',
      messages: allSessionMessages,
      // Optional: include AI-generated summary
      summary: 'This week focused on work stress and boundary-setting...',
    }),
  });

  const data = await response.json();
  if (data.success) {
    console.log('Mentor session saved');
  }
}
```

---

### B. Retrieve Chat Sessions

**Endpoint**: `GET /api/logs`

**Purpose**: Retrieve chat entries for a specific week (used to fetch vent context for mentor mode).

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uid` | string | Yes | Firebase user ID |
| `weekId` | string | Yes | Week ID in format `YYYY-Www` (e.g., `2025-W45`) |
| `type` | string | No | `"vent"` (default) or `"all"` for all entries |

#### Response

```typescript
{
  success: true;
  entries: Array<{
    id: string;                // "2025-11-03" or "mentor"
    mode: "vent" | "mentor";   // Entry type
    timestamp: number;          // Unix timestamp
    messages: Array<{          // All messages in this entry
      role: "user" | "assistant";
      content: string;
      timestamp?: number;
    }>;
    summary?: string;          // Optional summary
    lastUpdated: any;          // Firestore timestamp
  }>;
}
```

#### Error Response

```typescript
{
  success: false;
  error: string;
}
```

#### Examples

```javascript
// Fetch only vent entries for the week
async function fetchWeekVents() {
  const response = await fetch(
    `/api/logs?uid=${currentUser.uid}&weekId=2025-W45&type=vent`
  );
  const data = await response.json();
  return data.entries; // Array of vent sessions
}

// Fetch all entries (vent + mentor)
async function fetchAllWeekSessions() {
  const response = await fetch(
    `/api/logs?uid=${currentUser.uid}&weekId=2025-W45&type=all`
  );
  const data = await response.json();
  return data.entries;
}

// Fetch default (vent only)
async function fetchVentsDefault() {
  const response = await fetch(
    `/api/logs?uid=${currentUser.uid}&weekId=2025-W45`
  );
  const data = await response.json();
  return data.entries;
}
```

---

## 3. Firebase Authentication

**Service**: Firebase Auth (Client-side)

**Provider**: Google Sign-In

### Implementation Pattern

```javascript
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '$lib/firebase/client';

// Sign in with Google
async function signInUser() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    console.log('User ID:', user.uid);
    console.log('Email:', user.email);
    console.log('Name:', user.displayName);
    console.log('Photo:', user.photoURL);
  } catch (error) {
    console.error('Sign in failed:', error);
  }
}

// Sign out
async function signOutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Sign out failed:', error);
  }
}
```

### User Object

```typescript
{
  uid: string;              // Unique Firebase user ID
  email: string;            // User's email
  displayName: string;      // User's full name from Google
  photoURL: string;         // User's profile picture URL
  emailVerified: boolean;   // Always true for Google Sign-In
  isAnonymous: boolean;     // Always false
  createdAt: number;        // User creation timestamp
}
```

### Auth State Management (SvelteKit Store)

```typescript
// From $lib/stores/authStore.ts
import { authUser, authLoading } from '$lib/stores/authStore';

// In components:
{#if $authLoading}
  <p>Loading auth state...</p>
{:else if !$authUser}
  <button on:click={signInWithGoogle}>Sign in with Google</button>
{:else}
  <p>Welcome {$authUser.displayName}!</p>
  <img src={$authUser.photoURL} alt="Profile" />
{/if}
```

---

## 4. Session State Management

**Store**: `$lib/stores/sessionStore.ts`

### Svelte Store API

```typescript
import { sessionStore, timeRemaining, sessionExpired } from '$lib/stores/sessionStore';

// Start a new session
sessionStore.startSession('vent', 30);  // mode, duration in minutes

// Add a message to the session
sessionStore.addMessage({
  role: 'user' | 'assistant',
  content: 'Message text',
});

// End the session
sessionStore.endSession();

// Reset the store
sessionStore.reset();

// Subscribe to state
sessionStore.subscribe(state => {
  console.log('Current messages:', state.messages);
  console.log('Is active:', state.isActive);
  console.log('Week ID:', state.weekId);
  console.log('Current date:', state.currentDate);
});
```

### Derived Stores

```typescript
import { timeRemaining, sessionExpired } from '$lib/stores/sessionStore';

// Time remaining in minutes (updates live)
$timeRemaining  // number (e.g., 15.5 for 15:30)

// Whether session has expired
$sessionExpired // boolean
```

### Store Structure

```typescript
{
  mode: 'vent' | 'mentor';
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
  }>;
  startTime: number;              // Unix timestamp when session started
  durationMinutes: number;        // 30 for vent, 60 for mentor
  isActive: boolean;              // false after endSession() called
  currentDate: string;            // "2025-11-05"
  weekId: string;                 // "2025-W45"
}
```

---

## 5. Complete Flow Examples

### Daily Vent Session Flow

```javascript
// 1. User navigates to /session/daily
// 2. Component mounts and initializes session
sessionStore.startSession('vent', 30);

// 3. User types message and sends
const userMessage = 'I had a really frustrating day at work...';

// 4. Add to local store
sessionStore.addMessage({
  role: 'user',
  content: userMessage,
});

// 5. Call AI
const aiResponse = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: userMessage,
    mode: 'vent',
    history: $sessionStore.messages,
    uid: $authUser.uid,
    weekId: $sessionStore.weekId,
  }),
});

// 6. Add AI response
sessionStore.addMessage({
  role: 'assistant',
  content: response.data.reply,
});

// 7. Timer expires after 30 minutes
// OR user clicks end session button

// 8. Save to Firestore
await fetch('/api/logs', {
  method: 'POST',
  body: JSON.stringify({
    uid: $authUser.uid,
    weekId: $sessionStore.weekId,
    entryId: $sessionStore.currentDate, // "2025-11-05"
    mode: 'vent',
    messages: $sessionStore.messages,
  }),
});

// 9. Reset and redirect to dashboard
sessionStore.reset();
goto('/');
```

### Weekly Mentor Session Flow

```javascript
// 1. User navigates to /session/weekly
// 2. Component mounts and initializes session
sessionStore.startSession('mentor', 60);

// 3. Opening message from mentor
sessionStore.addMessage({
  role: 'assistant',
  content: "Welcome to your weekly reflection...",
});

// 4. User sends message
const userMessage = 'I want to talk about work stress...';
sessionStore.addMessage({ role: 'user', content: userMessage });

// 5. Call AI (with mode='mentor')
// Backend automatically:
// - Fetches /api/logs?uid={uid}&weekId={weekId}&type=vent
// - Includes those vent entries in the system context
// - Uses MentorAgent prompt
const aiResponse = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: userMessage,
    mode: 'mentor',  // ← Triggers context fetching
    history: $sessionStore.messages,
    uid: $authUser.uid,
    weekId: $sessionStore.weekId,
  }),
});

// 6. AI response includes personalized insights
// e.g., "You mentioned work stress on Monday, Wednesday, and Friday..."
sessionStore.addMessage({
  role: 'assistant',
  content: response.data.reply,
});

// 7. Timer expires after 60 minutes

// 8. Save to Firestore
await fetch('/api/logs', {
  method: 'POST',
  body: JSON.stringify({
    uid: $authUser.uid,
    weekId: $sessionStore.weekId,
    entryId: 'mentor',  // ← Special ID for weekly
    mode: 'mentor',
    messages: $sessionStore.messages,
  }),
});

// 9. Redirect to dashboard
goto('/');
```

---

## 6. Error Handling

### Common Error Codes

| Scenario | Status | Response |
|----------|--------|----------|
| Missing required fields | 400 | `{ success: false, error: "Missing required fields: ..." }` |
| User not authenticated | 401 | Firebase auth handles this |
| Firestore permission denied | 403 | `{ success: false, error: "Permission denied" }` |
| OpenAI API error | 500 | `{ success: false, error: "LLM service error" }` |
| Network error | 500 | `{ success: false, error: "Network error" }` |

### Frontend Error Handling

```javascript
async function safeChatMessage(message) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({...}),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    return data.reply;
  } catch (error) {
    console.error('Chat error:', error);
    // Show error to user
    displayErrorMessage(error.message);
  }
}
```

---

## 7. Rate Limiting & Best Practices

### Best Practices

1. **Debounce input** - Don't send every keystroke, only on submit
2. **Show loading state** - Disable input while waiting for AI response
3. **Cache messages locally** - Store in SvelteKit store before persisting
4. **Handle network errors** - Show retry buttons for failed saves
5. **Validate user input** - Trim whitespace, check message length (>1 char)
6. **Use session IDs** - Store week ID and date in state, not computed on fly

### OpenAI Rate Limits

- Plan for typical response time: 1-3 seconds
- Budget for network latency
- Consider quota for your API key tier

### Firestore Rate Limits

- Free tier: ~50K reads/writes per day
- Typical session: ~5 writes (save + message updates)
- Plan for ~10K sessions per day per user

---

## 8. Testing the APIs

### Using cURL (Command Line)

```bash
# Sign in manually first to get auth token, then:

# Send a chat message
curl -X POST http://localhost:5173/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Test message",
    "mode": "vent",
    "history": [],
    "uid": "test-user-id",
    "weekId": "2025-W45"
  }'

# Save a session
curl -X POST http://localhost:5173/api/logs \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "test-user-id",
    "weekId": "2025-W45",
    "entryId": "2025-11-05",
    "mode": "vent",
    "messages": [
      {"role": "user", "content": "Test"},
      {"role": "assistant", "content": "Response"}
    ]
  }'

# Fetch sessions
curl "http://localhost:5173/api/logs?uid=test-user-id&weekId=2025-W45&type=vent"
```

### Using Postman

1. Import as raw JSON:
   ```json
   {
     "info": { "name": "AI Mentor API" },
     "item": [
       {
         "name": "Send Chat Message",
         "request": {
           "method": "POST",
           "url": "{{baseUrl}}/api/chat",
           "body": {
             "mode": "raw",
             "raw": "{\"message\": \"...\", \"mode\": \"vent\", ...}"
           }
         }
       }
     ]
   }
   ```

---

## 9. Data Type Reference

### Message Type

```typescript
type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;  // Optional Unix timestamp in milliseconds
};
```

### ChatEntry Type (Firestore)

```typescript
type ChatEntry = {
  id: string;                    // "2025-11-05" or "mentor"
  mode: 'vent' | 'mentor';
  timestamp: number;             // Server timestamp
  messages: Message[];
  summary?: string;
  lastUpdated: FirestoreTimestamp;
};
```

### User Type (Firebase)

```typescript
type FirebaseUser = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  createdAt: number;
};
```

### Week ID Format

```
YYYY-Www
Example: 2025-W45

Where:
- YYYY = 4-digit year (2025)
- W = literal character "W"
- ww = 2-digit ISO week number (01-53)
```

---

## 10. Troubleshooting

### Chat API returns error

**Issue**: `{ success: false, error: "..." }`

**Solutions**:
1. Check `uid` and `weekId` are provided
2. Verify user is authenticated (check Firebase auth state)
3. Ensure `OPENAI_API_KEY` is set in `.env`
4. Check OpenAI API quota/limits

### Messages not saving to Firestore

**Issue**: Logs API responds with success but data not in Firestore

**Solutions**:
1. Verify Firebase Admin SDK config (`FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`)
2. Check Firestore security rules allow writes (or use test mode)
3. Verify `uid` matches authenticated user
4. Check Firestore quota isn't exceeded

### Auth not persisting across page reload

**Issue**: User logged in but after page refresh, shows login screen

**Solutions**:
1. Ensure `authStore.ts` is initializing `onAuthStateChanged`
2. Check browser allows localStorage (privacy mode?)
3. Firebase persistence should be automatic; no extra config needed

### Timer not updating

**Issue**: Timer display doesn't count down

**Solutions**:
1. Verify `timeRemaining` derived store is imported from `sessionStore`
2. Ensure `sessionStore.startSession()` was called
3. Check browser console for any errors
4. Verify Svelte reactivity: `$timeRemaining` not `timeRemaining`

---

## Summary

**3 Main Endpoints**:
- `POST /api/chat` - Get AI response
- `POST /api/logs` - Save session
- `GET /api/logs` - Fetch sessions

**2 Main Stores**:
- `authStore` - User authentication state
- `sessionStore` - Current session state + messages

**2 Main Flows**:
- **Daily**: User sends message → VentAgent responds → Save to Firestore
- **Weekly**: User sends message → Backend fetches week's vents → MentorAgent responds with context → Save to Firestore

All endpoints require Firebase authentication. Use `$authUser.uid` to identify the user.

