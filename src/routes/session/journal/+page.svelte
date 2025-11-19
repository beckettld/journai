<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { authUser } from '$lib/stores/authStore';
  import {fade} from 'svelte/transition';
  import image from '$lib/images/journal-bg.png';
  import creature from '$lib/images/capybara.png';


  let feedback = "";
  let feedbackHistory = [];
  let journalText = "";
  let success = "";
  let timeoutId: NodeJS.Timeout | null = null;
  const WAIT_TIME = 5000; // 5 seconds - for LLM debounce

  // Autosave settings
  const AUTOSAVE_INTERVAL_MS = 1800_000; // save to DB every 30 minutes - 60 * 30
  let autosaveTimer: NodeJS.Timeout | null = null;
  let isSaving = false; // simple lock to avoid parallel saves

  // Helper: ISO date YYYY-MM-DD
  const isoToday = () => new Date().toISOString().slice(0, 10);
  let currentDate = isoToday(); // used for autosave reset

  // Get today's date 
  const today = new Date(); 
  const formattedDate = today.toLocaleDateString('en-US', {
     year: 'numeric', month: 'long', day: 'numeric' 
     });

  // --- API CALLS ---

  // call your LLM elaborate endpoint (debounced)
  async function sendApiUpdate(content: string) {
    if (!$authUser?.uid) return;
    if (!content || content.trim().length === 0) return;

    try {
      const res = await fetch("/api/journal/elaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          uid: $authUser.uid,
          feedbackHistory
        })
      });

      const data = await res.json();
      // adapt to whatever your endpoint returns
      feedback = data?.response ?? data?.reply ?? "";
      // clear feedback after some time
      setTimeout(()=>{feedback = ""}, 6000);

      // add this to feedback history
      if (feedback.trim() !== "") {
        feedbackHistory.push(feedback);
      }
    } catch (err) {
      console.error("Failed to call API", err);
    }
  }

  // Save current text to DB via entry endpoint
  async function saveDraftToDB() {
    if (isSaving) return; // already saving, skip
    if (!$authUser?.uid) return;
    if (!journalText || journalText.trim().length === 0) return; // don't save empty drafts

    isSaving = true;
    const date = currentDate;

    try {
      const res = await fetch("/api/journal/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: $authUser.uid,
          date,
          content: journalText
        })
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Autosave failed:", data);
      } else {
        success = "journal entry saved...";
        localStorage.setItem("currentJournalText", journalText);
        setTimeout(()=> {
          clearSuccess()
        }, 3000);
      }
    } catch (err) {
      console.error("Autosave error:", err);
    } finally {
      isSaving = false;
    }
  }

  // --- EDIT LISTENING / DEBOUNCE ---

  function handleInput() {
    // Save to localStorage immediately so drafts persist across reloads
    if (mounted) {
      localStorage.setItem("currentJournalText", journalText);
    }

    // Debounce LLM elaborate call (pause detection)
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      sendApiUpdate(journalText);
    }, WAIT_TIME);
  }


  // --- LOAD / INITIALIZE ---

  async function loadJournalFromDB() {
    if (!$authUser?.uid) return null;

    const today = currentDate;

    try {
      const res = await fetch(`/api/journal/entry?uid=${$authUser.uid}&date=${today}`);
      const data = await res.json();

      if (res.ok && data.success) {
        return data.content;
      }

      return null;
    } catch (err) {
      console.error("Error loading journal entry:", err);
      return null;
    }
  }

  // -- SUCCESS --
  function clearSuccess() {
    success = "";
  }

  let mounted = false;

  onMount(async () => {
    mounted = true;

    // load DB entry if available
    const todayContent = await loadJournalFromDB();

    if (todayContent !== null) {
      journalText = todayContent;
    } else {
      // fallback to local draft
      journalText = localStorage.getItem("currentJournalText") ?? "";
    }

    // Start periodic autosave to DB
    autosaveTimer = setInterval(async () => {
      const todayNow = isoToday();

      // If the day changed while tab stayed open
      if (todayNow !== currentDate) {
        console.log("New day detected — reloading journal");

        currentDate = todayNow;

        // Load fresh entry for the new day
        const newEntry = await loadJournalFromDB();

        if (newEntry !== null) {
          journalText = newEntry;
        } else {
          // New day but no entry yet → empty or local draft reset
          journalText = "";
          localStorage.removeItem("currentJournalText");
        }

        return; // Don't autosave old text into the new date
      }

      saveDraftToDB();
    }, AUTOSAVE_INTERVAL_MS);

    // Save on tab close / refresh (synchronous attempt)
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      // try to synchronously persist to localStorage (always works)
      try {
        if (mounted) localStorage.setItem("currentJournalText", journalText);
      } catch (err) {
        // ignore
      }

      // Try to synchronously send a final save (navigator.sendBeacon)
      if (navigator.sendBeacon && $authUser?.uid && journalText && journalText.trim().length > 0) {
        const payload = JSON.stringify({
          uid: $authUser.uid,
          date: isoToday(),
          content: journalText
        });
        navigator.sendBeacon('/api/journal/entry', new Blob([payload], { type: 'application/json' }));
      }

      // no need to call e.preventDefault(); we just attempt best-effort save
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);

    // conserve cleanup references
    cleanup = () => {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  });

  // store cleanup for onDestroy
  let cleanup: (() => void) | null = null;

  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId);
    if (autosaveTimer) clearInterval(autosaveTimer);
    if (cleanup) cleanup();
  });
