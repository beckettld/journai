<script lang="ts">
  import { goto, afterNavigate } from '$app/navigation';
  import { authUser } from '$lib/stores/authStore';
  import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
  import { auth } from '$lib/firebase/client';
  import { onMount } from 'svelte';
  import { getISOWeek, getYear } from 'date-fns';
  import image from '$lib/images/journal-bg.png';

  type JournalHistoryEntry = {
    id: string;
    date: string;
    content: string;
  };

  let loading = false;
  let error: string | null = null;
  let showDashboard = false;
  let ventCount = 0;
  let mentorEnabled = false;
  let checkingVentCount = false;
  let isAdmin = false;
  let showJournalHistory = false;

  let journalHistoryLoading = false;

  let journalHistoryError: string | null = null;

  let journalHistory: JournalHistoryEntry[] = [];

  let selectedJournalId: string | null = null;

  let selectedJournal: JournalHistoryEntry | null = null;


  function getCurrentWeekId(): string {
    const now = new Date();
    const weekNumber = getISOWeek(now);
    const year = getYear(now);
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
  }

  async function checkMentorAvailability() {
    if (!$authUser) return;

    checkingVentCount = true;
    try {
      const weekId = getCurrentWeekId();
      const params = new URLSearchParams({
        uid: $authUser.uid,
        weekId,
      });
      
      const response = await fetch(`/api/mentor/availability?${params.toString()}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      mentorEnabled = data.available;
      ventCount = data.ventCount;
      isAdmin = data.isAdmin;
    } catch (err: any) {
      console.error('Failed to check mentor availability:', err);
      // Default to disabled if check fails
      mentorEnabled = false;
      ventCount = 0;
      isAdmin = false;
    } finally {
      checkingVentCount = false;
    }
  }

  onMount(async () => {
    if ($authUser) {
      showDashboard = true;
      await checkMentorAvailability();
    }
  });

  // Refresh vent count when navigating to this page (e.g., returning from a session)
  afterNavigate(async () => {
    if ($authUser && showDashboard) {
      await checkMentorAvailability();
    }
  });

  // Re-check when auth user changes
  $: if ($authUser && showDashboard) {
    checkMentorAvailability();
  }

  async function signInWithGoogle() {
    loading = true;
    error = null;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showDashboard = true;
    } catch (err: any) {
      error = err.message || 'Failed to sign in';
    } finally {
      loading = false;
    }
  }


  function startDaily() {
    goto('/session/daily');
  }

  function startJournal() {
    goto('/session/journal');
  }

  function startWeekly() {
    if (mentorEnabled) {
      goto('/session/weekly');
    }
  }

  function formatDateLabel(dateStr: string) {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  async function loadJournalHistory() {
    if (journalHistoryLoading || !$authUser?.uid) return;
    journalHistoryLoading = true;
    journalHistoryError = null;
    try {
      const res = await fetch(`/api/history/journals?uid=${$authUser.uid}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Unable to load journal history.');
      }
      journalHistory = data.entries ?? [];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      journalHistory = [];
      journalHistoryError = message || 'Unable to load journal history right now.';
    } finally {
      journalHistoryLoading = false;
    }
  }

  

  function openJournalHistory() {
    showJournalHistory = true;
    selectedJournalId = null;
    if (!journalHistory.length) {
      loadJournalHistory();
    }
  }

  

  function closeJournalHistory() {
    showJournalHistory = false;
    selectedJournalId = null;
  }


  $: selectedJournal = journalHistory.find((entry) => entry.id === selectedJournalId) ?? null;
</script>

