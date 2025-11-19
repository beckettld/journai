<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { authUser } from '$lib/stores/authStore';
  import { getISOWeek, getYear } from 'date-fns';
  import TimerBar from '$lib/components/TimerBar.svelte';
  import image from '$lib/images/journal-bg.png';
  import creature from '$lib/images/capybara.png';

  type WeeklySummaryData = {
    noticed: string[];
    focus: string[];
    message?: string;
  };
  type SessionEntry = { role: 'user' | 'assistant'; content: string; timestamp?: number };

  let loading = false;
  let error: string | null = null;
  let userMessage = '';
  let bubbleReply = 'Share what stood out this week. I am listening.';
  let weeklySummary: WeeklySummaryData | null = null;
  let summaryMessage = 'Loading a reflection summary from your journal entries...';
  let summaryLoaded = false;
  let summaryLoading = false;
  let weekId = '';
  const SESSION_DURATION_MINUTES = 60;
  let timeRemaining = SESSION_DURATION_MINUTES;
  let sessionActive = false;
  let sessionExpired = false;
  let sessionStartTime = 0;
  let sessionTimer: ReturnType<typeof setInterval> | null = null;
  let sessionLog: SessionEntry[] = [];
  let userEntries: SessionEntry[] = [];
  $: userEntries = sessionLog.filter((entry) => entry.role === 'user');

  function computeWeekId() {
    const now = new Date();
    const weekNumber = getISOWeek(now);
    const year = getYear(now);
    weekId = `${year}-W${String(weekNumber).padStart(2, '0')}`;
  }

  function stopSessionTimer() {
    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }
  }

  function startSessionTimer() {
    stopSessionTimer();
    sessionActive = true;
    sessionExpired = false;
    sessionStartTime = Date.now();
    timeRemaining = SESSION_DURATION_MINUTES;

    sessionTimer = setInterval(() => {
      const elapsedMinutes = (Date.now() - sessionStartTime) / 1000 / 60;
      const remaining = Math.max(0, SESSION_DURATION_MINUTES - elapsedMinutes);
      timeRemaining = remaining;

      if (remaining === 0) {
        stopSessionTimer();
        handleSessionEnd();
      }
    }, 1000);
  }

  onMount(() => {
    if (!$authUser) {
      goto('/');
      return;
    }

    computeWeekId();
    startSessionTimer();

    const openingMessage =
      "Welcome to your weekly reflection session. I've reviewed everything you shared with me this week. Let's explore what patterns I noticed and what might be helpful for you going forward. What would you like to focus on today?";

    bubbleReply = openingMessage;
    sessionLog = [{ role: 'assistant', content: openingMessage, timestamp: Date.now() }];
  });

  onDestroy(() => {
    stopSessionTimer();
  });

  async function loadWeeklySummary() {
    if (summaryLoading || !$authUser?.uid || !weekId) return;
    summaryLoading = true;
    try {
      const params = new URLSearchParams({
        uid: $authUser.uid,
        weekId,
      });
      const res = await fetch(`/api/journal/summary?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.summary) {
        weeklySummary = data.summary;
        summaryMessage = data.summary.message ?? '';
      } else {
        weeklySummary = null;
        summaryMessage = data.error || 'No journal entries were found for this week.';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      weeklySummary = null;
      summaryMessage = message || 'Unable to load your weekly summary right now.';
      console.error('Failed to load journal summary:', err);
    } finally {
      summaryLoaded = true;
      summaryLoading = false;
    }
  }

  $: if (!summaryLoaded && weekId && $authUser?.uid) {
    loadWeeklySummary();
  }

  async function handleMessage(detail: any) {
    const message = typeof detail === 'string' ? detail : detail;
    if (!message || !weekId || !sessionActive) return;

    loading = true;
    error = null;

    try {
      // Convert sessionLog to history format (remove timestamp field)
      const history = sessionLog.map(({ role, content }) => ({ role, content }));
      const userEntry = { role: 'user', content: message, timestamp: Date.now() };
      sessionLog = [...sessionLog, userEntry];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          mode: 'mentor',
          history,
          uid: $authUser?.uid,
          weekId,
        }),
      });

      const data = await response.json();

      if (!data.success || !data.reply) {
        throw new Error(data.error || 'Failed to get mentor response');
      }

      bubbleReply = data.reply;
      sessionLog = [
        ...sessionLog,
        { role: 'assistant', content: data.reply, timestamp: Date.now() },
      ];
      
    } catch (err: any) {
      error = err.message || 'Something went wrong';
    } finally {
      loading = false;
    }
  }

  async function handleSessionEnd() {
    if (!sessionActive && sessionExpired) {
      return;
    }

    loading = true;
    sessionActive = false;
    sessionExpired = true;
    stopSessionTimer();

    try {
      if ($authUser?.uid && weekId) {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: $authUser.uid,
            weekId,
            entryId: 'mentor',
            mode: 'mentor',
            messages: sessionLog,
          }),
        });
      }
    } catch (err: any) {
      console.error('Error saving session:', err);
    } finally {
      loading = false;
      setTimeout(() => goto('/'), 3000);
    }
  }

  function handleUserKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      submitCurrentMessage();
    }
  }

  function submitCurrentMessage() {
    const message = userMessage.trim();
    if (!message || !sessionActive || loading) return;

    handleMessage(message);
    userMessage = '';
  }
</script>

<div class="page-container" style={`background-image: url('${image}')`}>
  <div class="left-column">
    <section class="summary-card">
      <div class="summary-header">
        <span>Weekly Mentor Summary</span>
        <small>Generated from your journal entries for this week.</small>
      </div>
      <div class="summary-body">
        {#if weeklySummary}
          <div class="summary-group">
            <p class="summary-subheader">What I Noticed</p>
            {#if weeklySummary.noticed.length}
              <ul class="summary-list">
                {#each weeklySummary.noticed as item}
                  <li>{item}</li>
                {/each}
              </ul>
            {:else if weeklySummary.message}
              <p class="summary-placeholder">{weeklySummary.message}</p>
            {:else}
              <p class="summary-placeholder">No observations available yet.</p>
            {/if}
          </div>
          <div class="summary-group">
            <p class="summary-subheader">Focus For Next Week</p>
            {#if weeklySummary.focus.length}
              <ul class="summary-list">
                {#each weeklySummary.focus as item}
                  <li>{item}</li>
                {/each}
              </ul>
            {:else if weeklySummary.message}
              <p class="summary-placeholder">{weeklySummary.message}</p>
            {:else}
              <p class="summary-placeholder">No suggestions available yet.</p>
            {/if}
          </div>
        {:else}
          <span class="summary-placeholder">{summaryMessage}</span>
        {/if}
      </div>
    </section>

    <div class="creature-container">
      <img src="{creature}" alt="Capybara guide" class="creature" />
      <div class="speech-bubble">{bubbleReply}</div>
    </div>
  </div>

  <div class="chat-panel">
    <div class="timer-row">
      <TimerBar
        timeRemaining={timeRemaining}
        totalDuration={SESSION_DURATION_MINUTES}
        isActive={sessionActive}
        onExpired={handleSessionEnd}
      />
    </div>

    <section class="reflection-section">
      <div class="user-message-feed" aria-live="polite">
        {#if userEntries.length}
          {#each userEntries as entry, index (entry.timestamp ?? index)}
            <div class="user-message-row">
              <div class="user-message-bubble">
                {entry.content}
              </div>
            </div>
          {/each}
        {:else}
          <p class="user-placeholder">Your reflections will appear here after you send them.</p>
        {/if}
      </div>
      <textarea
        class="mentor-input"
        bind:value={userMessage}
        placeholder="Capture the themes, moments, or questions that feel most important right now..."
        disabled={!sessionActive || loading}
        on:keydown={handleUserKeydown}
      ></textarea>
      <div class="input-actions">
        <button
          class="submit-button"
          on:click={submitCurrentMessage}
          disabled={!sessionActive || loading || !userMessage.trim()}
        >
          {#if loading}
            Sending...
          {:else}
            Send
          {/if}
        </button>
      </div>
    </section>

    {#if error}
      <div class="error-banner">{error}</div>
    {/if}

    {#if !sessionActive}
      <div class="session-complete-banner">
        <h3>✓ Your weekly reflection is complete.</h3>
        <p>Returning to home...</p>
      </div>
    {/if}
  </div>

</div>

<style>
  .page-container {
    position: relative;
    min-height: 100vh;
    width: 100%;
    background-size: cover;
    background-position: center;
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 2.25rem;
    flex-wrap: wrap;
    padding: 2rem 4rem 4rem;
    box-sizing: border-box;
    overflow-y: auto;
  }

  .left-column {
    flex: 0 1 540px;
    max-width: 540px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: min(78vh, 660px);
    justify-content: space-between;
  }

  .chat-panel {
    flex: 0 1 520px;
    width: min(520px, 48vw);
    max-width: 560px;
    min-height: min(78vh, 660px);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    background: rgba(247, 237, 219, 0.92);
    border: 3px solid #7a5c2e;
    border-radius: 16px;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(4px);
    overflow: hidden;
  }

  .timer-row {
    flex-shrink: 0;
  }

  .summary-card {
    width: 100%;
    max-width: 420px;
    background: rgba(255, 248, 238, 0.85);
    border: 2px dashed #c29452;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: min(80vh, 640px);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.15);
    align-self: flex-start;
    overflow: hidden;
  }

  .reflection-section {
    flex: 1;
    background: rgba(255, 248, 238, 0.85);
    border: 2px dashed #c29452;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 0;
  }

  .user-message-feed {
    flex: 1;
    border: 2px solid #d8c2a4;
    border-radius: 10px;
    background: #fffdf8;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
  }

  .user-message-row {
    display: flex;
    justify-content: flex-end;
  }

  .user-message-bubble {
    background: linear-gradient(135deg, #7a5c2e 0%, #a87532 100%);
    color: #fffaf0;
    padding: 0.6rem 0.85rem;
    border-radius: 16px 16px 4px 16px;
    max-width: 85%;
    font-family: 'Courier New', monospace;
    font-size: 0.95rem;
    line-height: 1.35;
    box-shadow: 0 6px 16px rgba(122, 83, 33, 0.25);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .user-placeholder {
    font-style: italic;
    color: #b09772;
    margin: 0;
  }

  .summary-header {
    display: flex;
    flex-direction: column;
    font-weight: 600;
    color: #5c411d;
    margin-bottom: 0.5rem;
  }

  .summary-header small {
    font-size: 0.8rem;
    font-weight: 400;
    color: #a0783c;
  }

  .summary-body {
    flex: 1;
    max-height: calc(100% - 2rem);
    overflow-y: auto;
    font-family: 'Georgia', serif;
    font-size: 0.9rem;
    color: #2e281f;
    line-height: 1.3;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .summary-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .summary-subheader {
    font-weight: 700;
    color: #5c411d;
    margin: 0;
  }

  .summary-list {
    list-style: none;
    padding-left: 0.75rem;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .summary-list li {
    position: relative;
    padding-left: 0.8rem;
    line-height: 1.3;
  }

  .summary-list li::before {
    content: '-';
    position: absolute;
    left: 0;
    color: #a0783c;
  }

  .mentor-input {
    flex: 0 0 auto;
    border: 2px solid #7a5c2e;
    border-radius: 10px;
    background: #fffdf8;
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    padding: 1rem;
    resize: none;
    color: #2c2110;
    min-height: 170px;
    width: 100%;
  }

  .mentor-input:focus {
    outline: none;
    border-color: #b07a32;
    box-shadow: 0 0 0 3px rgba(176, 122, 50, 0.2);
  }

  .mentor-input:disabled {
    background: #f5ede0;
    color: #a1907d;
  }

  .input-actions {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: flex-end;
    width: 100%;
  }

  .submit-button {
    background: linear-gradient(135deg, #7a5321 0%, #bd8d4e 100%);
    color: #fff;
    border: none;
    padding: 0.85rem 1.5rem;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .submit-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(122, 83, 33, 0.3);
  }

  .submit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .summary-placeholder {
    font-style: italic;
    color: #a0783c;
    opacity: 0.8;
    line-height: 1.3;
  }

  .error-banner {
    background: #fce4ec;
    color: #c2185b;
    padding: 0.75rem 1rem;
    text-align: center;
    font-size: 0.9rem;
    border-radius: 10px;
    border: 2px solid #f8acc5;
  }

  .session-complete-banner {
    background: linear-gradient(135deg, #d1fae5 0%, #c1fce7 100%);
    color: #047857;
    padding: 1.5rem;
    text-align: center;
    border: 2px solid #10b981;
    border-radius: 12px;
  }

  .session-complete-banner h3 {
    margin: 0 0 0.5rem;
    font-size: 1.05rem;
  }

  .session-complete-banner p {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.8;
  }

  .creature-container {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
    align-self: flex-start;
    margin-top: auto;
  }

  .creature {
    width: clamp(140px, 24vw, 240px);
    height: auto;
  }

  .speech-bubble {
    position: relative;
    width: 520px;
    max-width: 80vw;
    min-height: 150px;
    background: #fff7e6;
    border: 3px solid #7a5c2e;
    padding: 1.2rem 1.5rem;
    font-family: 'Courier New', monospace;
    font-size: 1rem;
    border-radius: 14px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: flex-start;
    transform: translateY(-130px);
  }

  .speech-bubble::before {
    content: '';
    position: absolute;
    bottom: -18px;
    left: 70px;
    width: 0;
    height: 0;
    border-left: 14px solid transparent;
    border-right: 14px solid transparent;
    border-top: 18px solid #fff7e6;
    filter: drop-shadow(0 -2px 2px rgba(0, 0, 0, 0.15));
  }

  .speech-bubble::after {
    content: '';
    position: absolute;
    bottom: -21px;
    left: 70px;
    width: 0;
    height: 0;
    border-left: 16px solid transparent;
    border-right: 16px solid transparent;
    border-top: 20px solid #7a5c2e;
    z-index: -1;
  }

  @media (max-width: 900px) {
    .page-container {
      justify-content: center;
      padding: 1.5rem;
      gap: 1.5rem;
    }

    .left-column,
    .summary-card {
      width: 100%;
      max-height: none;
    }

    .chat-panel {
      width: 100%;
      min-height: auto;
    }

    .creature-container {
      justify-content: center;
      flex-wrap: wrap;
    }
  }
</style>