</script>


<style>
  .page-container {
    height: 100vh;
    width: 100vw;
    background-size: cover;
    background-position: center;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }


  
  @keyframes bg-float {
    0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(-6px); }
}

  @keyframes sun-pulse {
    0%, 100% { filter: brightness(1); }
    50%      { filter: brightness(1.15); }
  }

  .journal-box {
    width: 40vw;
    height: 60vh;
    padding: 1rem;
    background-color: #e7d3b5;
    border: 3px solid #7a5c2e;
    border-radius: 8px;
    resize: none;
    overflow-y: auto;
    font-family: "Courier New", monospace;
    font-size: 1rem;
    box-shadow: 0px 2px 10px rgba(0,0,0,0.2);
  }

  .journal-box:focus {
    outline: none;
    border-color: #5c411d;
  }

.creature-wrapper {
  position: absolute;
  bottom: 2rem;
  left: 2rem;
}

.creature-container {
  position: relative;
  bottom: -1rem;
  left: 1.5rem;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.creature {
  width: min(25vw, 400px);
  height: auto;
  transform: translate(10px, 110px);
  
}

.creature {
  animation: capy-idle 4s ease-in-out infinite;
}

@keyframes capy-idle {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}

.creature-container {
  position: absolute;
  bottom: 2rem;
  left: 2rem;
  display: flex;
  align-items: flex-start;  /* Align bubble to top of creature */
  gap: 1rem;
}

.speech-bubble {
  position: absolute;
  top: -31%;  
  left: 76%;
  width: min(20vw, 200px);
  height: min(20hw, 200px);
  max-width: 60vw;
  max-height: 60vw;
  background: #fff7e6;
  border: 3px solid #7a5c2e;
  padding: 1rem 1.2rem;
  font-family: "Courier New", monospace;
  border-radius: 14px;
  font-size: 0.8rem;
  box-shadow: 0 3px 10px rgba(0,0,0,0.25);
  z-index: 5;
}

/* Larger tail because creature is large */
.speech-bubble::before {
  content: "";
  position: absolute;
  bottom: -20px;              /* Downward tail aiming at creature's head */
  left: 40px;
  width: 0;
  height: 0;
  border-left: 16px solid transparent;
  border-right: 16px solid transparent;
  border-top: 20px solid #fff7e6;
  filter: drop-shadow(0 -2px 2px rgba(0,0,0,0.15));
}

/* Optional: slightly stronger outline for tail */
.speech-bubble::after {
  content: "";
  position: absolute;
  bottom: -23px;
  left: 40px;
  width: 0;
  height: 0;
  border-left: 18px solid transparent;
  border-right: 18px solid transparent;
  border-top: 22px solid #7a5c2e;
  z-index: -1;
}

  /* Makes the date sit directly above the textarea */
  .entry-wrapper {
    display: flex;
    flex-direction: column; /* stack vertically */
    gap: 8px;               /* small space between them */
    width: 100%;
    max-width: 600px;       /* optional: limit width */
    position: absolute;
    right: 10%;
  }

  .entry-wrapper p:not(.success) {
    font-size: 20px;
    background: white;
    color: #8b7355;
    border-radius: 6px;
    padding: 10px;
    font-weight: bold;
    width: 40vw;
    border: 3px solid #7a5c2e;
  }

  .page-bg {
    height: 100vh;
    width: 100vw;
    object-size: cover;
    object-position: center;
    display: flex;
    justify-content: center;
    align-items: center;
    animation:
      bg-float 5s ease-in-out infinite,
      sun-pulse 6s ease-in-out infinite;
    
  }

.success {
  background: rgb(95, 197, 34, 39%);
  border: 1px solid rgb(124, 197, 34, 35%);
  color: #404f32ad;
  font-style: oblique;
  padding: 0.3rem;
  border-radius: 4px;
  width: -webkit-fill-available;
  margin-left: 0.5rem;
}

.load-btn {
  padding: 0.7rem 1rem;
  background: #1f5e0bde;
  color: #75a167de;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  letter-spacing: 0.1rem;
  flex-shrink: 0;
}

.load-btn:hover:not(:disabled) {
  background: #154008de;
}

.load-btn:disabled {
  background: #287a0fde;
  cursor: not-allowed;
}

.save-wrapper {
  display: flex;
}

</style>

<div class="page-container">
  <div class="creature-info-container" >
    <img src="{image}" class="page-bg">
    <div class="creature-wrapper">
      <div class="creature-container">
        <img src="{creature}" alt="creature" class="creature" />
          {#if feedback}
            <div class="speech-bubble" in:fade={{ duration: 400 }} out:fade={{ duration: 300 }}>
              {feedback}
            </div>
          {/if}
        </div>
      </div>
    </div>
    <div class="entry-wrapper">
      <p>Journal Entry: {formattedDate}</p>
      <textarea
        class="journal-box"
        bind:value={journalText}
        on:input={handleInput}
        placeholder="Write your thoughts here..."
      ></textarea>
      <div class = "save-wrapper">
        <button on:click={saveDraftToDB} disabled={isSaving} class="load-btn">
          save
        </button>
        {#if success}
          <p class="success" in:fade={{ duration: 300 }} out:fade={{ duration: 300 }}>{success}</p>
        {/if}
      </div>
  </div>
</div>