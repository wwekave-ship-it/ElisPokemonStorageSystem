// admin.js - Eli's Pokemon Storage System (Admin)

// Firebase v11 CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  initializeFirestore,
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  query,
  orderBy,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ---------- Firebase config ----------
const firebaseConfig = {
  apiKey: "AIzaSyChVKNH9TSbzpNLemZY7wAJgsuXmALW8OU",
  authDomain: "eli-s-pokemon-storage-system.firebaseapp.com",
  projectId: "eli-s-pokemon-storage-system",
  storageBucket: "eli-s-pokemon-storage-system.firebasestorage.app",
  messagingSenderId: "953223266982",
  appId: "1:953223266982:web:5271305728aa74a6322a67",
};

const app = initializeApp(firebaseConfig);
// Use long-polling fallback for networks that block the WebChannel transport
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});
const storage = getStorage(app);
const auth = getAuth(app);

// ---------- DOM elements ----------
const currentBoxLabel = document.getElementById("currentBoxLabel");
const cardsContainer = document.getElementById("cardsContainer");
const noCardsMessage = document.getElementById("noCardsMessage");

const prevBoxBtn = document.getElementById("prevBoxBtn");
const nextBoxBtn = document.getElementById("nextBoxBtn");

const searchInput = document.getElementById("searchInput");
const filterSetNumber = document.getElementById("filterSetNumber");
const filterCondition = document.getElementById("filterCondition");
const filterClass = document.getElementById("filterClass");
const autoPackBtn = document.getElementById("autoPackBtn");

const cardForm = document.getElementById("cardForm");
const cardImage = document.getElementById("cardImage");
const portraitInitial = document.getElementById("portraitInitial");

// Preview fields
const selectedNameEl = document.getElementById("selectedName");
const selectedSetEl = document.getElementById("selectedSet");
const selectedSetNumberEl = document.getElementById("selectedSetNumber");
const selectedConditionEl = document.getElementById("selectedCondition");
const selectedClassEl = document.getElementById("selectedClass");
const selectedQtyEl = document.getElementById("selectedQty");
const selectedPriceEl = document.getElementById("selectedPrice");
const editPriceInput = document.getElementById("editPriceInput");
const updatePriceBtn = document.getElementById("updatePriceBtn");

// Form inputs
const cardNameInput = document.getElementById("cardName");
const cardSetInput = document.getElementById("cardSet");
const cardSetNumberInput = document.getElementById("cardSetNumber");
const cardConditionInput = document.getElementById("cardCondition");
const cardClassSelect = document.getElementById("cardClass");
const cardQuantityInput = document.getElementById("cardQuantity"); // hidden, always 1
const cardPriceInput = document.getElementById("cardPrice");
const cardImageFileInput = document.getElementById("cardImageFile");
const cardSpriteFileInput = document.getElementById("cardSpriteFile");
const targetBoxSelect = document.getElementById("targetBox");

// Delete button
const deleteBtn = document.getElementById("deleteCardBtn");

// Status text
const adminStatusEl = document.getElementById("adminStatus");
const activeRequestBanner = document.getElementById("activeRequestBanner");
const activeRequestText = document.getElementById("activeRequestText");
const clearRequestHighlightBtn = document.getElementById("clearRequestHighlight");
const activeRequestPrevBtn = document.getElementById("activeRequestPrev");
const activeRequestNextBtn = document.getElementById("activeRequestNext");

// Auth UI
const adminAppShell = document.getElementById("adminApp");
const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const loginEmailInput = document.getElementById("loginEmail");
const loginPasswordInput = document.getElementById("loginPassword");
const loginStatusEl = document.getElementById("loginStatus");
const logoutBtn = document.getElementById("logoutBtn");

// Theme inputs
const boxLabelGifUrlInput = document.getElementById("boxLabelGifUrl");
const boxLabelGifApplyBtn = document.getElementById("applyBoxLabelGif");
const boxLabelGifFileInput = document.getElementById("boxLabelGifFile");

const DEFAULT_LABEL_GIF = "";
const DEFAULT_SPRITE_GIF = "";
const DEFAULT_PREVIEW_GIF = "";
const spriteGifUrlInput = document.getElementById("spriteGifUrl");
const spriteGifApplyBtn = document.getElementById("applySpriteGif");
const spriteGifFileInput = document.getElementById("spriteGifFile");
const previewGifUrlInput = document.getElementById("previewGifUrl");
const previewGifApplyBtn = document.getElementById("applyPreviewGif");
const previewGifFileInput = document.getElementById("previewGifFile");
const availIsekaiStartInput = document.getElementById("availIsekaiStart");
const availIsekaiEndInput = document.getElementById("availIsekaiEnd");
const availIsekaiStartTimeInput = document.getElementById("availIsekaiStartTime");
const availIsekaiEndTimeInput = document.getElementById("availIsekaiEndTime");
const availAspenStartInput = document.getElementById("availAspenStart");
const availAspenEndInput = document.getElementById("availAspenEnd");
const availAspenStartTimeInput = document.getElementById("availAspenStartTime");
const availAspenEndTimeInput = document.getElementById("availAspenEndTime");
const saveAvailabilityBtn = document.getElementById("saveAvailability");
const setIsekaiWeekendBtn = document.getElementById("setIsekaiWeekend");
const setAspenWeekendBtn = document.getElementById("setAspenWeekend");
const dayCheckboxGroups = document.querySelectorAll(".day-checkbox-group");
const aspenDayRows = document.querySelectorAll(".aspen-day-row");
const tradeRequestsList = document.getElementById("tradeRequestsList");
let tradeRequestsCache = [];
const paymentIconVenmoFileInput = document.getElementById("paymentIconVenmoFile");
const paymentIconPaypalFileInput = document.getElementById("paymentIconPaypalFile");
const paymentIconTradeFileInput = document.getElementById("paymentIconTradeFile");
const DEFAULT_PAYMENT_ICONS = {
  venmo: "images/venmo-icon.svg",
  paypal: "images/paypal-icon.svg",
  trade: "images/trade.gif",
};
const overlayGifUrlInput = document.getElementById("overlayGifUrl");
const overlayGifApplyBtn = document.getElementById("applyOverlayGif");
const overlayGifFileInput = document.getElementById("overlayGifFile");
const DEFAULT_OVERLAY_GIF = "";
const THEME_DOC_REF = doc(db, "settings", "theme");
const MAX_LOCAL_VALUE = 200000; // skip localStorage when data URLs are too large
const MAX_CLOUD_VALUE = 900000; // guard Firestore 1MB field limit
const BOX_CAPACITY = 30;
// Admin boxes grow dynamically; start with one box and expand as cards fill.
let boxCount = 1;
let requestTagMap = new Map();

