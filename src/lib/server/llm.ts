import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL } from '$env/static/private';
import type { Message } from '$lib/stores/sessionStore';

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
    systemInstruction: systemPrompt,
  });

  // Separate messages: last user message is what we're responding to
  // All previous messages are history
  const allMessages = [...request.messages];
  const lastMessage = allMessages[allMessages.length - 1];
  
  if (!lastMessage || lastMessage.role !== 'user') {
    throw new Error('Last message must be from user');
  }

  const lastUserMessage = lastMessage.content;
  const historyMessages = allMessages.slice(0, -1);
  
  // Convert history to Gemini format
  const conversationHistory = historyMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({
    history: conversationHistory,
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 500,
    },
  });

  const result = await chat.sendMessage(lastUserMessage);
  const text = result.response.text()?.trim() ?? '';

  if (!text) {
    throw new Error('The mentor was unable to generate a response. Please try again.');
  }

  return text;
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
- Review the provided vent entries for emotional themes, recurring situations, and growth moments
- Identify 2-3 key patterns or insights from the week
- Offer 2-3 specific, actionable suggestions for the week ahead
- Be warm, direct, and practical—avoid generic advice
- Acknowledge their emotional journey
- End with encouragement and a clear sense of direction

Response format:
1. **What I Heard This Week**: 2-3 sentences summarizing themes and emotions
2. **Key Patterns**: 2-3 bullet points of observations
3. **Your Focus for Next Week**: 2-3 concrete suggestions or practices`,
};
