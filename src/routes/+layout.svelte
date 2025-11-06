<script lang="ts">
  import { authUser, authLoading } from '$lib/stores/authStore';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { signOut } from 'firebase/auth';
  import { auth } from '$lib/firebase/client';
  import '../styles/globals.css';

  let mounted = false;
  let signingOut = false;

  onMount(() => {
    mounted = true;
  });

  async function handleSignOut() {
    if (signingOut) return;
    signingOut = true;
    try {
      await signOut(auth);
      goto('/');
    } catch (err: any) {
      console.error('Failed to sign out:', err);
    } finally {
      signingOut = false;
    }
  }

  function goHome() {
    goto('/');
  }
</script>

<div class="app-container">
  {#if $authLoading}
    <div class="loading-screen">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else if !$authUser}
    <div class="auth-guard">
      <slot />
    </div>
  {:else}
    <header class="app-header">
      <div class="header-left">
        <button class="home-button" on:click={goHome} title="Return to home">
          <svg class="home-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <h1>AI Mentor</h1>
        </button>
      </div>
      <div class="header-right">
        {#if $authUser.photoURL}
          <img src={$authUser.photoURL} alt="Profile" class="profile-image" />
        {/if}
        <span class="username">{$authUser.displayName || $authUser.email}</span>
        <button class="signout-button" on:click={handleSignOut} disabled={signingOut} title="Sign out">
          {signingOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </header>
    <main class="app-main">
      <slot />
    </main>
  {/if}
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'Georgia', 'Garamond', serif;
    background: linear-gradient(135deg, #f5f3f0 0%, #faf8f6 100%);
    color: #2c2c2c;
  }

  .app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: linear-gradient(135deg, #f5f3f0 0%, #faf8f6 100%);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e0d5c7;
    border-top: 3px solid #8b7355;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .loading-screen p {
    margin-top: 1rem;
    color: #8b7355;
    font-size: 1rem;
  }

  .auth-guard {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }

  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(139, 115, 85, 0.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .home-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    margin: -0.5rem;
    border-radius: 8px;
    transition: all 0.2s ease;
  }

  .home-button:hover {
    background: rgba(139, 115, 85, 0.1);
  }

  .home-icon {
    width: 20px;
    height: 20px;
    color: #8b7355;
    flex-shrink: 0;
  }

  .header-left h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #8b7355;
    font-weight: 600;
    letter-spacing: -0.5px;
    cursor: pointer;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .profile-image {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid #d4a574;
    flex-shrink: 0;
  }

  .username {
    font-size: 0.95rem;
    color: #8b7355;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .signout-button {
    background: transparent;
    color: #8b7355;
    border: 2px solid #d4c5b0;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
    white-space: nowrap;
  }

  .signout-button:hover:not(:disabled) {
    border-color: #8b7355;
    background: rgba(139, 115, 85, 0.1);
    color: #8b7355;
  }

  .signout-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .app-header {
      padding: 1rem 1.5rem;
    }

    .header-left h1 {
      font-size: 1.25rem;
    }

    .username {
      display: none;
    }

    .signout-button {
      padding: 0.4rem 0.8rem;
      font-size: 0.85rem;
    }

    .home-icon {
      width: 18px;
      height: 18px;
    }
  }

  .app-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
</style>

