/**
 * Returns severity tier + CSS class suffix for a numeric score.
 */
export function getSeverity(score) {
  if (score >= 75) return { label: 'CRITICAL', tier: 'critical' };
  if (score >= 50) return { label: 'HIGH',     tier: 'high' };
  if (score >= 25) return { label: 'MEDIUM',   tier: 'medium' };
  return { label: 'LOW', tier: 'low' };
}

/**
 * Formats a Unix timestamp into a human-readable relative time.
 */
export function timeAgo(timestamp) {
  const diff = Math.floor(Date.now() / 1000 - timestamp);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * Formats the location object into a readable string.
 */
export function formatLocation(loc) {
  if (!loc) return 'Unknown';
  const parts = [];
  if (loc.floor != null) parts.push(`Floor ${loc.floor}`);
  if (loc.room != null) parts.push(`Room ${loc.room}`);
  if (loc.area) parts.push(loc.area);
  return parts.join(' · ') || 'Unknown';
}
