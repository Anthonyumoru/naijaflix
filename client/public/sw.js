const CACHE_NAME = "naijaflix-v2";
const ASSETS = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];
const DB_NAME = "naijaflix-encrypted";
const DB_VERSION = 1;
const STORE_VIDEOS = "videos";
const STORE_CHUNKS = "chunks";
const STORE_KEYS = "keys";
const CHUNK_SIZE = 5 * 1024 * 1024;
const VIDEO_HOSTS = ["moviebox-stream.umoruanthony345.workers.dev"];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
        db.createObjectStore(STORE_VIDEOS, { keyPath: "url" });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const store = db.createObjectStore(STORE_CHUNKS, { keyPath: ["url", "index"] });
        store.createIndex("byUrl", "url", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGetAll(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(db, store, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbDelete(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbClearByIndex(db, store, indexName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const idx = tx.objectStore(store).index(indexName);
    const req = idx.openCursor(IDBKeyRange.only(value));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getMasterKey() {
  const db = await openDB();
  const existing = await dbGet(db, STORE_KEYS, "master-key");
  if (existing) return existing.key;
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  await dbPut(db, STORE_KEYS, { id: "master-key", key });
  return key;
}

async function encryptChunk(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv, encrypted: new Uint8Array(encrypted) };
}

async function decryptChunk(key, iv, encryptedData) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    encryptedData
  );
  return new Uint8Array(decrypted);
}

async function downloadAndEncryptVideo(url, title, sendProgress) {
  const db = await openDB();
  const key = await getMasterKey();
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch video: " + response.status);
  const contentType = response.headers.get("Content-Type") || "video/mp4";
  const totalSize = parseInt(response.headers.get("Content-Length") || "0", 10);
  const reader = response.body.getReader();
  let chunkIndex = 0;
  let offset = 0;
  let totalReceived = 0;
  let buffer = new Uint8Array(CHUNK_SIZE);
  let bufferLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (bufferLen + value.length > buffer.length) {
      const newBuf = new Uint8Array(Math.max(buffer.length, bufferLen + value.length) * 2);
      newBuf.set(buffer.subarray(0, bufferLen));
      buffer = newBuf;
    }
    buffer.set(value, bufferLen);
    bufferLen += value.length;
    totalReceived += value.length;
    while (bufferLen >= CHUNK_SIZE) {
      const chunkData = buffer.subarray(0, CHUNK_SIZE);
      const { iv, encrypted } = await encryptChunk(key, chunkData);
      await dbPut(db, STORE_CHUNKS, {
        url, index: chunkIndex, iv: Array.from(iv), data: encrypted, offset, length: CHUNK_SIZE,
      });
      chunkIndex++;
      offset += CHUNK_SIZE;
      const remaining = buffer.subarray(CHUNK_SIZE);
      buffer = new Uint8Array(Math.max(CHUNK_SIZE, remaining.length * 2));
      buffer.set(remaining);
      bufferLen = remaining.length;
    }
    if (sendProgress && totalSize > 0) {
      sendProgress(totalReceived / totalSize);
    }
  }
  if (bufferLen > 0) {
    const chunkData = buffer.subarray(0, bufferLen);
    const { iv, encrypted } = await encryptChunk(key, chunkData);
    await dbPut(db, STORE_CHUNKS, {
      url, index: chunkIndex, iv: Array.from(iv), data: encrypted, offset, length: bufferLen,
    });
    chunkIndex++;
    offset += bufferLen;
  }
  await dbPut(db, STORE_VIDEOS, {
    url, title: title || url, size: offset, chunkCount: chunkIndex, contentType, createdAt: Date.now(),
  });
  if (sendProgress) sendProgress(1);
  return { url, title, size: offset, chunkCount: chunkIndex };
}

async function serveCachedVideo(request) {
  const url = request.url;
  const db = await openDB();
  const meta = await dbGet(db, STORE_VIDEOS, url);
  if (!meta) return null;
  const key = await getMasterKey();
  const allChunks = await dbGetAll(db, STORE_CHUNKS);
  const chunks = allChunks.filter((c) => c.url === url).sort((a, b) => a.index - b.index);
  const decryptedParts = [];
  for (const chunk of chunks) {
    const decrypted = await decryptChunk(key, new Uint8Array(chunk.iv), chunk.data);
    decryptedParts.push(decrypted);
  }
  const totalLength = decryptedParts.reduce((sum, p) => sum + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let pos = 0;
  for (const part of decryptedParts) {
    combined.set(part, pos);
    pos += part.length;
  }
  const range = request.headers.get("Range");
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : totalLength - 1;
      const slice = combined.subarray(start, end + 1);
      return new Response(slice, {
        status: 206,
        headers: {
          "Content-Type": meta.contentType,
          "Content-Range": "bytes " + start + "-" + end + "/" + totalLength,
          "Accept-Ranges": "bytes",
          "Content-Length": slice.length,
          "Cache-Control": "no-store",
        },
      });
    }
  }
  return new Response(combined, {
    status: 200,
    headers: {
      "Content-Type": meta.contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": totalLength,
      "Cache-Control": "no-store",
    },
  });
}

