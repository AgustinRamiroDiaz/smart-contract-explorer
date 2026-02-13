/**
 * IndexedDB utilities for storing FileSystemDirectoryHandle
 * FileSystemDirectoryHandle cannot be stored in localStorage due to browser security,
 * so we use IndexedDB which supports structured cloning of these objects.
 */

const DB_NAME = 'genlayer-explorer-db';
const DB_VERSION = 1;
const STORE_NAME = 'config';
const FOLDER_HANDLE_KEY = 'abisFolderHandle';
const FILE_HANDLE_KEY = 'deploymentsFileHandle';

/**
 * Opens or creates the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Saves the folder handle to IndexedDB
 */
export async function saveFolderHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, FOLDER_HANDLE_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Retrieves the folder handle from IndexedDB
 */
export async function getFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(FOLDER_HANDLE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  } catch (error) {
    console.error('Error getting folder handle:', error);
    return null;
  }
}

/**
 * Clears the saved folder handle
 */
export async function clearFolderHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(FOLDER_HANDLE_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Requests permission for a saved folder handle
 * Returns true if permission granted, false otherwise
 */
export async function requestFolderPermission(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    // @ts-expect-error - File System Access API
    const permission = await handle.queryPermission({ mode: 'read' });

    if (permission === 'granted') {
      return true;
    }

    // @ts-expect-error - File System Access API
    const requestResult = await handle.requestPermission({ mode: 'read' });
    return requestResult === 'granted';
  } catch (error) {
    console.error('Error requesting folder permission:', error);
    return false;
  }
}

/**
 * Saves the deployments file handle to IndexedDB
 */
export async function saveFileHandle(
  handle: FileSystemFileHandle
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, FILE_HANDLE_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Retrieves the deployments file handle from IndexedDB
 */
export async function getFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(FILE_HANDLE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  } catch (error) {
    console.error('Error getting file handle:', error);
    return null;
  }
}

/**
 * Clears the saved file handle
 */
export async function clearFileHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(FILE_HANDLE_KEY);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Requests permission for a saved file handle
 * Returns true if permission granted, false otherwise
 */
export async function requestFilePermission(
  handle: FileSystemFileHandle
): Promise<boolean> {
  try {
    // @ts-expect-error - File System Access API
    const permission = await handle.queryPermission({ mode: 'read' });

    if (permission === 'granted') {
      return true;
    }

    // @ts-expect-error - File System Access API
    const requestResult = await handle.requestPermission({ mode: 'read' });
    return requestResult === 'granted';
  } catch (error) {
    console.error('Error requesting file permission:', error);
    return false;
  }
}

/**
 * Reads and parses JSON from a file handle
 */
export async function readJsonFile<T = Record<string, unknown>>(
  handle: FileSystemFileHandle
): Promise<T> {
  const file = await handle.getFile();
  const text = await file.text();
  return JSON.parse(text) as T;
}