// ---------- State ----------
let allCards = [];
let currentBoxIndex = 0;
let selectedCardId = null;
let adminAppStarted = false;
let activeRequestLabel = null;
let activeRequestIndex = -1;

// ---------- Helpers ----------
function setStatus(message) {
  if (!adminStatusEl) return;
  adminStatusEl.textContent = message || "";
}

function getBoxName(index) {
  return `BOX${index + 1} (Shelf)`;
}

function getBoxIndexFromName(name) {
  const match = /BOX(\d+)/i.exec(name || "");
  const idx = match ? Number(match[1]) - 1 : -1;
  return Number.isFinite(idx) ? idx : -1;
}

function setBoxCount(nextCount = 1) {
  const safeCount = Math.max(1, Math.floor(nextCount));
  if (safeCount !== boxCount) {
    boxCount = safeCount;
    populateTargetBoxOptions();
  }
  return boxCount;
}

function ensureBoxCount(minCount = 1) {
  const maxIdx = allCards.reduce((max, card) => {
    const idx = getBoxIndexFromName(card.boxName);
    return idx > max ? idx : max;
  }, -1);
  const needed = Math.max(maxIdx + 1, minCount);
  return setBoxCount(Math.max(needed, boxCount));
}

function populateTargetBoxOptions() {
  if (!targetBoxSelect) return;
  targetBoxSelect.innerHTML = "";
  for (let i = 0; i < boxCount; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = getBoxName(i);
    targetBoxSelect.appendChild(option);
  }
}

function updateBoxHeader() {
  if (!currentBoxLabel) return;
  currentBoxLabel.textContent = getBoxName(currentBoxIndex);
}

function getBoxCounts() {
  const counts = [];
  allCards.forEach((card) => {
    const idx = getBoxIndexFromName(card.boxName);
    if (idx >= 0) {
      if (counts[idx] == null) counts[idx] = 0;
      counts[idx] += 1;
    }
  });
  const length = Math.max(counts.length, boxCount, currentBoxIndex + 1, 1);
  const normalized = Array(length).fill(0);
  counts.forEach((val, idx) => {
    if (val != null) normalized[idx] = val;
  });
  setBoxCount(length);
  return normalized;
}

function findNextBoxWithSpace(startIndex = 0, counts) {
  const tally = counts ? [...counts] : getBoxCounts();
  for (let i = 0; i < tally.length; i++) {
    if (tally[i] == null) tally[i] = 0;
  }

  for (let i = startIndex; i < tally.length; i++) {
    if (tally[i] < BOX_CAPACITY) return i;
  }

  // All current boxes are full; create a new box index.
  const newIndex = tally.length;
  setBoxCount(newIndex + 1);
  return newIndex;
}

function extractCardIdsFromRequest(req) {
  if (!req) return [];
  if (Array.isArray(req.cardIds) && req.cardIds.length) {
    return req.cardIds.filter(Boolean);
  }
  if (Array.isArray(req.cart) && req.cart.length) {
    return req.cart.map((c) => c.id).filter(Boolean);
  }
  return [];
}

// Initialize box options with at least one box
setBoxCount(1);

// ---------- Auth gate ----------
function toggleAuthUI(isSignedIn) {
  if (adminAppShell) adminAppShell.classList.toggle("hidden", !isSignedIn);
  if (loginOverlay) loginOverlay.classList.toggle("hidden", isSignedIn);
}

function resetAdminUi() {
  adminAppStarted = false;
  selectedCardId = null;
  allCards = [];
  clearCardsContainer();
  selectCard(null);
}

async function startAdminApp() {
  if (adminAppStarted) return;
  adminAppStarted = true;
  try {
    updateBoxHeader();
    await loadThemeSettingsFromCloud();
    loadLocalPaymentIcons();
    loadBoxLabelGif();
    loadSpriteGif();
    loadPreviewGif();
    loadOverlayGif();
    loadOverlayGif2();
    await loadAllCards();
    await enforceBoxCapacity();
    await loadTradeRequests();
    renderCards();
    selectCard(null);
  } catch (err) {
    adminAppStarted = false;
    throw err;
  }
}

function applyBoxLabelGif(url, persist = true) {
  const finalUrl = (url || DEFAULT_LABEL_GIF || "").trim();
  const value = finalUrl ? `url("${finalUrl}")` : "";
  if (value) {
    document.documentElement.style.setProperty("--box-label-gif", value);
  } else {
    document.documentElement.style.removeProperty("--box-label-gif");
  }
  if (persist) {
    if (finalUrl) {
      localStorage.setItem("boxLabelGif", finalUrl);
    } else {
      localStorage.removeItem("boxLabelGif");
    }
  }
  if (boxLabelGifUrlInput) boxLabelGifUrlInput.value = finalUrl;
}

function loadBoxLabelGif() {
  const saved = localStorage.getItem("boxLabelGif");
  applyBoxLabelGif(saved || DEFAULT_LABEL_GIF, false);
}

function applySpriteGif(url, persist = true) {
  const finalUrl = url || DEFAULT_SPRITE_GIF;
  const value = finalUrl ? `url("${finalUrl}")` : "none";
  document.documentElement.style.setProperty("--sprite-gif", value);
  document.documentElement.style.setProperty("--sprite-grid-gif", value);
  if (persist) {
    if (url) {
      localStorage.setItem("spriteGif", finalUrl);
    } else {
      localStorage.removeItem("spriteGif");
    }
  }
  if (spriteGifUrlInput) spriteGifUrlInput.value = url || "";
}

function loadSpriteGif() {
  const saved = localStorage.getItem("spriteGif");
  applySpriteGif(saved || DEFAULT_SPRITE_GIF, false);
}

function applyPreviewGif(url, persist = true) {
  const finalUrl = url || DEFAULT_PREVIEW_GIF;
  const value = finalUrl ? `url("${finalUrl}")` : "none";
  document.documentElement.style.setProperty("--preview-gif", value);
  if (persist) {
    if (url) {
      localStorage.setItem("previewGif", finalUrl);
    } else {
      localStorage.removeItem("previewGif");
    }
  }
  if (previewGifUrlInput) previewGifUrlInput.value = url || "";
}

