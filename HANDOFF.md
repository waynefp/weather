# Atmosphera — Project Hand-Off Document

**Date:** March 23, 2026
**Project:** Atmosphera — AI-Powered Weather Intelligence Platform
**GitHub:** https://github.com/waynefp/weather
**Production URL:** https://atmosphera-weather.vercel.app

---

## 1. Project Overview

Atmosphera is a high-end, single-page weather experience built with a "Taste-Skill" design philosophy — premium typography, bento grid layouts, spring animations, and zero generic patterns. It has evolved from a static showcase into a functional platform with live forecast data, an AI-powered broadcast briefing engine, and a Minimax TTS audio layer feeding into a planned Meteorologist Avatar pipeline.

---

## 2. What Has Been Built

### 2.1 Main Site — `index.html`

A single-file, no-build-step website featuring:

| Section | Description |
|---|---|
| **Hero** | Full-screen `3_Weathers.mp4` video background with layered gradient overlay, animated headline, typewriter effect |
| **AI Briefing CTA** | Location search input with geocoding, "Use my location" geolocation, live status messages during the 3-step API chain |
| **Live Dashboard** | Bento 2.0 grid — temperature arc gauge, wind compass, UV index, visibility, 7-day precipitation bar chart, air quality, sunrise/sunset arc |
| **Hourly Forecast Strip** | Horizontal scroll strip, 12-hour outlook with weather icons |
| **Weather Phenomena** | 6 cards (Lightning, Aurora Borealis, Tornado, Hurricane, Fog, Blizzard) — each with bespoke CSS animations |
| **Meteorological Science** | Atmospheric layers with animated bars, Beaufort scale, cloud classification table, record-breaking weather facts |
| **Footer** | Clean sign-off with shimmer text effect |

**Design system:**
- Fonts: Outfit (sans) + DM Serif Display — loaded via Google Fonts CDN
- Styling: Tailwind CSS v3 CDN (no build step)
- Colors: off-black `#0d0f14`, sky blue `#4a90d9`, aurora `#7fdbca`, mist `#8b9ab3`
- Motion: CSS cubic-bezier spring physics, IntersectionObserver scroll reveals, perpetual loops (float, shimmer, typewriter, pulse rings)

### 2.2 Forecasting Engine

Three-step async chain triggered from the CTA section on `index.html`:

```
1. Geocode (Open-Meteo)
   City name → strip state/country → lat/lon + display label

2. Fetch Forecast (Open-Meteo)
   lat/lon → 7-day daily + hourly forecast
   Units auto-detected: US timezone → °F + mph | all others → °C + km/h

3. Generate Briefing (Vercel → Claude)
   Forecast JSON → Claude Sonnet → structured TV script
   Payload stored in sessionStorage → navigate to briefing.html
```

**Temperature unit detection** uses a comprehensive set of US IANA timezone identifiers (`America/New_York`, `America/Los_Angeles`, `Pacific/Honolulu`, etc.) checked against `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### 2.3 AI Briefing Page — `briefing.html`

A standalone broadcast-style page that reads the payload from `sessionStorage`.

| Panel | Description |
|---|---|
| **Teleprompter** | Full-width card, 460px tall, 1.3rem font, 72ch max-width — word-by-word highlighting at 150 WPM with auto-scroll |
| **Segment Tabs** | Jump to Intro / Today / Tonight / Week / Outro |
| **Playback Controls** | Play/Pause, Restart, segment label + elapsed time |
| **Audio Panel** | Voice selector (all Minimax voices loaded dynamically), model selector, Generate Audio button, audio player — audio + teleprompter launch in sync |
| **Conditions Card** | Current temp (correct unit), weather icon, high/low, wind, precipitation, rain %, 7-day outlook |
| **Avatar Panel** | Placeholder for HeyGen video — auto-surfaces if `localStorage.atmosphera_avatar_video` is set |
| **Pipeline Export** | n8n Webhook URL field (saved to localStorage), Copy JSON, Download JSON — full structured payload |

### 2.4 The Briefing Payload

This is the critical handoff object. Everything downstream (n8n, HeyGen, future features) consumes this:

```json
{
  "location": "Boston, United States",
  "generated_at": "2026-03-23T12:00:00.000Z",
  "unit": "fahrenheit",
  "temp_symbol": "°F",
  "script": {
    "full_text": "Good morning Boston! Here is your complete forecast...",
    "segments": [
      { "id": "intro",   "text": "...", "duration_hint": 5  },
      { "id": "today",   "text": "...", "duration_hint": 12 },
      { "id": "tonight", "text": "...", "duration_hint": 8  },
      { "id": "week",    "text": "...", "duration_hint": 15 },
      { "id": "outro",   "text": "...", "duration_hint": 4  }
    ]
  },
  "raw_forecast": { /* full Open-Meteo 7-day response */ }
}
```

`duration_hint` is approximate seconds per segment — useful for HeyGen scene timing and n8n automation pacing.

---

## 3. Technical Architecture

```
Browser
  │
  ├── index.html           Static site + Briefing Engine JS
  │     ├── Open-Meteo Geocoding API (free, no key, direct fetch)
  │     └── Open-Meteo Forecast API  (free, no key, direct fetch)
  │
  ├── briefing.html        Broadcast page (reads sessionStorage)
  │     ├── GET /api/voices    → Minimax voice library
  │     └── POST /api/tts      → Minimax TTS audio
  │
  └── Vercel Serverless Functions (API keys live here only)
        ├── POST /api/briefing  → Anthropic Claude Sonnet
        ├── POST /api/tts       → Minimax t2a_v2
        └── GET  /api/voices    → Minimax get_voice
