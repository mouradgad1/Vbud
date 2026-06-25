import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------------------- Helpers ----------------------

/**
 * Converts a File object into a Gemini-compatible inline data object.
 * @param {File} file
 * @returns {Promise<{inlineData: {data: string, mimeType: string}}>}
 */
function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      return reject(new Error("🤖 Oops! That doesn’t look like a valid image file. Please try again."));
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const base64Data = reader.result.split(",")[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        });
      } catch (err) {
        reject(new Error("😵‍💫 Couldn’t read your image. Maybe it’s corrupted?"));
      }
    };
    reader.onerror = () => reject(new Error("📸 There was a problem reading the image file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Safely parses a JSON string, even if wrapped in markdown code fences.
 * @param {string} text
 * @returns {object}
 */
function parseJsonFromText(text) {
  const defaultResponse = {
    fatigueScore: 50,
    mood: "Neutral",
    customTips: ["Take a break.", "Stay hydrated.", "Adjust screen brightness."],
    parseError: true,
  };

  try {
    let cleaned = text.trim();
    // Remove markdown code fences
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(cleaned);

    // Validate expected fields
    if (
      typeof parsed.fatigueScore !== "number" ||
      typeof parsed.mood !== "string" ||
      !Array.isArray(parsed.customTips)
    ) {
      console.warn("Gemini returned JSON with missing fields, using fallback.", parsed);
      return { ...defaultResponse, parseError: true };
    }
    return parsed;
  } catch (err) {
    console.error("Failed to parse JSON from Gemini:", text, err);
    return defaultResponse;
  }
}

/**
 * Cleans a text response: removes accidental outer quotes and double‑escaped newlines.
 * @param {string} text
 * @returns {string}
 */
function cleanTextResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    try {
      cleaned = JSON.parse(cleaned);
    } catch {
      cleaned = cleaned.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
    }
  }
  return cleaned;
}

// ---------------------- Gemini REST API (with retry & abort) ----------------------

const API_URL = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Core API caller with retry, timeout, and abort support.
 * @param {string} apiKey
 * @param {string} promptText
 * @param {object} [inlineData] - inline data part (optional)
 * @param {string} [responseMimeType] - MIME type for structured output (optional)
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] - external abort signal
 * @param {number} [options.timeout=15000] - per‑request timeout in ms
 * @returns {Promise<string>} - the model’s text response
 */
