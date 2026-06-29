# 🚀 CivicEye OS

> AI-powered civic issue detection and intelligent complaint resolution platform built for Vibe2Ship Hackathon 2026.

---

# Overview

CivicEye OS is an AI-driven platform that helps citizens report civic infrastructure issues using images or videos while automatically classifying complaints, assessing severity, recommending responsible departments, and providing an intelligent workflow for government authorities.

Instead of manually filing complaints and waiting for action, CivicEye OS uses AI to streamline the entire lifecycle—from citizen reporting to government resolution.

---

# Problem Statement

Municipal complaints are often:

- difficult to report
- manually categorized
- delayed in routing
- lacking transparency
- hard to monitor

Citizens rarely know whether their complaint has been verified or resolved.

Government departments also lack intelligent prioritization for incoming complaints.

---

# Solution

CivicEye OS automates the complaint lifecycle using AI.

The platform can:

- Detect civic issues from uploaded media
- Generate structured complaint reports
- Classify issue severity
- Recommend responsible departments
- Predict maintenance requirements
- Track issue resolution
- Provide analytics dashboards for administrators

---

# Features

## Citizen Portal

- Upload image/video evidence (JPG, PNG, WEBP, MP4, MOV, WEBM)
- AI issue detection via Google Gemini Vision
- Multilingual voice input for the Civic Copilot (English, Hindi, Tamil, Telugu, Kannada, Malayalam)
- GPS metadata support with automatic fallback
- Official complaint PDF generation
- Real-time resolution tracking

## AI Analytics

- Weekly and monthly reporting trends
- Infrastructure health scoring
- Department workload forecasts
- Seasonal issue predictions
- High-risk zone identification
- Preventive maintenance recommendations

## Government Dashboard

- Complaint queue with priority scoring
- Accept / reject / assign officer workflow
- Repair scheduling
- Full audit trail

## Admin Intelligence Dashboard

- City health KPIs
- Department efficiency metrics
- AI-generated operational recommendations (powered by Anthropic Claude)
- Hotspot clustering engine

---

# Technology Stack

- React 19 + TypeScript
- Vite 6
- TailwindCSS 4
- Node.js + Express
- Google Gemini 2.5 Flash — image/video analysis, Civic Copilot, analytics
- Anthropic Claude Sonnet — Admin Intelligence recommendations
- Web Speech API — multilingual voice input

---

# Prerequisites

## Node.js

Node.js 18+ is required.

## ffmpeg (required for video upload support)

Video analysis uses `ffprobe` and `ffmpeg` to extract representative frames before sending them to Gemini Vision. These must be installed as system binaries.

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu / Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html and add to your PATH.

> If ffmpeg is not installed, the server will still run but video uploads will return an error. Image uploads are unaffected.

---

# Project Structure

```
src/
  components/
    dashboard/          # All view components
  context/              # React context (IssueProvider)
  hooks/                # useSpeechRecognition
  lib/                  # Shared types and utilities

server.ts               # Express + Gemini API routes
videoFrames.ts          # ffmpeg frame extraction for video analysis
geminiRetry.ts          # Retry logic for Gemini API calls
```

---

# Installation

```bash
npm install
```

Copy the example environment file and fill in your API keys:

```bash
cp .env.example .env
```

Then start the development server:

```bash
npm run dev
```

The app will be available at http://localhost:3000

---

# Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
# Required — Google Gemini API key for AI analysis, Copilot, and Analytics
CUSTOM_GEMINI_API_KEY=your_gemini_api_key_here

# Required for Admin Intelligence AI Recommendations tab
# Get one at https://console.anthropic.com
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

> **Note:** Without `ANTHROPIC_API_KEY`, all other features work normally. Only the "Generate AI Recommendations" button in the Admin Intelligence tab will be unavailable.

---

# Production Build

```bash
npm run build
npm start
```

---

# AI Usage

**Google Gemini 2.5 Flash** is used for:

- Civic issue classification from images and videos
- Official complaint document generation
- Civic Copilot conversational assistant
- AI Analytics Center summaries and forecasts
- Infrastructure health assessments

**Anthropic Claude Sonnet** is used for:

- Admin Intelligence operational recommendations

---

# Future Improvements

- Real GIS / map tile integration
- IoT sensor data ingestion
- Mobile application (React Native)
- Predictive maintenance ML models
- Multi-city deployment with tenant isolation
- Government API integration (RTI portals)

---

# Team

Built for **Vibe2Ship Hackathon 2026**

---

# License

MIT
