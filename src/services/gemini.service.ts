import { GoogleGenerativeAI } from '@google/generative-ai';
import { IChatMessage } from '../models/Project';

export const activeGenerations = new Map<string, AbortController>();

// class Mutex {
//   private mutex = Promise.resolve();

//   lock(): Promise<() => void> {
//     let begin: (unlock: () => void) => void = (unlock) => { };

//     this.mutex = this.mutex.then(() => {
//       return new Promise(begin);
//     });

//     return new Promise((res) => {
//       begin = res;
//     });
//   }
// }

// // Create a global lock for Gemini requests
// const geminiLock = new Mutex();

export const cancelGeneration = (projectId: string) => {
  const controller = activeGenerations.get(projectId);
  if (controller) {
    controller.abort();
    activeGenerations.delete(projectId);
    return true;
  }
  return false;
};

export const generateManimCode = async (
  projectId: string,
  prompt: string,
  history: IChatMessage[],
  currentCode: string
): Promise<{ explanation: string; code: string; fileClass: string }> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  const systemInstruction = `You are an expert Manim developer. 
Respond to the user's prompt by providing a brief explanation followed by the complete updated Python code for the Manim animation.
Always output the Python code within a markdown code block starting with \`\`\`python and ending with \`\`\`. 
Additionally, you MUST output the exact name of the main class to be rendered in a separate markdown block starting with \`\`\`class and ending with \`\`\`.
Do not use any other formatting for the code. 
CRITICAL: Do not answer any prompts that unrelated to manim code generation/explanation. if user asks you to do anything else, politely refuse and say that you can only generate manim code.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: systemInstruction
  });

  // --- CONTEXT MINIMIZATION ---
  // 1. Sliding Window: Keep only the last 6 messages (3 user, 3 ai)
  const recentHistory = history.slice(-10);

  // 2. Code Stripping: Map the history for Gemini
  const formattedHistory = recentHistory.map((msg, index) => {
    const isLastMessage = index === recentHistory.length - 1;
    const isAiMessage = msg.role === 'ai';

    // Always start with the text/explanation
    let textContent = msg.prompt;

    if (isAiMessage && isLastMessage && currentCode) {
      textContent += `\n[CURRENT FILE STATE - INCLUDING MANUAL EDITS BY THE USER]:\n\`\`\`python\n${currentCode}\n\`\`\``;
    }

    return {
      role: isAiMessage ? 'model' : 'user',
      parts: [{ text: textContent }],
    };
  });
  // -----------------------------------


  const chat = model.startChat({
    history: formattedHistory,
  });

  const abortController = new AbortController();
  activeGenerations.set(projectId, abortController);

  // const unlock = await geminiLock.lock();

  try {
    if (abortController.signal.aborted) throw new Error('AbortError');

    abortController.signal.addEventListener('abort', () => {
      console.log(`[Gemini] Generation aborted for project ${projectId}`);
    });

    const result = await chat.sendMessage(prompt);

    if (abortController.signal.aborted) throw new Error('AbortError');

    const text = result.response.text();

    const codeMatch = text.match(/```python([\s\S]*?)```/);
    const classMatch = text.match(/```class([\s\S]*?)```/);
    let code = '';
    let explanation = text;
    let fileClass = 'MainScene';

    if (codeMatch) {
      code = codeMatch[1].trim();
      explanation = text.replace(/```python[\s\S]*?```/, '').replace(/```class[\s\S]*?```/, '').trim();
    }

    if (classMatch) {
      fileClass = classMatch[1].trim();
    }

    return { explanation, code, fileClass };
  } catch (err: any) {
    throw err;
  } finally {
    activeGenerations.delete(projectId);
    // unlock();
  }
};
