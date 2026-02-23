import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Fetch the VAPID public key from the backend.
 */
export async function fetchVapidKey() {
  const response = await axios.get(`${API_BASE}/push/vapid-public-key`);
  return response.data.key;
}

/**
 * Subscribe to push notifications for a spot.
 */
export async function subscribePush(subscription, spotId, threshold) {
  const response = await axios.post(`${API_BASE}/push/subscribe`, {
    subscription,
    spotId,
    threshold
  });
  return response.data;
}

/**
 * Unsubscribe from push notifications for a spot.
 */
export async function unsubscribePush(endpoint, spotId) {
  const response = await axios.post(`${API_BASE}/push/unsubscribe`, {
    endpoint,
    spotId
  });
  return response.data;
}

/**
 * Convert a base64-encoded VAPID key to a Uint8Array for the Push API.
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