async function callGeminiAPI(apiKey, promptText, inlineData = null, responseMimeType = null, options = {}) {
  const { signal: externalSignal, timeout = 15000 } = options;

  // Build the URL (model hard‑coded for now)
  const url = `${API_URL}/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const parts = [];
  if (inlineData) parts.push(inlineData);
  parts.push({ text: promptText });

  const body = {
    contents: [{ parts }],
  };

  if (responseMimeType) {
    body.generationConfig = { responseMimeType };
  }

  // Retry logic with exponential backoff (max 3 attempts)
  const maxRetries = 3;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine external and internal abort signals
    const combinedSignal = externalSignal
      ? combineAbortSignals(externalSignal, controller.signal)
      : controller.signal;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: combinedSignal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`[${response.status}] ${errText}`);
      }

      const json = await response.json();
      if (json.error) throw new Error(json.error.message);
      if (!json.candidates?.length || !json.candidates[0].content?.parts?.length) {
        throw new Error("Unexpected response structure from Gemini.");
      }

      // Success – return joined text
      return json.candidates[0].content.parts.map(p => p.text).join("");
    } catch (err) {
      lastError = err;
      // Don’t retry on user abort or client errors (4xx)
      if (err.name === "AbortError" || (err.message && err.message.startsWith("[4"))) {
        throw err;
      }
      // Exponential backoff before next retry
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // All retries exhausted
  throw new Error(
    `😞 Vbud is having trouble reaching the AI right now. Please check your connection and try again.\n\n(Details: ${lastError?.message || "Unknown error"})`
  );
}

/**
 * Combines two AbortSignals so that aborting either aborts the combined signal.
 * @param {AbortSignal} a
 * @param {AbortSignal} b
 * @returns {AbortSignal}
 */
function combineAbortSignals(a, b) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  // If already aborted, abort immediately
  if (a.aborted || b.aborted) controller.abort();
  return controller.signal;
}

// ---------------------- Exported functions ----------------------

/**
 * Analyzes a face image to extract fatigue score, mood, and custom tips.
 * @param {string} apiKey
 * @param {File} imageFile
 * @param {AbortSignal} [signal] - optional abort signal
 * @returns {Promise<{fatigueScore: number, mood: string, customTips: string[], parseError?: boolean}>}
 */
export async function analyzeFaceImage(apiKey, imageFile, signal) {
  if (!apiKey) throw new Error("🔑 Please add your Gemini API key in Settings first!");
  if (!imageFile) throw new Error("📷 Please upload an image so I can see your face.");

  const inlineData = await fileToGenerativePart(imageFile);

  const promptText = `You are Vbud, an empathetic AI study companion.
Analyze the uploaded face picture. Assess the person's fatigue level and emotional state.
Return a valid JSON object matching this exact structure:
{
  "fatigueScore": <number 0-100>,
  "mood": "<string>",
  "customTips": [<3 strings>]
}`;

  const resultText = await callGeminiAPI(apiKey, promptText, inlineData, "application/json", { signal });
  return parseJsonFromText(resultText);
}

/**
 * Generates a Markdown study report from session data.
 * @param {string} apiKey
 * @param {Array} timelineData
 * @param {number|null} avgHR
 * @param {string} transcript
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>} - clean Markdown string
 */
export async function generateStudyReport(apiKey, timelineData, avgHR = null, transcript = "", signal) {
  if (!apiKey) throw new Error("🔑 API key required to generate a report.");
  const duration = timelineData.length > 0
    ? timelineData[timelineData.length - 1].time
    : "Unknown";

  const prompt = `You are Vbud, a helpful study assistant.
Based on the following study session data, generate a concise Markdown summary (max 15 lines).

Session Duration: ${duration}
Average Heart Rate: ${avgHR !== null ? avgHR + " BPM" : "N/A"}
Timeline Events: ${JSON.stringify(timelineData)}
User's Spoken Transcript: "${transcript}"

Include:
- Key topics covered (inferred from transcript and timeline).
- One practical improvement tip.
- A short motivational closing.

Return raw Markdown only. No JSON enclosing, no markdown backticks block around the output.`;

  const resultText = await callGeminiAPI(apiKey, prompt, null, null, { signal });
  return cleanTextResponse(resultText);
}

/**
 * Chat with Vbud using the current dashboard data as context.
 * @param {string} apiKey
 * @param {string} userMessage
 * @param {object} contextData - the full data context object
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function chatWithVbud(apiKey, userMessage, contextData, signal) {
  if (!apiKey) {
    return "🤖 I’m in demo mode. Please add your Gemini API key in Settings to chat with me!";
  }

  const contextStr = JSON.stringify(contextData, null, 2);

  const prompt = `You are Vbud, a personal dashboard assistant.
You may ONLY answer questions related to the user's current data provided below.
If the user asks something unrelated, politely decline and steer back to the data.

Current Data Context:
${contextStr}

User: ${userMessage}
Vbud:

Return only standard raw text. Do not wrap in JSON blocks.`;

  const resultText = await callGeminiAPI(apiKey, prompt, null, null, { signal });
  return cleanTextResponse(resultText);
}

/**
 * Gets a beginner-friendly guide on fixing a minor water pipe leak (demo/utility).
 * @param {string} apiKey
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function getLeakFixInstructions(apiKey, signal) {
  if (!apiKey) {
    return "🔧 I need an API key to fetch the leak-fix guide. Please set it in Settings.";
  }

  const prompt = `Provide a short, beginner-friendly step-by-step guide (max 5 steps) on how to temporarily fix a minor water pipe leak using common tools (tightening, plumber's tape, turning off main valve).
Return as a plain text list. DO NOT return JSON.`;

  const resultText = await callGeminiAPI(apiKey, prompt, null, null, { signal });
  let text = cleanTextResponse(resultText);

  // If the model stubbornly returns a JSON block, parse it gracefully
  if (text.startsWith("{") || text.startsWith("```json")) {
    try {
      if (text.startsWith("```")) {
        text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(text);
      if (parsed.steps && Array.isArray(parsed.steps)) {
        return (parsed.title ? parsed.title + "\n\n" : "") + parsed.steps.join("\n");
      }
      // Fallback: join all values
      return Object.values(parsed).join("\n");
    } catch (e) {
      // Stick with the raw text if parsing fails
    }
  }

  return text;
}