import { useState, useRef, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Hook that connects to the SSE streaming endpoint and returns real-time
 * scraper progress steps + final conditions data.
 */
export default function useSSEProgress() {
  const [steps, setSteps] = useState([]);
  const [total, setTotal] = useState(0);
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
    let completed = false;

    es.addEventListener('start', () => {
      // Server acknowledged the stream
    });

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      if (data.total) setTotal(data.total);
      setSteps((prev) => {
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
      completed = true;
      const data = JSON.parse(e.data);
      setFinalData(data);
      setIsStreaming(false);
      es.close();
    });

    es.addEventListener('error', (e) => {
      // Ignore error events that fire after a successful complete
      // (browser fires error when server closes the SSE connection)
      if (completed) return;
      try {
        const data = JSON.parse(e.data);
        setError(data.message || 'Stream failed');
      } catch {
        setError('Connection lost');
      }
      setIsStreaming(false);
      es.close();
    });

    es.onerror = () => {
      if (completed) return;
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

  return { steps, total, isStreaming, finalData, error, startStream, cleanup };
}
