import { useState, useRef, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Hook that connects to the SSE streaming endpoint and returns real-time
 * scraper progress steps + final conditions data.
 */
export default function useSSEProgress() {
  const [steps, setSteps] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [finalData, setFinalData] = useState(null);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  const startStream = useCallback((spotId) => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setSteps([]);
    setFinalData(null);
    setError(null);
    setIsStreaming(true);

    const es = new EventSource(`${API_BASE}/conditions/${spotId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('start', (e) => {
      // Server acknowledged the stream, nothing to render yet
    });

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setSteps((prev) => {
        // Avoid duplicates by scraper name
        if (prev.find((s) => s.name === data.name)) return prev;
        return [
          ...prev,
          {
            name: data.name,
            label: data.label,
            status: data.success ? 'done' : 'failed',
            snippet: data.snippet,
          },
        ];
      });
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setFinalData(data);
      setIsStreaming(false);
      es.close();
    });

    es.addEventListener('error', (e) => {
      // SSE 'error' event can be a server-sent error or a connection failure
      try {
        const data = JSON.parse(e.data);
        setError(data.message || 'Stream failed');
      } catch {
        setError('Connection lost');
      }
      setIsStreaming(false);
      es.close();
    });

    // Browser-level connection error
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      setError('Connection lost');
      setIsStreaming(false);
      es.close();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return { steps, isStreaming, finalData, error, startStream, cleanup };
}