function loadPreviewGif() {
  const saved = localStorage.getItem("previewGif");
  applyPreviewGif(saved || DEFAULT_PREVIEW_GIF, false);
}

function applyOverlayGif(url, persist = true) {
  const finalUrl = url || DEFAULT_OVERLAY_GIF;
  const value = finalUrl ? `url("${finalUrl}")` : "none";
  document.documentElement.style.setProperty("--overlay-gif", value);
  if (persist) {
    if (url && url.length <= MAX_LOCAL_VALUE && !url.startsWith("data:")) {
      localStorage.setItem("overlayGif", finalUrl);
    } else if (!url) {
      localStorage.removeItem("overlayGif");
    }
  }
  if (overlayGifUrlInput) overlayGifUrlInput.value = url || "";
}

function loadOverlayGif() {
  const saved = localStorage.getItem("overlayGif");
  applyOverlayGif(saved || DEFAULT_OVERLAY_GIF, false);
}

function applyOverlayGif2(url, persist = true) {
  const finalUrl = url || "";
  const value = finalUrl ? `url("${finalUrl}")` : "none";
  document.documentElement.style.setProperty("--overlay-gif-2", value);
  // overlay 2 removed
}

function loadOverlayGif2() {
  // overlay 2 removed
}

function getUpcomingWeekDates() {
  const today = new Date();
  const day = today.getDay(); // 0 = Sun, 1 = Mon, 6 = Sat
  const daysUntilMon = (1 - day + 7) % 7; // if today is Mon, use today
  const mon = new Date(today);
  mon.setDate(today.getDate() + daysUntilMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { mon: toISO(mon), sun: toISO(sun) };
}

function applyAvailabilityInputs(avail = {}) {
  const isekai = avail.isekai || {};
  const aspen = avail.aspen || {};
  // Defaults: Isekai closed Mon, Aspen open all week
  const isekaiUnavailable = isekai.unavailableDays || ["mon"];
  const aspenUnavailable = aspen.unavailableDays || [];
  const aspenDayTimes = aspen.dayTimes || {};
  if (availIsekaiStartInput) availIsekaiStartInput.value = isekai.startDate || "";
  if (availIsekaiEndInput) availIsekaiEndInput.value = isekai.endDate || "";
  if (availIsekaiStartTimeInput) availIsekaiStartTimeInput.value = isekai.startTime || "";
  if (availIsekaiEndTimeInput) availIsekaiEndTimeInput.value = isekai.endTime || "";
  if (availAspenStartInput) availAspenStartInput.value = aspen.startDate || "";
  if (availAspenEndInput) availAspenEndInput.value = aspen.endDate || "";
  if (availAspenStartTimeInput) availAspenStartTimeInput.value = aspen.startTime || "";
  if (availAspenEndTimeInput) availAspenEndTimeInput.value = aspen.endTime || "";

  dayCheckboxGroups.forEach((group) => {
    const loc = group.dataset.location;
    const blocked = loc === "isekai" ? isekaiUnavailable : aspenUnavailable;
    group
      .querySelectorAll('input[type="checkbox"]')
      .forEach((cb) => (cb.checked = blocked.includes(cb.value)));
  });

  aspenDayRows.forEach((row) => {
    const day = row.dataset.day;
    const config = aspenDayTimes[day] || {};
    const start = row.querySelector(".day-start");
    const end = row.querySelector(".day-end");
    if (start) start.value = config.start || "";
    if (end) end.value = config.end || "";
  });
}

function gatherAvailabilityPayload() {
  return {
    isekai: {
      startDate: availIsekaiStartInput?.value || "",
      endDate: availIsekaiEndInput?.value || "",
      startTime: availIsekaiStartTimeInput?.value || "",
      endTime: availIsekaiEndTimeInput?.value || "",
      unavailableDays: Array.from(
        document.querySelectorAll('.day-checkbox-group[data-location="isekai"] input[type="checkbox"]:checked')
      ).map((cb) => cb.value),
    },
    aspen: {
      startDate: availAspenStartInput?.value || "",
      endDate: availAspenEndInput?.value || "",
      startTime: availAspenStartTimeInput?.value || "",
      endTime: availAspenEndTimeInput?.value || "",
      unavailableDays: Array.from(
        document.querySelectorAll('.day-checkbox-group[data-location="aspen"] input[type="checkbox"]:checked')
      ).map((cb) => cb.value),
      dayTimes: Array.from(aspenDayRows).reduce((acc, row) => {
        const day = row.dataset.day;
        const start = row.querySelector(".day-start")?.value || "";
        const end = row.querySelector(".day-end")?.value || "";
        if (start || end) acc[day] = { start, end };
        return acc;
      }, {}),
    },
  };
}

function statusPillClass(status) {
  const key = String(status || "pending").toLowerCase();
  return `pill-status ${key}`;
}

function renderTradeRequests(requests = []) {
  tradeRequestsCache = requests;
  if (!tradeRequestsList) return;
  tradeRequestsList.innerHTML = "";
  if (!requests.length) {
    const p = document.createElement("p");
    p.className = "panel-hint";
    p.textContent = "No requests loaded.";
    tradeRequestsList.appendChild(p);
    return;
  }

  requests.forEach((req, idx) => {
    const card = document.createElement("div");
    card.className = "trade-request-card";

    const header = document.createElement("div");
    header.className = "trade-request-meta";
    const name = document.createElement("strong");
    name.textContent = req.name || "Unknown";
    const status = document.createElement("span");
    status.className = statusPillClass(req.status);
    status.textContent = (req.status || "pending").toUpperCase();
    header.append(name, status);

    const details = document.createElement("div");
    details.className = "trade-request-meta";
    details.textContent = `${req.location || "—"} • ${req.date || "—"} ${req.time || ""}`;

    const contact = document.createElement("div");
    contact.className = "trade-request-meta";
    contact.textContent = `Email: ${req.email || "—"} • Phone: ${req.phone || "—"}`;

    const items = document.createElement("div");
    items.className = "trade-request-meta";
    const cartLines =
      Array.isArray(req.cart) && req.cart.length
        ? req.cart
            .map((item, idx) => {
              const label = item.name || item.id || `Item ${idx + 1}`;
              const setNum =
                item.setNumber != null && item.setNumber !== ""
                  ? ` • Set #: ${item.setNumber}`
                  : "";
              const price =
                item.price != null && !Number.isNaN(Number(item.price))
                  ? `$${Number(item.price).toFixed(2)}`
                  : "";
              return `${label}${setNum}${price ? ` (${price})` : ""}`;
            })
            .join(" • ")
        : "No items.";
    items.textContent = `Items: ${cartLines}`;

    const actions = document.createElement("div");
    actions.className = "trade-request-actions";
    const buttons = [
      { label: "Pending", status: "pending" },
      { label: "Sold", status: "sold" },
      { label: "Delete", status: "delete" },
    ];
    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b.label;
      btn.addEventListener("click", () => {
        if (b.status === "delete") {
          deleteTradeRequest(req.id);
        } else {
          updateTradeRequestStatus(req.id, b.status);
        }
      });
      actions.appendChild(btn);
    });

    card.append(header, details, contact, items, actions);
    if (req.id) {
      const idRow = document.createElement("div");
      idRow.className = "trade-request-meta";
      idRow.textContent = `ID: ${req.id}`;
      card.appendChild(idRow);
    }

    card.addEventListener("click", (ev) => {
      if (ev.target.closest("button")) return;
      selectRequestByIndex(idx);
    });

    tradeRequestsList.appendChild(card);
  });
}

