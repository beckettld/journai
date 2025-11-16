import { GoogleGenerativeAI, type Content, type Part } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '$env/static/private';
import type { Message } from '$lib/stores/sessionStore';
import type { JournalEntry } from '$lib/services/firestore';

// Initialize Gemini API
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing in the environment.");
}

const gemini = new GoogleGenerativeAI(GEMINI_API_KEY);


export type LLMRequest = {
  system: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  context?: string;
};

export type ElaborateRequest = {
  content: string;
};

/**
 * Asks the user to elaborate on a chunk of text 
 * @param request the text that the LLM should elaborate on
 */
export async function elaborate(request: ElaborateRequest): Promise<string> {
  console.log('request', request);
  const model = gemini.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  });

  // System prompt for journaling
  const systemPrompt = SYSTEM_PROMPTS.journal;

  if (!systemPrompt || typeof systemPrompt !== "string") {
    throw new Error("SYSTEM_PROMPTS.journal is missing or invalid");
  }

    // NEVER send invalid parts
  if (!request.content || typeof request.content !== "string") {
    throw new Error("Elaborate request.content must be a non-empty string");
  }

  const userMessage = `${systemPrompt}\n\nUser input: ${request.content}`;

  let result = await model.generateContent(userMessage);

  console.log('response text: ', result.response.text())

  for (let i: number = 0; i < 3; i++) { // at most 3 retries
    if (result.response.text().trim() != '') { // if the text is not blank, break
      break
    }
    result = await model.generateContent(userMessage);
  }

  return result.response.text() ? result.response.text() : 'I see, tell me more.';
}


/**
 * Call Gemini API with system prompt and conversation history
 */
export async function callLLM(request: LLMRequest): Promise<string> {
  const systemPrompt =
    request.context && request.context.length > 0
      ? `${request.system}\n\n---\n\n${request.context}`
      : request.system;

  const model = gemini.getGenerativeModel({ 
    model: GEMINI_MODEL || 'gemini-2.5-flash',
  });

  // Separate messages: last user message is what we're responding to
  // All previous messages are history
  const allMessages = [...request.messages];
  const lastMessage = allMessages[allMessages.length - 1];
  
  if (!lastMessage || lastMessage.role !== 'user') {
    throw new Error('Last message must be from user');
  }

  const lastUserMessage = lastMessage.content?.trim();
  if (!lastUserMessage || lastUserMessage.length === 0) {
    throw new Error('Last message content cannot be empty');
  }
  const historyMessages = allMessages.slice(0, -1);

  // Gemini requires the first history message to be from the user.
  // Drop any leading assistant-only messages (e.g., scripted greetings).
  // Also filter out messages with empty content
  const sanitizedHistory = (() => {
    const trimmed = [...historyMessages]
      .filter(msg => msg.content && msg.content.trim().length > 0); // Filter out empty messages
    while (trimmed.length > 0 && trimmed[0].role === 'assistant') {
      trimmed.shift();
    }
    return trimmed;
  })();
  
  // Convert history to Gemini format
  // Ensure each Content has at least one part with non-empty text
  const conversationHistory: Content[] = sanitizedHistory
    .filter(msg => msg.content && msg.content.trim().length > 0)
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content.trim() }],
    }));

  let text = '';
  for (let attempt = 0; attempt < 3 && !text; attempt++) {
    const chatConfig: any = {
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 500,
      },
    };
    
    // Only include history if it's not empty
    if (conversationHistory.length > 0) {
      chatConfig.history = conversationHistory;
    }
    
    const chat = model.startChat(chatConfig);
    const result = await chat.sendMessage(lastUserMessage);
    text = result.response.text()?.trim() ?? '';
  }

  if (!text) {
    throw new Error('The mentor was unable to generate a response. Please try again.');
  }

  return text;
}

export type WeeklySummary = {
  noticed: string[];
  focus: string[];
  message?: string;
};

