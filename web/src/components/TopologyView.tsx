import React, { useState, useMemo } from 'react';
import { APCAPEvent } from '../types';

interface TopologyViewProps {
  events: APCAPEvent[];
  onSelectEvent: (event: APCAPEvent) => void;
}

interface GraphNode {
  id: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  callCount: number;
  errorCount: number;
  totalDurationMs: number;
  totalTokens: number;
  totalCost: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  protocol: string;
  calls: number;
  errors: number;
  lastActive: number;
}

export const TopologyView: React.FC<TopologyViewProps> = ({ events, onSelectEvent }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Compute Nodes and Edges from Events
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();
    const edgeMap = new Map<string, GraphEdge>();

    events.forEach(ev => {
      const srcName = ev.source.name || 'client';
      const dstName = ev.destination.name || 'service';
      const srcKind = ev.source.kind || 'agent';
      const dstKind = ev.destination.kind || (ev.protocol === 'MODEL' ? 'model' : ev.protocol === 'MCP' ? 'mcp_server' : 'tool');

      // Add/update source node
      if (!nodeMap.has(srcName)) {
        nodeMap.set(srcName, {
          id: srcName,
          name: srcName,
          kind: srcKind,
          x: 0,
          y: 0,
          callCount: 0,
          errorCount: 0,
          totalDurationMs: 0,
          totalTokens: 0,
          totalCost: 0,
        });
      }
      const sNode = nodeMap.get(srcName)!;
      sNode.callCount++;

      // Add/update destination node
      if (!nodeMap.has(dstName)) {
        nodeMap.set(dstName, {
          id: dstName,
          name: dstName,
          kind: dstKind,
          x: 0,
          y: 0,
          callCount: 0,
          errorCount: 0,
          totalDurationMs: 0,
          totalTokens: 0,
          totalCost: 0,
        });
      }
      const dNode = nodeMap.get(dstName)!;
      dNode.callCount++;
      dNode.totalDurationMs += ev.duration_ms;
      if (ev.tokens) dNode.totalTokens += ev.tokens.total_tokens;
      if (ev.cost) dNode.totalCost += ev.cost.amount;
      if (ev.status === 'ERROR' || ev.status === 'TIMEOUT') {
        dNode.errorCount++;
      }

      // Add/update edge
      const edgeKey = `${srcName}->${dstName}`;
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          id: edgeKey,
          source: srcName,
          target: dstName,
          protocol: ev.protocol,
          calls: 0,
          errors: 0,
          lastActive: new Date(ev.timestamp).getTime(),
        });
      }
      const edge = edgeMap.get(edgeKey)!;
      edge.calls++;
      if (ev.status === 'ERROR' || ev.status === 'TIMEOUT') {
        edge.errors++;
      }
    });

    // Layout nodes deterministically into columns based on kind
    const columns: Record<string, GraphNode[]> = {
      clients: [],
      agents: [],
      tools: [],
      models: [],
    };

    nodeMap.forEach(n => {
      if (n.kind === 'client') columns.clients.push(n);
      else if (n.kind === 'agent') columns.agents.push(n);
      else if (n.kind === 'model') columns.models.push(n);
      else columns.tools.push(n);
    });

    const colX = {
      clients: 120,
      agents: 340,
      tools: 580,
      models: 820,
    };

    Object.entries(columns).forEach(([colKey, colNodes]) => {
      const x = colX[colKey as keyof typeof colX] || 400;
      const spacing = 110;
      const startY = 120 + Math.max(0, (4 - colNodes.length) * 40);

      colNodes.forEach((node, i) => {
        node.x = x;
        node.y = startY + i * spacing;
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    };
  }, [events]);

  const getNodeColor = (kind: string) => {
    switch (kind) {
      case 'agent': return '#38bdf8';
      case 'model': return '#34d399';
      case 'tool': return '#fbbf24';
      case 'mcp_server': return '#c084fc';
      default: return '#94a3b8';
    }
  };

  const getEdgeColor = (proto: string) => {
    switch (proto) {
      case 'A2A': return '#38bdf8';
      case 'MCP': return '#c084fc';
      case 'MODEL': return '#34d399';
      case 'TOOL': return '#fbbf24';
      default: return '#64748b';
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 54px)', backgroundColor: 'var(--bg-app)', display: 'flex' }}>
      {/* SVG Canvas */}
      <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox="0 0 1000 700" style={{ cursor: 'grab' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
            </marker>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
            </marker>
          </defs>

          {/* Grid background dots */}
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="1" fill="#1e293b" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Edges */}
          {edges.map(e => {
            const src = nodes.find(n => n.id === e.source);
            const dst = nodes.find(n => n.id === e.target);
            if (!src || !dst) return null;

            const isSelected = selectedEdge?.id === e.id;
            const color = e.errors > 0 ? '#f87171' : getEdgeColor(e.protocol);
            const dx = dst.x - src.x;
            const cx1 = src.x + dx * 0.5;
            const cy1 = src.y;
            const cx2 = src.x + dx * 0.5;
            const cy2 = dst.y;
            const pathData = `M ${src.x} ${src.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${dst.x} ${dst.y}`;

            return (
              <g key={e.id} onClick={() => { setSelectedEdge(e); setSelectedNode(null); }} style={{ cursor: 'pointer' }}>
                <path
                  d={pathData}
                  fill="none"
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 1.5}
                  strokeOpacity={isSelected ? 1 : 0.65}
                  markerEnd={isSelected ? "url(#arrow-active)" : "url(#arrow)"}
                />
                {/* Traffic animation pulse */}
                <circle r="3" fill={color}>
                  <animateMotion path={pathData} dur="3s" repeatCount="indefinite" />
                </circle>
                {/* Edge Label Badge */}
                <rect
                  x={(src.x + dst.x) / 2 - 16}
                  y={(src.y + dst.y) / 2 - 10}
                  width="32"
                  height="20"
                  rx="4"
                  fill="#0f172a"
                  stroke={color}
                  strokeWidth="1"
                />
                <text
                  x={(src.x + dst.x) / 2}
                  y={(src.y + dst.y) / 2 + 4}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fontWeight="bold"
                >
                  {e.calls}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(n => {
            const isSelected = selectedNode?.id === n.id;
            const color = getNodeColor(n.kind);

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => { setSelectedNode(n); setSelectedEdge(null); }}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer Glow on selection */}
                {isSelected && (
                  <rect
                    x="-75"
                    y="-32"
                    width="150"
                    height="64"
                    rx="10"
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    style={{ filter: `drop-shadow(0 0 8px ${color})` }}
                  />
                )}

                {/* Node Box */}
                <rect
                  x="-70"
                  y="-28"
                  width="140"
                  height="56"
                  rx="8"
                  fill="#0e1524"
                  stroke={color}
                  strokeWidth={isSelected ? 2 : 1.2}
                />

                {/* Node Title & Kind */}
                <text
                  x="0"
                  y="-8"
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="var(--font-sans)"
                >
                  {n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name}
                </text>
                <text
                  x="0"
                  y="10"
                  textAnchor="middle"
                  fill={color}
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                  letterSpacing="0.05em"
                >
                  {n.kind.toUpperCase()}
                </text>

                {/* Error badge if any */}
                {n.errorCount > 0 && (
                  <g transform="translate(56, -24)">
                    <circle r="8" fill="#ef4444" />
                    <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
                      {n.errorCount}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend Overlay */}
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          backgroundColor: 'rgba(14, 21, 36, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '8px 14px',
          display: 'flex',
          gap: 16,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#38bdf8' }} />
            <span>Agent (A2A)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#c084fc' }} />
            <span>MCP Server</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#34d399' }} />
            <span>Model (LLM)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#fbbf24' }} />
            <span>Tool</span>
          </div>
        </div>
      </div>

      {/* Inspector Side Drawer */}
      {(selectedNode || selectedEdge) && (
        <aside style={{
          width: 320,
          borderLeft: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              {selectedNode ? 'NODE DETAILS' : 'EDGE DETAILS'}
            </span>
            <button
              onClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}
            >
              ✕
            </button>
          </div>

          {selectedNode && (
            <>
              <div>
                <h3 style={{ fontSize: 18, color: '#f8fafc', fontWeight: 800 }}>{selectedNode.name}</h3>
                <span className={`badge badge-${selectedNode.kind === 'agent' ? 'a2a' : selectedNode.kind === 'model' ? 'model' : 'tool'}`}>
                  {selectedNode.kind.toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Total Calls</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{selectedNode.callCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Total Duration</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{selectedNode.totalDurationMs.toFixed(1)} ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Tokens Spent</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedNode.totalTokens.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Cost</span>
                  <span style={{ color: '#34d399', fontWeight: 600 }}>${selectedNode.totalCost.toFixed(4)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Errors</span>
                  <span style={{ color: selectedNode.errorCount > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: 600 }}>
                    {selectedNode.errorCount}
                  </span>
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ marginTop: 8, justifyContent: 'center' }}
                onClick={() => {
                  const match = events.find(e => e.source.name === selectedNode.name || e.destination.name === selectedNode.name);
                  if (match) onSelectEvent(match);
                }}
              >
                Inspect Recent Packet
              </button>
            </>
          )}

          {selectedEdge && (
            <>
              <div>
                <h4 style={{ fontSize: 14, color: '#f8fafc' }}>{selectedEdge.source} ➔ {selectedEdge.target}</h4>
                <span className="badge badge-mcp" style={{ marginTop: 4 }}>
                  {selectedEdge.protocol}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Calls</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{selectedEdge.calls}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Errors</span>
                  <span style={{ color: selectedEdge.errors > 0 ? '#f87171' : 'var(--text-muted)', fontWeight: 600 }}>
                    {selectedEdge.errors}
                  </span>
                </div>
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  );
};
