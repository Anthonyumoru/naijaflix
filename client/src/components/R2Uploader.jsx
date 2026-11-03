
import { useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "https://moviebox-backend.umoruanthony345.workers.dev";

const CHUNK_SIZE = 10 * 1024 * 1024;
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1s, 2s, 4s, 8s, 16s

// ── Sleep helper ──────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Check if error is network-related (retryable) ────────────
function isNetworkError(err) {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("networkerror") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("connection") ||
    msg.includes("econnreset") ||
    msg.includes("socket") ||
    msg.includes("dns") ||
    msg.includes("offline") ||
    msg.includes("internet") ||
    msg.includes("load failed")
  );
}

// ── Fetch with auto-retry on network errors ──────────────────
async function fetchWithRetry(url, options, retries = MAX_RETRIES, onRetry) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);

      // If we get a 403/401, don't retry — it's an auth issue
      if (res.status === 401 || res.status === 403) return res;

      // 5xx server errors are also retryable
      if (res.status >= 500 && attempt < retries) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        if (onRetry) onRetry(attempt + 1, delay, `Server error ${res.status}`);
        await sleep(delay);
        continue;
      }

      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isNetworkError(err)) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        if (onRetry) onRetry(attempt + 1, delay, err.message || "Network error");
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function generateThumbnail(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      video.currentTime = video.duration > 3 ? 3 : video.duration * 0.1;
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to generate thumbnail"));
        }
      }, "image/jpeg", 0.8);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load video for thumbnail"));
    };
  });
}

async function uploadSingle(file, onProgress, onRetry) {
  const adminKey = localStorage.getItem("adminKey") || "";
  const filename = encodeURIComponent(file.name);
  const contentType = encodeURIComponent(file.type || "application/octet-stream");

  const res = await fetchWithRetry(
    `${API_URL}/api/upload/single?filename=${filename}&contentType=${contentType}`,
    { method: "POST", body: file, headers: { "x-admin-key": adminKey } },
    MAX_RETRIES,
    onRetry
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Single upload failed");
  }

  const data = await res.json();
  if (onProgress) onProgress(file.size, file.size);
  return data.publicUrl;
}

async function uploadMultipart(file, onProgress, onRetry) {
  const adminKey = localStorage.getItem("adminKey") || "";

  // ── Initiate (with retry) ──────────────────────────────────
  const initRes = await fetchWithRetry(
    `${API_URL}/api/upload/initiate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
      }),
    },
    MAX_RETRIES,
    onRetry
  );

  if (!initRes.ok) throw new Error("Failed to initiate upload");
  const { key, uploadId } = await initRes.json();

  const totalParts = Math.ceil(file.size / CHUNK_SIZE);
  const parts = [];
  let uploadedBytes = 0;

  // ── Upload each part with per-part retry ──────────────────
  for (let i = 0; i < totalParts; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    const partNumber = i + 1;

    let partData = null;
    let partSuccess = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const partRes = await fetch(
          `${API_URL}/api/upload/part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`,
          { method: "POST", body: chunk, headers: { "x-admin-key": adminKey } }
        );

        if (!partRes.ok) {
          // Server error — retry
          if (partRes.status >= 500 && attempt < MAX_RETRIES) {
            const delay = BASE_DELAY * Math.pow(2, attempt);
            if (onRetry) onRetry(attempt + 1, delay, `Part ${partNumber}/${totalParts}: Server error ${partRes.status}`);
            await sleep(delay);
            continue;
          }
          throw new Error(`Part ${partNumber} upload failed: ${partRes.status}`);
        }

        partData = await partRes.json();
        partSuccess = true;
        break;
      } catch (err) {
        if (attempt < MAX_RETRIES && isNetworkError(err)) {
          const delay = BASE_DELAY * Math.pow(2, attempt);
          if (onRetry) onRetry(attempt + 1, delay, `Part ${partNumber}/${totalParts}: ${err.message || "Network error"}`);
          await sleep(delay);
          continue;
        }
        // Exhausted retries — abort the multipart upload
        await fetchWithRetry(
          `${API_URL}/api/upload/abort`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
            body: JSON.stringify({ key, uploadId }),
          },
          2,
          onRetry
        ).catch(() => {});
        throw new Error(`Part ${partNumber}/${totalParts} failed after ${attempt + 1} attempts: ${err.message || "Network error"}`);
      }
    }

    if (!partSuccess || !partData) {
      throw new Error(`Part ${partNumber}/${totalParts} failed to upload`);
    }

    parts.push({ partNumber, etag: partData.etag });
    uploadedBytes += (end - start);
    if (onProgress) onProgress(uploadedBytes, file.size);
  }

  // ── Complete (with retry) ──────────────────────────────────
  const completeRes = await fetchWithRetry(
    `${API_URL}/api/upload/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
      body: JSON.stringify({ key, uploadId, parts }),
    },
    MAX_RETRIES,
    onRetry
  );

  if (!completeRes.ok) throw new Error("Failed to complete upload");
  const completeData = await completeRes.json();
  return completeData.publicUrl;
}