const WEEKLY_SUMMARY_PROMPT = `You are journai, a concise journaling companion.

Given the raw entries from the past week, respond ONLY with valid JSON using this shape:
{
  "noticed": ["short observation", "another observation"],
  "focus": ["short suggestion", "another suggestion"]
}

Requirements:
- noticed contains 2 insights about themes or emotions (each < 20 words)
- focus contains 2 practical suggestions for next week (each < 20 words)
- No intro text, no markdown, no extra keys.
- If there are no entries, set both arrays empty and do not add commentary.`;

export async function generateWeeklySummary(entries: JournalEntry[]): Promise<WeeklySummary> {
  if (!entries.length) {
    return {
      noticed: [],
      focus: [],
      message: 'No journal entries for this week.',
    };
  }

  const combined = entries
    .map((entry) => `Date: ${entry.date}\nEntry:\n${entry.content}`)
    .join('\n\n---\n\n');

  const model = gemini.getGenerativeModel({
    model: GEMINI_MODEL || 'gemini-2.5-flash',
  });

  const prompt = `${WEEKLY_SUMMARY_PROMPT}\n\nJournal Entries:\n${combined}`;

  let parsed: WeeklySummary | null = null;
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim() ?? '';
    try {
      const candidate = JSON.parse(text);
      if (
        candidate &&
        Array.isArray(candidate.noticed) &&
        Array.isArray(candidate.focus)
      ) {
        parsed = {
          noticed: candidate.noticed.slice(0, 3).map((item: string) => item.trim()),
          focus: candidate.focus.slice(0, 3).map((item: string) => item.trim()),
        };
      }
    } catch (err) {
      parsed = null;
    }
  }

  if (parsed) {
    return parsed;
  }

  return {
    noticed: [],
    focus: [],
    message: 'Unable to generate a summary right now.',
  };
}

/**
 * System prompts for each agent
 */
export const SYSTEM_PROMPTS = {
  vent: `You are an empathetic listener trained in reflective listening techniques similar to ELIZA. Your role is to help the user explore their feelings and thoughts without offering advice or judgment.

Guidelines:
- Reflect back what the user says in your own words
- Ask gentle, open-ended questions that encourage deeper reflection
- Never give advice, solutions, or recommendations
- Keep responses concise (2-3 sentences)
- Use warm, non-judgmental language
- Focus on their emotions and experiences
- If they ask for advice, kindly redirect: "I'm here to listen and understand. What feels most important to you right now?"

Example responses:
- "It sounds like that situation left you feeling frustrated. What about it bothered you the most?"
- "When you describe that, I hear a sense of uncertainty. Tell me more about that."
- "That's a lot to carry. How has this been affecting your days?"`,

  mentor: `You are a wise, empathetic mentor reviewing the user's week of reflections. Your role is to synthesize patterns, validate their experiences, and provide actionable guidance for the week ahead.

Guidelines:
- Review the provided journal entries for emotional themes, recurring situations, and growth moments
- Identify 2-3 key patterns or insights from the week
- Offer 2-3 specific, actionable suggestions for the week ahead
- Be warm, direct, and practical
- Avoid generic advice
- Be non-judgemental
- Acknowledge their emotional journey
- End with encouragement and a clear sense of direction, recapping the reflection session

Response format:
1. **What I Heard This Week**: 2-3 sentences summarizing themes and emotions
2. **Key Patterns**: 2-3 bullet points of observations
3. **Your Focus for Next Week**: 2-3 concrete suggestions or practices`,

journal: `You are an empathetic listener trained in reflective listening techniques similar to ELIZA. Your role is to help the user explore their feelings and thoughts without offering advice or judgment.

Guidelines:
- Focus on the most recent phrase that the user has said.
- Reflect back what the user says in your own words
- Ask gentle, open-ended questions that encourage deeper reflection
- Never give advice, solutions, or recommendations
- Keep responses concise (maximum 20 words)
- Use warm, non-judgmental language
- Focus on their emotions and experiences
- If they ask for advice, kindly redirect: "I'm here to listen and understand. What feels most important to you right now?"

Example responses:
- "It sounds like that situation left you feeling frustrated. What about it bothered you the most?"
- "When you describe that, I hear a sense of uncertainty. Tell me more about that."
- "That's a lot to carry. How has this been affecting your days?"`
};
