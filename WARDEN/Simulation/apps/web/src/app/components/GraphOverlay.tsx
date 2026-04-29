'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { GraphState, GraphNode } from '@crisis/types';

interface GraphOverlayProps {
  graphState: GraphState | null;
}

export function GraphOverlay({ graphState }: GraphOverlayProps) {
  if (!graphState) return null;

  const { nodes, edges, zones, entities } = graphState;

  const getNodeColor = (riskLevel: number) => {
    if (riskLevel >= 80) return 'rgba(255, 0, 0, 0.8)';
    if (riskLevel >= 60) return 'rgba(255, 165, 0, 0.8)';
    if (riskLevel >= 30) return 'rgba(255, 255, 0, 0.8)';
    return 'rgba(0, 255, 0, 0.4)';
  };

  const getEntityColor = (role: string) => {
    switch (role) {
      case 'responder': return '#00e5ff';
      case 'staff': return '#76ff03';
      case 'guest': return '#e040fb';
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
      <svg className="w-full h-full drop-shadow-md" viewBox="0 0 100 100" preserveAspectRatio="none">
        {/* Draw Edges */}
        {edges.map(edge => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;

          return (
            <motion.line
              key={`${edge.from}-${edge.to}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={edge.blocked ? 'rgba(255, 0, 0, 0.8)' : 'rgba(200, 200, 200, 0.3)'}
              strokeWidth={edge.blocked ? 0.6 : 0.2}
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
            <g key={node.id}>
              {isHazard && (
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={2}
                  fill={color}
                  opacity={0.3}
                  animate={{ r: [2, 4, 2], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={0.8}
                fill={color}
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
              key={entity.id}
              r={1.2}
              fill={getEntityColor(entity.type)}
              animate={{ cx: node.x, cy: node.y }}
              transition={{ type: 'spring', stiffness: 50, damping: 10 }}
            />
          );
        })}
      </svg>
    </div>
  );
}
