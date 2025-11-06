<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { authUser } from '$lib/stores/authStore';
  import { sessionStore, timeRemaining, sessionExpired } from '$lib/stores/sessionStore';
  import {
    createOrUpdateWeek,
    canStartVentSession,
    getSessionDraft,
    saveSessionDraft,
    deleteSessionDraft,
  } from '$lib/services/firestore';
  import { getISOWeek, getYear } from 'date-fns';
  import TimerBar from '$lib/components/TimerBar.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import MessageInput from '$lib/components/MessageInput.svelte';
  import ModeBanner from '$lib/components/ModeBanner.svelte';

  let loading = false;
  let error: string | null = null;
  let cooldownInfo: { canStart: boolean; hoursRemaining?: number; lastSessionAt?: Date } | null =
    null;
  let sessionRestored = false;
  let saveDraftInterval: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    if (!$authUser) {
      goto('/');
      return;
    }

    // Calculate weekId first
    const now = new Date();
    const weekNumber = getISOWeek(now);
    const year = getYear(now);
    const weekId = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    const currentDate = now.toISOString().split('T')[0];

    // Create or update the week document
    try {
      await createOrUpdateWeek($authUser.uid, weekId);
    } catch (err: any) {
      console.error('Failed to create week document:', err);
    }

    // Check for existing session draft first
    const draft = await getSessionDraft($authUser.uid, weekId, currentDate);

    if (draft && draft.mode === 'vent') {
      // Calculate remaining time based on original start time
      const elapsed = (Date.now() - draft.startTime) / 1000 / 60; // minutes
      const remaining = Math.max(0, draft.durationMinutes - elapsed);

      if (remaining > 0) {
        // Restore existing session with ORIGINAL start time
        // This ensures the timer continues from when the session was first started
        sessionStore.restoreSession('vent', draft.durationMinutes, draft.messages, draft.startTime);
        sessionRestored = true;
      } else {
        // Session expired, check cooldown
        await checkCooldown(weekId);
      }
    } else {
      // No existing session, check cooldown
      await checkCooldown(weekId);
    }

    // Set up auto-save for session drafts
    if ($sessionStore.isActive) {
      saveDraftInterval = setInterval(async () => {
        if ($authUser?.uid && $sessionStore.isActive && $sessionStore.messages.length > 0) {
          try {
            await saveSessionDraft($authUser.uid, $sessionStore.weekId, $sessionStore.currentDate, {
              mode: $sessionStore.mode,
              messages: $sessionStore.messages,
              startTime: $sessionStore.startTime,
              durationMinutes: $sessionStore.durationMinutes,
            });
          } catch (err) {
            console.error('Failed to save draft:', err);
          }
        }
      }, 5000); // Save every 5 seconds
    }
  });

  onDestroy(() => {
    if (saveDraftInterval) {
      clearInterval(saveDraftInterval);
    }
  });

  async function checkCooldown(weekId: string) {
    if (!$authUser) return;

    try {
      cooldownInfo = await canStartVentSession($authUser.uid, weekId);
      if (cooldownInfo.canStart) {
        // Start a new 30-minute daily session
        sessionStore.startSession('vent', 30);
      }
    } catch (err: any) {
      console.error('Failed to check cooldown:', err);
      // Default to allowing session if check fails
      sessionStore.startSession('vent', 30);
    }
  }

  async function handleMessage(detail: any) {
    const message = typeof detail === 'string' ? detail : detail;
    if (!message) return;

    loading = true;
    error = null;

    try {
      // Add user message to store
      sessionStore.addMessage({
        role: 'user',
        content: message,
      });

      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode: 'vent',
          history: $sessionStore.messages.filter((m) => m.role === 'user'),
          uid: $authUser?.uid,
          weekId: $sessionStore.weekId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Add AI response
      sessionStore.addMessage({
        role: 'assistant',
        content: data.reply,
      });

      // Save draft after message exchange
      if ($authUser?.uid) {
        try {
          await saveSessionDraft($authUser.uid, $sessionStore.weekId, $sessionStore.currentDate, {
            mode: $sessionStore.mode,
            messages: $sessionStore.messages,
            startTime: $sessionStore.startTime,
            durationMinutes: $sessionStore.durationMinutes,
          });
        } catch (err) {
          console.error('Failed to save draft:', err);
        }
      }
    } catch (err: any) {
      error = err.message || 'Something went wrong';
    } finally {
      loading = false;
    }
  }

  async function handleSessionEnd() {
    loading = true;
    try {
      // Save the session to Firestore
      if ($authUser?.uid) {
        // Use date and time as the session ID for better readability
        const startDate = new Date($sessionStore.startTime);
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        const hours = String(startDate.getHours()).padStart(2, '0');
        const minutes = String(startDate.getMinutes()).padStart(2, '0');
        const seconds = String(startDate.getSeconds()).padStart(2, '0');
        const sessionId = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
        
        console.log('Saving vent session:', {
          uid: $authUser.uid,
          weekId: $sessionStore.weekId,
          sessionId,
          startTime: $sessionStore.startTime,
          messageCount: $sessionStore.messages.length,
        });
        
        const response = await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: $authUser.uid,
            weekId: $sessionStore.weekId,
            entryId: sessionId,
            mode: 'vent',
            messages: $sessionStore.messages,
            startTime: $sessionStore.startTime,
            durationMinutes: $sessionStore.durationMinutes,
          }),
        });

        const result = await response.json();
        console.log('Save response:', result);

        if (!result.success) {
          throw new Error(result.error || 'Failed to save session');
        }

        // Delete the draft since session is complete
        await deleteSessionDraft($authUser.uid, $sessionStore.weekId, $sessionStore.currentDate);
      }

      sessionStore.endSession();
      // Redirect to completion page or back to dashboard after a delay
      setTimeout(() => goto('/'), 2000);
    } catch (err: any) {
      console.error('Error in handleSessionEnd:', err);
      error = err.message || 'Failed to save session';
    } finally {
      loading = false;
    }
  }

  $: if ($sessionExpired && $sessionStore.isActive) {
    handleSessionEnd();
  }
