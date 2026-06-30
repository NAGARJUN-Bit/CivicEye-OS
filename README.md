# 🚀 CivicEye OS

<p align="center">
AI-powered civic issue detection and intelligent complaint resolution platform built for the Vibe2Ship Hackathon 2026.
</p>

<p align="center">

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![Google Gemini](https://img.shields.io/badge/Google-Gemini%202.5%20Flash-4285F4)
![Cloud Run](https://img.shields.io/badge/Google%20Cloud-Cloud%20Run-4285F4?logo=googlecloud)
![License](https://img.shields.io/badge/License-MIT-green)

</p>

---

# 🌐 Live Demo

**Application**

https://civiceye-os-563427267126.asia-south1.run.app

---

# 📂 GitHub Repository

https://github.com/NAGARJUN-Bit/CivicEye-OS

---

# 📖 Overview

CivicEye OS is an AI-powered civic infrastructure platform that enables citizens to report civic issues using images or videos while automatically analyzing, classifying, prioritizing, and routing complaints to the appropriate government department.

Instead of relying on manual complaint filing, CivicEye OS leverages Google Gemini to understand visual evidence, generate structured reports, estimate severity, recommend departments, and assist both citizens and administrators throughout the complaint lifecycle.

---

# 🎯 Problem Statement

Municipal complaint systems today face several challenges:

- Manual complaint categorization
- Slow routing to departments
- Lack of transparency
- Poor prioritization
- Limited citizen engagement
- No AI-assisted verification

These inefficiencies often delay issue resolution and reduce public trust.

---

# 💡 Solution

CivicEye OS automates the entire complaint lifecycle using AI.

The platform allows citizens to:

- Upload images or videos of civic issues
- Automatically analyze media using Google Gemini
- Generate structured complaint reports
- Identify responsible government departments
- Estimate severity and resolution time
- Track issue progress
- Interact with an AI Civic Copilot

Government administrators receive intelligent dashboards with analytics, hotspot detection, workload monitoring, and AI-generated operational insights.

---

# ✨ Key Features

## 👤 Citizen Reporting Hub

- Upload Images
- Upload Videos
- Automatic GPS Capture
- AI-powered Media Analysis
- Smart Complaint Generation
- Resolution Tracking

---

## 🤖 Google Gemini Vision

Supports:

- Road Damage Detection
- Water Logging
- Drainage Issues
- Garbage Dumps
- Electrical Hazards
- Infrastructure Damage
- Public Safety Risks

Gemini automatically generates:

- Issue Classification
- Severity Score
- Department Assignment
- Estimated Resolution Time
- Risk Assessment
- Official Complaint Draft

---

## 🎥 Video Intelligence

Video uploads are processed using FFmpeg.

The system:

- Extracts representative frames
- Sends them to Gemini Vision
- Aggregates results
- Generates a unified incident report

Supported formats:

- MP4
- MOV
- WEBM

---

## 🧠 Civic Copilot

AI-powered assistant capable of answering questions related to:

- Civic infrastructure
- Complaint status
- Department information
- Neighborhood issues
- Public services

Supports multilingual voice input using the Web Speech API.

---

## 📊 Analytics Dashboard

Provides:

- City Health Score
- Department Performance
- Resolution Metrics
- Infrastructure Trends
- Seasonal Predictions
- High-Risk Zones
- Preventive Maintenance Insights

---

## 🏛 Government Dashboard

Designed for authorities to:

- Review complaints
- Verify reports
- Track progress
- Manage departments
- Monitor KPIs
- Improve operational efficiency

---

# 🏗 System Workflow

```
Citizen Upload
       │
       ▼
Image / Video
       │
       ▼
Google Gemini Vision
       │
       ▼
Issue Classification
       │
       ▼
Severity Analysis
       │
       ▼
Department Assignment
       │
       ▼
Complaint Generation
       │
       ▼
Government Dashboard
       │
       ▼
Verification & Resolution
```

---

# 🛠 Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- TailwindCSS

### Backend

- Node.js
- Express

### Artificial Intelligence

- Google Gemini 2.5 Flash
- Anthropic Claude Sonnet (Admin Intelligence)

### Video Processing

- FFmpeg
- FFprobe

### Deployment

- Google Cloud Run
- Docker

---

# ☁ Google Technologies Used

- Google Gemini 2.5 Flash API
- Google AI Studio
- Google Cloud Run
- Google Cloud Build
- Docker Containers

---

# 📁 Project Structure

```
src/
 ├── components/
 ├── context/
 ├── hooks/
 ├── lib/

server.ts
videoFrames.ts
geminiRetry.ts
Dockerfile
```

---

# ⚙ Installation

Clone the repository

```bash
git clone https://github.com/NAGARJUN-Bit/CivicEye-OS.git
```

Navigate into the project

```bash
cd CivicEye-OS
```

Install dependencies

```bash
npm install
```

Create an environment file

```bash
cp .env.example .env
```

Add your API keys

```env
CUSTOM_GEMINI_API_KEY=YOUR_GEMINI_API_KEY

ANTHROPIC_API_KEY=YOUR_ANTHROPIC_KEY
```

Run locally

```bash
npm run dev
```

Build production

```bash
npm run build
```

Start server

```bash
npm start
```

---

# 🐳 Docker

Build

```bash
docker build -t civiceye-os .
```

Run

```bash
docker run -p 8080:8080 civiceye-os
```

---

# 📷 Supported Media

### Images

- JPG
- JPEG
- PNG
- WEBP

### Videos

- MP4
- MOV
- WEBM

---

# 🔒 Environment Variables

Required

```env
CUSTOM_GEMINI_API_KEY=
```

Optional

```env
ANTHROPIC_API_KEY=
```

---

# 🚀 Deployment

The application is deployed on **Google Cloud Run** using Docker containers.

Production URL:

https://civiceye-os-563427267126.asia-south1.run.app

---

# 🔮 Future Improvements

- Live GIS Map Integration
- IoT Sensor Support
- Mobile Application
- Government API Integration
- Predictive Maintenance Models
- Real-Time Officer Dispatch
- Smart Notifications
- Multi-City Deployment

---

# 👨‍💻 Developer

**Nagarjun N**

Built for **Vibe2Ship Hackathon 2026**

GitHub:

https://github.com/NAGARJUN-Bit

---

# 📜 License

This project is released under the MIT License.

---

## ⭐ Acknowledgements

Special thanks to:

- Google AI Studio
- Google Cloud
- Gemini API
- Vibe2Ship Hackathon
- React Community
- Node.js Community

---

<p align="center">

Made with ❤️ using Google Gemini, React, TypeScript and Google Cloud.

</p>
