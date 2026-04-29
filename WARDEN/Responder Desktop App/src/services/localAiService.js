// The URL where the local llama-server (Tauri sidecar) is running
const LOCAL_AI_URL = 'http://127.0.0.1:8080/v1/chat/completions';

/**
 * Analyzes alerts using the local Gemma sidecar model.
 * @param {Array} alerts The raw alerts from the backend.
 * @param {Function} setAlerts React state setter to update alerts with AI data.
 */
export const analyzeAlertsLocally = async (alerts, setAlerts) => {
  if (!alerts || alerts.length === 0) return;
  const alert = alerts[0]; // Process only the first (selected) alert for speed

  console.log('[LOCAL AI] 🧠 Sending alert to local Gemma model for tactical analysis (streaming)...');

  const prompt = `You are a tactical advisor for emergency first responders on the ground.
Analyze this alert and provide a tactical entry report. Be concise and format with clear markdown.

ALERT DATA:
Type: ${alert.event_type}
Location: ${alert.location?.floor || 'Unknown'} - Node: ${alert.node_id}
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
              
              // Update React state incrementally for live streaming effect
              setAlerts(prevAlerts => {
                const updatedAlerts = [...prevAlerts];
                const idx = updatedAlerts.findIndex(a => a.id === alert.id);
                if (idx !== -1) {
                  updatedAlerts[idx] = {
                    ...updatedAlerts[idx],
                    detailed_report: fullText,
                  };
                }
                return updatedAlerts;
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
