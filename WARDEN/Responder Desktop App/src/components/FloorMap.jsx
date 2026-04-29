import { useState, useMemo } from 'react';
import { FLOORS, getFloorById } from '../data/floors';

/* ── Node type → colour mapping ──────────────────────────────────────────── */
const NODE_COLORS = {
  exit:      '#22c55e',
  vertical:  '#3b82f6',
  stairs:    '#3b82f6',
  service:   '#f59e0b',
  open_area: '#8b5cf6',
  junction:  '#8b5cf6',
  room:      '#a78bfa',
  corridor:  '#64748b',
  lab:       '#06b6d4',
  washroom:  '#94a3b8',
  office:    '#f97316',
};

const ALERT_PULSE_COLOR = '#ef4444';

/**
 * FloorMap renders a floor-plan image with interactive SVG node + edge overlays.
 *
 * Props:
 *   - alert       (object|null) The selected alert. When present, its floor
 *                  is auto-selected and the matching zone node is highlighted.
 *   - defaultFloor (number)     Floor to show when no alert is selected (0).
 */
export default function FloorMap({ alert = null, allAlerts = [], defaultFloor = 1 }) {
  /* Work out which floor the alert belongs to */
  const alertFloor = alert?.location?.floor;
  const [manualFloor, setManualFloor] = useState(defaultFloor);
  const activeFloorId = alertFloor != null ? Number(alertFloor) : manualFloor;
  const floor = getFloorById(activeFloorId) ?? FLOORS[0];

  /* Build a node-id lookup for edges */
  const nodeMap = useMemo(
    () => Object.fromEntries(floor.nodes.map((n) => [n.id, n])),
    [floor],
  );

  /* Find the nodes that match active alerts on this floor */
  const alertingNodeIds = useMemo(() => {
    const ids = new Set();
    
    // Filter to active alerts on this floor
    const relevantAlerts = allAlerts.filter(a => 
      a.status !== 'resolved' && 
      (a.location?.floor == null || Number(a.location.floor) === activeFloorId)
    );

    relevantAlerts.forEach(a => {
      const zone = (
        a.location?.area ||
        a.metadata?.zone_id ||
        a.location?.node || // Added fallback for node ID directly
        ''
      ).toLowerCase().replace(/[\s-]/g, '_');

      if (!zone) return;

      // Exact zone match
      const exact = floor.nodes.find(
        (n) => n.zone === zone || n.label?.toLowerCase().replace(/[\s-]/g, '_') === zone || n.id.toLowerCase() === zone
      );
      if (exact) {
        ids.add(exact.id);
        return;
      }

      // Partial match
      const partial = floor.nodes.find(
        (n) => n.zone.includes(zone) || zone.includes(n.zone)
      );
      if (partial) ids.add(partial.id);
    });

    // Also include the currently selected alert if it's on this floor (even if resolved, for focus)
    if (alert && (alert.location?.floor == null || Number(alert.location.floor) === activeFloorId)) {
       const zone = (alert.location?.area || alert.metadata?.zone_id || alert.location?.node || '').toLowerCase().replace(/[\s-]/g, '_');
       const match = floor.nodes.find(n => n.zone === zone || n.label?.toLowerCase().replace(/[\s-]/g, '_') === zone || n.id.toLowerCase() === zone) 
                  || floor.nodes.find(n => zone && (n.zone.includes(zone) || zone.includes(n.zone)));
       if (match) ids.add(match.id);
    }

    return ids;
  }, [allAlerts, alert, floor, activeFloorId]);

  return (
    <div className="floor-map">
      {/* ── Floor selector tabs ─────────────────────────────────────────── */}
      <div className="floor-map__tabs">
        {FLOORS.map((f) => (
          <button
            key={f.id}
            className={`floor-map__tab ${f.id === activeFloorId ? 'floor-map__tab--active' : ''} ${
              alertFloor != null && f.id === Number(alertFloor) ? 'floor-map__tab--alert' : ''
            }`}
            onClick={() => setManualFloor(f.id)}
            id={`floor-tab-${f.key}`}
          >
            {f.label}
            {alertFloor != null && f.id === Number(alertFloor) && (
              <span className="floor-map__tab-badge">⚠</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Map viewport ─────────────────────────────────────────────────── */}
      <div className="floor-map__viewport">
        <div
          className="floor-map__canvas"
          style={{ 
            aspectRatio: `${floor.canvasW} / ${floor.canvasH}`,
            maxWidth: '100%',
            position: 'relative'
          }}
        >
          {/* Background image */}
          <img
            className="floor-map__image"
            src={floor.image}
            alt={floor.label}
            draggable={false}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />

          {/* SVG overlay */}
          <svg
            className="floor-map__svg"
            viewBox={`0 0 ${floor.canvasW} ${floor.canvasH}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          >
            {/* Glow filter for alert node */}
            <defs>
              <filter id="alert-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* ── Edges ───────────────────────────────────────────────── */}
            {floor.edges.map(([a, b], i) => {
              const na = nodeMap[a];
              const nb = nodeMap[b];
              if (!na || !nb) return null;
              return (
                <line
                  key={i}
                  x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                  className="floor-map__edge"
                />
              );
            })}

            {/* ── Nodes ───────────────────────────────────────────────── */}
            {floor.nodes.map((node) => {
              const isAlert = alertingNodeIds.has(node.id);
              const isSelected = alert && alertingNodeIds.has(node.id) && (
                (alert.location?.area || alert.metadata?.zone_id || alert.location?.node || '').toLowerCase().replace(/[\s-]/g, '_') === node.zone ||
                node.id === node.id // Fallback
              );
              // Simplified selection check: if it's the selected one, we can give it extra prominence if needed.
              // For now, let's just make all matching nodes pulse.
              const color = isAlert ? ALERT_PULSE_COLOR : (NODE_COLORS[node.type] || '#94a3b8');
              const r = isAlert ? 14 : node.isExit ? 10 : 8;

              return (
                <g key={node.id} className="floor-map__node-group">
                  {/* Pulse ring for alert node */}
                  {isAlert && (
                    <circle
                      cx={node.x} cy={node.y} r={r + 8}
                      className="floor-map__pulse-ring"
                    />
                  )}

                  {/* Node circle */}
                  <circle
                    cx={node.x} cy={node.y} r={r}
                    fill={color}
                    stroke={isAlert ? '#fff' : 'none'}
                    strokeWidth={isAlert ? 2.5 : 0}
                    filter={isAlert ? 'url(#alert-glow)' : undefined}
                    className="floor-map__node"
                    style={{ opacity: isAlert ? 1 : undefined }}
                  />

                  {/* Label */}
                  <text
                    x={node.x}
                    y={node.y - r - 4}
                    className={`floor-map__label ${isAlert ? 'floor-map__label--alert' : ''}`}
                    style={{ opacity: isAlert ? 1 : undefined }}
                  >
                    {node.label || node.zone}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
