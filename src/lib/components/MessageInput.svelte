<script lang="ts">
  export let disabled = false;
  export let loading = false;
  export let placeholder = 'Share your thoughts...';
  export let onSubmit: (message: string) => void = () => {};

  let input = '';

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  }

  function handleSubmit() {
    const message = input.trim();
    if (message && !disabled && !loading) {
      onSubmit(message);
      input = '';
    }
  }
</script>

<div class="message-input-container" class:disabled>
  <div class="input-wrapper">
    <textarea
      bind:value={input}
      {placeholder}
      disabled={disabled || loading}
      on:keydown={handleKeydown}
      class="input-field"
      rows="3"
    />
    <button
      class="submit-button"
      on:click={handleSubmit}
      disabled={disabled || loading || !input.trim()}
    >
      {#if loading}
        <span class="spinner"></span>
      {:else}
        <span>Send</span>
      {/if}
    </button>
  </div>
  {#if disabled}
    <p class="disabled-message">✓ Session has ended. Thank you for sharing.</p>
  {/if}
  <p class="hint-text">Press Ctrl+Enter to send</p>
</div>

<style>
  .message-input-container {
    background: white;
    border-top: 2px solid #e0d5c7;
    padding: 1.5rem;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
    flex-shrink: 0;
    position: sticky;
    bottom: 0;
    z-index: 10;
  }

  .message-input-container.disabled {
    background: #f9f7f4;
  }

  .input-wrapper {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
  }

  .input-field {
    flex: 1;
    border: 2px solid #e0d5c7;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    font-family: 'Georgia', serif;
    font-size: 0.95rem;
    color: #2c2c2c;
    resize: vertical;
    min-height: 50px;
    max-height: 150px;
    transition: all 0.2s ease;
  }

  .input-field:focus {
    outline: none;
    border-color: #8b7355;
    box-shadow: 0 0 0 3px rgba(139, 115, 85, 0.1);
  }

  .input-field:disabled {
    background: #f5f3f0;
    color: #b8a89a;
    cursor: not-allowed;
  }

  .submit-button {
    background: linear-gradient(135deg, #8b7355 0%, #a08b6f 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .submit-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(139, 115, 85, 0.2);
  }

  .submit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .disabled-message {
    color: #10b981;
    font-size: 0.9rem;
    margin: 0.75rem 0 0;
    font-weight: 500;
    text-align: center;
  }

  .hint-text {
    color: #b8a89a;
    font-size: 0.8rem;
    margin: 0.5rem 0 0;
    text-align: right;
  }
</style>

