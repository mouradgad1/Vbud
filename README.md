# VBUD 

Vbud is an interactive, browser-based personal study companion powered by the Gemini API. It assists users by monitoring study focus, biometrics, environmental telemetry, and facial fatigue, providing live feedback and structured sessions to optimize productivity.

---

## Features

- **Facial Fatigue Analysis** - Photographic assessment of user fatigue levels and emotional state. Users can upload a photo to receive a calculated fatigue score, mood evaluation, and custom wellness recommendations.
- **Study Session Mode** - Real-time tracking of study sessions featuring a live audio waveform visualizer, elapsed session timer, and dynamic event log. When a session ends, the app generates a summarized AI report of the session.
- **Biometric Monitoring** - Dynamic simulation of heart rate (BPM) and oxygen saturation (SpO2) levels. The system monitors thresholds and initiates a mock emergency countdown with a dispatch log if critical biometrics are detected.
- **Telemetry Dashboard** - Live SVG line charts visualizing environmental metrics such as water flow and gas concentration. Includes interactive tooltips and simulation controls to trigger system anomalies.
- **Context-Aware Chatbot** - Integrated chat interface allowing users to converse with Vbud. The chatbot is context-aware and answers questions specifically based on the current dashboard telemetry and session metrics.

---

## Architecture and Technology Stack

- **Frontend Framework** - React (initialized with Vite)
- **Styling** - Vanilla CSS
- **AI Integration** - Google Generative AI (Gemini 2.5 Flash model)
- **Browser APIs** - Web Speech API (Speech Recognition & Speech Synthesis)

---

## Getting Started

### Prerequisites

To run this project locally, ensure you have the following installed:
- Node.js (version 18 or higher)
- npm (Node Package Manager)
- A modern web browser (Google Chrome or Microsoft Edge is recommended for Web Speech API compatibility)
- A Gemini API Key (obtainable from Google AI Studio)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mouradgad1/scratch.git
   cd scratch/vbud-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure the API Key:**
   Create a `.env` file in the `vbud-app` directory and add your API key:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```
   *Note: If you do not configure a `.env` file, you can enter the API key directly in the application's Settings panel during runtime. The key will be saved to your browser's local storage.*

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

5. **Build for production (optional):**
   ```bash
   npm run build
   ```
   The production-ready assets will be generated in the `vbud-app/dist` directory.

---

## Usage Guide

1. **Enter API Key** - Navigate to the Settings panel and ensure a valid Gemini API key is configured.
2. **Start a Study Session** - Go to the Study Mode section and click the start button. Speak to the companion, view the live waveform, and observe the timeline event log. Click stop to receive an automated AI summary of your session.
3. **Analyze Fatigue** - Take or upload a photo in the Fatigue Analysis section to get an instantaneous wellness report and advice on study breaks.
4. **Monitor Telemetry** - Use the Dashboard panel to track simulated environmental and biometric telemetry. Adjust settings to simulate critical thresholds or trigger anomalies.
5. **Chat with Vbud** - Use the Chat input field to ask Vbud questions about your telemetry data or ask for help with the study session.