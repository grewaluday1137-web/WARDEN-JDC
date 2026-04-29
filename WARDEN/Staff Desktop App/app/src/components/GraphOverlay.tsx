// GraphOverlay.tsx
import { motion } from 'framer-motion';
import type { GraphState, GraphNode } from '../types';

interface GraphOverlayProps {
  graphState: GraphState | null;
}

export function GraphOverlay({ graphState }: GraphOverlayProps) {
  if (!graphState) return null;

  const { nodes, edges, zones, entities } = graphState;

  const getNodeColor = (riskLevel: number) => {
    if (riskLevel >= 80) return 'rgba(239, 68, 68, 0.8)'; // red
    if (riskLevel >= 60) return 'rgba(245, 158, 11, 0.8)'; // amber
    if (riskLevel >= 30) return 'rgba(59, 130, 246, 0.8)'; // blue
    return 'rgba(255, 255, 255, 0.2)';
  };

  const getEntityColor = (role: string) => {
    switch (role) {
      case 'responder': return '#06b6d4';
      case 'staff': return '#10b981';
      case 'guest': return '#8b5cf6';
      default: return '#ffffff';
    }
  };

  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const getMicroZoneRisk = (zoneId: string) => {
    const zone = zones.find(z => z.id === zoneId);
    return zone ? zone.riskLevel : 0;
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Draw Edges */}
        {edges.map((edge, i) => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;

          return (
            <motion.line
              key={`edge-${edge.from}-${edge.to}-${i}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={edge.blocked ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255, 255, 255, 0.1)'}
              strokeWidth={edge.blocked ? 0.6 : 0.15}
              strokeDasharray={edge.blocked ? '1,1' : 'none'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            />
          );
        })}

        {/* Draw Nodes */}
        {nodes.map(node => {
          const riskLevel = getMicroZoneRisk(node.zoneId);
          const color = getNodeColor(riskLevel);
          const isHazard = riskLevel >= 60;
          return (
            <g key={`node-${node.id}`}>
              {isHazard && (
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={2}
                  fill={color}
                  opacity={0.3}
                  animate={{ r: [1.5, 3, 1.5], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={0.6}
                fill={color}
                className="transition-colors duration-300"
              />
            </g>
          );
        })}

        {/* Draw Entities */}
        {entities.map(entity => {
          const node = nodeMap.get(entity.currentNode);
          if (!node) return null;

          return (
            <motion.circle
              key={`entity-${entity.id}`}
              r={1}
              fill={getEntityColor(entity.type)}
              stroke="white"
              strokeWidth={0.2}
              animate={{ cx: node.x, cy: node.y }}
              transition={{ type: 'spring', stiffness: 40, damping: 12 }}
            />
          );
        })}
      </svg>
    </div>
  );
}
