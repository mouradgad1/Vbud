# vbud

A personal AI-powered study companion that monitors your biometrics, environment, and focus — all from the browser.

---

## Abilities

- **Voice Interaction** — Speak directly to Vbud and receive spoken responses powered by the Gemini API. Uses the Web Speech API for microphone input and text-to-speech output.
- **Face Fatigue Analysis** — Upload a photo and receive an AI-generated assessment of your fatigue level, current mood, and personalized recovery tips.
- **Study Mode** — Track your study session in real time with a live audio waveform, elapsed timer, and timestamped event log. Receive a concise AI-generated report when the session ends.
- **Biometric Monitoring** — Simulated heart rate and SpO₂ readings fluctuate with your current state. Critical thresholds trigger an automated emergency countdown with a dispatch log.
- **Telemetry Dashboard** — Live SVG line charts display water flow and gas concentration readings with interactive hover tooltips and anomaly simulation controls.
- **State-Aware Theming** — The interface shifts its color palette based on the active state: Idle, Studying, Analyzing, or Alerts.

---

## Deploy It Yourself

**Prerequisites:** Node.js v18+ and npm installed on your machine.

**1. Clone the repository**
```bash
git clone https://github.com/mouradgad1/scratch.git
cd scratch/vbud-app
```
2. Install dependencies

```bash
npm install
```
3. Configure your Gemini API key

Create a .env file inside vbud-app/ with the following:

```text
VITE_GEMINI_API_KEY=your_api_key_here
```
Alternatively, you can paste the key directly into the Settings panel within the app at runtime — it will be saved to localStorage.

4. Start the dev server

```bash
npm run dev
```
The app will be available at http://localhost:5173 by default.

5. Build for production (optional)

```bash
npm run build
```
The compiled output will appear in vbud-app/dist/.

### Requirements
- Node.js version 18 or higher

- npm (comes with Node.js)

- Modern browser (Chrome or Edge recommended — required for Web Speech API support)

-Gemini API key — obtain from Google AI Studio

The app uses React, Vite, and the Google Generative AI library. All other dependencies are installed automatically via npm install.

Mourad Gad