```

**Key architectural decisions:**
- No framework, no build step — pure HTML/CSS/JS. Deployable anywhere, zero npm dependencies for the frontend
- API keys never touch the browser — all sensitive calls proxied through Vercel serverless functions
- `sessionStorage` carries the briefing payload between pages — no backend session needed
- `localStorage` persists webhook URL and last-used voice across sessions

---

## 4. File Structure

```
Weather/
├── index.html              Main site + briefing CTA + forecasting engine JS
├── briefing.html           AI broadcast page + TTS + export panel
├── 3_Weathers.mp4          Hero background video (gitignored — keep locally)
│
├── api/
│   ├── briefing.js         Claude proxy — generates TV script from forecast
│   ├── tts.js              Minimax TTS proxy — returns base64 MP3
│   └── voices.js           Minimax voice library — returns grouped voice list
│
├── server.js               Local dev server (mirrors Vercel routing, no login needed)
├── package.json            Declares "type": "module", Node >=18
├── vercel.json             Function maxDuration config (briefing: 30s, tts: 30s, voices: 15s)
├── .gitignore              Ignores: *.mp4, .env*, .vercel/, .claude/
└── HANDOFF.md              This document
```

---

## 5. API Integrations

### Open-Meteo (Free — No Key Required)
| Endpoint | Used For |
|---|---|
| `https://geocoding-api.open-meteo.com/v1/search` | City name → lat/lon |
| `https://api.open-meteo.com/v1/forecast` | 7-day hourly + daily forecast |

Parameters passed to forecast: `temperature_unit` (fahrenheit/celsius), `windspeed_unit` (mph/kmh), `timezone: auto`, `forecast_days: 7`

---

### Anthropic Claude (`ANTHROPIC_API_KEY`)
- Model: `claude-sonnet-4-6`
- Max tokens: `2048`
- Role: TV meteorologist persona — returns structured JSON with `full_text` + `segments`
- Prompt instructs correct temperature/wind units, natural spoken language, ~90 seconds of speech

---

### Minimax (`MINIMAX_API_KEY`)
| Endpoint | Method | Used For |
|---|---|---|
| `https://api.minimax.io/v1/t2a_v2` | POST | Text-to-speech |
| `https://api.minimax.io/v1/get_voice` | POST | Fetch voice library |

- Auth: `Authorization: Bearer {key}`
- TTS response: hex-encoded audio → converted to base64 in `api/tts.js` → decoded to blob URL in browser
- Default model: `speech-02-hd`
- Default voice: `English_expressive_narrator`
- Voice dropdown groups: **My Cloned Voices** → **My Generated Voices** → **Minimax Voice Library** (English first)

---

## 6. Environment Variables

Required in both `.env.local` (local dev) and Vercel dashboard:

| Variable | Where to Get It | Used In |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com | `api/briefing.js` |
| `MINIMAX_API_KEY` | platform.minimax.io | `api/tts.js`, `api/voices.js` |

Vercel env vars dashboard: https://vercel.com/waynefps-projects/atmosphera-weather/settings/environment-variables

---

## 7. Local Development

