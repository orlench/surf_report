/**
 * Resolves paths for mutable data files.
 * In production with GCS FUSE mount: /mnt/data/<file>
 * In development: ./data/<file> (relative to backend root)
 */
const path = require('path');

const PERSISTENT_DIR = process.env.PERSISTENT_DATA_DIR || path.join(__dirname, '../../data');

function resolve(filename) {
  return path.join(PERSISTENT_DIR, filename);
}

module.exports = { resolve, PERSISTENT_DIR };
