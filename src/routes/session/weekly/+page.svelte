<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { authUser } from '$lib/stores/authStore';
  import { getISOWeek, getYear } from 'date-fns';
  import TimerBar from '$lib/components/TimerBar.svelte';
  import image from '$lib/images/journal-bg.png';
  import creature from '$lib/images/capybara.png';
  import { SYSTEM_PROMPTS } from '$lib/constants/prompts';

  type SummaryItem = { text: string; reason?: string };
  type WeeklySummaryData = {
    noticed: SummaryItem[];
    focus: SummaryItem[];
    message?: string;
  };
  type SessionEntry = { role: 'user' | 'assistant'; content: string; timestamp?: number };
  type JournalEntry = { id: string; date: string; content: string };

  let loading = false;
  let error: string | null = null;
  let userMessage = '';
  let weeklySummary: WeeklySummaryData | null = null;
  let summaryMessage = 'Loading a reflection summary from your journal entries...';
  let summaryLoaded = false;
  let summaryLoading = false;
  let summaryExpanded = false;
  let weekId = '';
  const SESSION_DURATION_MINUTES = 60;
  let timeRemaining = SESSION_DURATION_MINUTES;
  let sessionActive = false;
  let sessionExpired = false;
  let sessionStartTime = 0;
  let sessionTimer: ReturnType<typeof setInterval> | null = null;
  let sessionLog: SessionEntry[] = [];
  const mentorGreeting =
    "Share what stood out this week. I am listening.";
  let latestAssistantReply = mentorGreeting;
  let journalEntries: JournalEntry[] = [];
  let journalEntriesLoading = false;
  let journalEntriesLoaded = false;
  let journalEntriesError: string | null = null;
  let selectedJournalEntry: JournalEntry | null = null;
  let previousWeekId: string | null = null;
  $: latestAssistantReply =
    sessionLog
      .slice()
      .reverse()
      .find((entry) => entry.role === 'assistant')?.content ?? mentorGreeting;

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


    sessionLog = [];
  });

  onDestroy(() => {
    stopSessionTimer();
  });

  function formatEntryDate(dateStr: string) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function selectJournalEntry(entry: JournalEntry) {
    selectedJournalEntry = entry;
  }

  function resetJournalEntrySelection() {
    selectedJournalEntry = null;
  }

  async function loadJournalEntries() {
    if (journalEntriesLoading || !$authUser?.uid || !weekId) return;
    journalEntriesLoading = true;
    journalEntriesError = null;

    try {
      const params = new URLSearchParams({
        uid: $authUser.uid,
        weekId,
      });
      const res = await fetch(`/api/journal/entries?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to load journal entries.');
      }

      journalEntries = data.entries ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      journalEntries = [];
      journalEntriesError = message || 'Unable to load journal entries right now.';
    } finally {
      journalEntriesLoading = false;
      journalEntriesLoaded = true;
    }
  }

  $: if (weekId && weekId !== previousWeekId) {
    previousWeekId = weekId;
    journalEntries = [];
    journalEntriesLoaded = false;
    journalEntriesError = null;
    selectedJournalEntry = null;
  }

  $: if (weekId && $authUser?.uid && !journalEntriesLoaded) {
    loadJournalEntries();
  }

  $: if (journalEntriesLoaded && weekId && $authUser?.uid && selectedJournalEntry) {
    const stillExists = journalEntries.some((entry) => entry.id === selectedJournalEntry?.id);
    if (!stillExists) {
      selectedJournalEntry = null;
    }
  }

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
        // Backend returns arrays of strings, convert to SummaryItem format
        const normalizeItems = (items: any[] = []) =>
          items
            .map((item) => {
              // Handle both string format (from backend) and object format (if it changes)
              if (typeof item === 'string') {
                return { text: item.trim() };
              }
              return {
                text: typeof item?.text === 'string' ? item.text.trim() : String(item || '').trim(),
                reason: typeof item?.reason === 'string' ? item.reason.trim() : '',
              };
            })
            .filter((item) => item.text.trim().length);

        weeklySummary = {
          noticed: normalizeItems(data.summary.noticed || []),
          focus: normalizeItems(data.summary.focus || []),
          message: data.summary.message,
        };
        summaryMessage = weeklySummary.message ?? '';
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
      const history = sessionLog
        // Remove empty messages
        .filter(m => m.content && m.content.trim().length > 0)

        // Keep only role + content for API
        .map(({ role, content }) => ({ role, content }));
      const userEntry = { role: 'user', content: message, timestamp: Date.now() };
      sessionLog = [...sessionLog, userEntry];

        // Switch to meditation prompt if timeRemaining <= 10, else use mentor
        let systemPrompt = timeRemaining <= 10
          ? SYSTEM_PROMPTS.meditation
          : SYSTEM_PROMPTS.mentor;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            mode: 'mentor',
            history,
            uid: $authUser?.uid,
            weekId,
            system: systemPrompt,
          }),
        });

      const data = await response.json();

      if (!data.success || !data.reply) {
        throw new Error(data.error || 'Failed to get mentor response');
      }

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

  function toggleSummaryExpanded() {
    summaryExpanded = !summaryExpanded;
  }
</script>

<div class="page-container" style={`background-image: url('${image}')`}>
  <div class="left-column">
    <section class={`summary-card ${summaryExpanded ? 'expanded' : ''}`}>
      <div class="summary-header">
        <div class="summary-title">
          <span>Weekly Mentor Summary</span>
          <small>Generated from your journal entries for this week. Click "Expand" to see mentor's reasonings.</small>
        </div>
        <button
          class="expand-button"
          on:click={toggleSummaryExpanded}
          aria-expanded={summaryExpanded}
          type="button"
        >
          {summaryExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div class="summary-body">
        {#if weeklySummary}
          <div class="summary-group">
            <p class="summary-subheader">What I Noticed</p>
            {#if weeklySummary.noticed.length}
              <ul class="summary-list">
                {#each weeklySummary.noticed as item (item.text)}
                  <li class="summary-item">
                    <span class="summary-text">{item.text}</span>
                    {#if summaryExpanded && item.reason}
                      <p class="summary-reason">
                        <strong>Mentor reasoning:</strong> {item.reason}
                      </p>
                    {/if}
                  </li>
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
                {#each weeklySummary.focus as item (item.text)}
                  <li class="summary-item">
                    <span class="summary-text">{item.text}</span>
                    {#if summaryExpanded && item.reason}
                      <p class="summary-reason">
                        <strong>Mentor reasoning:</strong> {item.reason}
                      </p>
                    {/if}
                  </li>
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
    <section class="journal-entries-card">
      <div class="summary-header">
      <div class="summary-title">
        <span>Your journals this week</span>
        <small>Refer back to your journal entries of the week here.</small>
      </div>
        
      </div>
      <div class="journal-entries-body">
        {#if journalEntriesLoading}
          <p class="journal-entry-placeholder">Loading your journal entries...</p>
        {:else if journalEntriesError}
          <p class="journal-entry-placeholder error">{journalEntriesError}</p>
        {:else if !journalEntries.length}
          <p class="journal-entry-placeholder">You don’t have any journal entries yet.</p>
        {:else if selectedJournalEntry}
          <div class="journal-entry-detail">
            <div class="journal-entry-detail-header">
              <button class="journal-entry-back" on:click={resetJournalEntrySelection}>
                ← Back
              </button>
              <h4>{formatEntryDate(selectedJournalEntry.date)}</h4>
            </div>
            <div class="journal-entry-content">
              {selectedJournalEntry.content}
            </div>
          </div>
        {:else}
          <div class="journal-entry-list" role="list">
            {#each journalEntries as entry (entry.id)}
              <button
                class="journal-entry-button"
                on:click={() => selectJournalEntry(entry)}
              >
                <span class="entry-date">{formatEntryDate(entry.date)}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </section>
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
      <div class="chat-feed" aria-live="polite">
        {#if sessionLog.length}
          {#each sessionLog as entry, index (entry.timestamp ?? `${entry.role}-${index}`)}
            <div class={`chat-row ${entry.role}`}>
              <div class="chat-bubble">
                {entry.content}
              </div>
            </div>
          {/each}
        {:else}
          <p class="chat-placeholder">Your reflections will appear here after you send them.</p>
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
        <button
          class="submit-button"
          on:click={handleSessionEnd}
          disabled={!sessionActive || loading}
          type="button"
        >
          End session
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
  }

  .chat-panel {
    flex: 1 1 720px;
    min-width: 0;
    width: auto;
    max-width: none;
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
    flex-shrink: 0;
  }

  .summary-card.expanded {
    max-height: none;
    overflow: visible;
  }

  .journal-entries-card {
    width: 100%;
    max-width: 420px;
    flex: 1;
    background: rgba(255, 248, 238, 0.85);
    border: 2px dashed #c29452;
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 0;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.15);
  }

  .journal-entries-header {
    font-weight: 600;
    color: #5c411d;
    font-size: 1rem;
    letter-spacing: 0.05em;
  }

  .journal-entries-body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .journal-entry-list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .journal-entry-button {
    border: 2px solid #d8c2a4;
    border-radius: 10px;
    background: #fffdf8;
    padding: 0.75rem;
    text-align: left;
    font-family: 'Courier New', monospace;
    color: #5c411d;
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.2s ease;
  }

  .journal-entry-button .entry-date {
    font-weight: 600;
  }

  .journal-entry-button:hover {
    border-color: #a87532;
    transform: translateX(4px);
  }

  .journal-entry-placeholder {
    font-style: italic;
    color: #a0783c;
    text-align: center;
    margin: 0;
  }

  .journal-entry-placeholder.error {
    color: #c2185b;
  }

  .journal-entry-detail {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .journal-entry-detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .journal-entry-detail-header h4 {
    margin: 0;
    font-size: 1rem;
    color: #5c411d;
  }

  .journal-entry-back {
    border: none;
    background: #7a5c2e;
    color: #fff;
    padding: 0.5rem 0.85rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .journal-entry-content {
    flex: 1;
    min-height: 0;
    border: 2px solid #d8c2a4;
    border-radius: 10px;
    background: #fffdf8;
    padding: 0.75rem;
    font-family: 'Courier New', monospace;
    color: #2e281f;
    overflow-y: auto;
    white-space: pre-wrap;
    line-height: 1.4;
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

  .chat-feed {
    flex: 0 0 auto;
    height: clamp(320px, 55vh, 620px);
    min-height: 320px;
    border: 2px solid #d8c2a4;
    border-radius: 10px;
    background: #fffdf8;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    scroll-behavior: smooth;
    overscroll-behavior: contain;
  }

  .chat-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .chat-row.assistant {
    justify-content: flex-start;
  }

  .chat-row.user {
    justify-content: flex-end;
  }

  .chat-bubble {
    padding: 0.65rem 0.95rem;
    border-radius: 16px;
    max-width: 85%;
    font-family: 'Courier New', monospace;
    font-size: 0.95rem;
    line-height: 1.35;
    white-space: pre-wrap;
    word-break: break-word;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  }

  .chat-row.assistant .chat-bubble {
    background: #fff7e6;
    border: 2px solid #e2c18b;
    color: #5c411d;
    border-top-left-radius: 4px;
  }

  .chat-row.user .chat-bubble {
    background: linear-gradient(135deg, #7a5c2e 0%, #a87532 100%);
    color: #fffaf0;
    border-top-right-radius: 4px;
  }

  .chat-placeholder {
    font-style: italic;
    color: #b09772;
    margin: 0;
  }

  .summary-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    font-weight: 600;
    color: #5c411d;
    margin-bottom: 0.5rem;
  }

  .summary-title {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .summary-header small {
    font-size: 0.8rem;
    font-weight: 400;
    color: #a0783c;
  }

  .expand-button {
    border: 2px solid #c29452;
    background: #fff7e6;
    color: #5c411d;
    border-radius: 10px;
    padding: 0.45rem 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    flex-shrink: 0;
  }

  .expand-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    background: #fff0d9;
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

  .summary-card.expanded .summary-body {
    max-height: none;
    overflow: visible;
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

  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding-right: 0.4rem;
  }

  .summary-text {
    display: inline-block;
    border-bottom: 1px dashed rgba(160, 120, 60, 0.6);
  }

  .summary-reason {
    margin: 0;
    background: rgba(46, 40, 31, 0.08);
    border: 1px solid rgba(160, 120, 60, 0.35);
    border-radius: 10px;
    padding: 0.6rem 0.7rem;
    font-size: 0.85rem;
    line-height: 1.35;
    color: #3a2f1f;
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