<div class="landing-container" style={`--landing-bg: url('${image}')`}>
  {#if !showDashboard}
    <!-- Landing / Login Screen -->
    <div class="landing">
      <div class="landing-content">
        <h1 class="landing-title">journ.ai</h1>
        <p class="landing-subtitle">Journal daily. Reflect deeply on weekends.</p>

        <div class="landing-description">
          <p>
            <strong>Daily Journal Sessions (Mon–Fri):</strong> Spend 30 minutes journaling with an
            empathetic listener. Share your thoughts, feelings, and experiences without judgment.
          </p>
          <p>
            <strong>Weekly Reflection Sessions (Sat–Sun):</strong> Spend an hour in synthesis. An AI mentor will review
            your week, identify patterns, and share insights and next steps.
          </p>
        </div>

        {#if error}
          <div class="error-message">{error}</div>
        {/if}

        <button
          class="signin-button"
          on:click={signInWithGoogle}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  {:else}
    <!-- Dashboard -->
    <div class="dashboard">
      <div class="dashboard-header">
        <h2>Welcome back!</h2>
        <p style="color: #5c5c5c;">What would you like to do today?</p>
      </div>

      <div class="session-grid">
        <div class="session-card journal-card">
        <div class="card-header">
          <h3>Daily Journal Entry</h3>
          <span class="badge">30 min</span>
        </div>
        <p class="card-description">
          Write about your day here...
        </p>
          <div class="card-actions">
            <button class="session-button" on:click={startJournal}>
              Start Daily Journaling
            </button>
            <button class="session-button" type="button" on:click={openJournalHistory} style="background: #f5ede0;
    color: #8b7355; border: 1px solid #d6c7b5;">
              View Past Journals
            </button>
          </div>
        </div>

        <div class="session-card mentor-card" class:disabled={!mentorEnabled}>
          <div class="card-header">
            <h3>Weekly Reflection Session</h3>
            <span class="badge">60 min</span>
          </div>
          <p class="card-description">
            Review your week. Explore patterns. Get actionable insights and next steps.
          </p>
          {#if checkingVentCount}
            <div class="checking-status">Checking progress...</div>
          {:else if !mentorEnabled}
            <div class="mentor-locked">
              {#if isAdmin}
                <p class="locked-message">
                  Admin access enabled. You can start a mentor session anytime.
                </p>
              {:else}
                <p class="locked-message">
                  Complete 5 daily journal sessions to unlock your weekly mentor session.
                </p>
                <p class="progress-message">
                  Progress: {ventCount} / 5 sessions
                </p>
              {/if}
            </div>
          {/if}
          {#if isAdmin && mentorEnabled}
            <div class="admin-badge">
              <p class="admin-message">Admin: Unlimited access</p>
            </div>
          {/if}
          <div class="card-actions">
            <button 
              class="session-button" 
              class:disabled={!mentorEnabled}
              on:click={startWeekly}
              disabled={!mentorEnabled || checkingVentCount}
            >
              {checkingVentCount ? 'Checking...' : mentorEnabled ? 'Start Mentor Session' : 'Locked'}
            </button>
            
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if showJournalHistory}
  <div class="modal-overlay">
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <p class="modal-eyebrow">Journals</p>
          <h3>Past Entries</h3>
        </div>
        <button class="close-button" type="button" on:click={closeJournalHistory}>Close</button>
      </div>

      {#if journalHistoryLoading}
        <p class="modal-placeholder">Loading your journal history...</p>
      {:else if journalHistoryError}
        <p class="modal-placeholder error">{journalHistoryError}</p>
      {:else if !journalHistory.length}
        <p class="modal-placeholder">No past journals yet.</p>
      {:else if selectedJournal}
        <div class="modal-subheader">
          <button class="back-button" type="button" on:click={() => (selectedJournalId = null)}>
            ← Back
          </button>
          <div>
            <p class="modal-eyebrow">Journal Entry</p>
            <h4 class="modal-title">{formatDateLabel(selectedJournal.date)}</h4>
          </div>
        </div>
        <div class="modal-body scrollable">
          <div class="entry-content">{selectedJournal.content}</div>
        </div>
      {:else}
        <div class="history-list">
          {#each journalHistory as entry (entry.id)}
            <button class="history-list-item" type="button" on:click={() => (selectedJournalId = entry.id)}>
              <div>
                <p class="item-title">{formatDateLabel(entry.date)}</p>
                <p class="item-subtitle">
                  {entry.content.length > 140
                    ? `${entry.content.slice(0, 140)}…`
                    : entry.content || 'Tap to view details'}
                </p>
              </div>
              <span class="chevron">→</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .landing-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: var(--landing-bg) center/cover no-repeat;
    position: relative;
  }

  /* optional soft overlay for readability */
  .landing-container::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(245, 243, 240, 0.45), rgba(250, 248, 246, 0.55));
    pointer-events: none;
  }

  /* keep children above overlay */
  .landing,
  .dashboard {
    position: relative;
    z-index: 1;
  }

  .landing {
    max-width: 600px;
    width: 100%;
  }

  .landing-content {
    background: white;
    padding: 3rem;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    text-align: center;
  }

  .landing-title {
    font-size: 2.5rem;
    margin: 0 0 0.5rem;
    color: #8b7355;
    font-weight: 600;
    letter-spacing: -1px;
  }

  .landing-subtitle {
    font-size: 1.2rem;
    color: #b8a89a;
    margin: 0 0 2rem;
    font-style: italic;
  }

  .landing-description {
    text-align: left;
    margin: 2rem 0;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #5c5c5c;
  }

  .landing-description p {
    margin: 1rem 0;
  }

  .error-message {
    background: #fce4ec;
    color: #c2185b;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    font-size: 0.9rem;
  }

  .signin-button {
    background: linear-gradient(135deg, #8b7355 0%, #a08b6f 100%);
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 2rem;
    box-shadow: 0 4px 12px rgba(139, 115, 85, 0.2);
  }

  .signin-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(139, 115, 85, 0.3);
  }

  .signin-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Dashboard Styles */
  .dashboard {
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem;
  }

  .dashboard-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .dashboard-header h2 {
    font-size: 2rem;
    margin: 0 0 0.5rem;
    color: #8b7355;
  }

  .dashboard-header p {
    font-size: 1.1rem;
    color: #b8a89a;
    margin: 0;
  }

  .session-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-bottom: 3rem;
  }

  .session-card {
    background: rgba(250, 248, 246, 0.78);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    border: 2px solid transparent;
  }

  

  .daily-card {
    border-color: #c9b8a8;
  }

  

  .mentor-card {
    border-color: #c9b8a8;
  }


  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 1rem;
  }

  .card-header h3 {
    margin: 0;
    font-size: 1.3rem;
    color: #8b7355;
  }

  .badge {
    background: #f0e8df;
    color: #8b7355;
    padding: 0.3rem 0.8rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .card-description {
    color: #5c5c5c;
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 1rem 0;
  }

  .session-button {
    width: 100%;
    background: linear-gradient(135deg, #8b7355 0%, #a08b6f 100%);
    color: white;
    border: none;
    padding: 0.9rem;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 1.5rem;
  }

  .session-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 115, 85, 0.2);
  }

  .session-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #d4c5b0;
  }

  .session-card.disabled {
    opacity: 0.7;
    border-color: #e0d5c7;
  }

  .checking-status {
    text-align: center;
    color: #b8a89a;
    font-size: 0.9rem;
    margin: 1rem 0;
    font-style: italic;
  }

  .mentor-locked {
    margin: 1rem 0;
    padding: 1rem;
    background: #f9f7f4;
    border-radius: 8px;
    border: 1px solid #e0d5c7;
  }

  .locked-message {
    color: #8b7355;
    font-size: 0.9rem;
    margin: 0 0 0.5rem;
    text-align: center;
    font-weight: 500;
  }

  .progress-message {
    color: #b8a89a;
    font-size: 0.85rem;
    margin: 0;
    text-align: center;
  }

  .admin-badge {
    margin: 1rem 0;
    padding: 0.75rem;
    background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
    border-radius: 8px;
    border: 1px solid #81c784;
  }

  .admin-message {
    color: #2e7d32;
    font-size: 0.85rem;
    margin: 0;
    text-align: center;
    font-weight: 600;
  }

  .card-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .secondary-button {
    width: 100%;
    background: #f5ede0;
    color: #8b7355;
    border: 1px solid #d6c7b5;
    padding: 0.85rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .secondary-button:hover:not(:disabled) {
    background: #ede1cf;
    transform: translateY(-1px);
  }

  .card-actions .session-button,
  .card-actions .secondary-button {
    margin-top: 0;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(30, 22, 12, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    z-index: 20;
    backdrop-filter: blur(2px);
  }

  .modal-card {
    background: #fffaf3;
    border: 2px solid #c9b8a8;
    border-radius: 12px;
    width: min(900px, 100%);
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
  }

  .modal-card.large {
    max-width: 1100px;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .modal-header h3 {
    margin: 0;
    color: #7d623f;
  }

  .modal-eyebrow {
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.75rem;
    color: #b8a89a;
  }

  .modal-title {
    margin: 0;
    color: #7d623f;
  }

  .close-button,
  .back-button {
    background: #f2e7d8;
    color: #7a5c2e;
    border: 1px solid #d5c3ac;
    padding: 0.55rem 0.9rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.18s ease, transform 0.18s ease;
  }

  .close-button:hover,
  .back-button:hover {
    background: #e9dcc9;
    transform: translateY(-1px);
  }

  .modal-placeholder {
    text-align: center;
    color: #8b7355;
    margin: 1rem 0;
  }

  .modal-placeholder.error {
    color: #c2185b;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .history-list-item {
    width: 100%;
    text-align: left;
    background: white;
    border: 1px solid #e6d9c7;
    border-radius: 10px;
    padding: 0.85rem 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    cursor: pointer;
    transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .history-list-item:hover {
    transform: translateY(-1px);
    border-color: #b48b54;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.08);
  }

  .item-title {
    margin: 0 0 0.25rem;
    font-weight: 700;
    color: #7d623f;
  }

  .item-subtitle {
    margin: 0;
    color: #6a5a44;
    font-size: 0.9rem;
    opacity: 0.85;
  }

  .chevron {
    color: #b48b54;
    font-weight: 700;
  }

  .modal-subheader {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .modal-body.scrollable {
    overflow-y: auto;
    border: 1px solid #e6d9c7;
    border-radius: 10px;
    padding: 1rem;
    background: #fffdf8;
    flex: 1;
    min-height: 260px;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .entry-content {
    white-space: pre-wrap;
    font-family: 'Courier New', monospace;
    line-height: 1.5;
    color: #2f261a;
  }

  .summary-chip {
    background: #f7efe2;
    border: 1px solid #dec8aa;
    border-radius: 10px;
    padding: 0.75rem 0.9rem;
  }

  .history-chat {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chat-line {
    border: 1px solid #e6d9c7;
    border-radius: 10px;
    padding: 0.65rem 0.75rem;
    background: white;
  }

  .chat-line.assistant {
    background: #fff7e9;
  }

  .chat-line-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .chat-role {
    font-weight: 700;
    color: #7a5c2e;
    font-size: 0.85rem;
  }

  .chat-content {
    margin: 0.15rem 0 0;
    color: #2f261a;
    line-height: 1.45;
    white-space: pre-wrap;
  }

</style>
