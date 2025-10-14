/**
 * IndexedDB utilities for storing FileSystemDirectoryHandle
 * FileSystemDirectoryHandle cannot be stored in localStorage due to browser security,
 * so we use IndexedDB which supports structured cloning of these objects.
 */

const DB_NAME = 'genlayer-explorer-db';
const DB_VERSION = 1;
const STORE_NAME = 'config';
const FOLDER_HANDLE_KEY = 'abisFolderHandle';

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
    // @ts-ignore - File System Access API
    const permission = await handle.queryPermission({ mode: 'read' });

    if (permission === 'granted') {
      return true;
    }

    // @ts-ignore - File System Access API
    const requestResult = await handle.requestPermission({ mode: 'read' });
    return requestResult === 'granted';
  } catch (error) {
    console.error('Error requesting folder permission:', error);
    return false;
  }
}
