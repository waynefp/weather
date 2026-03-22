/**
 * POST /api/briefing
 * Body: { location: string, forecast: object }
 * Returns: { location, generated_at, script: { full_text, segments }, raw_forecast }
 */
export default async function handler(req, res) {
  // CORS headers (needed for local dev with vercel dev)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { location, forecast } = req.body;

  if (!location || !forecast) {
    return res.status(400).json({ error: 'Missing location or forecast data' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Build a concise summary of the forecast to pass to Claude
  const today = forecast.daily;
  const hourly = forecast.hourly;

  const forecastSummary = {
    location,
    today: {
      high: today.temperature_2m_max?.[0],
      low: today.temperature_2m_min?.[0],
      weathercode: today.weathercode?.[0],
      precipitation_mm: today.precipitation_sum?.[0],
      max_wind_kmh: today.windspeed_10m_max?.[0],
    },
    tonight: {
      low: today.temperature_2m_min?.[1],
      weathercode: today.weathercode?.[1],
    },
    week: today.temperature_2m_max?.slice(1, 7).map((high, i) => ({
      day: i + 1,
      high,
      low: today.temperature_2m_min?.[i + 1],
      weathercode: today.weathercode?.[i + 1],
      precipitation_mm: today.precipitation_sum?.[i + 1],
    })),
    next_12h_precip_pct: hourly.precipitation_probability?.slice(0, 12),
  };

  const systemPrompt = `You are a professional TV meteorologist delivering a live on-air weather forecast.
Your tone is warm, authoritative, and engaging — like a trusted local broadcaster.
Use natural spoken language with smooth transitions between segments.
Never say "percent" as a number symbol — always write it out.
Do not use markdown. Return ONLY valid JSON matching this exact structure:

{
  "full_text": "The complete spoken script as one continuous string",
  "segments": [
    { "id": "intro",   "text": "Opening greeting and location", "duration_hint": 5 },
    { "id": "today",   "text": "Today's conditions in detail", "duration_hint": 12 },
    { "id": "tonight", "text": "Overnight outlook", "duration_hint": 8 },
    { "id": "week",    "text": "7-day forecast narrative", "duration_hint": 15 },
    { "id": "outro",   "text": "Closing sign-off", "duration_hint": 4 }
  ]
}

duration_hint is approximate seconds of speech for that segment.
Keep the total script under 90 seconds of natural speech.
Make it vivid and human — mention what to wear, what to plan for, how the sky will look.`;

  const userPrompt = `Here is the forecast data for ${location}. Write a TV weather briefing:

${JSON.stringify(forecastSummary, null, 2)}

Weather code reference: 0=Clear, 1-3=Partly Cloudy, 45-48=Fog, 51-67=Drizzle/Rain, 71-77=Snow, 80-82=Rain Showers, 85-86=Snow Showers, 95=Thunderstorm, 96-99=Thunderstorm with hail.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'AI service error', detail: err });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text ?? '';

    // Strip any accidental markdown fences before parsing
    const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let script;
    try {
      script = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: rawText });
    }

    const payload = {
      location,
      generated_at: new Date().toISOString(),
      script,
      raw_forecast: forecast,
    };

    return res.status(200).json(payload);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
