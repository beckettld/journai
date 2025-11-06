<script lang="ts">
  export let mode: 'vent' | 'mentor' = 'vent';
  export let subtext = '';
</script>

<div class="mode-banner" class:mentor={mode === 'mentor'}>
  <div class="banner-content">
    <h2 class="banner-title">
      {mode === 'vent' ? '📝 Daily Vent Session' : '🎯 Weekly Mentor Session'}
    </h2>
    <p class="banner-subtitle">{subtext}</p>
  </div>
</div>

<style>
  .mode-banner {
    background: linear-gradient(135deg, #f5e6d3 0%, #ebe1d6 100%);
    padding: 2rem;
    border-bottom: 3px solid #d4c5b0;
    text-align: center;
  }

  .mode-banner.mentor {
    background: linear-gradient(135deg, #e8ddd0 0%, #dcd3c6 100%);
    border-bottom-color: #c9b8a8;
  }

  .banner-content {
    max-width: 600px;
    margin: 0 auto;
  }

  .banner-title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    color: #8b7355;
    font-weight: 600;
    letter-spacing: -0.5px;
  }

  .banner-subtitle {
    margin: 0;
    font-size: 0.95rem;
    color: #b8a89a;
    font-style: italic;
  }
</style>