async function loadTradeRequests() {
  if (!tradeRequestsList) return;
  try {
    setStatus("Loading trade requests...");
    const colRef = collection(db, "tradeRequests");
    let snap;
    try {
      const q = query(colRef, orderBy("createdAt", "desc"));
      snap = await getDocs(q);
    } catch {
      snap = await getDocs(colRef);
    }
    const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTradeRequests(requests);
    tradeRequestsCache = requests;
    clearRequestHighlight(true);
    setStatus("Ready.");
  } catch (err) {
    console.warn("Failed to load trade requests", err);
    setStatus("Failed to load trade requests.");
  }
}

async function updateTradeRequestStatus(id, status) {
  if (!id || !status) return;
  try {
    setStatus(`Updating request ${id}...`);
    await updateDoc(doc(db, "tradeRequests", id), { status });
    tradeRequestsCache = tradeRequestsCache.map((req) =>
      req.id === id ? { ...req, status } : req
    );
    renderTradeRequests(tradeRequestsCache);
    const target = tradeRequestsCache.find((r) => r.id === id);
    const cardIds = extractCardIdsFromRequest(target);
    if (cardIds.length) {
      if (status === "sold") {
        await deleteCardsAndAssets(cardIds);
      } else {
        const updates =
          status === "sold"
            ? { held: false, sold: true }
            : { held: true, sold: false };
        await updateCardFlags(cardIds, updates);
      }
    }
    await loadTradeRequests();
    setStatus(`Updated request ${id} to ${status}.`);
  } catch (err) {
    console.warn("Failed to update request status", err);
    setStatus("Failed to update request.");
  }
}

async function updateCardFlags(cardIds, updates) {
  const batch = writeBatch(db);
  cardIds.forEach((id) => {
    batch.set(doc(db, "cards", id), updates, { merge: true });
  });
  await batch.commit();
}

async function deleteCardAndAssets(card) {
  if (!card?.id) return;
  const assetUrls = [card.cardImageUrl, card.imageUrl, card.spriteUrl].filter(Boolean);
  await deleteDoc(doc(db, "cards", card.id));
  await Promise.allSettled(
    assetUrls.map((url) => {
      try {
        // ref does not accept full URLs; ignore errors if invalid
        const assetRef = ref(storage, url);
        return deleteObject(assetRef);
      } catch {
        return Promise.resolve();
      }
    })
  );
}

async function deleteCardsAndAssets(cardIds) {
  const targets = allCards.filter((c) => cardIds.includes(c.id));
  if (!targets.length) return;
  try {
    setStatus("Removing sold cards...");
    await Promise.allSettled(targets.map((card) => deleteCardAndAssets(card)));
    allCards = allCards.filter((c) => !cardIds.includes(c.id));
    cardIds.forEach((id) => requestTagMap.delete(id));
    ensureBoxCount();
    renderCards();
    selectCard(null);
  } catch (err) {
    console.warn("Failed to delete sold cards", err);
    setStatus("Failed to remove sold cards.");
  }
}

async function deleteTradeRequest(id) {
  if (!id) return;
  const ok = confirm("Delete this request? This cannot be undone.");
  if (!ok) return;
  try {
    setStatus(`Deleting request ${id}...`);
    const target = tradeRequestsCache.find((r) => r.id === id);
    const cardIds = extractCardIdsFromRequest(target);
    // Release holds on delete if not sold
    if (cardIds.length && target?.status !== "sold") {
      await updateCardFlags(cardIds, { held: false });
    }
    await deleteDoc(doc(db, "tradeRequests", id));
    tradeRequestsCache = tradeRequestsCache.filter((req) => req.id !== id);
    renderTradeRequests(tradeRequestsCache);
    setStatus("Request deleted.");
  } catch (err) {
    console.warn("Failed to delete request", err);
    setStatus("Failed to delete request.");
  }
}

async function autoPackBoxes() {
  if (!allCards.length) return;
  try {
    setStatus("Auto-packing boxes...");
    const sorted = [...allCards].sort(
      (a, b) => (a.createdAt || 0) - (b.createdAt || 0)
    );
    const updates = [];
    let moved = 0;
    sorted.forEach((card, idx) => {
      const targetBoxIdx = Math.floor(idx / BOX_CAPACITY);
      const targetName = getBoxName(targetBoxIdx);
      if (card.boxName !== targetName) {
        card.boxName = targetName;
        moved += 1;
        updates.push(updateDoc(doc(db, "cards", card.id), { boxName: targetName }));
      }
    });
    setBoxCount(Math.ceil(sorted.length / BOX_CAPACITY));
    await Promise.allSettled(updates);
    allCards = sorted;
    renderCards();
    setStatus(
      moved
        ? `Auto-packed boxes. Moved ${moved} card${moved === 1 ? "" : "s"}.`
        : "Auto-pack complete. No moves needed."
    );
  } catch (err) {
    console.error("Auto-pack failed", err);
    setStatus("Auto-pack failed.");
  }
}

