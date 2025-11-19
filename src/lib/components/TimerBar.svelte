<script lang="ts">
  export let timeRemaining: number = 0;
  export let totalDuration: number = 30;
  export let isActive: boolean = false;
  export let onExpired: (() => void) | null = null;

  $: percentage = ((totalDuration - timeRemaining) / totalDuration) * 100;
  $: minutes = Math.floor(timeRemaining);
  $: seconds = Math.floor((timeRemaining % 1) * 60);

  // Only call onExpired if session is active and time has actually expired
  $: if (isActive && timeRemaining <= 0 && onExpired) {
    onExpired();
  }
</script>

<div class="timer-bar-container">
  <div class="timer-info">
    <span class="timer-label">Time Remaining</span>
    <span class="timer-display">
      {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  </div>
  <div class="progress-bar">
    <div class="progress-fill" style="width: {100 - percentage}%;"></div>
  </div>
  {#if timeRemaining <= 5 && timeRemaining > 0}
    <div class="warning">⏰ Wrapping up soon...</div>
  {/if}
  {#if timeRemaining <= 0}
    <div class="expired">✓ Session Complete</div>
  {/if}
</div>

<style>
  .timer-bar-container {
    background: white;
    padding: 0.85rem 1.1rem;
    border-bottom: 2px solid #e0d5c7;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
  }

  .timer-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.6rem;
  }

  .timer-label {
    font-size: 0.85rem;
    color: #b8a89a;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .timer-display {
    font-size: 1.2rem;
    font-weight: 600;
    color: #8b7355;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.5px;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: #e0d5c7;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #8b7355 0%, #a08b6f 100%);
    transition: width 0.3s ease;
  }

  .warning,
  .expired {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    text-align: center;
  }

  .warning {
    color: #d97706;
    font-weight: 500;
  }

  .expired {
    color: #10b981;
    font-weight: 600;
  }
</style>
