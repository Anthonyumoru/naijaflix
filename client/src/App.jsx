import { useState, useEffect } from 'react';
import R2Uploader from './components/R2Uploader';
import CastButton from './components/CastButton';
import Settings from './components/Settings';
import axios from 'axios';
import Help from './components/Help';
const API_URL = import.meta.env.VITE_API_URL || "https://moviebox-backend.umoruanthony345.workers.dev";
const TIPS_API = "https://naijaflix-tips.umoruanthony345.workers.dev";
const STREAM_URL = "https://moviebox-stream.umoruanthony345.workers.dev/video?url=";
const AUTH_API = "https://auth.naijaflix.site";

// Get token from localStorage (works in both browser and APK)
const getToken = () => localStorage.getItem("naijaflix_token");

const VerifiedBadge = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: "0", display: "inline-block", verticalAlign: "middle" }}>
    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.71 3.998 3.818 3.998.47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.787 3.818-3.998 0-.174-.012-.344-.033-.514 1.16-.688 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" fill="#1DA1F2"/>
  </svg>
);

function App() {
  const [movies, setMovies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [mood, setMood] = useState("");
  const [dark, setDark] = useState(localStorage.getItem("theme") === "dark");
  const [loading, setLoading] = useState(true);
  const [showRequests, setShowRequests] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqCategory, setReqCategory] = useState("Nollywood");
  const [reqDesc, setReqDesc] = useState("");
  const [continueWatching, setContinueWatching] = useState([]);

  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [profilePic, setProfilePic] = useState("");

  const [adminKey, setAdminKey] = useState(localStorage.getItem("adminKey") || "");
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");

  const [likedMovies, setLikedMovies] = useState(JSON.parse(localStorage.getItem("likedMovies") || "[]"));
  const [showComments, setShowComments] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [allComments, setAllComments] = useState({});
  const [likeCounts, setLikeCounts] = useState({});

  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [appSettings, setAppSettings] = useState(JSON.parse(localStorage.getItem("appSettings") || '{"notifications":false,"pidgin":false,"familyMode":false,"bgDownload":true,"miniplayer":true}'));

  const [showTip, setShowTip] = useState(false);
  const [tipAmount, setTipAmount] = useState(500);
  const [showCreatorDashboard, setShowCreatorDashboard] = useState(false);
  const [creatorDashboard, setCreatorDashboard] = useState(null);
  const [creatorId, setCreatorId] = useState("");
  const [showCreatorSignup, setShowCreatorSignup] = useState(false);
  const [creatorName, setCreatorName] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [creatorAccountNumber, setCreatorAccountNumber] = useState("");
  const [creatorBankCode, setCreatorBankCode] = useState("");
  const [banks, setBanks] = useState([]);
  const [verifiedCreators, setVerifiedCreators] = useState({});
  const [showProfile, setShowProfile] = useState(false);
  const [isVerifiedCreator, setIsVerifiedCreator] = useState(false);

  const categories = ["All", "Nollywood", "Church Program", "Comedy", "Music Video", "Snapchat", "Drama", "Action", "Uncategorized"];

  const moods = [
    { emoji: "😂", label: "Laugh", cats: ["Comedy"] },
    { emoji: "🙏", label: "Spiritual", cats: ["Church Program"] },
    { emoji: "😢", label: "Emotional", cats: ["Drama"] },
    { emoji: "🎤", label: "Vibes", cats: ["Music Video"] },
    { emoji: "🔥", label: "Thrill", cats: ["Action", "Drama"] },
    { emoji: "📱", label: "Quick", cats: ["Snapchat"] },
  ];

  // Check if user is logged in via token on app load
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetch(`${AUTH_API}/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
          if (data.user.profilePic) setProfilePic(data.user.profilePic);
          if (data.user.creatorId) setCreatorId(data.user.creatorId);
        }
      })
      .catch(err => console.error("Auth check error:", err));
  }, []);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("continueWatching") || "[]");
    setContinueWatching(saved);
  }, []);

  useEffect(() => {
    if (creatorId && !creatorDashboard) {
      fetchDashboard(creatorId);
    }
  }, [creatorId]);

  const handleAuth = async () => {
    if (!authUsername.trim() || !authPassword.trim()) {
      return alert("Please enter username and password");
    }

    try {
      const res = await fetch(`${AUTH_API}/${authMode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername, password: authPassword })
      });

      const data = await res.json();

      if (data.error) {
        return alert("❌ " + data.error);
      }

      // Save token (works in browser AND APK)
      localStorage.setItem("naijaflix_token", data.token);
      setUser(data.user);
      if (data.user.profilePic) setProfilePic(data.user.profilePic);
      if (data.user.creatorId) setCreatorId(data.user.creatorId);

      setShowAuth(false);
      setAuthUsername("");
      setAuthPassword("");

      if (authMode === "signup") {
        alert("✅ Account created! Welcome to NaijaFlix");
      }
    } catch (err) {
      alert("❌ Failed to connect to auth server");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("naijaflix_token");
    setUser(null);
    setProfilePic("");
    setCreatorId("");
    setCreatorDashboard(null);
    setIsVerifiedCreator(false);
    setShowProfile(false);
    alert("👋 Logged out. See you soon!");
  };

  const uploadProfilePic = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const filename = encodeURIComponent(file.name);
      const contentType = encodeURIComponent(file.type || "image/jpeg");
      const key = localStorage.getItem("adminKey") || "";

      // 1. Upload image to R2 via backend
      const res = await fetch(
        `${API_URL}/api/upload/single?filename=${filename}&contentType=${contentType}`,
        { method: "POST", body: file, headers: { "x-admin-key": key } }
      );
      const data = await res.json();

      if (data.success) {
        // 2. Save URL to Auth Worker via Bearer token
        const token = getToken();
        await fetch(`${AUTH_API}/update-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ profilePic: data.publicUrl })
        });

        setProfilePic(data.publicUrl);
        alert("✅ Profile picture updated!");
      } else {
        alert("❌ " + (data.error || "Upload failed"));
      }
    } catch (err) {
      alert("Failed to upload profile picture");
    }
  };

  const saveAdminKey = () => {
    if (!adminKeyInput.trim()) return alert("Enter your admin key");
    localStorage.setItem("adminKey", adminKeyInput);
    setAdminKey(adminKeyInput);
    setShowAdminSetup(false);
    setAdminKeyInput("");
    alert("✅ Admin key saved! You can now upload and manage videos.");
  };

  const clearAdminKey = () => {
    localStorage.removeItem("adminKey");
    setAdminKey("");
    alert("Admin key removed.");
  };

  const fetchMovies = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/movies?t=${Date.now()}`);
      setMovies(res.data);
      res.data.forEach(async (m) => {
        try {
          const likeRes = await axios.get(`${API_URL}/movies/${m.id}/likes`);
          setLikeCounts(prev => ({ ...prev, [m.id]: likeRes.data.likes }));
        } catch {}
      });
    } catch (err) {
      console.error("Failed to load movies:", err);
    }
    setLoading(false);
  };

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/requests`);
      setRequests(res.data);
    } catch (err) {
      console.error("Failed to load requests:", err);
    }
  };

  const fetchVerifiedCreators = async () => {
    try {
      const res = await fetch(`${TIPS_API}/creators/verified`);
      const data = await res.json();
      if (data.verified) {
        setVerifiedCreators(data.verified);
      }
    } catch (err) {
      console.error("Failed to load verified creators:", err);
    }
  };

  useEffect(() => { fetchMovies(); fetchRequests(); fetchVerifiedCreators(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const movieId = params.get("movie");
    if (movieId && movies.length > 0) {
      const m = movies.find((x) => String(x.id) === String(movieId));
      if (m) setSelectedMovie(m);
    }
  }, [movies]);

  const handleDelete = async (id) => {
    if (!adminKey) return alert("⚠️ Admin key required. Tap ⚙️ to set it.");
    if (confirm('Delete this movie?')) {
      await axios.delete(`${API_URL}/movies/${id}`, {
        headers: { "x-admin-key": adminKey },
      });
      fetchMovies();
    }
  };

  const approveMovie = async (id) => {
    if (!adminKey) return alert("⚠️ Admin key required.");
    try {
      await axios.post(`${API_URL}/movies/${id}/approve`, {}, {
        headers: { "x-admin-key": adminKey },
      });
      alert("✅ Movie approved!");
      fetchMovies();
    } catch (err) {
      alert("Failed to approve: " + (err.response?.data?.error || "Unknown error"));
    }
  };

  const saveProgress = (movie, progress) => {
    let saved = JSON.parse(localStorage.getItem("continueWatching") || "[]");
    saved = saved.filter(m => m.id !== movie.id);
    if (progress > 0 && progress < 95) {
      saved.unshift({ ...movie, progress, savedAt: Date.now() });
    }
    saved = saved.slice(0, 10);
    localStorage.setItem("continueWatching", JSON.stringify(saved));
    setContinueWatching(saved);
  };

  const trackView = async (movieId) => {
    try {
      await fetch(`${TIPS_API}/track-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId })
      });
    } catch (err) {
      console.error("View tracking error:", err);
    }
  };

  const tipCreator = async (creatorId, amountNaira, viewerEmail) => {
    if (!creatorId) return alert("This movie has no creator assigned yet.");
    const amountKobo = amountNaira * 100;
    try {
      const res = await fetch(`${TIPS_API}/tips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId, viewerEmail, amountKobo })
      });
      const data = await res.json();
      if (data.success) {
        window.location.href = data.authorizationUrl;
      } else {
        alert("❌ " + (data.error || "Failed to start payment"));
      }
    } catch (err) {
      alert("Failed to send tip");
    }
  };

  const fetchDashboard = async (id) => {
    try {
      const res = await fetch(`${TIPS_API}/creators/${id}`);
      const data = await res.json();
      if (data.error) {
        alert("❌ " + data.error);
        return;
      }
      setCreatorDashboard(data);
      const verified = !!(data.is_verified || (data.creator && data.creator.is_verified));
      setIsVerifiedCreator(verified);
    } catch (err) {
      alert("Failed to load dashboard");
    }
  };

  const checkVerification = async () => {
    if (!creatorId) return;
    try {
      const res = await fetch(`${TIPS_API}/creators/check-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId })
      });
      const data = await res.json();
      if (data.verified) {
        alert("🎉 " + (data.message || "You are now verified!"));
        setIsVerifiedCreator(true);
        fetchDashboard(creatorId);
        fetchVerifiedCreators();
      } else if (data.alreadyVerified) {
        setIsVerifiedCreator(true);
        alert("✅ You're already verified!");
      } else {
        alert("Not eligible yet. " + data.reason);
      }
    } catch (err) {
      alert("Failed to check verification");
    }
  };

  const fetchBanks = async () => {
    try {
      const res = await fetch(`${TIPS_API}/banks`);
      const data = await res.json();
      if (data.status && data.data) {
        setBanks(data.data);
      }
    } catch (err) {
      console.error("Failed to load banks:", err);
    }
  };

  const registerCreator = async () => {
    if (!creatorName.trim() || !creatorEmail.trim() || !creatorAccountNumber.trim() || !creatorBankCode.trim()) {
      return alert("Please fill in all fields");
    }
    try {
      const res = await fetch(`${TIPS_API}/creators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: creatorName,
          email: creatorEmail,
          accountNumber: creatorAccountNumber,
          bankCode: creatorBankCode
        })
      });
      const data = await res.json();
      if (data.success) {
        setCreatorId(data.creatorId);
        setIsVerifiedCreator(false);
        setShowCreatorSignup(false);

        // Save creatorId to auth worker via Bearer token
        const token = getToken();
        await fetch(`${AUTH_API}/update-profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ creatorId: data.creatorId })
        });

        alert("✅ Creator account created! You can now receive tips and earn revenue.");
        fetchDashboard(data.creatorId);
      } else {
        alert("❌ " + (data.error || "Failed to register"));
      }
    } catch (err) {
      alert("Failed to register as creator");
    }
  };

  const requestPayout = async () => {
    if (!creatorId) return;
    if (!confirm("Request payout for your available balance?")) return;
    try {
      const res = await fetch(`${TIPS_API}/payouts/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId })
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Payout initiated! You will receive your money in your bank account.");
        fetchDashboard(creatorId);
      } else {
        alert("❌ " + (data.error || "Payout failed"));
      }
    } catch (err) {
      alert("Failed to request payout");
    }
  };

  const assignMovieToCreator = async (movieId, cId) => {
    try {
      const res = await fetch(`${TIPS_API}/assign-movie`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId, creatorId: cId })
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Movie assigned to creator!");
      } else {
        alert("❌ " + (data.error || "Failed to assign"));
      }
    } catch (err) {
      alert("Failed to assign movie");
    }
  };

  const handleUploadComplete = async () => {
    await fetchMovies();
    try {
      const res = await axios.get(`${API_URL}/movies?t=${Date.now()}`);
      const allMovies = res.data;
      const latest = allMovies[0]; // most recent

      if (latest && latest.posterUrl) {
        // Send to AI moderator for auto-approval
        await fetch("https://moviebox-moderator.umoruanthony345.workers.dev/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            movieId: latest.id,
            posterUrl: latest.posterUrl
          })
        });

        // Refresh movies to show updated approval status
        await fetchMovies();
      }

      if (creatorId) {
        const unassigned = allMovies.filter(m => !m.creator_id).sort((a, b) => b.id - a.id);
        if (unassigned.length > 0) {
          await assignMovieToCreator(unassigned[0].id, creatorId);
          alert("✅ Video uploaded and auto-assigned to your creator account!");
        }
      }
    } catch (err) {
      console.error("Upload complete error:", err);
    }
  };

  const handleDownload = async (movie) => {
    try {
      const res = await fetch(`${STREAM_URL}${encodeURIComponent(movie.videoUrl)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${movie.title}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      window.open(`${STREAM_URL}${encodeURIComponent(movie.videoUrl)}`, "_blank");
    }
  };

  const toggleLike = async (movieId) => {
    if (!user) return alert("Please login to like");
    try {
      const res = await axios.post(`${API_URL}/movies/${movieId}/likes`, {
        username: user.username,
      });
      if (res.data.success) {
        let liked = [...likedMovies];
        if (res.data.action === "liked") {
          liked.push(movieId);
        } else {
          liked = liked.filter(id => id !== movieId);
        }
        setLikedMovies(liked);
        localStorage.setItem("likedMovies", JSON.stringify(liked));
        setLikeCounts(prev => ({ ...prev, [movieId]: res.data.likes }));
      }
    } catch (err) {
      alert("Failed to like");
    }
  };

  const handleShare = async (movie) => {
    const shareUrl = `https://og.naijaflix.site/movie/${movie.id}`;
    const shareText = `🎬 Check out "${movie.title}" on NaijaFlix!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: movie.title, text: shareText, url: shareUrl });
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        alert("🔗 Link copied to clipboard!");
      } catch (err) {
        prompt("Copy this link:", `${shareText} ${shareUrl}`);
      }
    }
  };

  const fetchComments = async (movieId) => {
    try {
      const res = await axios.get(`${API_URL}/movies/${movieId}/comments`);
      setAllComments(prev => ({ ...prev, [movieId]: res.data }));
    } catch (err) {
      console.error("Failed to load comments:", err);
    }
  };

  const submitComment = async (movieId) => {
    if (!user) return alert("Please login to comment");
    if (!commentText.trim()) return;
    try {
      const res = await axios.post(`${API_URL}/movies/${movieId}/comments`, {
        username: user.username,
        text: commentText,
      });
      if (res.data.success) {
        setCommentText("");
        fetchComments(movieId);
      }
    } catch (err) {
      alert("Failed to comment");
    }
  };

  const deleteComment = async (commentId, movieId) => {
    if (!adminKey) return alert("⚠️ Admin key required.");
    try {
      await axios.delete(`${API_URL}/comments/${commentId}`, {
        headers: { "x-admin-key": adminKey },
      });
      fetchComments(movieId);
    } catch (err) {
      alert("Failed to delete comment");
    }
  };

  const voteRequest = async (id) => {
    const voterId = localStorage.getItem("voterId") || `user_${Date.now()}`;
    localStorage.setItem("voterId", voterId);
    try {
      await axios.post(`${API_URL}/requests/${id}/vote`, { voter: voterId });
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to vote");
    }
  };

  const submitRequest = async () => {
    if (!reqTitle.trim()) return alert("Please enter a movie title");
    try {
      await axios.post(`${API_URL}/requests`, {
        title: reqTitle,
        category: reqCategory,
        description: reqDesc,
      });
      setReqTitle("");
      setReqDesc("");
      fetchRequests();
      alert("✅ Request submitted!");
    } catch (err) {
      alert("Failed to submit request");
    }
  };

  const deleteRequest = async (id) => {
    if (!adminKey) return alert("⚠️ Admin key required.");
    try {
      await axios.delete(`${API_URL}/requests/${id}`, {
        headers: { "x-admin-key": adminKey },
      });
      fetchRequests();
    } catch (err) {
      alert("Failed to delete request");
    }
  };

  const reportMovie = async (movie) => {
    const reason = prompt("Why are you reporting this video?");
    if (!reason) return;
    try {
      await axios.post(`${API_URL}/requests`, {
        title: `🚨 REPORT: ${movie.title}`,
        category: "Report",
        description: `Movie ID: ${movie.id} - ${reason}`,
      });
      alert("✅ Reported! Admin will review it.");
    } catch (err) {
      alert("Failed to report");
    }
  };

  const filtered = movies.filter(m => {
    if (appSettings.familyMode && (m.category === 'Snapchat' || m.category === 'Drama')) return false;
    const matchSearch =
      (m.title && m.title.toLowerCase().includes(search.toLowerCase())) ||
      (m.description && m.description.toLowerCase().includes(search.toLowerCase()));
    const matchCat = category === "All" || m.category === category;
    const moodCats = mood ? moods.find(mo => mo.label === mood)?.cats : null;
    const matchMood = !mood || (moodCats && moodCats.includes(m.category));
    return m.approved === 1 && matchSearch && matchCat && matchMood;
  });

  const moviesByCategory = {};
  if (category === "All" && !search && !mood) {
    categories.slice(1).forEach(cat => {
      if (appSettings.familyMode && (cat === 'Snapchat' || cat === 'Drama')) return;
      const catMovies = movies.filter(m => m.category === cat && m.approved === 1);
      if (catMovies.length > 0) moviesByCategory[cat] = catMovies;
    });
  } else {
    if (filtered.length > 0) moviesByCategory["Results"] = filtered;
  }

  const isVerified = isVerifiedCreator || (creatorDashboard && (creatorDashboard.is_verified || (creatorDashboard.creator && creatorDashboard.creator.is_verified)));

  const openProfile = () => {
    setShowProfile(true);
    if (creatorId) fetchDashboard(creatorId);
  };
  return (
    <div className="home">
      <div className="nav">
        <div className="nav-left">
          <span className="nav-logo">🎬NaijaFlix</span>
        </div>
        <div className="nav-right" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {user ? (
            <>
              <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }} onClick={openProfile}>
                {profilePic ? (
                  <img src={profilePic} alt="profile" style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "20px" }}>👤</span>
                )}
                <span style={{ fontSize: "14px", color: "#888", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                  @{user.username}
                  {isVerified && <VerifiedBadge size={14} />}
                </span>
              </div>
              <button className="theme-toggle" onClick={handleLogout} style={{ fontSize: "14px" }}>🚪 Logout</button>
            </>
          ) : (
            <button className="theme-toggle" onClick={() => { setAuthMode("login"); setShowAuth(true); }} style={{ fontSize: "14px" }}>🔑 Login</button>
          )}
          <button className="theme-toggle" onClick={() => { setShowCreatorDashboard(!showCreatorDashboard); if (creatorId) fetchDashboard(creatorId); }} style={{ fontSize: "16px" }}>💰 Creator</button>
          <button className="theme-toggle" onClick={() => setShowAdminSetup(true)} style={{ fontSize: "16px" }}>⚙️</button>
          <button className="theme-toggle" onClick={() => setShowRequests(!showRequests)} style={{ fontSize: "16px" }}>🎯 Requests</button>
          <Help />
          <button className="theme-toggle" onClick={() => setShowSettings(true)} style={{ fontSize: "16px" }}>☰</button>
          <button className="theme-toggle" onClick={() => setDark(!dark)}>{dark ? "☀️" : "🌙"}</button>
        </div>
      </div>

      {showAuth && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--card)", borderRadius: "12px", padding: "24px", maxWidth: "350px", width: "90%", border: "1px solid var(--border)" }}>
            <h2 style={{ marginBottom: "16px", textAlign: "center" }}>{authMode === "login" ? "🔑 Login" : "📝 Sign Up"}</h2>
            <input type="text" placeholder="Username" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", boxSizing: "border-box" }} />
            <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "16px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", boxSizing: "border-box" }} />
            <button onClick={handleAuth} style={{ width: "100%", padding: "12px", background: "var(--red)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", marginBottom: "12px" }}>{authMode === "login" ? "Login" : "Create Account"}</button>
            <p style={{ textAlign: "center", fontSize: "14px", color: "#888" }}>
              {authMode === "login" ? (
                <>Don't have an account? <span style={{ color: "var(--red)", cursor: "pointer" }} onClick={() => setAuthMode("signup")}>Sign Up</span></>
              ) : (
                <>Already have an account? <span style={{ color: "var(--red)", cursor: "pointer" }} onClick={() => setAuthMode("login")}>Login</span></>
              )}
            </p>
            <button onClick={() => setShowAuth(false)} style={{ width: "100%", padding: "10px", background: "transparent", color: "#888", border: "none", cursor: "pointer", marginTop: "8px" }}>Cancel</button>
          </div>
        </div>
      )}

      {showAdminSetup && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--card)", borderRadius: "12px", padding: "24px", maxWidth: "350px", width: "90%", border: "1px solid var(--border)" }}>
            <h2 style={{ marginBottom: "16px", textAlign: "center" }}>⚙️ Admin Setup</h2>
            <p style={{ fontSize: "13px", color: "#888", marginBottom: "12px", textAlign: "center" }}>Enter the admin key to upload and manage videos.</p>
            <input type="password" placeholder="Admin key" value={adminKeyInput} onChange={(e) => setAdminKeyInput(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", boxSizing: "border-box" }} />
            <button onClick={saveAdminKey} style={{ width: "100%", padding: "12px", background: "var(--red)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", marginBottom: "8px" }}>Save Admin Key</button>
            {adminKey && (
              <button onClick={clearAdminKey} style={{ width: "100%", padding: "10px", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer" }}>Remove Admin Key</button>
            )}
            <button onClick={() => setShowAdminSetup(false)} style={{ width: "100%", padding: "10px", background: "transparent", color: "#888", border: "none", cursor: "pointer", marginTop: "8px" }}>Cancel</button>
          </div>
        </div>
      )}

      {showProfile && user && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={() => setShowProfile(false)}>
          <div style={{ background: "var(--card)", borderRadius: "12px", padding: "24px", maxWidth: "350px", width: "90%", border: "1px solid var(--border)", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowProfile(false)} style={{ float: "right", background: "var(--red)", color: "white", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px" }}>✕</button>
            <div style={{ position: "relative", width: "80px", height: "80px", margin: "0 auto 12px" }}>
              {profilePic ? (
                <img src={profilePic} alt="profile" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)" }} />
              ) : (
                <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--border)" }}>
                  <span style={{ fontSize: "36px" }}>👤</span>
                </div>
              )}
              {isVerified && (
                <div style={{ position: "absolute", bottom: "-2px", right: "-2px", background: "var(--card)", borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <VerifiedBadge size={22} />
                </div>
              )}
            </div>
            <h2 style={{ fontSize: "18px", marginBottom: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
              @{user.username}
              {isVerified && <VerifiedBadge size={16} />}
            </h2>
            {isVerified ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 14px", background: "rgba(29,161,242,0.1)", borderRadius: "20px", marginBottom: "16px", border: "1px solid rgba(29,161,242,0.3)" }}>
                <VerifiedBadge size={14} />
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#1DA1F2" }}>Verified Creator</span>
              </div>
            ) : creatorId ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 14px", background: "rgba(255,193,7,0.1)", borderRadius: "20px", marginBottom: "16px", border: "1px solid rgba(255,193,7,0.3)" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFC107" }}>🎬 Creator (Pending Verification)</span>
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "#888", marginBottom: "16px" }}>Regular User</p>
            )}
            <label style={{ display: "block", padding: "12px", background: "var(--red)", color: "white", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", marginBottom: "8px" }}>
              📷 Change Profile Picture
              <input type="file" accept="image/*" onChange={uploadProfilePic} style={{ display: "none" }} />
            </label>
            {creatorId && (
              <button onClick={() => { setShowProfile(false); setShowCreatorDashboard(true); fetchDashboard(creatorId); }} style={{ width: "100%", padding: "12px", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", marginBottom: "8px" }}>
                💰 Open Creator Dashboard
              </button>
            )}
            {!creatorId && (
              <button onClick={() => { setShowProfile(false); setShowCreatorSignup(true); fetchBanks(); }} style={{ width: "100%", padding: "12px", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", marginBottom: "8px" }}>
                🎬 Become a Creator
              </button>
            )}
            <button onClick={() => { setShowProfile(false); handleLogout(); }} style={{ width: "100%", padding: "12px", background: "transparent", color: "#f44336", border: "1px solid #f44336", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>
              🚪 Logout
            </button>
          </div>
        </div>
      )}

      {showCreatorSignup && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--card)", borderRadius: "12px", padding: "24px", maxWidth: "400px", width: "90%", border: "1px solid var(--border)" }}>
            <h2 style={{ marginBottom: "16px", textAlign: "center" }}>💰 Become a Creator</h2>
            <p style={{ fontSize: "13px", color: "#888", marginBottom: "16px", textAlign: "center" }}>Sign up to receive tips and earn ad revenue from your videos.</p>
            <input type="text" placeholder="Your name" value={creatorName} onChange={(e) => setCreatorName(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", boxSizing: "border-box" }} />
            <input type="email" placeholder="Email address" value={creatorEmail} onChange={(e) => setCreatorEmail(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", boxSizing: "border-box" }} />
            <input type="text" placeholder="Bank account number" value={creatorAccountNumber} onChange={(e) => setCreatorAccountNumber(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", boxSizing: "border-box" }} />
            <select value={creatorBankCode} onChange={(e) => setCreatorBankCode(e.target.value)} onClick={fetchBanks} style={{ width: "100%", padding: "12px", marginBottom: "16px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", boxSizing: "border-box" }}>
              <option value="">Select your bank</option>
              {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
            <button onClick={registerCreator} style={{ width: "100%", padding: "12px", background: "var(--red)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", marginBottom: "8px" }}>Register as Creator</button>
            <button onClick={() => setShowCreatorSignup(false)} style={{ width: "100%", padding: "10px", background: "transparent", color: "#888", border: "none", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {showCreatorDashboard && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, overflow: "auto" }}>
          <div style={{ background: "var(--card)", borderRadius: "12px", padding: "24px", maxWidth: "500px", width: "90%", border: "1px solid var(--border)", marginTop: "20px", marginBottom: "20px" }}>
            <button onClick={() => setShowCreatorDashboard(false)} style={{ float: "right", background: "var(--red)", color: "white", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "16px" }}>✕</button>
            <h2 style={{ marginBottom: "16px" }}>💰 Creator Dashboard</h2>
            {isVerified && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px", padding: "10px 14px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <VerifiedBadge size={18} />
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#1DA1F2" }}>Verified Creator</span>
              </div>
            )}
            {!creatorId ? (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <p style={{ color: "#888", marginBottom: "16px" }}>You're not registered as a creator yet.</p>
                <button onClick={() => { setShowCreatorSignup(true); fetchBanks(); }} style={{ padding: "12px 24px", background: "var(--red)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Become a Creator</button>
              </div>
            ) : !creatorDashboard ? (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <button onClick={() => fetchDashboard(creatorId)} style={{ padding: "12px 24px", background: "var(--red)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Load My Dashboard</button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ background: "var(--bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <p style={{ color: "#888", fontSize: "13px" }}>Total Views</p>
                    <p style={{ color: "var(--text)", fontSize: "22px", fontWeight: "bold" }}>{(creatorDashboard.stats.totalViews || 0).toLocaleString()}</p>
                  </div>
                  <div style={{ background: "var(--bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <p style={{ color: "#888", fontSize: "13px" }}>Ad Revenue (55%)</p>
                    <p style={{ color: "var(--text)", fontSize: "22px", fontWeight: "bold" }}>₦{creatorDashboard.stats.creatorAdShareNaira}</p>
                  </div>
                  <div style={{ background: "var(--bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <p style={{ color: "#888", fontSize: "13px" }}>Tips Received</p>
                    <p style={{ color: "var(--text)", fontSize: "22px", fontWeight: "bold" }}>₦{creatorDashboard.stats.totalTipsNaira}</p>
                  </div>
                  <div style={{ background: "var(--bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <p style={{ color: "#888", fontSize: "13px" }}>Total Earnings</p>
                    <p style={{ color: "var(--text)", fontSize: "22px", fontWeight: "bold" }}>₦{creatorDashboard.stats.totalEarningsNaira}</p>
                  </div>
                  <div style={{ background: "var(--bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <p style={{ color: "#888", fontSize: "13px" }}>Paid Out</p>
                    <p style={{ color: "var(--text)", fontSize: "22px", fontWeight: "bold" }}>₦{creatorDashboard.stats.totalPaidOutNaira}</p>
                  </div>
                  <div style={{ background: "var(--bg)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                    <p style={{ color: "#888", fontSize: "13px" }}>Available Balance</p>
                    <p style={{ color: creatorDashboard.stats.eligibleForPayout ? "#4CAF50" : "var(--text)", fontSize: "22px", fontWeight: "bold" }}>₦{creatorDashboard.stats.balanceNaira}</p>
                    {creatorDashboard.stats.eligibleForPayout && <p style={{ color: "#4CAF50", fontSize: "11px" }}>✓ Eligible for payout</p>}
                  </div>
                </div>
                <h3 style={{ fontSize: "15px", marginBottom: "8px" }}>Your Movies</h3>
                <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "16px" }}>
                  {(creatorDashboard.movies || []).length === 0 ? (
                    <p style={{ color: "#888", fontSize: "13px" }}>No movies assigned yet. Ask admin to assign your movies.</p>
                  ) : (
                    (creatorDashboard.movies || []).map(m => (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "var(--bg)", borderRadius: "6px", marginBottom: "6px", border: "1px solid var(--border)" }}>
                        <span style={{ fontSize: "13px" }}>{m.title}</span>
                        <span style={{ fontSize: "13px", color: "#888" }}>{(m.views || 0).toLocaleString()} views</span>
                      </div>
                    ))
                  )}
                </div>
                {creatorDashboard.stats.eligibleForPayout && (
                  <button onClick={requestPayout} style={{ width: "100%", padding: "14px", background: "#4CAF50", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}>
                    Request Payout (₦{creatorDashboard.stats.balanceNaira})
                  </button>
                )}
                {!creatorDashboard.stats.eligibleForPayout && (
                  <p style={{ textAlign: "center", fontSize: "12px", color: "#888" }}>Minimum payout: ₦10,000</p>
                )}
                {!isVerified && (
                  <button onClick={checkVerification} style={{ width: "100%", padding: "12px", background: "#1DA1F2", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", marginTop: "12px" }}>
                    ✅ Check Verification Eligibility
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <Settings
          user={user}
          onLogout={() => { handleLogout(); setShowSettings(false); }}
          settings={appSettings}
          setSettings={setAppSettings}
        />
      )}

      <div style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto" }}>
        <div className="search-bar">
          <input type="text" placeholder="🔍 Search movies..." value={search} onChange={(e) => setSearch(e.target.value)} className="search-input" />
        </div>
        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "14px", color: "#888", marginBottom: "8px" }}>What's your mood?</p>
          <div className="category-pills">
            <button className={`pill ${mood === "" ? "pill-active" : ""}`} onClick={() => setMood("")}>📺 All</button>
            {moods.map(mo => (
              <button key={mo.label} className={`pill ${mood === mo.label ? "pill-active" : ""}`} onClick={() => setMood(mo.label)}>{mo.emoji} {mo.label}</button>
            ))}
          </div>
        </div>
        <div className="category-pills">
          {categories.map(cat => (
            <button key={cat} className={`pill ${category === cat ? "pill-active" : ""}`} onClick={() => setCategory(cat)}>{cat}</button>
          ))}
        </div>
        {adminKey && <R2Uploader onUpload={handleUploadComplete} />}
        {showRequests && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
            <h2 style={{ marginBottom: "16px" }}>🎯 Request a Movie</h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
              <input type="text" placeholder="Movie title you want..." value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} style={{ flex: 1, minWidth: "200px", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
              <select value={reqCategory} onChange={(e) => setReqCategory(e.target.value)} style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}>
                {categories.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
              <input type="text" placeholder="Description (optional)" value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} style={{ flex: 1, minWidth: "200px", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
              <button onClick={submitRequest} style={{ padding: "10px 20px", background: "var(--red)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Submit</button>
            </div>
            {requests.length === 0 ? (
              <p style={{ color: "#888", textAlign: "center" }}>No requests yet. Be the first to request a movie!</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {requests.map(req => (
                  <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--bg)" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: "16px", marginBottom: "4px" }}>{req.title}</h3>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", background: "var(--red)", color: "white", padding: "2px 8px", borderRadius: "10px" }}>{req.category}</span>
                        {req.description && <span style={{ fontSize: "12px", color: "#888" }}>{req.description}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => voteRequest(req.id)} style={{ padding: "6px 12px", background: "var(--red)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>👍 {req.votes || 0}</button>
                      {adminKey && (
                        <button onClick={() => deleteRequest(req.id)} style={{ padding: "6px 10px", background: "transparent", color: "#f44336", border: "1px solid #f44336", borderRadius: "6px", cursor: "pointer", fontSize: "14px" }}>🗑️</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {loading ? (
          <p style={{ textAlign: "center", padding: "40px", color: "#888" }}>Loading movies...</p>
        ) : (
          <>
            {continueWatching.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>▶️ Continue Watching</h2>
                <div className="movie-grid" style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
                  {continueWatching.map(m => (
                    <div key={m.id} onClick={() => setSelectedMovie(m)} style={{ minWidth: "160px", cursor: "pointer", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)" }}>
                      <img src={m.posterUrl} alt={m.title} style={{ width: "100%", height: "90px", objectFit: "cover" }} />
                      <div style={{ padding: "8px" }}>
                        <p style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "flex", alignItems: "center", gap: "3px" }}>
                          {m.title}
                          {verifiedCreators[m.creator_id] && <VerifiedBadge size={12} />}
                        </p>
                        <div style={{ height: "3px", background: "var(--border)", borderRadius: "2px" }}>
                          <div style={{ width: `${m.progress || 0}%`, height: "100%", background: "var(--red)", borderRadius: "2px" }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(moviesByCategory).length === 0 ? (
              <p style={{ textAlign: "center", padding: "40px", color: "#888" }}>No movies found.</p>
            ) : (
              Object.entries(moviesByCategory).map(([cat, catMovies]) => (
                <div key={cat} style={{ marginBottom: "24px" }}>
                  <h2 style={{ fontSize: "18px", marginBottom: "12px" }}>{cat}</h2>
                  <div className="movie-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px" }}>
                    {catMovies.map(m => (
                      <div key={m.id} style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)", background: "var(--card)", cursor: "pointer" }} onClick={() => setSelectedMovie(m)}>
                        <div style={{ position: "relative" }}>
                          <img src={m.posterUrl} alt={m.title} style={{ width: "100%", height: "180px", objectFit: "cover" }} />
                          <div style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.7)", color: "white", padding: "2px 8px", borderRadius: "10px", fontSize: "12px" }}>❤️ {likeCounts[m.id] || 0}</div>
                          {verifiedCreators[m.creator_id] && (
                            <div style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(29,161,242,0.9)", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <VerifiedBadge size={14} />
                            </div>
                          )}
                        </div>
                        <div style={{ padding: "8px" }}>
                          <p style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: "3px" }}>
                            {m.title}
                            {verifiedCreators[m.creator_id] && <VerifiedBadge size={12} />}
                          </p>
                          <p style={{ fontSize: "12px", color: "#888" }}>
                            {m.category}
                            {verifiedCreators[m.creator_id] && (
                              <span style={{ color: "#1DA1F2", marginLeft: "4px" }}>· {verifiedCreators[m.creator_id]}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {selectedMovie && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <button onClick={() => { setSelectedMovie(null); setShowComments(null); setShowTip(false); }} style={{ position: "absolute", top: "16px", right: "16px", background: "var(--red)", color: "white", border: "none", borderRadius: "50%", width: "40px", height: "40px", fontSize: "20px", cursor: "pointer" }}>✕</button>
          <div style={{ maxWidth: "800px", width: "100%" }}>
            <video
              src={`${STREAM_URL}${encodeURIComponent(selectedMovie.videoUrl)}`}
              poster={selectedMovie.posterUrl}
              controls
              autoPlay
              style={{ width: "100%", maxHeight: "60vh", borderRadius: "8px", background: "#000" }}
              onPlay={() => trackView(selectedMovie.id)}
              onTimeUpdate={(e) => { const progress = (e.target.currentTime / e.target.duration) * 100; saveProgress(selectedMovie, progress); }}
            />
            <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <h2 style={{ fontSize: "18px", flex: 1, display: "flex", alignItems: "center", gap: "6px" }}>
                {selectedMovie.title}
                {verifiedCreators[selectedMovie.creator_id] && <VerifiedBadge size={16} />}
              </h2>
              <button onClick={() => toggleLike(selectedMovie.id)} style={{ padding: "8px 12px", background: likedMovies.includes(selectedMovie.id) ? "var(--red)" : "transparent", color: likedMovies.includes(selectedMovie.id) ? "white" : "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer" }}>{likedMovies.includes(selectedMovie.id) ? "❤️" : "🤍"} {likeCounts[selectedMovie.id] || 0}</button>
              <button onClick={() => handleShare(selectedMovie)} style={{ padding: "8px 12px", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer" }}>🔗 Share</button>
              <button onClick={() => handleDownload(selectedMovie)} style={{ padding: "8px 12px", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer" }}>⬇️ Download</button>
              <CastButton videoUrl={`${STREAM_URL}${encodeURIComponent(selectedMovie.videoUrl)}`} />
              <button onClick={() => { showComments === selectedMovie.id ? setShowComments(null) : (setShowComments(selectedMovie.id), fetchComments(selectedMovie.id)); }} style={{ padding: "8px 12px", background: "transparent", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", cursor: "pointer" }}>💬 Comments</button>
              <button onClick={() => setShowTip(!showTip)} style={{ padding: "8px 12px", background: showTip ? "var(--red)" : "transparent", color: showTip ? "white" : "var(--text)", border: "1px solid var(--red)", borderRadius: "6px", cursor: "pointer" }}>💰 Tip Creator</button>
              <button onClick={() => reportMovie(selectedMovie)} style={{ padding: "8px 12px", background: "#ff9800", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>🚨 Report</button>
              {adminKey && (
                <>
                  <button onClick={() => approveMovie(selectedMovie.id)} style={{ padding: "8px 12px", background: "#4caf50", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>✅ Approve</button>
                  <button onClick={() => handleDelete(selectedMovie.id)} style={{ padding: "8px 12px", background: "#f44336", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>🗑️ Delete</button>
                </>
              )}
            </div>
            {verifiedCreators[selectedMovie.creator_id] && (
              <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", background: "var(--bg)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <VerifiedBadge size={16} />
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#1DA1F2" }}>{verifiedCreators[selectedMovie.creator_id]}</span>
                <span style={{ fontSize: "12px", color: "#888" }}>· Verified Creator</span>
              </div>
            )}
            <p style={{ marginTop: "8px", fontSize: "14px", color: "#888" }}>{selectedMovie.description}</p>
            {showTip && (
              <div style={{ marginTop: "16px", background: "var(--card)", borderRadius: "8px", padding: "16px", border: "1px solid var(--border)" }}>
                <h3 style={{ marginBottom: "12px" }}>💰 Tip the Creator</h3>
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
                  {[200, 500, 1000, 2000].map(amt => (
                    <button key={amt} onClick={() => setTipAmount(amt)} style={{ padding: "8px 16px", background: tipAmount === amt ? "var(--red)" : "var(--bg)", color: tipAmount === amt ? "white" : "var(--text)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>₦{amt}</button>
                  ))}
                </div>
                <button onClick={() => tipCreator(selectedMovie.creator_id, tipAmount, user?.email)} style={{ width: "100%", padding: "12px", background: "var(--red)", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}>Send ₦{tipAmount} Tip</button>
                {!selectedMovie.creator_id && (
                  <p style={{ fontSize: "12px", color: "#888", textAlign: "center", marginTop: "8px" }}>This movie has no creator assigned yet.</p>
                )}
              </div>
            )}
            {showComments === selectedMovie.id && (
              <div style={{ marginTop: "16px", background: "var(--card)", borderRadius: "8px", padding: "16px", border: "1px solid var(--border)" }}>
                <h3 style={{ marginBottom: "12px" }}>💬 Comments</h3>
                {user ? (
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <input type="text" placeholder="Write a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }} />
                    <button onClick={() => submitComment(selectedMovie.id)} style={{ padding: "10px 16px", background: "var(--red)", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>Post</button>
                  </div>
                ) : (
                  <p style={{ fontSize: "13px", color: "#888", marginBottom: "12px" }}>Please login to comment.</p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(allComments[selectedMovie.id] || []).length === 0 ? (
                    <p style={{ fontSize: "13px", color: "#888" }}>No comments yet.</p>
                  ) : (
                    (allComments[selectedMovie.id] || []).map((c, i) => (
                      <div key={i} style={{ padding: "10px", background: "var(--bg)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: "600", fontSize: "13px" }}>@{c.username}</span>
                          {adminKey && (
                            <button onClick={() => deleteComment(c.id, selectedMovie.id)} style={{ background: "transparent", border: "none", color: "#f44336", cursor: "pointer", fontSize: "12px" }}>🗑️</button>
                          )}
                        </div>
                        <p style={{ fontSize: "14px", marginTop: "4px" }}>{c.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{ textAlign: "center", padding: "20px", fontSize: "13px", color: "#888" }}>
        © 2026 NaijaFlix. All rights reserved.
      </div>
    </div>
  );
}

export default App;
