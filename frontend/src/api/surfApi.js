import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Fetch all available surf spots
 */
export async function fetchSpots() {
  const response = await axios.get(`${API_BASE}/spots`);
  return response.data.spots;
}

/**
 * Fetch conditions for a specific spot
 *
 * @param {string} spotId - Spot identifier
 * @param {boolean} refresh - Force fetch fresh data (bypass cache)
 */
export async function fetchConditions(spotId, refresh = false) {
  const url = `${API_BASE}/conditions/${spotId}`;
  const params = refresh ? { refresh: 'true' } : {};
  const response = await axios.get(url, { params });
  return response.data;
}

/**
 * Fetch conditions for all spots
 */
export async function fetchAllConditions() {
  const response = await axios.get(`${API_BASE}/conditions`);
  return response.data;
}

/**
 * Fetch API health status
 */
export async function fetchHealth() {
  const response = await axios.get(`${API_BASE}/health`);
  return response.data;
}