```bash
# Start local dev server (no Vercel login required)
node server.js
# → http://localhost:3000

# Kill and restart
npx kill-port 3000 && node server.js

# Deploy to Vercel production
npx vercel --prod
```

`server.js` mirrors Vercel's routing:
- POST `/api/briefing`, `/api/tts` → proxied to respective handler
- GET `/api/voices` → proxied to handler
- All other requests → static files served from project root
- `.env.local` is loaded automatically on startup

---

## 8. Git History

| Commit | What Was Built |
|---|---|
| `8269c9a` | Initial Atmosphera site — hero, bento dashboard, phenomena, science sections |
| `4225e14` | Forecasting Engine + AI Briefing Layer + `briefing.html` + Vercel setup |
| `5b85734` | ElevenLabs TTS, dynamic voice loading, temperature unit auto-detection |
| `2f4337b` | Switched audio to Minimax — hex decoding, voice grouping, model selector |

---

## 9. In-Progress — Meteorologist Avatar Pipeline

**Goal:** The briefing payload fires into n8n → Minimax audio generated → HeyGen creates lip-synced avatar video → video URL stored → surfaces in the Avatar panel on `briefing.html`.

**What's already wired up on the site side:**
- "Send to Webhook" button on `briefing.html` — paste any n8n webhook URL, fires the full payload as JSON POST
- Webhook URL persisted in `localStorage` (`atmosphera_webhook_url`)
- Avatar panel auto-shows a video if `localStorage.atmosphera_avatar_video` contains a URL
- Briefing payload includes `script.segments` with `duration_hint` for scene timing

**Suggested n8n flow:**
```
Webhook trigger (receives briefing payload)
  → Extract script.full_text
  → Minimax TTS → MP3 file
  → HeyGen: create video with avatar + MP3 audio
  → Poll HeyGen for completion
  → Store video URL (callback to site or push notification)
```

**HeyGen API docs:** https://docs.heygen.com
**Key payload fields for HeyGen:** `script.full_text` (voice), `script.segments` (scene cuts), `raw_forecast` (for data overlays)

---

## 10. Approved Roadmap — Next Steps After Avatar

Priority order based on discussion:

### Phase 3 — Global Weather Map
Interactive map layer connecting everything built so far:
- **Option A (recommended):** Leaflet.js flat map + Open-Meteo weather tile overlays (precipitation radar, cloud cover, temperature) — click any location to trigger the briefing engine
- **Option B:** Three.js 3D rotating globe with data overlaid — higher wow factor, more complex
- **Option C:** Animated wind particle map (NOAA GFS data) — visual art piece

### Phase 4 — Live Alert Dashboard
- Real-time NOAA severe weather alerts (free public API)
- Active hurricane/typhoon tracker with projected cone paths
- Unified natural hazard view (flood, fire, wind)

### Phase 5 — Activity-Based Forecasting
- "I'm going hiking / flying / sailing / running" mode
- Filters the forecast to what actually matters for that activity
- Reuses existing Open-Meteo data — low effort, high personal value

### Phase 6 — Personalization Layer
- Saved locations stored in localStorage
- Daily auto-briefing on page load for home location
- Severe weather push notifications (Web Push API)

### Phase 7 — Deep Content
- Dedicated phenomenon pages with interactive diagrams
- Historical weather deep dives ("This Day in Weather History")
- Sky of the Day (APOD-style daily feature with AI caption)
- Cloud identification tool (vision AI — upload photo → identify cloud type)

---

## 11. Design System Reference

| Token | Value | Used For |
|---|---|---|
| `#0d0f14` | Off-black | Page background |
| `#1a1e28` | Card background | Bento cards |
| `#4a90d9` | Sky blue | Primary accent, CTAs |
| `#7fdbca` | Aurora teal | Secondary accent, success states |
| `#8b9ab3` | Mist | Muted text, labels |
| `#c8d8f0` | Frost | Borders, subtle highlights |
| `rounded-[2rem]` | — | Standard card border radius |
| `cubic-bezier(0.34, 1.56, 0.64, 1)` | — | Spring animation easing |
| `cubic-bezier(0.22, 1, 0.36, 1)` | — | Smooth reveal easing |
| Outfit | sans-serif | All body text and UI |
| DM Serif Display | serif | Headlines and feature text |

---

*Built with Claude Sonnet 4.6 — Anthropic*
