async function waitForSW() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Workers not supported in this browser");
  }
  if (!navigator.serviceWorker.controller) {
    await navigator.serviceWorker.register("/sw.js");
    await new Promise((resolve) => {
      if (navigator.serviceWorker.controller) return resolve();
      navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
    });
  }
  return navigator.serviceWorker.controller;
}

function buildStreamUrl(videoUrl) {
  if (videoUrl && videoUrl.includes("moviebox-stream.umoruanthony345.workers.dev")) {
    return videoUrl;
  }
  const STREAM_URL = "https://moviebox-stream.umoruanthony345.workers.dev/video?url=";
  return STREAM_URL + encodeURIComponent(videoUrl);
}

export async function downloadVideo(videoUrl, title, options = {}) {
  const sw = await waitForSW();
  const fullUrl = buildStreamUrl(videoUrl);
  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const msg = event.data;
      if (msg.url !== fullUrl) return;
      if (msg.type === "DOWNLOAD_COMPLETE") {
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve(msg);
      } else if (msg.type === "DOWNLOAD_ERROR") {
        navigator.serviceWorker.removeEventListener("message", handler);
        reject(new Error(msg.error));
      } else if (msg.type === "DOWNLOAD_PROGRESS" && options.onProgress) {
        options.onProgress(msg.progress);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    sw.postMessage({ type: "DOWNLOAD_VIDEO", url: fullUrl, title: title || videoUrl });
  });
}

export async function getCachedVideos() {
  const sw = await waitForSW();
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.data.type === "CACHED_VIDEOS_LIST") {
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve(event.data.videos || []);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    sw.postMessage({ type: "GET_CACHED_VIDEOS" });
  });
}

export async function isVideoCached(videoUrl) {
  const sw = await waitForSW();
  const fullUrl = buildStreamUrl(videoUrl);
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.data.type === "VIDEO_CHECK_RESULT" && event.data.url === fullUrl) {
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve(event.data.cached);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    sw.postMessage({ type: "CHECK_VIDEO", url: fullUrl });
  });
}

export async function deleteCachedVideo(videoUrl) {
  const sw = await waitForSW();
  const fullUrl = buildStreamUrl(videoUrl);
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.data.type === "VIDEO_DELETED" && event.data.url === fullUrl) {
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    sw.postMessage({ type: "DELETE_VIDEO", url: fullUrl });
  });
}

export async function clearAllCachedVideos() {
  const sw = await waitForSW();
  return new Promise((resolve) => {
    const handler = (event) => {
      if (event.data.type === "ALL_VIDEOS_CLEARED") {
        navigator.serviceWorker.removeEventListener("message", handler);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    sw.postMessage({ type: "CLEAR_ALL_VIDEOS" });
  });
}
