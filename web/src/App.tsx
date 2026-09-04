import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { TopologyView } from './components/TopologyView';
import { TimelineWaterfall } from './components/TimelineWaterfall';
import { PacketsList } from './components/PacketsList';
import { PacketInspector } from './components/PacketInspector';
import { FlamegraphView } from './components/FlamegraphView';
import { FindingsView } from './components/FindingsView';
import { DiffView } from './components/DiffView';
import { MetadataView } from './components/MetadataView';
import { APCAPEvent, Manifest, CaptureMetadata, Finding, CriticalPathReport } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('topology');
  const [events, setEvents] = useState<APCAPEvent[]>([]);
  const [manifest, setManifest] = useState<Manifest | undefined>();
  const [metadata, setMetadata] = useState<CaptureMetadata | undefined>();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [criticalPath, setCriticalPath] = useState<CriticalPathReport | undefined>();
  const [selectedEvent, setSelectedEvent] = useState<APCAPEvent | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  // Fetch initial session state
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/session');
      if (res.ok) {
        const data = await res.json();
        if (data.manifest) setManifest(data.manifest);
        if (data.metadata) setMetadata(data.metadata);
        if (data.events) setEvents(data.events);
      }
    } catch {
      // Offline / standalone mode fallback
    }

    try {
      const fRes = await fetch('/api/findings');
      if (fRes.ok) {
        const fData = await fRes.json();
        setFindings(fData);
      }
    } catch {}

    try {
      const cpRes = await fetch('/api/critical-path');
      if (cpRes.ok) {
        const cpData = await cpRes.json();
        setCriticalPath(cpData);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSession();

    // Setup Live SSE stream
    const eventSource = new EventSource('/api/stream');
    eventSource.onopen = () => setIsLive(true);
    eventSource.onmessage = (e) => {
      try {
        const newEv: APCAPEvent = JSON.parse(e.data);
        setEvents(prev => [...prev, newEv]);

        // Refresh findings periodically or after events
        fetchSession();
      } catch {}
    };
    eventSource.onerror = () => {
      setIsLive(false);
    };

    return () => {
      eventSource.close();
    };
  }, [fetchSession]);

  // Handle Drag & Drop of .apcap file
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          fetchSession();
        }
      } catch (err) {
        console.error('Failed uploading .apcap', err);
      }
    }
  };

  const handleOpenFileInput = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.apcap';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (res.ok) fetchSession();
      } catch (err) {
        console.error('Failed uploading file', err);
      }
    };
    input.click();
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-app)',
        position: 'relative',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Top Header Navigation */}
      <Header
        manifest={manifest}
        metadata={metadata}
        findings={findings}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isLive={isLive}
        onOpenFile={handleOpenFileInput}
      />

      {/* Main View Area */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {activeTab === 'topology' && (
          <TopologyView events={events} onSelectEvent={setSelectedEvent} />
        )}
        {activeTab === 'timeline' && (
          <TimelineWaterfall
            events={events}
            criticalPath={criticalPath}
            onSelectEvent={setSelectedEvent}
            selectedEventId={selectedEvent?.id}
          />
        )}
        {activeTab === 'packets' && (
          <PacketsList
            events={events}
            onSelectEvent={setSelectedEvent}
            selectedEventId={selectedEvent?.id}
          />
        )}
        {activeTab === 'flamegraph' && (
          <FlamegraphView events={events} />
        )}
        {activeTab === 'findings' && (
          <FindingsView
            findings={findings}
            events={events}
            onSelectEvent={setSelectedEvent}
          />
        )}
        {activeTab === 'diff' && (
          <DiffView />
        )}
        {activeTab === 'metadata' && (
          <MetadataView manifest={manifest} metadata={metadata} />
        )}

        {/* Slide-over Packet Inspector */}
        <PacketInspector
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />

        {/* Drag and drop overlay */}
        {dragOver && (
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(8, 12, 20, 0.88)',
            border: '2px dashed #38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            fontSize: 18,
            fontWeight: 700,
            color: '#38bdf8',
            fontFamily: 'var(--font-mono)',
          }}>
            Drop .apcap capture file to inspect
          </div>
        )}
      </main>
    </div>
  );
};
export default App;
