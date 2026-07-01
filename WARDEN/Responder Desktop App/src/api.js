const BASE = 'http://localhost:8000';

/**
 * Fetch all stored alerts from the backend (REST fallback for initial load).
 */
export async function fetchAlerts() {
  const res = await fetch(`${BASE}/responder/alerts`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  const data = await res.json();
  return data.alerts;
}

/**
 * Fetch the detailed AI report for a specific alert.
 * If the report hasn't been generated yet, the backend generates it on-demand.
 */
export async function fetchReport(alertId) {
  const res = await fetch(`${BASE}/responder/alerts/${alertId}/report`);
  if (!res.ok) throw new Error('Failed to fetch report');
  return res.json();
}

/**
 * Update the response status of an alert.
 * @param {string} alertId
 * @param {'pending'|'responding'|'resolved'} status
 */
export async function updateStatus(alertId, status) {
  const res = await fetch(`${BASE}/responder/alerts/${alertId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Failed to update status');
  return res.json();
}