</script>

<div class="session-container">
  <ModeBanner
    mode="vent"
    subtext="30 minutes to vent — I'll just listen."
  />

  {#if cooldownInfo && !cooldownInfo.canStart}
    <div class="cooldown-banner">
      <h3>⏰ Session Cooldown Active</h3>
      <p>
        You can start a new vent session in{' '}
        {cooldownInfo.hoursRemaining
          ? `${Math.ceil(cooldownInfo.hoursRemaining)} hour${Math.ceil(cooldownInfo.hoursRemaining) > 1 ? 's' : ''}`
          : 'a few minutes'}
        .
      </p>
      {#if cooldownInfo.lastSessionAt}
        <p class="cooldown-time">
          Last session: {cooldownInfo.lastSessionAt.toLocaleString()}
        </p>
      {/if}
      <button class="home-button" on:click={() => goto('/')}>Return Home</button>
    </div>
  {:else}
    <TimerBar
      timeRemaining={$timeRemaining}
      totalDuration={30}
      isActive={$sessionStore.isActive}
      onExpired={handleSessionEnd}
    />

    {#if sessionRestored}
      <div class="restored-banner">
        ✓ Your previous session has been restored
      </div>
    {/if}

    <div class="messages-wrapper">
      <MessageList messages={$sessionStore.messages} />
    </div>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    <MessageInput
      disabled={!$sessionStore.isActive}
      {loading}
      placeholder="Share what's on your mind..."
      onSubmit={handleMessage}
    />
  {/if}
</div>

<style>
  .session-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 80px);
    min-height: 0;
    background: linear-gradient(135deg, #f5f3f0 0%, #faf8f6 100%);
    overflow: hidden;
  }

  .messages-wrapper {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .error-banner {
    background: #fce4ec;
    color: #c2185b;
    padding: 1rem;
    text-align: center;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .cooldown-banner {
    background: white;
    border-radius: 12px;
    padding: 3rem;
    margin: 2rem auto;
    max-width: 500px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .cooldown-banner h3 {
    color: #8b7355;
    margin: 0 0 1rem;
    font-size: 1.5rem;
  }

  .cooldown-banner p {
    color: #5c5c5c;
    margin: 0.5rem 0;
    font-size: 1rem;
  }

  .cooldown-time {
    color: #b8a89a;
    font-size: 0.9rem;
    font-style: italic;
  }

  .cooldown-banner .home-button {
    margin-top: 2rem;
    background: linear-gradient(135deg, #8b7355 0%, #a08b6f 100%);
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .cooldown-banner .home-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 115, 85, 0.2);
  }

  .restored-banner {
    background: #d1fae5;
    color: #047857;
    padding: 0.75rem 1rem;
    text-align: center;
    font-size: 0.9rem;
    font-weight: 500;
    flex-shrink: 0;
    border-bottom: 1px solid #10b981;
  }
</style>

