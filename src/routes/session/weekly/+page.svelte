<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authUser } from '$lib/stores/authStore';
  import { sessionStore, timeRemaining, sessionExpired } from '$lib/stores/sessionStore';
  import TimerBar from '$lib/components/TimerBar.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import MessageInput from '$lib/components/MessageInput.svelte';
  import ModeBanner from '$lib/components/ModeBanner.svelte';

  let loading = false;
  let error: string | null = null;
  let sessionStarted = false;

  onMount(() => {
    if (!$authUser) {
      goto('/');
      return;
    }

    // Start a 60-minute weekly session
    sessionStore.startSession('mentor', 60);
    sessionStarted = true;

    // Optionally add an opening message from the mentor
    sessionStore.addMessage({
      role: 'assistant',
      content:
        "Welcome to your weekly reflection session. I've reviewed everything you shared with me this week. Let's explore what patterns I noticed and what might be helpful for you going forward. What would you like to focus on today?",
    });
  });

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

      // Call chat API with mentor mode
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode: 'mentor',
          history: $sessionStore.messages,
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
    } catch (err: any) {
      error = err.message || 'Something went wrong';
    } finally {
      loading = false;
    }
  }

  async function handleSessionEnd() {
    loading = true;
    try {
      // Save the mentor session to Firestore
      if ($authUser?.uid) {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: $authUser.uid,
            weekId: $sessionStore.weekId,
            entryId: 'mentor',
            mode: 'mentor',
            messages: $sessionStore.messages,
          }),
        });
      }

      sessionStore.endSession();
      // Show completion message
      setTimeout(() => goto('/'), 3000);
    } catch (err: any) {
      console.error('Error saving session:', err);
      // Still redirect even if save fails
      sessionStore.endSession();
      setTimeout(() => goto('/'), 3000);
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
    mode="mentor"
    subtext="Reflect on your week — I'll share what I noticed."
  />

  <TimerBar
    timeRemaining={$timeRemaining}
    totalDuration={60}
    isActive={$sessionStore.isActive}
    onExpired={handleSessionEnd}
  />

  <div class="messages-wrapper">
    <MessageList messages={$sessionStore.messages} />
  </div>

  {#if error}
    <div class="error-banner">{error}</div>
  {/if}

  {#if !$sessionStore.isActive}
    <div class="session-complete-banner">
      <h3>✓ Your weekly reflection is complete.</h3>
      <p>Returning to home...</p>
    </div>
  {/if}

  <MessageInput
    disabled={!$sessionStore.isActive}
    {loading}
    placeholder="What would you like to explore?"
    onSubmit={handleMessage}
  />
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

  .session-complete-banner {
    background: linear-gradient(135deg, #d1fae5 0%, #c1fce7 100%);
    color: #047857;
    padding: 2rem;
    text-align: center;
    border-top: 2px solid #10b981;
    flex-shrink: 0;
  }

  .session-complete-banner h3 {
    margin: 0 0 0.5rem;
    font-size: 1.2rem;
  }

  .session-complete-banner p {
    margin: 0;
    font-size: 0.95rem;
    opacity: 0.8;
  }
</style>

