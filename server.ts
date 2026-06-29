import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import 'dotenv/config';
import { withGeminiRetry } from './geminiRetry';
import { extractRepresentativeFrames } from './videoFrames';

// 10MB was sized for photo uploads only. Video clips are heavier, so the
// limit is raised to accommodate short citizen-submitted clips while still
// bounding memory usage (the file is held in memory as a Buffer either way).
const upload = multer({ limits: { fileSize: 60 * 1024 * 1024 } }); // 60MB memory buffer

async function startServer() {
  const geminiApiKey = process.env.CUSTOM_GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    throw new Error('CUSTOM_GEMINI_API_KEY is required');
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey });

  const app = express();
  const PORT = Number(process.env.PORT ?? 3000);

  app.use(express.json());

  // Fallback civic-center coordinates, only used when the browser cannot
  // supply a real GPS fix (permission denied, unsupported device, etc).
  const FALLBACK_LAT = 13.0827;
  const FALLBACK_LNG = 80.2707;

  // Shared prompt builder for the civic-infrastructure classifier. The
  // image path sends this with a single inlineData part (unchanged from
  // before); the video path sends it once alongside several extracted
  // frames so Gemini returns one merged report instead of one per frame.
  const buildClassifierPrompt = (isVideo: boolean, frameCount?: number) => `You are an expert Municipal Infrastructure AI. Analyze ${isVideo ? `these ${frameCount} frames, sampled across a citizen-submitted video clip,` : 'this image'} as an open-world civic infrastructure classifier. ${isVideo ? 'Treat the frames as one continuous piece of evidence of the same scene/issue and produce a single combined assessment, not separate per-frame answers.' : ''}

1. Determine whether a civic infrastructure issue exists in the ${isVideo ? 'footage' : 'image'}.
2. Generate a precise category dynamically (e.g., 'Fallen Tree', 'Open Manhole', 'Pothole', 'Illegal Dumping', 'Broken Traffic Signal'). 
3. Generate the responsible municipal department dynamically based on the issue (e.g., 'Parks & Forestry', 'Traffic Department', 'Water Management').
4. If NO civic issue exists (e.g., it's just a selfie, a dog, or a normal car), set isCivicIssue to false and category to 'none'.

You MUST return your response as a raw JSON object without any markdown formatting like \`\`\`json. The JSON must exactly match this structure: 
{ 
  "isCivicIssue": true | false,
  "category": "Dynamic string representing the issue, or 'none'", 
  "department": "Target municipal department", 
  "confidence": "High/Medium/Low with brief reason", 
  "severityScore": "Number between 0-100 as a string", 
  "accidentRisk": "Brief risk assessment", 
  "grievanceDocument": "A formal 2-sentence municipal grievance report ready for filing.",
  "estimatedResolutionWindow": "AI-estimated resolution timeframe specific to the issue type, severity, and likely department workload. Examples: '1 business day', '2-3 business days', '1-2 weeks'. Be concise."
}`;

  const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']);

  // Same dynamic-department routing used for both images and videos, kept
  // as a shared helper so the rule set can't drift between the two paths.
  const applyDepartmentRouting = (jsonResult: any) => {
    const cat = jsonResult.category?.toLowerCase() || '';
    if (cat === 'pothole') {
      jsonResult.department = 'Public Works';
    } else if (cat === 'leakage' || cat.includes('leak')) {
      jsonResult.department = 'Water Management';
    } else if (cat === 'garbage') {
      jsonResult.department = 'Sanitation';
    } else if (cat === 'streetlight') {
      jsonResult.department = 'Electrical Services';
    } else {
      // For dynamic/open-world categories, trust Gemini's assigned department
      jsonResult.department = jsonResult.department || 'General Municipal Review';
    }
    return jsonResult;
  };

  const parseGeminiJson = (responseText: string | undefined) => {
    let resultText = responseText || '{}';
    resultText = resultText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(resultText);
  };

  // API route for Gemini Vision analysis (images and videos)
  app.post('/api/analyze-issue', upload.single('image'), async (req, res) => {
    try {
      // TS HACKATHON HOTFIX: Cast to 'any' to silence the strict compiler errors
      const file = (req as any).file;
      const body = (req as any).body || {};

      if (!file) return res.status(400).json({ error: 'No image provided' });

      // multer puts non-file multipart fields onto req.body as strings
      const clientLat = parseFloat(body.lat);
      const clientLng = parseFloat(body.lng);
      const hasRealLocation =
        Number.isFinite(clientLat) && Number.isFinite(clientLng) &&
        Math.abs(clientLat) <= 90 && Math.abs(clientLng) <= 180;

      const isVideo = VIDEO_MIME_TYPES.has(file.mimetype) || String(body.mediaType).toLowerCase() === 'video';

      let jsonResult: any;
      let videoDurationSeconds: number | undefined;
      let framesAnalyzed: number | undefined;

      if (isVideo) {
        // 1. Extract representative frames from the uploaded clip.
        const extension = path.extname(file.originalname || '') || '.mp4';
        const { frames, durationSeconds } = await extractRepresentativeFrames(file.buffer, extension);
        videoDurationSeconds = durationSeconds;
        framesAnalyzed = frames.length;

        // 2. Send all extracted frames + one shared prompt to Gemini Vision
        //    in a single call, so the model merges them into ONE final report.
        const prompt = buildClassifierPrompt(true, frames.length);
        const response = await withGeminiRetry(() => ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              ...frames.map((frame) => ({ inlineData: { mimeType: frame.mimeType, data: frame.data } })),
              { text: prompt }
            ]
          }
        }));

        jsonResult = parseGeminiJson(response.text);
      } else {
        // Original image pipeline — byte-for-byte the same request shape as before.
        const base64EncodeString = file.buffer.toString('base64');
        const prompt = buildClassifierPrompt(false);

        const response = await withGeminiRetry(() => ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              { inlineData: { mimeType: file.mimetype, data: base64EncodeString } },
              { text: prompt }
            ]
          }
        }));

        jsonResult = parseGeminiJson(response.text);
      }

      applyDepartmentRouting(jsonResult);

      res.json({
        ...jsonResult,
        id: `CIVIC-${Math.floor(1000 + Math.random() * 9000)}`,
        lat: hasRealLocation ? clientLat : FALLBACK_LAT + (Math.random() - 0.5) * 0.01,
        lng: hasRealLocation ? clientLng : FALLBACK_LNG + (Math.random() - 0.5) * 0.01,
        locationSource: hasRealLocation ? 'gps' : 'approximate',
        confirmations: 1,
        status: 'AI VERIFIED',
        filename: file.originalname,
        mediaType: isVideo ? 'video' : 'image',
        ...(isVideo ? { videoDurationSeconds, framesAnalyzed } : {})
      });
    } catch (error: any) {
      console.error('Analysis Error:', error);
      const errMsg = (error.message || '').toLowerCase();
      // Attempt to parse status from different possible error structures
      const status = error.status || (error.response && error.response.status);

      let reason = 'analysis_error'; // Default reason
      if (status === 400 || errMsg.includes('invalid argument')) {
        reason = 'invalid_image';
      } else if (status === 429 || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted')) {
        reason = 'rate_limited';
      } else if (status >= 500 || errMsg.includes('service unavailable')) {
        reason = 'service_unavailable';
      } else if (errMsg.includes('fetchfailed')) {
        reason = 'network_error';
      }

      res.status(500).json({ error: "GEMINI ANALYSIS FAILED", reason });
    }
  });

  // API route for Civic Copilot
  app.post('/api/copilot', express.json(), async (req, res) => {
    try {
      const { message, contextData } = req.body;

      const systemInstruction = `You are Civic Copilot, a helpful municipal AI assistant. Always reply in the same language and script the user used in their question (for example, if they wrote or spoke in Tamil, reply in Tamil; if Hindi, reply in Hindi) — do this even though the civic data below is in English. Use the following live civic infrastructure data to answer the user's question. Be concise, professional, and helpful. If they ask how to fix something, give safe, official municipal advice.\n\nLive Data: ${JSON.stringify(contextData)}`;

      const response = await withGeminiRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: systemInstruction + "\n\nUser Question: " + message }] }
        ]
      }));

      res.json({ reply: response.text });
    } catch (error: any) {
      console.error('Copilot Error:', error);
      res.json({ reply: "Sorry, I couldn't reach the civic data service just now. Please try again in a moment." });
    }
  });

  // API route for Official Complaint Generation
  app.post('/api/generate-complaint', express.json(), async (req, res) => {
    try {
      const { issueType, department, severity, estimatedResolution, location, accidentRisk, grievanceDocument, complaintId } = req.body;

      const prompt = `You are an expert Municipal Legal Officer drafting an official Government Civic Complaint document.

Generate a formal, professional official complaint letter body (NOT a full letter with headers — just the body paragraphs) based on the following civic issue details:

Issue Category: ${issueType}
Responsible Department: ${department}
Severity Score: ${severity}/100
Estimated Resolution: ${estimatedResolution}
GPS Location: ${location?.latitude?.toFixed(5)}, ${location?.longitude?.toFixed(5)}
Accident Risk: ${accidentRisk || 'Not assessed'}
Initial Grievance: ${grievanceDocument || 'Not provided'}
Complaint Reference: ${complaintId}

Write 3 concise paragraphs:
1. Formal description of the issue and its exact nature, referencing the AI-classified evidence.
2. Impact on public safety, civic infrastructure, and community well-being.
3. Formal request for immediate remediation from the ${department}, citing the severity and the estimated SLA of ${estimatedResolution}.

Use formal government language. Be precise, professional, and legally sound. Do not use bullet points. Do not add headers. Return ONLY the complaint body text, no preamble.`;

      const response = await withGeminiRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }));

      res.json({ complaint: response.text ?? '' });
    } catch (error: any) {
      console.error('Complaint generation error:', error);
      res.status(500).json({ error: 'Failed to generate complaint' });
    }
  });

  // API route for AI Analytics Center — accepts pre-computed stats from the frontend,
  // sends them to Gemini, and returns structured analytics JSON with AI summaries
  // for all 8 analytics cards.
  app.post('/api/analytics', express.json(), async (req, res) => {
    try {
      const { stats } = req.body;
      if (!stats) return res.status(400).json({ error: 'stats payload required' });

      const prompt = `You are an expert Municipal Infrastructure Data Analyst and AI assistant. Analyse the following real civic infrastructure data and return structured insights for 8 analytics cards in a city dashboard.

DATA:
- Total Issues Reported: ${stats.totalIssues}
- Resolved Issues: ${stats.resolvedCount}
- Active (Open) Issues: ${stats.openCount}
- Average Severity Score: ${stats.avgSeverity}%
- Infrastructure Health Score: ${stats.healthScore}/100
- Weekly Trend (this week vs last): ${stats.weeklyGrowth}
- Monthly Trend (this month vs last): ${stats.monthlyGrowth}
- Current Season: ${stats.currentSeason}
- Current Month: ${stats.currentMonth}
- Issues Per Day of Week (Sun-Sat): ${JSON.stringify(stats.weekdayCounts)}
- Issues Per Month (last 6 months, oldest first): ${JSON.stringify(stats.monthlyCounts)} for months ${JSON.stringify(stats.monthLabels)}
- Top Issue Categories (name, count): ${JSON.stringify(stats.topCategories)}
- Top Departments (name, count): ${JSON.stringify(stats.topDepts)}
- Department Resolution Data: ${JSON.stringify(stats.deptResolution)}
- Geographic Hotspots: ${JSON.stringify(stats.hotspots)}

You MUST return ONLY a raw JSON object (no markdown, no backticks, no preamble) exactly matching this structure:
{
  "weeklyTrend": {
    "summary": "2-3 sentence AI analysis of weekly reporting patterns. Reference the actual data.",
    "growth": "+X% or -X% or Stable",
    "outlook": "One sentence outlook for next week."
  },
  "monthlyTrend": {
    "summary": "2-3 sentence AI analysis of monthly volume trends. Reference actual months and counts.",
    "growth": "+X% or -X% or Stable",
    "outlook": "One sentence 30-day outlook."
  },
  "infrastructureHealth": {
    "summary": "2-3 sentence assessment of current infrastructure health based on severity scores and open issues.",
    "riskLevel": "Critical | High | Medium | Low",
    "recommendation": "One actionable recommendation for improving infrastructure health."
  },
  "departmentForecast": {
    "summary": "2 sentences summarising cross-department performance and workload distribution.",
    "forecasts": [
      { "dept": "Department name", "forecast": "One sentence forecast for this department.", "risk": "High | Medium | Low" }
    ]
  },
  "highRiskZones": {
    "summary": "2-3 sentences analysing geographic risk distribution and hotspot patterns.",
    "zones": [
      { "name": "Zone name", "riskLevel": "Critical | High | Medium | Low", "action": "Recommended immediate action." }
    ]
  },
  "seasonalPredictions": {
    "summary": "2-3 sentences about what civic issues are likely in the current season and why.",
    "predictions": [
      { "season": "Season name", "forecast": "What issues typically spike and why.", "categories": ["category1", "category2"] }
    ]
  },
  "maintenanceRecommendations": [
    {
      "dept": "Department name",
      "recommendation": "Specific 1-2 sentence preventive maintenance action to take now.",
      "priority": "Critical | High | Medium | Low",
      "timeframe": "e.g. Within 48 hours | This week | This month"
    }
  ],
  "emergingCategories": {
    "summary": "2 sentences about which issue categories are growing and what that signals.",
    "categories": [
      { "name": "Category name", "trend": "Rising/Stable/Declining", "growth": "+X% or -X% or Stable" }
    ]
  }
}

Provide all arrays with at least 2-3 items where data is available. If data is limited (few issues), extrapolate intelligently based on seasonal and infrastructure context. All summaries must reference the actual numbers provided. Keep language professional, specific, and actionable. Return ONLY the JSON — no other text.`;

      const response = await withGeminiRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      }));

      let resultText = response.text ?? '{}';
      // Strip any accidental markdown fences
      resultText = resultText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

      const analyticsData = JSON.parse(resultText);
      res.json(analyticsData);
    } catch (error: any) {
      console.error('Analytics generation error:', error);
      res.status(500).json({ error: 'Failed to generate analytics' });
    }
  });

  // API route for Admin Intelligence AI Recommendations (Anthropic Claude)
  // Called from AdminIntelligenceDashboard — keeps the API key server-side.
  app.post('/api/admin-recommendations', express.json(), async (req, res) => {
    try {
      const { summary } = req.body;
      if (!summary) return res.status(400).json({ error: 'summary payload required' });

      const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
      if (!anthropicKey) return res.status(500).json({ error: 'Anthropic API key not configured on server' });

      const prompt = `You are an expert municipal operations analyst. Based on the following civic issue management data, generate operational recommendations for department managers.\n\nDATA:\n${JSON.stringify(summary, null, 2)}\n\nRespond ONLY with a valid JSON object (no markdown, no backticks) with this exact structure:\n{\n  "recommendations": [\n    {\n      "dept": "Department Name",\n      "priority": "critical|high|medium",\n      "recommendation": "One concise sentence describing the operational issue",\n      "action": "One specific actionable step to take this week"\n    }\n  ],\n  "operationalSummary": "2-3 sentence executive summary of overall operations",\n  "topInsight": "Single most important insight for leadership"\n}\n\nGenerate 4-6 recommendations, one per department plus any cross-department insights. Be specific and data-driven.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error(`Anthropic API error ${response.status}`);
      const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
      const text = (data.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');

      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      res.json(parsed);
    } catch (error: any) {
      console.error('Admin recommendations error:', error);
      res.status(500).json({ error: 'Failed to generate recommendations' });
    }
  });


  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
