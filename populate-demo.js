/**
 * Populate Demo Data Script
 * 
 * Usage: node populate-demo.js <uid>
 * 
 * This script populates a week with:
 * - Week document
 * - 6 vent sessions (to unlock mentor)
 * - 6 journal entries (one per day)
 * - 1 mentor session
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get UID from command line
const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node populate-demo.js <uid>');
  console.error('Please provide your Firebase user UID');
  process.exit(1);
}

// Initialize Firebase Admin
let projectId, privateKey, clientEmail;

// Try to load from JSON file first
try {
  const jsonPath = join(__dirname, 'journai-faff1-firebase-adminsdk-fbsvc-4cc82197a5.json');
  const serviceAccount = JSON.parse(readFileSync(jsonPath, 'utf8'));
  projectId = serviceAccount.project_id;
  privateKey = serviceAccount.private_key;
  clientEmail = serviceAccount.client_email;
  console.log('[Firebase Admin] Loaded credentials from JSON file');
} catch (err) {
  // Try environment variables
  projectId = process.env.FIREBASE_PROJECT_ID;
  privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/gm, '\n');
  clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  if (!projectId || !privateKey || !clientEmail) {
    console.error('Missing Firebase Admin credentials. Please set environment variables or place the service account JSON file in the project root.');
    process.exit(1);
  }
}

const app = initializeApp({
  credential: cert({
    projectId,
    privateKey,
    clientEmail,
  }),
});

const db = getFirestore(app);

// Helper function to get ISO week date range
function getIsoWeekDateRange(weekId) {
  const [yearPart, weekPart] = weekId.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);

  if (Number.isNaN(year) || Number.isNaN(week)) {
    throw new Error(`Invalid weekId: ${weekId}`);
  }

  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = firstThursday.getUTCDay() || 7;

  const isoWeekStart = new Date(firstThursday);
  isoWeekStart.setUTCDate(firstThursday.getUTCDate() - (dayOfWeek - 1) + (week - 1) * 7);

  const isoWeekEnd = new Date(isoWeekStart);
  isoWeekEnd.setUTCDate(isoWeekStart.getUTCDate() + 6);

  const toIsoDate = (date) => date.toISOString().slice(0, 10);

  return {
    startDate: toIsoDate(isoWeekStart),
    endDate: toIsoDate(isoWeekEnd),
  };
}

// Get current week ID (ISO week)
function getCurrentWeekId() {
  const now = new Date();
  const year = now.getFullYear();
  
  // ISO week calculation
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = firstThursday.getUTCDay() || 7;
  
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekStart = new Date(jan4);
  weekStart.setUTCDate(jan4.getUTCDate() - (dayOfWeek - 1));
  
  const diff = now - weekStart;
  const weekNumber = Math.ceil((diff / (1000 * 60 * 60 * 24) + 1) / 7);
  
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

// Generate demo data
const weekId = getCurrentWeekId();
const { startDate, endDate } = getIsoWeekDateRange(weekId);

console.log(`\n📅 Populating week: ${weekId}`);
console.log(`   Date range: ${startDate} to ${endDate}\n`);

// Parse dates
const start = new Date(startDate);
const end = new Date(endDate);

// Generate dates for the week
const weekDates = [];
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  weekDates.push(new Date(d).toISOString().slice(0, 10));
}

// Demo vent sessions (6 sessions across different days)
const ventSessions = [
  {
    date: weekDates[0], // Monday
    time: '09:15:00',
    messages: [
      { role: 'user', content: 'I woke up feeling really anxious about this presentation I have to give today. My stomach is in knots.' },
      { role: 'assistant', content: 'It sounds like this presentation is weighing heavily on you. What about it makes you feel most anxious?' },
      { role: 'user', content: 'I guess I\'m worried people will think my ideas are stupid. I\'ve been working on this for weeks but I still don\'t feel ready.' },
      { role: 'assistant', content: 'That fear of judgment is really present. Tell me more about what you\'ve prepared - what feels most solid to you?' },
      { role: 'user', content: 'I think the data is good. I\'ve done the research. But I keep second-guessing myself. What if I forget what to say?' },
      { role: 'assistant', content: 'It sounds like you\'ve put in the work, but the self-doubt is loud right now. How has this anxiety been showing up in your body?' },
    ],
  },
  {
    date: weekDates[1], // Tuesday
    time: '14:30:00',
    messages: [
      { role: 'user', content: 'The presentation actually went okay. I was nervous but I got through it. Now I just feel drained.' },
      { role: 'assistant', content: 'You made it through something that was really challenging for you. What was that experience like in the moment?' },
      { role: 'user', content: 'I was shaky at first but once I got going, I found my rhythm. A few people even asked good questions.' },
      { role: 'assistant', content: 'It sounds like you found your footing, and people were engaged. How does that feel now, looking back?' },
      { role: 'user', content: 'Relieved, mostly. But also proud? I don\'t know, that feels weird to say.' },
      { role: 'assistant', content: 'That sense of pride - what makes it feel weird to acknowledge?' },
    ],
  },
  {
    date: weekDates[2], // Wednesday
    time: '18:45:00',
    messages: [
      { role: 'user', content: 'Had a really frustrating conversation with my manager today. They keep changing priorities and it\'s hard to keep up.' },
      { role: 'assistant', content: 'That constant shifting must be exhausting. What happened in today\'s conversation specifically?' },
      { role: 'user', content: 'They asked me to pivot on a project I\'ve been working on for a month. Said it\'s not a priority anymore. I feel like I wasted all that time.' },
      { role: 'assistant', content: 'That sense of wasted effort is really valid. How are you feeling about the work you put in?' },
      { role: 'user', content: 'Frustrated. Angry maybe? I don\'t know how to navigate this without seeming difficult.' },
      { role: 'assistant', content: 'You\'re carrying both the frustration and the worry about how you\'ll be perceived. What feels most important to address right now?' },
    ],
  },
  {
    date: weekDates[3], // Thursday
    time: '12:20:00',
    messages: [
      { role: 'user', content: 'I had coffee with an old friend today. It was nice to catch up but I realized how much I\'ve been isolating myself lately.' },
      { role: 'assistant', content: 'That realization about isolation - what came up for you during that conversation?' },
      { role: 'user', content: 'They were talking about all these things they\'ve been doing, trips, events, and I realized I\'ve just been working and going home. That\'s it.' },
      { role: 'assistant', content: 'It sounds like you\'re noticing a gap between how you\'re living and how you might want to be living. What does that bring up for you?' },
      { role: 'user', content: 'I guess I\'m lonely? But also, I don\'t have the energy for much else. Work takes everything out of me.' },
      { role: 'assistant', content: 'That exhaustion is real. How has work been affecting your capacity for other things?' },
    ],
  },
  {
    date: weekDates[4], // Friday
    time: '20:10:00',
    messages: [
      { role: 'user', content: 'Made it through the week. Feeling a mix of relief and emptiness. Like, what was it all for?' },
      { role: 'assistant', content: 'That question "what was it all for?" - what does that emptiness feel like?' },
      { role: 'user', content: 'I don\'t know. I just go through the motions. Get things done. But I don\'t feel like I\'m moving toward anything meaningful.' },
      { role: 'assistant', content: 'That sense of going through motions without purpose is heavy. What would make it feel more meaningful to you?' },
      { role: 'user', content: 'I wish I knew. Maybe I need to figure out what I actually want, not just what I think I should be doing.' },
      { role: 'assistant', content: 'That distinction between what you want and what you should do - what comes up when you think about that?' },
    ],
  },
  {
    date: weekDates[5], // Saturday
    time: '11:00:00',
    messages: [
      { role: 'user', content: 'Trying to have a slow morning but I keep thinking about work. Can\'t seem to turn my brain off.' },
      { role: 'assistant', content: 'That inability to disconnect from work thoughts - what\'s showing up in your mind right now?' },
      { role: 'user', content: 'Just replaying conversations, worrying about what I might have missed, planning for Monday. It\'s exhausting.' },
      { role: 'assistant', content: 'Your mind is working even when you want it to rest. How does that feel in your body?' },
      { role: 'user', content: 'Tense. My shoulders are up around my ears. I know I need to relax but I can\'t.' },
      { role: 'assistant', content: 'That physical tension is real. What would help you feel like you could let go, even a little?' },
    ],
  },
];

// Demo journal entries (one per day)
const journalEntries = [
  {
    date: weekDates[0],
    content: 'Monday morning anxiety is real. Big presentation today and I\'m second-guessing everything. The data is solid, I know that logically, but the fear of judgment is loud. Trying to breathe through it. I\'ve prepared. I can do this.',
  },
  {
    date: weekDates[1],
    content: 'Made it through the presentation. It went better than I expected - people were engaged, asked questions. I felt shaky at first but found my rhythm. There\'s relief, but also this weird feeling of... pride? That\'s new. Usually I just move on to the next thing.',
  },
  {
    date: weekDates[2],
    content: 'Frustrated with work today. Manager keeps changing priorities. Asked me to pivot on a project I\'ve been working on for a month. Feels like wasted effort. I don\'t know how to push back without seeming difficult. This constant shifting is exhausting.',
  },
  {
    date: weekDates[3],
    content: 'Coffee with an old friend. Realized how much I\'ve been isolating myself. They were talking about trips, events, life happening, and I realized I\'ve just been working and going home. That\'s it. Work takes everything out of me. I\'m lonely but also don\'t have energy for much else.',
  },
  {
    date: weekDates[4],
    content: 'End of the week. Relief mixed with emptiness. What was it all for? I go through the motions, get things done, but I don\'t feel like I\'m moving toward anything meaningful. Maybe I need to figure out what I actually want, not just what I think I should be doing.',
  },
  {
    date: weekDates[5],
    content: 'Saturday morning and I can\'t turn my brain off. Replaying work conversations, worrying about Monday, planning ahead. My shoulders are tense. I know I need to rest but I can\'t seem to disconnect. This isn\'t sustainable.',
  },
];

// Demo mentor session
const mentorSession = {
  messages: [
    { role: 'user', content: 'This week felt like a lot. I had the presentation, work frustrations, and I realized how isolated I\'ve become.' },
    { role: 'assistant', content: 'I hear you. This week held both accomplishment and some hard realizations. Let\'s sit with what stood out most.' },
    { role: 'user', content: 'I guess the isolation thing hit hardest. Seeing my friend made me realize I\'ve been on autopilot - just work and home, nothing else.' },
    { role: 'assistant', content: 'That awareness is important. You\'re noticing a gap between how you\'re living and what might feel more nourishing. What would it look like to start small - maybe one thing this week that\'s just for you, not work?' },
    { role: 'user', content: 'I don\'t know. I feel like I don\'t have time, but also I don\'t have energy. It\'s a catch-22.' },
    { role: 'assistant', content: 'That exhaustion is real, and it makes sense given how much you\'re carrying. The work stress, the constant mental replay, the physical tension - your system is working overtime. What if rest and connection weren\'t things you had to earn, but things you needed to function?' },
    { role: 'user', content: 'That\'s a shift. I guess I\'ve been treating rest as a reward instead of a requirement.' },
    { role: 'assistant', content: 'Exactly. And you showed yourself this week that you can do hard things - the presentation, navigating the work frustrations. You have capacity. The question is: how do you want to use it? What would make next week feel different?' },
  ],
};

async function populateDemoData() {
  try {
    console.log('🚀 Starting demo data population...\n');

    const now = Timestamp.now();

    // 1. Create week document
    console.log('📝 Creating week document...');
    const weekRef = db.doc(`users/${uid}/weeks/${weekId}`);
    await weekRef.set({
      weekId,
      ventEntryCount: ventSessions.length,
      lastVentSessionAt: now,
      createdAt: now,
      lastUpdated: now,
    });
    console.log('   ✓ Week document created\n');

    // 2. Create vent sessions
    console.log('💬 Creating vent sessions...');
    for (let i = 0; i < ventSessions.length; i++) {
      const session = ventSessions[i];
      const sessionDate = new Date(`${session.date}T${session.time}`);
      const sessionId = `${session.date}_${session.time.replace(/:/g, '-')}`;
      const startTime = sessionDate.getTime();

      const sessionRef = db.doc(`users/${uid}/weeks/${weekId}/ventSessions/${sessionId}`);
      await sessionRef.set({
        startTime,
        durationMinutes: 30,
        messages: session.messages,
        completedAt: Timestamp.fromDate(new Date(startTime + 30 * 60 * 1000)),
        createdAt: Timestamp.fromDate(sessionDate),
        lastUpdated: Timestamp.fromDate(sessionDate),
      });
      console.log(`   ✓ Vent session ${i + 1}/${ventSessions.length}: ${sessionId}`);
    }
    console.log('');

    // 3. Create journal entries
    console.log('📔 Creating journal entries...');
    for (let i = 0; i < journalEntries.length; i++) {
      const entry = journalEntries[i];
      const entryRef = db.doc(`users/${uid}/journal/${entry.date}`);
      await entryRef.set({
        date: entry.date,
        content: entry.content,
        lastUpdated: Timestamp.fromDate(new Date(`${entry.date}T12:00:00`)),
      });
      console.log(`   ✓ Journal entry ${i + 1}/${journalEntries.length}: ${entry.date}`);
    }
    console.log('');

    // 4. Create mentor session
    console.log('🧘 Creating mentor session...');
    const mentorRef = db.doc(`users/${uid}/weeks/${weekId}/entries/mentor`);
    await mentorRef.set({
      mode: 'mentor',
      messages: mentorSession.messages,
      timestamp: now.toMillis(),
      lastUpdated: now,
    });
    console.log('   ✓ Mentor session created\n');

    console.log('✅ Demo data population complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Week: ${weekId}`);
    console.log(`   - Vent sessions: ${ventSessions.length}`);
    console.log(`   - Journal entries: ${journalEntries.length}`);
    console.log(`   - Mentor session: 1`);
    console.log(`\n🎉 Your account is now populated with demo data!\n`);

  } catch (error) {
    console.error('❌ Error populating demo data:', error);
    process.exit(1);
  }
}

populateDemoData();

