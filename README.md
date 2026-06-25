# ✦ vbud ✦

A personal AI-powered study companion that monitors your biometrics, environment, and focus — all from the browser.

---

## ✴︎ Abilities

- **Voice Interaction** — Speak directly to Vbud and receive spoken responses powered by the Gemini API. Uses the Web Speech API for microphone input and text-to-speech output.
- **Face Fatigue Analysis** — Upload a photo and receive an AI-generated assessment of your fatigue level, current mood, and personalized recovery tips.
- **Study Mode** — Track your study session in real time with a live audio waveform, elapsed timer, and timestamped event log. Receive a concise AI-generated report when the session ends.
- **Biometric Monitoring** — Simulated heart rate and SpO₂ readings fluctuate with your current state. Critical thresholds trigger an automated emergency countdown with a dispatch log.
- **Telemetry Dashboard** — Live SVG line charts display water flow and gas concentration readings with interactive hover tooltips and anomaly simulation controls.
- **State-Aware Theming** — The interface shifts its color palette based on the active state: Idle, Studying, Analyzing, or Alerts.

---

## ˖ ݁ Deploy It Yourself

**Prerequisites:** Node.js v18+ and npm installed on your machine.

**1. Clone the repository**
```bash
git clone https://github.com/mouradgad1/scratch.git
cd scratch/vbud-app
```

**2. Install dependencies**
```bash
npm install
```

**3. Configure your Gemini API key**

Create a `.env` file inside `vbud-app/` with the following:
```
VITE_GEMINI_API_KEY=your_api_key_here
```

Alternatively, you can paste the key directly into the Settings panel within the app at runtime — it will be saved to `localStorage`.

**4. Start the dev server**
```bash
npm run dev
```

The app will be available at `http://localhost:5173` by default.

**5. Build for production** *(optional)*
```bash
npm run build
```
The compiled output will appear in `vbud-app/dist/`.

---

## ⋆˙ Requirements

### Runtime
| Requirement | Notes |
|---|---|
| Node.js | v18 or higher |
| npm | Bundled with Node.js |
| Modern browser | Chrome or Edge recommended — required for Web Speech API support |
| Gemini API Key | Obtain from [Google AI Studio](https://aistudio.google.com/) |

### Dependencies

| Package | Version | Purpose |
|---|---|---|
| `react` | ^19.2.6 | UI framework |
| `react-dom` | ^19.2.6 | DOM renderer |
| `@google/generative-ai` | ^0.24.1 | Gemini API client |
| `lucide-react` | ^1.21.0 | Icon library |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^8.0.12 | Build tool and dev server |
| `@vitejs/plugin-react` | ^6.0.1 | React + Vite integration |
| `eslint` | ^10.3.0 | Code linting |
| `eslint-plugin-react-hooks` | ^7.1.1 | React hooks lint rules |
| `eslint-plugin-react-refresh` | ^0.5.2 | Fast refresh lint support |
| `@types/react` | ^19.2.14 | TypeScript types for React |
| `@types/react-dom` | ^19.2.3 | TypeScript types for ReactDOM |
| `globals` | ^17.6.0 | Global variable definitions for ESLint |

---

*Mourad Gad*
