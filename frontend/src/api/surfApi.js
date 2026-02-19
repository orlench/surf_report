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
 * @param {Object} options - Optional params
 * @param {boolean} options.refresh - Force fetch fresh data (bypass cache)
 * @param {number} options.weight - User weight in kg (for board volume)
 * @param {string} options.skill - User skill level (for board volume)
 */
export async function fetchConditions(spotId, options = {}) {
  const url = `${API_BASE}/conditions/${spotId}`;
  const params = {};
  if (options.refresh) params.refresh = 'true';
  if (options.weight) params.weight = options.weight;
  if (options.skill) params.skill = options.skill;
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
 * Fetch conditions for a custom spot by coordinates
 */
export async function fetchConditionsByCoords(lat, lon, name, country, options = {}) {
  const params = { lat, lon, name, country };
  if (options.weight) params.weight = options.weight;
  if (options.skill) params.skill = options.skill;
  const response = await axios.get(`${API_BASE}/conditions/custom`, { params });
  return response.data;
}

/**
 * Save a user-discovered spot to the backend
 */
export async function createSpot({ name, lat, lon, country, region }) {
  const response = await axios.post(`${API_BASE}/spots`, { name, lat, lon, country, region });
  return response.data;
}

/**
 * Fetch API health status
 */
export async function fetchHealth() {
  const response = await axios.get(`${API_BASE}/health`);
  return response.data;
}
