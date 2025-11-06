<script lang="ts">
  import type { Message } from '$lib/stores/sessionStore';

  export let messages: Message[] = [];

  let messageListElement: HTMLDivElement;

  $: if (messageListElement) {
    setTimeout(() => {
      messageListElement.scrollTop = messageListElement.scrollHeight;
    }, 0);
  }
</script>

<div class="message-list" bind:this={messageListElement}>
  {#if messages.length === 0}
    <div class="empty-state">
      <p class="empty-message">Start sharing whenever you're ready.</p>
      <p class="empty-hint">Your thoughts are welcome here.</p>
    </div>
  {/if}

  {#each messages as msg, idx (idx)}
    <div class="message-group message-{msg.role}">
      <div class="message-bubble">
        <p class="message-content">{msg.content}</p>
        {#if msg.timestamp}
          <span class="message-time">
            {new Date(msg.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .message-list {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: linear-gradient(135deg, #faf8f6 0%, #f5f3f0 100%);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
  }

  .empty-message {
    font-size: 1.1rem;
    color: #8b7355;
    margin: 0;
    font-weight: 500;
  }

  .empty-hint {
    font-size: 0.95rem;
    color: #b8a89a;
    margin: 0.5rem 0 0;
  }

  .message-group {
    display: flex;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .message-user {
    justify-content: flex-end;
  }

  .message-assistant {
    justify-content: flex-start;
  }

  .message-bubble {
    max-width: 70%;
    padding: 1rem 1.2rem;
    border-radius: 12px;
    word-wrap: break-word;
    line-height: 1.5;
  }

  .message-user .message-bubble {
    background: linear-gradient(135deg, #8b7355 0%, #a08b6f 100%);
    color: white;
    border-radius: 12px 2px 12px 12px;
  }

  .message-assistant .message-bubble {
    background: white;
    color: #2c2c2c;
    border: 1px solid #e0d5c7;
    border-radius: 2px 12px 12px 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }

  .message-content {
    margin: 0;
    font-size: 0.95rem;
  }

  .message-time {
    display: block;
    font-size: 0.75rem;
    margin-top: 0.5rem;
    opacity: 0.7;
  }

  .message-user .message-time {
    text-align: right;
  }
</style>