function applyPaymentIcon(id, url, persist = true) {
  const finalUrl = url || DEFAULT_PAYMENT_ICONS[id] || "";
  if (persist) {
    if (finalUrl) {
      localStorage.setItem(`paymentIcon_${id}`, finalUrl);
    } else {
      localStorage.removeItem(`paymentIcon_${id}`);
    }
  }
}

function loadLocalPaymentIcons() {
  Object.keys(DEFAULT_PAYMENT_ICONS).forEach((key) => {
    const saved = localStorage.getItem(`paymentIcon_${key}`);
    if (saved) applyPaymentIcon(key, saved, false);
  });
}

function applyRequestTagsToCards() {
  if (!allCards || !allCards.length) return;
  allCards = allCards.map((card) => ({
    ...card,
    requestTagLabel: requestTagMap.get(card.id) || null,
  }));
}

function selectRequestByIndex(index) {
  if (!tradeRequestsCache.length) return;
  const total = tradeRequestsCache.length;
  const normalized = ((index % total) + total) % total; // wrap around
  const req = tradeRequestsCache[normalized];
  const label = normalized + 1;
  const ids = extractCardIdsFromRequest(req);
  if (!ids.length) {
    alert("No cards attached to this request.");
    return;
  }
  requestTagMap = new Map();
  ids.forEach((id) => requestTagMap.set(id, label));
  applyRequestTagsToCards();
  renderCards();
  activeRequestIndex = normalized;
  activeRequestLabel = label;
  updateActiveRequestBanner(req, label, total);
  setStatus(`Highlighted ${ids.length} card${ids.length === 1 ? "" : "s"} for request ${label}.`);
}

function clearRequestHighlight(silent = false) {
  requestTagMap = new Map();
  applyRequestTagsToCards();
  renderCards();
  activeRequestLabel = null;
  activeRequestIndex = -1;
  updateActiveRequestBanner();
  if (!silent) setStatus("Cleared request highlight.");
}

function updateActiveRequestBanner(req = null, label = null, total = null) {
  if (!activeRequestBanner || !activeRequestText) return;
  const show = req && label != null;
  activeRequestBanner.classList.toggle("hidden", !show);
  if (show) {
    const name = req.name || req.id || `Request ${label}`;
    const count = extractCardIdsFromRequest(req).length;
    const countText = `${count} item${count === 1 ? "" : "s"}`;
    const totalText = total ? ` / ${total}` : "";
    activeRequestText.textContent = `REQ ${label}${totalText}: ${name} • ${countText}`;
  }
}

async function saveThemeSettings(partial) {
  try {
    await setDoc(THEME_DOC_REF, partial, { merge: true });
  } catch (err) {
    console.warn("Theme save failed; kept locally.", err);
    setStatus("Saved locally; cloud sync failed.");
  }
}

function canSaveToCloud(val) {
  if (!val) return true;
  if (typeof val !== "string") return true;
  if (val.startsWith("data:")) return false;
  return val.length <= MAX_CLOUD_VALUE;
}

async function uploadThemeAsset(file, key, applyFn, label = "asset") {
  if (!file || !applyFn) return;
  try {
    setStatus(`Uploading ${label}...`);
    const url = await uploadImage(file, `theme-${key}`);
    if (!url) {
      setStatus(`Upload failed for ${label}.`);
      return;
    }
    applyFn(url);
    await saveThemeSettings({ [key]: url });
    setStatus(`${label} saved.`);
  } catch (err) {
    console.error(`Error uploading ${label}`, err);
    setStatus(`Error uploading ${label}.`);
  }
}

async function loadThemeSettingsFromCloud() {
  try {
    const snap = await getDoc(THEME_DOC_REF);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    if ("boxLabelGif" in data) applyBoxLabelGif(data.boxLabelGif || "", false);
    if ("spriteGif" in data) applySpriteGif(data.spriteGif || "", false);
    if ("previewGif" in data) applyPreviewGif(data.previewGif || "", false);
    if ("overlayGif" in data) applyOverlayGif(data.overlayGif || "", false);
    if (data.pickupAvailability) {
      const fallback = data.pickupAvailability;
      // tolerate old timeWindow values by mapping to startTime/endTime when missing
      ["isekai", "aspen"].forEach((key) => {
        const entry = fallback[key] || {};
        if (!entry.startTime && entry.timeWindow) {
          entry.startTime = entry.timeWindow;
        }
        if (!entry.endTime) entry.endTime = "";
        if (!Array.isArray(entry.unavailableDays)) {
          entry.unavailableDays = key === "isekai" ? ["mon"] : [];
        }
        if (!entry.dayTimes) entry.dayTimes = {};
        fallback[key] = entry;
      });
      applyAvailabilityInputs(fallback);
    }
    if (data.paymentIcons) {
      Object.entries(data.paymentIcons).forEach(([key, val]) => {
        applyPaymentIcon(key, val, false);
      });
    }
  } catch (err) {
    console.warn("Theme load failed; using local values.", err);
  }
}