function isVideoRequest(url) {
  try {
    const parsed = new URL(url);
    return VIDEO_HOSTS.some((host) => parsed.hostname === host);
  } catch {
    return false;
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await getMasterKey();
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const request = e.request;
  if (request.method !== "GET") return;
  if (isVideoRequest(request.url)) {
    e.respondWith(
      (async () => {
        const cached = await serveCachedVideo(request);
        if (cached) return cached;
        return fetch(request).catch(() => new Response("Offline and not cached", { status: 503 }));
      })()
    );
    return;
  }
  e.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((response) => {
            if (request.url.startsWith(self.location.origin)) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match("/index.html"))
      );
    })
  );
});

self.addEventListener("message", (e) => {
  const { type, url, title } = e.data || {};
  const clientId = e.source && e.source.id;
  const sendProgress = (progress) => {
    if (clientId) {
      self.clients.get(clientId).then((client) => {
        if (client) client.postMessage({ type: "DOWNLOAD_PROGRESS", url, progress });
      });
    }
  };
  switch (type) {
    case "DOWNLOAD_VIDEO":
      e.waitUntil(
        (async () => {
          try {
            const result = await downloadAndEncryptVideo(url, title, sendProgress);
            if (clientId) {
              const client = await self.clients.get(clientId);
              if (client) client.postMessage({ type: "DOWNLOAD_COMPLETE", ...result });
            }
          } catch (err) {
            if (clientId) {
              const client = await self.clients.get(clientId);
              if (client) client.postMessage({ type: "DOWNLOAD_ERROR", url, error: err.message });
            }
          }
        })()
      );
      break;
    case "GET_CACHED_VIDEOS":
      e.waitUntil(
        (async () => {
          const db = await openDB();
          const videos = await dbGetAll(db, STORE_VIDEOS);
          e.source.postMessage({ type: "CACHED_VIDEOS_LIST", videos });
        })()
      );
      break;
    case "DELETE_VIDEO":
      e.waitUntil(
        (async () => {
          const db = await openDB();
          await dbClearByIndex(db, STORE_CHUNKS, "byUrl", url);
          await dbDelete(db, STORE_VIDEOS, url);
          e.source.postMessage({ type: "VIDEO_DELETED", url });
        })()
      );
      break;
    case "CHECK_VIDEO":
      e.waitUntil(
        (async () => {
          const db = await openDB();
          const meta = await dbGet(db, STORE_VIDEOS, url);
          e.source.postMessage({ type: "VIDEO_CHECK_RESULT", url, cached: !!meta, meta });
        })()
      );
      break;
    case "CLEAR_ALL_VIDEOS":
      e.waitUntil(
        (async () => {
          const db = await openDB();
          const tx1 = db.transaction(STORE_CHUNKS, "readwrite");
          tx1.objectStore(STORE_CHUNKS).clear();
          await new Promise((r) => { tx1.oncomplete = r; });
          const tx2 = db.transaction(STORE_VIDEOS, "readwrite");
          tx2.objectStore(STORE_VIDEOS).clear();
          await new Promise((r) => { tx2.oncomplete = r; });
          e.source.postMessage({ type: "ALL_VIDEOS_CLEARED" });
        })()
      );
      break;
  }
});
