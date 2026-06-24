import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Converts a File object to the Google GenAI inline data format.
 */
function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Cleans markdown code block wraps and parses JSON.
 */
function parseJsonFromText(text) {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse JSON response from Gemini. Raw text:", text, err);
    return {
      fatigueScore: 40,
      mood: "Calm",
      customTips: [
        "Take a standard 5-minute deep breathing break.",
        "Drink a glass of fresh water to restore focus.",
        "Blink frequently and adjust screen brightness to reduce eye fatigue."
      ],
      parseError: true
    };
  }
}

/**
 * Analyzes an uploaded face picture to return fatigue and mood biometrics.
 */
export async function analyzeFaceImage(apiKey, imageFile) {
  if (!apiKey) throw new Error("Gemini API Key is required.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const inlineData = await fileToGenerativePart(imageFile);

  const prompt = `
    You are Vbud, an empathetic AI study companion.
    Analyze the uploaded face picture. Assess the student's current fatigue level and emotional state.
    Return a valid JSON object ONLY. Do not include markdown code block formatting in the raw text, or if you do, ensure it is standard.
    
    The JSON structure MUST be exactly:
    {
      "fatigueScore": <number between 0 and 100>,
      "mood": "<string indicating current mood, e.g., Focused, Energetic, Tired, Anxious, Calm, Stressed>",
      "customTips": [
        "<personalized suggestion 1>",
        "<personalized suggestion 2>",
        "<personalized suggestion 3>"
      ]
    }
  `;

  const result = await model.generateContent([prompt, inlineData]);
  const responseText = result.response.text();
  return parseJsonFromText(responseText);
}

/**
 * Evaluates the study session timeline log and generates a short, focused report.
 */
export async function generateStudyReport(apiKey, timelineData, avgHR = null) {
  if (!apiKey) throw new Error("Gemini API Key is required.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const duration = timelineData.length > 0 ? timelineData[timelineData.length - 1].time : "Unknown";

  const prompt = `
    You are Vbud, a friendly and concise study assistant.
    Based on the following study session timeline log, generate a **very short** (max 10 lines) and helpful summary in Markdown.

    Timeline log:
    ${JSON.stringify(timelineData, null, 2)}

    Session duration: ${duration}
    ${avgHR !== null ? `Average heart rate: ${avgHR} BPM` : ''}

    Please include:
    - **Stats**: session duration and average heart rate (if provided).
    - **Topics covered**: infer interesting topics or activity changes from the timeline events.
    - **One quick tip** to improve the next session.

    Keep it human‑friendly, supportive, and actionable. Use bullet points and bold for emphasis. Do not include any HTML, only Markdown.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Chat with Vbud via voice: send a user message and get a conversational response.
 */
export async function chatWithVbud(apiKey, userMessage) {
  if (!apiKey) throw new Error("Gemini API Key is required.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
    You are Vbud, a friendly, empathetic, and concise AI assistant.
    The user just spoke to you: "${userMessage}"
    Respond in a short, warm, and helpful way (maximum 2‑3 sentences).
    Be conversational and human‑like. Do not include any markdown or special formatting – just plain text.
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
}