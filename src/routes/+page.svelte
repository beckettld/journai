<script lang="ts">
  import { goto, afterNavigate } from '$app/navigation';
  import { authUser } from '$lib/stores/authStore';
  import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
  import { auth } from '$lib/firebase/client';
  import { onMount } from 'svelte';
  import { getISOWeek, getYear } from 'date-fns';

  let loading = false;
  let error: string | null = null;
  let showDashboard = false;
  let ventCount = 0;
  let mentorEnabled = false;
  let checkingVentCount = false;
  let isAdmin = false;

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
</script>

<div class="landing-container">
  {#if !showDashboard}
    <!-- Landing / Login Screen -->
    <div class="landing">
      <div class="landing-content">
        <h1 class="landing-title">AI Mentor</h1>
        <p class="landing-subtitle">Journal daily. Reflect deeply on weekends.</p>

        <div class="landing-description">
          <p>
            <strong>Daily Vent Sessions (Mon–Fri):</strong> Spend 30 minutes reflecting with an
            empathetic listener. Share your thoughts, feelings, and experiences without judgment.
          </p>
          <p>
            <strong>Weekly Mentor Sessions (Sat–Sun):</strong> Spend an hour in synthesis. I'll review
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
        <p>What would you like to do today?</p>
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
          <button class="session-button" on:click={startJournal}>
            Start Daily Journaling
          </button>
        </div>

        <div class="session-card mentor-card" class:disabled={!mentorEnabled}>
          <div class="card-header">
            <h3>Weekly Mentor Session</h3>
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
                  Complete 5 daily vent sessions to unlock your weekly mentor session.
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
  {/if}
</div>

<style>
  .landing-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: linear-gradient(135deg, #f5f3f0 0%, #faf8f6 100%);
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
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;
    border: 2px solid transparent;
  }

  .session-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  }

  .daily-card {
    border-color: #d4c5b0;
  }

  .daily-card:hover {
    border-color: #8b7355;
  }

  .mentor-card {
    border-color: #c9b8a8;
  }

  .mentor-card:hover {
    border-color: #8b7355;
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

</style>