// Upload an image to Firebase Storage and return its download URL
async function uploadImage(file, folder) {
  if (!file) return null;
  const path = `${folder}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
}

// ---------- Loading & rendering ----------
function debounce(fn, delay) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

const renderCardsDebounced = debounce(renderCards, 120);
async function loadAllCards() {
  setStatus("Loading cards...");
  const snap = await getDocs(collection(db, "cards"));
  allCards = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      cardClass: data.cardClass || "Pokemon",
    };
  });
  console.log("[admin] Loaded cards:", allCards);
  ensureBoxCount();
  applyRequestTagsToCards();
  setStatus("Ready.");
}

function getCardsForCurrentBox() {
  const name = getBoxName(currentBoxIndex);
  return allCards.filter((c) => c.boxName === name);
}

function matchesFilters(card) {
  const search = (searchInput?.value || "").toLowerCase().trim();
  const setFilter = filterSetNumber ? filterSetNumber.value : "Any";
  const conditionFilter = filterCondition ? filterCondition.value : "Any";
  const classFilter = filterClass ? filterClass.value : "Any";

  const matchesSearch =
    !search ||
    (card.name || "").toLowerCase().includes(search) ||
    (card.set || "").toLowerCase().includes(search);

  const setNumStr = card.setNumber != null ? String(card.setNumber) : "";
  const matchesSetNumber =
    setFilter === "Any" || setNumStr === String(setFilter);

  const matchesCondition =
    conditionFilter === "Any" || card.condition === conditionFilter;

  const matchesClass =
    classFilter === "Any" ||
    (card.cardClass || "Pokemon").toLowerCase() ===
      String(classFilter).toLowerCase();

  return matchesSearch && matchesSetNumber && matchesCondition && matchesClass;
}

function clearCardsContainer() {
  if (cardsContainer) cardsContainer.innerHTML = "";
}

function renderCards() {
  if (!cardsContainer) return;

  clearCardsContainer();
  updateBoxHeader();

  const cards = getCardsForCurrentBox().filter(matchesFilters).slice(0, BOX_CAPACITY);

  if (!cards.length) {
    cardsContainer.classList.add("empty");
    if (noCardsMessage) noCardsMessage.classList.remove("hidden");
    return;
  }

  cardsContainer.classList.remove("empty");
  if (noCardsMessage) noCardsMessage.classList.add("hidden");

  const fragment = document.createDocumentFragment();

  cards.forEach((card) => {
    const slot = document.createElement("button");
    slot.className = "admin-card-slot";
    slot.dataset.cardId = card.id;

    if (card.requestTagLabel) {
      slot.classList.add("has-request-tag");
      const badge = document.createElement("span");
      badge.className = "request-badge";
      badge.textContent = `REQ ${card.requestTagLabel}`;
      slot.appendChild(badge);
    }

    const imageWrapper = document.createElement("div");
    imageWrapper.className = "admin-card-image-wrapper";

    const img = document.createElement("img");
    img.className = "admin-card-sprite";
    img.loading = "lazy";
    img.decoding = "async";

    // Use sprite if we have it, otherwise fall back to card image
    if (card.spriteUrl) {
      img.src = card.spriteUrl;
    } else if (card.cardImageUrl || card.imageUrl) {
      img.src = card.cardImageUrl || card.imageUrl;
    }

    const nameLabel = document.createElement("div");
    nameLabel.className = "admin-card-label";
    nameLabel.textContent = card.name || "Unknown";

    imageWrapper.appendChild(img);
    slot.appendChild(imageWrapper);
    slot.appendChild(nameLabel);

    slot.addEventListener("click", () => selectCard(card.id));
    fragment.appendChild(slot);
  });

  cardsContainer.appendChild(fragment);
}

// ---------- Selection / preview ----------
function selectCard(cardId) {
  selectedCardId = cardId;
  const card = allCards.find((c) => c.id === cardId) || null;

  if (!card) {
    // Reset preview
    if (selectedNameEl) selectedNameEl.textContent = "No card selected";
    if (selectedSetEl) selectedSetEl.textContent = "Set: —";
    if (selectedSetNumberEl) selectedSetNumberEl.textContent = "Set Number: —";
    if (selectedConditionEl) selectedConditionEl.textContent = "Condition: —";
    if (selectedClassEl) selectedClassEl.textContent = "Class: —";
    if (selectedQtyEl) selectedQtyEl.textContent = "Quantity: —";
    if (selectedPriceEl) selectedPriceEl.textContent = "Price: —";

  if (cardImage) {
    cardImage.src = "";
      cardImage.classList.add("hidden");
    }
    if (portraitInitial) {
      portraitInitial.textContent = "?";
      portraitInitial.classList.remove("hidden");
    }

    if (deleteBtn) deleteBtn.disabled = true;
    if (editPriceInput) editPriceInput.value = "0.00";
    if (updatePriceBtn) updatePriceBtn.disabled = true;
    return;
  }

  // Text details
  if (selectedNameEl) selectedNameEl.textContent = card.name || "Unknown";
  if (selectedSetEl)
    selectedSetEl.textContent = `Set: ${card.set || "Unknown"}`;
  if (selectedSetNumberEl)
    selectedSetNumberEl.textContent = `Set Number: ${
      card.setNumber ?? "—"
    }`;
  if (selectedConditionEl)
    selectedConditionEl.textContent = `Condition: ${
      card.condition || "Unknown"
    }`;
  if (selectedClassEl)
    selectedClassEl.textContent = `Class: ${card.cardClass || "Pokemon"}`;
  if (selectedQtyEl)
    selectedQtyEl.textContent = `Quantity: ${card.quantity ?? 1}`;
  if (selectedPriceEl)
    selectedPriceEl.textContent = `Price: $${Number(
      card.price || 0
    ).toFixed(2)}`;
  if (editPriceInput) {
    const priceNum = Number(card.price || 0);
    editPriceInput.value = Number.isFinite(priceNum)
      ? priceNum.toFixed(2)
      : "0.00";
  }
  if (updatePriceBtn) updatePriceBtn.disabled = false;

  // ---- IMAGE PRIORITY FOR PREVIEW ----
  const imageUrl =
    card.cardImageUrl || card.imageUrl || card.spriteUrl || "";

  if (imageUrl && cardImage) {
    cardImage.src = imageUrl;
    cardImage.classList.remove("hidden");
    if (portraitInitial) portraitInitial.classList.add("hidden");
  } else {
    if (cardImage) {
      cardImage.src = "";
      cardImage.classList.add("hidden");
    }
    if (portraitInitial) {
      portraitInitial.textContent = (card.name || "?")
        .charAt(0)
        .toUpperCase();
      portraitInitial.classList.remove("hidden");
    }
  }

  if (deleteBtn) deleteBtn.disabled = false;
}

// ---------- Add card ----------
async function handleAddCard(e) {
  e.preventDefault();
  try {
    setStatus("Adding card...");

    const name = cardNameInput.value.trim();
  const set = cardSetInput.value.trim();
  const setNumber = cardSetNumberInput.value.trim();
  const condition = cardConditionInput.value;
  const cardClass = cardClassSelect?.value || "Pokemon";
  const quantity = Number(cardQuantityInput.value || "1");
  const price = Number(cardPriceInput.value || "0");

    const counts = getBoxCounts();
    const targetBoxIndex = findNextBoxWithSpace(currentBoxIndex, counts);
    if (targetBoxIndex == null) {
      alert("All boxes are full (30 cards each). Delete a card to add more.");
      setStatus("All boxes are full. Delete a card to add more.");
      return;
    }
    const boxName = getBoxName(targetBoxIndex);

    if (!name) {
      alert("Please enter a card name.");
      setStatus("Name is required.");
      return;
    }

    // Upload images if provided
    const imageFile = cardImageFileInput.files[0] || null;
    const spriteFile = cardSpriteFileInput.files[0] || null;

    const [imageUrl, spriteUrl] = await Promise.all([
      uploadImage(imageFile, "cardImages"),
      uploadImage(spriteFile, "cardSprites"),
    ]);

    // Save to Firestore
    const payload = {
      name,
      set,
      setNumber,
      condition,
      cardClass,
      quantity,
      price,
      boxName,
      cardImageUrl: imageUrl || null,
      spriteUrl: spriteUrl || null,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(collection(db, "cards"), payload);

    const newCard = { id: docRef.id, ...payload };
    allCards.push(newCard);

    // Reset form + preview
    cardForm.reset();
    if (cardQuantityInput) cardQuantityInput.value = "1";

    if (cardImage) {
      cardImage.src = "";
      cardImage.classList.add("hidden");
    }
    if (portraitInitial) {
      portraitInitial.textContent = "?";
      portraitInitial.classList.remove("hidden");
    }

    setStatus(
      targetBoxIndex === currentBoxIndex
        ? "Card added."
        : `Current box full. Added to ${boxName}.`
    );
    renderCards();
    selectCard(newCard.id);
  } catch (err) {
    console.error("Error adding card:", err);
    setStatus("Error adding card.");
  }
}

// ---------- Delete card ----------
async function handleDeleteCard() {
  if (!selectedCardId) return;
  const card = allCards.find((c) => c.id === selectedCardId);
  if (!card) return;

  const confirmDelete = confirm(
    `Delete "${card.name}" from ${card.boxName}? This cannot be undone.`
  );
  if (!confirmDelete) return;

  try {
    setStatus("Deleting card...");
    await deleteCardAndAssets(card);
    allCards = allCards.filter((c) => c.id !== selectedCardId);
    selectedCardId = null;
    renderCards();
    selectCard(null);
    setStatus("Card deleted.");
  } catch (err) {
    console.error("Error deleting card:", err);
    setStatus("Error deleting card.");
  }
}

// ---------- Update price ----------
async function handleUpdatePrice() {
  if (!selectedCardId) return;
  if (!editPriceInput) return;
  const raw = editPriceInput.value;
  const price = Number(raw);
  if (!Number.isFinite(price) || price < 0) {
    alert("Enter a valid price (0 or higher).");
    return;
  }
  try {
    setStatus("Updating price...");
    await updateDoc(doc(db, "cards", selectedCardId), { price });
    // Update local cache
    const card = allCards.find((c) => c.id === selectedCardId);
    if (card) card.price = price;
    renderCards();
    selectCard(selectedCardId);
    setStatus("Price updated.");
  } catch (err) {
    console.error("Error updating price:", err);
    setStatus("Error updating price.");
  }
}

// ---------- Box navigation ----------
function gotoPrevBox() {
  if (currentBoxIndex === 0) return;
  currentBoxIndex -= 1;
  renderCards();
  selectCard(null);
}

function gotoNextBox() {
  currentBoxIndex += 1;
  ensureBoxCount(currentBoxIndex + 1);
  renderCards();
  selectCard(null);
}

async function enforceBoxCapacity() {
  if (!allCards.length) return;

  const counts = getBoxCounts();
  const updates = [];
  let moved = 0;

  for (let boxIdx = 0; boxIdx < counts.length; boxIdx++) {
    const cardsInBox = allCards
      .filter((c) => getBoxIndexFromName(c.boxName) === boxIdx)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    if (cardsInBox.length <= BOX_CAPACITY) continue;

    const overflow = cardsInBox.slice(BOX_CAPACITY);
    overflow.forEach((card) => {
      const targetIdx = findNextBoxWithSpace(boxIdx + 1, counts);
      if (targetIdx == null) return;
      const targetName = getBoxName(targetIdx);
      if (counts[targetIdx] == null) counts[targetIdx] = 0;
      counts[targetIdx] += 1;
      counts[boxIdx] -= 1;
      card.boxName = targetName;
      moved += 1;
      updates.push(updateDoc(doc(db, "cards", card.id), { boxName: targetName }));
    });
  }

  if (updates.length) {
    await Promise.allSettled(updates);
    setStatus(`Moved ${moved} card${moved === 1 ? "" : "s"} to the next box to keep 30 per box.`);
  }
}

// ---------- Auth listeners ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    toggleAuthUI(true);
    if (loginStatusEl) {
      loginStatusEl.textContent = "";
      loginStatusEl.classList.remove("error");
    }
    try {
      await startAdminApp();
      setStatus("Ready.");
    } catch (err) {
      console.error("Failed to load admin", err);
      setStatus("Could not load admin data. Refresh and try again.");
    }
  } else {
    toggleAuthUI(false);
    resetAdminUi();
    if (loginStatusEl) {
      loginStatusEl.textContent = "";
      loginStatusEl.classList.remove("error");
    }
    if (loginPasswordInput) loginPasswordInput.value = "";
    setStatus("Please sign in to manage inventory.");
  }
});

// ---------- Event wiring ----------
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmailInput?.value?.trim() || "";
    const password = loginPasswordInput?.value || "";
    if (!email || !password) {
      if (loginStatusEl) {
        loginStatusEl.textContent = "Enter your email and password.";
        loginStatusEl.classList.add("error");
      }
      return;
    }
    if (loginStatusEl) {
      loginStatusEl.textContent = "Signing in...";
      loginStatusEl.classList.remove("error");
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.warn("Login failed", err);
      if (loginStatusEl) {
        loginStatusEl.textContent = "Login failed. Check your email/password.";
        loginStatusEl.classList.add("error");
      }
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => signOut(auth));
}

if (cardForm) cardForm.addEventListener("submit", handleAddCard);
if (deleteBtn) deleteBtn.addEventListener("click", handleDeleteCard);
if (updatePriceBtn) updatePriceBtn.addEventListener("click", handleUpdatePrice);

if (prevBoxBtn) prevBoxBtn.addEventListener("click", gotoPrevBox);
if (nextBoxBtn) nextBoxBtn.addEventListener("click", gotoNextBox);

// Box label GIF controls
if (boxLabelGifApplyBtn) {
  boxLabelGifApplyBtn.addEventListener("click", () => {
    const url = boxLabelGifUrlInput?.value?.trim();
    const finalUrl = url || DEFAULT_LABEL_GIF;
    applyBoxLabelGif(finalUrl);
    if (canSaveToCloud(finalUrl)) {
      saveThemeSettings({ boxLabelGif: finalUrl });
      setStatus(url ? "Applied box label background from URL." : "Reverted to default box label background.");
    } else {
      setStatus("Applied locally; not saved to cloud (too large or data URL).");
    }
  });
}

if (boxLabelGifFileInput) {
  boxLabelGifFileInput.addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    await uploadThemeAsset(file, "boxLabelGif", applyBoxLabelGif, "Box label GIF");
    boxLabelGifFileInput.value = "";
  });
}

// Sprite GIF controls
if (spriteGifApplyBtn) {
  spriteGifApplyBtn.addEventListener("click", () => {
    const url = spriteGifUrlInput?.value?.trim();
    const finalUrl = url || DEFAULT_SPRITE_GIF;
    applySpriteGif(finalUrl);
    if (canSaveToCloud(finalUrl)) {
      saveThemeSettings({ spriteGif: finalUrl });
      setStatus(url ? "Applied sprite background from URL." : "Reverted to default sprite background.");
    } else {
      setStatus("Applied locally; not saved to cloud (too large or data URL).");
    }
  });
}

// Preview GIF controls
if (previewGifApplyBtn) {
  previewGifApplyBtn.addEventListener("click", () => {
    const url = previewGifUrlInput?.value?.trim();
    const finalUrl = url || DEFAULT_PREVIEW_GIF;
    applyPreviewGif(finalUrl);
    if (canSaveToCloud(finalUrl)) {
      saveThemeSettings({ previewGif: finalUrl });
      setStatus(url ? "Applied preview placeholder background from URL." : "Reverted to default preview placeholder background.");
    } else {
      setStatus("Applied locally; not saved to cloud (too large or data URL).");
    }
  });
}

// Overlay GIF controls
if (overlayGifApplyBtn) {
  overlayGifApplyBtn.addEventListener("click", () => {
    const url = overlayGifUrlInput?.value?.trim();
    const finalUrl = url || DEFAULT_OVERLAY_GIF;
    applyOverlayGif(finalUrl);
    if (canSaveToCloud(finalUrl)) {
      saveThemeSettings({ overlayGif: finalUrl });
      setStatus(url ? "Applied overlay background from URL." : "Cleared overlay background.");
    } else {
      setStatus("Applied locally; not saved to cloud (too large or data URL).");
    }
  });
}

if (overlayGifFileInput) {
  overlayGifFileInput.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    uploadThemeAsset(file, "overlayGif", (url) => applyOverlayGif(url, false), "Overlay GIF").finally(
      () => {
        overlayGifFileInput.value = "";
      }
    );
  });
}

if (setIsekaiWeekendBtn) {
  setIsekaiWeekendBtn.addEventListener("click", () => {
    const { mon, sun } = getUpcomingWeekDates();
    if (availIsekaiStartInput) availIsekaiStartInput.value = mon;
    if (availIsekaiEndInput) availIsekaiEndInput.value = sun;
  });
}

if (setAspenWeekendBtn) {
  setAspenWeekendBtn.addEventListener("click", () => {
    const { mon, sun } = getUpcomingWeekDates();
    if (availAspenStartInput) availAspenStartInput.value = mon;
    if (availAspenEndInput) availAspenEndInput.value = sun;
  });
}

if (saveAvailabilityBtn) {
  saveAvailabilityBtn.addEventListener("click", async () => {
    const payload = gatherAvailabilityPayload();
    await saveThemeSettings({ pickupAvailability: payload });
    setStatus("Saved pickup availability.");
  });
}

if (previewGifFileInput) {
  previewGifFileInput.addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    await uploadThemeAsset(file, "previewGif", applyPreviewGif, "Preview GIF");
    previewGifFileInput.value = "";
  });
}

if (spriteGifFileInput) {
  spriteGifFileInput.addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    await uploadThemeAsset(file, "spriteGif", applySpriteGif, "Sprite GIF");
    spriteGifFileInput.value = "";
  });
}

async function handlePaymentIconUpload(fileInput, key, label) {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    setStatus(`Uploading ${label} icon...`);
    const url = await uploadImage(file, "payment-icons");
    if (!url) {
      setStatus(`Upload failed for ${label}.`);
      return;
    }
    applyPaymentIcon(key, url);
    await saveThemeSettings({ paymentIcons: { [key]: url } });
    setStatus(`${label} icon saved.`);
  } catch (err) {
    console.error(`Error uploading ${label} icon`, err);
    setStatus(`Error uploading ${label} icon.`);
  } finally {
    fileInput.value = "";
  }
}

if (paymentIconVenmoFileInput) {
  paymentIconVenmoFileInput.addEventListener("change", () =>
    handlePaymentIconUpload(paymentIconVenmoFileInput, "venmo", "Venmo")
  );
}

if (paymentIconPaypalFileInput) {
  paymentIconPaypalFileInput.addEventListener("change", () =>
    handlePaymentIconUpload(paymentIconPaypalFileInput, "paypal", "PayPal")
  );
}

if (paymentIconTradeFileInput) {
  paymentIconTradeFileInput.addEventListener("change", () =>
    handlePaymentIconUpload(paymentIconTradeFileInput, "trade", "Trade")
  );
}

if (searchInput) searchInput.addEventListener("input", renderCardsDebounced);
if (filterSetNumber)
  filterSetNumber.addEventListener("change", renderCardsDebounced);
if (filterCondition)
  filterCondition.addEventListener("change", renderCardsDebounced);
if (filterClass) filterClass.addEventListener("change", renderCardsDebounced);
if (autoPackBtn) {
  autoPackBtn.addEventListener("click", autoPackBoxes);
}

if (clearRequestHighlightBtn) {
  clearRequestHighlightBtn.addEventListener("click", () => clearRequestHighlight());
}

if (activeRequestPrevBtn) {
  activeRequestPrevBtn.addEventListener("click", () => {
    if (!tradeRequestsCache.length) return;
    const targetIdx = activeRequestIndex >= 0 ? activeRequestIndex - 1 : 0;
    selectRequestByIndex(targetIdx);
  });
}

if (activeRequestNextBtn) {
  activeRequestNextBtn.addEventListener("click", () => {
    if (!tradeRequestsCache.length) return;
    const targetIdx = activeRequestIndex >= 0 ? activeRequestIndex + 1 : 0;
    selectRequestByIndex(targetIdx);
  });
}