async function smartUpload(file, onProgress, onRetry) {
  if (file.size >= MULTIPART_THRESHOLD) {
    return uploadMultipart(file, onProgress, onRetry);
  } else {
    return uploadSingle(file, onProgress, onRetry);
  }
}

export default function R2Uploader({ onUpload }) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("Nollywood");
  const [showChecklist, setShowChecklist] = useState(false);
  const [retryInfo, setRetryInfo] = useState("");

  const [nfvcbNumber, setNfvcbNumber] = useState("");
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);
  const [check3, setCheck3] = useState(false);
  const [check4, setCheck4] = useState(false);

  const isNollywood = category === "Nollywood";
  const allChecked = check1 && check2 && check3 && check4 && nfvcbNumber.trim().length > 0;
  const canUpload = isNollywood ? allChecked : true;

  const handleRetry = (attempt, delay, reason) => {
    setRetryInfo(`🔄 Network hiccup — retry ${attempt}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s (${reason})`);
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const title = document.getElementById("title").value;
    const desc = document.getElementById("desc").value;
    if (!title) return alert("⚠️ Please add a Movie Title first");

    const adminKey = localStorage.getItem("adminKey") || "";
    if (!adminKey) return alert("⚠️ Admin key required. Tap ⚙️ to set it first.");
    if (isNollywood && !allChecked) return alert("⚠️ Please complete the Nollywood compliance checklist first.");

    setUploading(true);
    setProgress(1);
    setRetryInfo("");

    try {
      let posterUrl = "";
      try {
        setProgress(5);
        const thumbBlob = await generateThumbnail(file);
        const thumbFile = new File([thumbBlob], `${title.replace(/\s+/g, "-")}-thumb.jpg`, {
          type: "image/jpeg",
        });
        posterUrl = await smartUpload(thumbFile, (uploaded, total) => {
          const percent = 5 + Math.round((uploaded / total) * 10);
          setProgress(percent);
        }, handleRetry);
      } catch (err) {
        console.warn("Thumbnail generation failed:", err);
      }

      setRetryInfo("");

      const publicUrl = await smartUpload(file, (uploaded, total) => {
        const percent = 15 + Math.round((uploaded / total) * 80);
        setProgress(percent);
      }, handleRetry);

      setRetryInfo("");

      const saveRes = await fetchWithRetry(
        `${API_URL}/movies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
          body: JSON.stringify({
            title: title,
            description: desc,
            category: category,
            videoUrl: publicUrl,
            posterUrl: posterUrl,
            nfvcbNumber: isNollywood ? nfvcbNumber : "",
            complianceChecks: isNollywood ? { check1, check2, check3, check4 } : null,
            agreedAt: isNollywood ? new Date().toISOString() : null,
          }),
        },
        MAX_RETRIES,
        handleRetry
      );

      const saveData = await saveRes.json();

      if (!saveData.success) {
        throw new Error("Failed to save movie metadata: " + (saveData.error || "Unknown"));
      }

      setProgress(100);
      setRetryInfo("");
      onUpload();
      alert("✅ Upload Complete! Movie is now pending approval.");
      setShowChecklist(false);
      setNfvcbNumber("");
      setCheck1(false);
      setCheck2(false);
      setCheck3(false);
      setCheck4(false);
    } catch (err) {
      console.error("Upload error:", err);
      alert("❌ Upload failed after " + MAX_RETRIES + " retries: " + (err.message || "Unknown error"));
    }

    setProgress(0);
    setUploading(false);
    setRetryInfo("");
    document.getElementById("title").value = "";
    document.getElementById("desc").value = "";
    e.target.value = "";
  };

  const checkboxStyle = { width: "20px", height: "20px", cursor: "pointer", marginTop: "2px", flexShrink: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", padding: "15px", background: "var(--card)", borderRadius: "8px" }}>
      <h3>📤 Upload New Movie</h3>
      <input id="title" type="text" placeholder="Movie Title - REQUIRED" style={{ padding: "10px", borderRadius: "6px" }} />

      <select value={category} onChange={(e) => { setCategory(e.target.value); setShowChecklist(false); }} style={{ padding: "10px", borderRadius: "6px" }}>
        <option>Nollywood</option>
        <option>Church Program</option>
        <option>Comedy</option>
        <option>Music Video</option>
        <option>Shorts</option>
        <option>Drama</option>
      </select>

      <input id="desc" type="text" placeholder="Short Description" style={{ padding: "10px", borderRadius: "6px" }} />

      {isNollywood && (
        <>
          <button
            onClick={() => setShowChecklist(!showChecklist)}
            style={{
              padding: "12px",
              background: allChecked ? "#4caf50" : "var(--red)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            {allChecked ? "✅ Compliance Verified" : "📋 Complete Compliance Checklist (Required)"}
          </button>

          {showChecklist && (
            <div style={{ background: "var(--bg)", borderRadius: "8px", padding: "16px", border: "1px solid var(--border)", fontSize: "13px", lineHeight: "1.6" }}>
              <h4 style={{ fontSize: "15px", marginBottom: "12px", color: "var(--red)" }}>🎬 NaijaFlix Nollywood Content Checklist</h4>

              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                  <input type="checkbox" checked={check1} onChange={(e) => setCheck1(e.target.checked)} style={checkboxStyle} />
                  <div>
                    <b>1. NFVCB Classification</b><br />
                    <span style={{ color: "#888" }}>I confirm this movie has been reviewed and classified by the NFVCB for public distribution in Nigeria.</span>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Enter NFVCB Certificate/Classification Number *"
                  value={nfvcbNumber}
                  onChange={(e) => setNfvcbNumber(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)", boxSizing: "border-box", marginTop: "4px" }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input type="checkbox" checked={check2} onChange={(e) => setCheck2(e.target.checked)} style={checkboxStyle} />
                <div>
                  <b>2. Soundtrack & Audio Rights</b><br />
                  <span style={{ color: "#888" }}>I certify all background music, sound effects, and soundtracks are original, public domain, or fully licensed for commercial streaming.</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input type="checkbox" checked={check3} onChange={(e) => setCheck3(e.target.checked)} style={checkboxStyle} />
                <div>
                  <b>3. Production & Ownership Rights</b><br />
                  <span style={{ color: "#888" }}>I warrant I am the Executive Producer, Director, or authorized distributor. This movie is not locked under an exclusive contract with Netflix, Prime Video, Showmax, or a cinema chain.</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                <input type="checkbox" checked={check4} onChange={(e) => setCheck4(e.target.checked)} style={checkboxStyle} />
                <div>
                  <b>4. NaijaFlix Terms of Distribution</b><br />
                  <span style={{ color: "#888" }}>I understand this binds me to the Non-Exclusive Digital Creator Distribution Agreement. If this movie generates zero ad impressions, my payout will be ₦0.00.</span>
                </div>
              </div>

              {!allChecked && (
                <p style={{ fontSize: "12px", color: "#ff9800", textAlign: "center" }}>⚠️ All boxes must be checked and NFVCB number entered to upload.</p>
              )}
              {allChecked && (
                <p style={{ fontSize: "12px", color: "#4caf50", textAlign: "center" }}>✅ Compliance verified! You can now upload.</p>
              )}
            </div>
          )}
        </>
      )}

      {retryInfo && (
        <div style={{ padding: "10px 12px", background: "rgba(255, 152, 0, 0.1)", border: "1px solid rgba(255, 152, 0, 0.3)", borderRadius: "6px", fontSize: "12px", color: "#ff9800", textAlign: "center" }}>
          {retryInfo}
        </div>
      )}

      <label style={{
        padding: "14px",
        background: uploading ? "#666" : (canUpload ? "var(--red)" : "#444"),
        color: "white",
        borderRadius: "6px",
        textAlign: "center",
        cursor: canUpload && !uploading ? "pointer" : "not-allowed",
        fontWeight: "bold",
        opacity: canUpload || uploading ? 1 : 0.5,
      }}>
        {uploading ? `⬆️ Uploading... ${progress}%` : (isNollywood && !canUpload) ? "🔒 Complete checklist to unlock upload" : "📁 Tap To Choose Video From Phone"}
        <input type="file" accept="video/*" onChange={handleFile} disabled={uploading || !canUpload} style={{ display: "none" }} />
      </label>
    </div>
  );
}
