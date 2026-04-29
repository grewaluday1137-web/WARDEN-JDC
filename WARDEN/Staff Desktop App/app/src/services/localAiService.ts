import { useCrisisStore, Alert } from '../store/useCrisisStore';

// The URL where the local llama-server (Tauri sidecar) is running
const LOCAL_AI_URL = 'http://127.0.0.1:8080/v1/chat/completions';

/**
 * Analyzes an alert using the local Gemma sidecar model.
 * Streams the result to the store.
 * @param {Array} alerts The raw alerts (will process the first one)
 */
export const analyzeAlertsLocally = async (alerts: Alert[]) => {
  if (!alerts || alerts.length === 0) return;
  const alert = alerts[0]; // Process only the first (selected) alert for speed

  console.log('[LOCAL AI] 🧠 Sending alert to local Gemma model for tactical analysis (streaming)...');

  const prompt = `You are a tactical advisor for emergency first responders on the ground.
Analyze this alert and provide a tactical entry report. Be concise and format with clear markdown.

ALERT DATA:
Type: ${alert.eventType || alert.message}
Location: ${alert.floor || 'Unknown'} - Node: ${alert.node || 'Unknown'}
Severity: ${alert.severity}

Output a short tactical summary and actionable entry advice.`;

  try {
    const response = await fetch(LOCAL_AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma-4-e2b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        stream: true
      }),
    });

    if (!response.ok) {
      throw new Error(`Local AI Server returned ${response.status}`);
    }

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line === 'data: [DONE]') return;
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices[0].delta.content) {
              fullText += data.choices[0].delta.content;
              
              // Update Zustand store incrementally for live streaming effect
              useCrisisStore.getState().updateExternalAlert(alert.id, {
                detailed_report: fullText,
              });
            }
          } catch (e) {
            // Ignore parse errors on partial chunks
          }
        }
      }
    }
  } catch (error) {
    console.warn('[LOCAL AI] ⚠️ Local AI unreachable or failed. Ensure llama-server sidecar is running.', error);
  }
};

/**
 * Generates overall system insights (Predictions and Tasks) using the local Gemma model.
 */
export const generateSystemInsights = async () => {
  const state = useCrisisStore.getState();
  const activeAlerts = [...(state.tickData?.alerts || []), ...state.externalAlerts];

  console.log('[LOCAL AI] 🧠 Generating System Insights with Gemma...');

  let incidentText = "No active incidents. The facility is stable.";
  if (activeAlerts.length > 0) {
    incidentText = JSON.stringify(activeAlerts.map(a => ({ type: a.eventType || a.message, zone: a.floor || a.zone })), null, 2);
  }

  const prompt = `You are WARDEN, a tactical AI system.
Based on the following active incidents, generate a JSON response with 2 predictions and 3 actionable tasks for first responders.
Incidents: ${incidentText}

You must respond ONLY with a valid JSON object. Do not add any conversational text before or after the JSON.
Use EXACTLY this structure:
{
  "summary": { "text": "Overall tactical assessment" },
  "recommendations": {
    "staff": ["Task 1", "Task 2", "Task 3"],
    "guests": ["Prediction 1", "Prediction 2"]
  }
}`;

  try {
    const response = await fetch(LOCAL_AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma-4-e2b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Lower temperature for more stable JSON
      }),
    });

    if (!response.ok) throw new Error(`Local AI Server returned ${response.status}`);

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Extract JSON if it got wrapped in markdown
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        state.updateAIInsights(parsed.summary, parsed.recommendations);
      } catch (e) {
        // Fallback if JSON is malformed
        state.updateAIInsights({ text: "AI generated a response, but it was not formatted correctly." }, { guests: [content], staff: ["Review AI output manually in console."] });
        console.error("JSON Parse Error:", e, content);
      }
    } else {
      // Fallback if no JSON found at all
      state.updateAIInsights({ text: "AI tactical analysis completed." }, { guests: [content], staff: ["Stay alert and monitor the situation."] });
    }
  } catch (error) {
    console.warn('[LOCAL AI] ⚠️ Failed to generate insights', error);
    state.addToast({ message: "Failed to connect to local AI. Ensure llama-server is running.", severity: "warning" });
  }
};
