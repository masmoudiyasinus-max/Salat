/**
 * audioStorage.js - IndexedDB and LocalStorage Service for Audio Player & Local Folder Library
 * Local-First, 100% Client-Side, Zero External Uploads
 */

import { logError } from './errorLogger.js';

const DB_NAME = 'HabitTracker_AudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'audio_tracks';

const STORAGE_KEY_PLAYER_STATE = 'prayer_tracker_audio_player_state_v1';
export const AUDIO_EVENTS = {
  STATE_UPDATED: 'prayer_tracker_audio_state_updated',
  PLAYBACK_STARTED: 'prayer_tracker_audio_playback_started',
  PLAYBACK_STOPPED: 'prayer_tracker_audio_playback_stopped',
};

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'wav',
  'aac',
  'ogg',
  'flac',
  'opus',
  'wma',
  'mp4',
  'webm',
]);

/**
 * Checks if a filename or path matches supported audio file formats.
 */
export function isAudioFile(filename = '') {
  if (!filename || typeof filename !== 'string') return false;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_AUDIO_EXTENSIONS.has(ext);
}

/**
 * Natural Alphanumeric String Sorter (e.g. 01, 02, ... 10 or 1, 2, ... 10)
 */
export function naturalSortTracks(tracks = []) {
  return [...tracks].sort((a, b) => {
    return (a.name || a.title || '').localeCompare(b.name || b.title || '', undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

/**
 * Clean track title by stripping common prefixes and extension
 */
export function formatTrackTitle(filename = '') {
  if (!filename || typeof filename !== 'string') return 'مقطع صوتي';
  // Remove file extension
  let clean = filename.replace(/\.[^/.]+$/, '');
  // Remove leading folder path if any
  clean = clean.split(/[/\\]/).pop() || clean;
  // Replace leading numbering separators like "001_Al-Fatiha" -> "001 - Al-Fatiha"
  clean = clean.replace(/^([0-9]+)[-_.\s]+/, '$1 - ');
  return clean.trim() || filename;
}

/**
 * Format bytes to readable size (KB, MB, GB)
 */
export function formatFileSize(bytes = 0) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export function formatAudioDuration(seconds = 0) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSec = Math.floor(seconds);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Open or initialize the IndexedDB database for audio
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (e) => {
      resolve(e.target.result);
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

/**
 * Saves a list of audio files (File objects from input or drag-drop) to IndexedDB
 */
export async function saveAudioFilesToDB(files = [], libraryLabel = '') {
  if (!Array.isArray(files) || files.length === 0) return getStoredAudioTracks();
  const db = await openDB();

  const now = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!isAudioFile(file.name)) continue;

    const id = `track_${now}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    const relativePath = file.webkitRelativePath || file.name;
    const cleanTitle = formatTrackTitle(file.name);

    // Read file data buffer
    const arrayBuffer = await file.arrayBuffer();

    const record = {
      id,
      name: file.name,
      title: cleanTitle,
      relativePath,
      size: file.size,
      type: file.type || 'audio/mpeg',
      lastModified: file.lastModified || now,
      dateAdded: now,
      data: arrayBuffer,
    };

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Retrieve full updated list of stored tracks from IndexedDB
  const allStored = await getStoredAudioTracks();
  if (allStored.length > 0) {
    const currentState = getAudioPlayerState();
    const resolvedLabel = libraryLabel || currentState.folderName || 'المكتبة الصوتية';
    saveAudioPlayerState({
      ...currentState,
      folderName: resolvedLabel,
      activeTrackId: currentState.activeTrackId && allStored.some((t) => t.id === currentState.activeTrackId)
        ? currentState.activeTrackId
        : allStored[0].id,
    });
  }

  return allStored;
}

/**
 * Retrieves all stored audio track metadata (without loading giant ArrayBuffers into memory)
 */
export async function getStoredAudioTracks() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = req.result || [];
        const metadataList = records.map((r) => ({
          id: r.id,
          name: r.name,
          title: r.title || formatTrackTitle(r.name),
          relativePath: r.relativePath || r.name,
          size: r.size || 0,
          type: r.type || 'audio/mpeg',
          dateAdded: r.dateAdded || Date.now(),
        }));
        resolve(naturalSortTracks(metadataList));
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('getStoredAudioTracks', err);
    return [];
  }
}

/**
 * Retrieves the audio Blob for a specific track id
 */
export async function getAudioTrackBlob(trackId) {
  if (!trackId) return null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackId);

      req.onsuccess = () => {
        const record = req.result;
        if (!record || !record.data) {
          resolve(null);
          return;
        }
        const blob = new Blob([record.data], { type: record.type || 'audio/mpeg' });
        resolve(blob);
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('getAudioTrackBlob', err);
    return null;
  }
}

/**
 * Removes a single track from IndexedDB
 */
export async function removeAudioTrack(trackId) {
  if (!trackId) return false;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(trackId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('removeAudioTrack', err);
    return false;
  }
}

/**
 * Updates a track's display title in IndexedDB
 */
export async function updateAudioTrackTitle(trackId, newTitle) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(trackId);

      getReq.onsuccess = () => {
        const record = getReq.result;
        if (!record) {
          resolve(false);
          return;
        }
        record.title = (newTitle && newTitle.trim()) || record.name;
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve(true);
        putReq.onerror = () => reject(putReq.error);
      };

      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    logError('updateAudioTrackTitle', err);
    return false;
  }
}

/**
 * Clears all audio tracks and database contents
 */
export async function clearAudioLibraryDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => {
        saveAudioPlayerState({
          activeTrackId: null,
          folderName: '',
          currentTime: 0,
          isPlaying: false,
        });
        resolve(true);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    logError('clearAudioLibraryDB', err);
    return false;
  }
}

/**
 * Get the saved audio player preferences/state from localStorage
 */
export function getAudioPlayerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLAYER_STATE);
    if (!raw) {
      return {
        activeTrackId: null,
        folderName: '',
        currentTime: 0,
        repeatMode: 'all', // 'off' | 'all' | 'one'
        isShuffle: false,
        isPlaylistExpanded: true,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      isPlaylistExpanded: true,
      ...parsed,
    };
  } catch {
    return {
      activeTrackId: null,
      folderName: '',
      currentTime: 0,
      repeatMode: 'all',
      isShuffle: false,
      isPlaylistExpanded: true,
    };
  }
}

/**
 * Save audio player state to localStorage and notify listeners
 */
export function saveAudioPlayerState(stateUpdates = {}) {
  try {
    const current = getAudioPlayerState();
    const merged = { ...current, ...stateUpdates };
    localStorage.setItem(STORAGE_KEY_PLAYER_STATE, JSON.stringify(merged));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent(AUDIO_EVENTS.STATE_UPDATED, { detail: merged }));
    }
    return merged;
  } catch (err) {
    logError('saveAudioPlayerState', err);
    return stateUpdates;
  }
}
