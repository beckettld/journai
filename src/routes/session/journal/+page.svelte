<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { authUser } from '$lib/stores/authStore';   // ★ FIXED: import auth store
  import image from '$lib/images/journal-bg.png';
  import creature from '$lib/images/capybara.png';

  let feedback = "";
  let journalText = "";
  let timeoutId: NodeJS.Timeout | null = null;
  const WAIT_TIME = 5000; // 5 seconds

  // Get today's date
  const today = new Date();

  // Format it however you like (example: YYYY-MM-DD)
  const formattedDate = today.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });



  // --- API CALLS ---

  async function sendApiUpdate(content: string) {
    if (!$authUser?.uid) return;

  try {
        const res = await fetch("/api/journal/elaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            content,
            uid: $authUser.uid
        })
        });

        const data = await res.json();
        console.log('data', data);
        feedback = data.response;    // ★ Store LLM output
        console.log('feedback change', feedback)
    } catch (err) {
    console.error("Failed to call API", err);
    }
  }

  async function uploadDailyEntry() {
    if (!$authUser?.uid) {
      console.warn("Tried to save journal but user is not logged in"); 
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    try {
      await fetch("/api/journal/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: $authUser.uid,        // ★ FIXED (added)
          date: today,
          content: journalText
        })
      });

      // Clear for the next day
      journalText = "";

      localStorage.setItem("lastResetDate", today);
    } catch (err) {
      console.error("Daily journal upload failed", err);
    }
  }

   // --- Load from database ---

  async function loadJournalFromDB() {
    if (!$authUser?.uid) return;

    const today = new Date().toISOString().slice(0, 10);

    try {
      const res = await fetch(`/api/journal/entry?uid=${$authUser.uid}&date=${today}`);

      const data = await res.json();

      if (data.success) {
        return data.content;
      }

      return null;
    } catch (err) {
      console.error("Error loading journal entry:", err);
      return null;
    }
  }

  // --- EDIT LISTENING / DEBOUNCE ---

  function handleInput() {
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      sendApiUpdate(journalText);
    }, WAIT_TIME);
  }

  // --- MIDNIGHT HANDLING ---

  function msUntilMidnight() {
    const now = new Date();
    console.log('now', now);
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime() - now.getTime();
  }

  let midnightTimer: NodeJS.Timeout;

  function scheduleMidnightUpload() {
    const delay = msUntilMidnight();

    midnightTimer = setTimeout(async () => {
      await uploadDailyEntry();
      scheduleMidnightUpload(); // schedule next
    }, delay);
  }

  // --- LOAD SAVED TEXT FOR THE DAY ---

let mounted = false; 

  onMount(async () => {
    mounted = true;
    const today = new Date().toISOString().slice(0, 10);
    const lastReset = localStorage.getItem("lastResetDate");

    if (lastReset !== today) {
      journalText = "";
      localStorage.setItem("lastResetDate", today);
    } else {
      journalText = localStorage.getItem("currentJournalText") ?? "";
    }

    try {
        const todayContent = await loadJournalFromDB();
        if (todayContent !== null) {
            journalText = data.content;
            localStorage.setItem("currentJournalText", journalText);
        }
    } catch (err) {
        console.warn("Could not load journal from Firestore, falling back to localStorage");
    }


    scheduleMidnightUpload();
  });

  // Persist text during the day
  $: if (mounted) {
  localStorage.setItem("currentJournalText", journalText);
}
  onDestroy(() => {
    if (midnightTimer) clearTimeout(midnightTimer);
    if (timeoutId) clearTimeout(timeoutId);
  });
</script>


<style>
  .page-container {
    height: 100vh;
    width: 100vw;
    background-image: url("{image}");
    background-size: cover;
    background-position: center;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding-right: 4rem;
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
  bottom: 1.5rem;
  left: 1.5rem;
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.creature {
  width: min(35vw, 500px);
  height: auto;
  transform: translate(10px, 110px);
  
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
  top: -10%;  /* move above head, scales with creature */
  left: 70%;  /* to the right of the creature */
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
  }

  .entry-wrapper p {
    font-size: 20px;
    background: white;
    color: #8b7355;
    border-radius: 6px;
    padding: 10px;
    font-weight: bold;
    width: 40vw;
    border: 3px solid #7a5c2e;
  }

</style>

<div class="page-container" style="background-image: url('{image}')">
<div class="entry-wrapper">
 <p>Journal Entry: {formattedDate}</p>
  <textarea
    class="journal-box"
    bind:value={journalText}
    on:input={handleInput}
    placeholder="Write your thoughts here..."
  ></textarea>
  </div>
    <div class="creature-wrapper">
    <div class="creature-container">
    <img src="{creature}" alt="creature" class="creature" />

        {#if feedback}
            <div class="speech-bubble">
            {feedback}
            </div>
        {/if}
    </div>
    </div>
</div>
