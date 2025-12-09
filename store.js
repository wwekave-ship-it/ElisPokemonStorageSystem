// store.js - Eli's Pokemon Storage System (Store View) with party shelf + Set Number / Condition

// Firebase v11 (match admin.js versions)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  initializeFirestore,
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// --- Firebase config (same project as admin) ---
const firebaseConfig = {
  apiKey: "AIzaSyChVKNH9TSbzpNLemZY7wAJgsuXmALW8OU",
  authDomain: "eli-s-pokemon-storage-system.firebaseapp.com",
  projectId: "eli-s-pokemon-storage-system",
  storageBucket: "eli-s-pokemon-storage-system.firebasestorage.app",
  messagingSenderId: "953223266982",
  appId: "1:953223266982:web:5271305728aa74a6322a67",
};

// === LOCAL STORAGE KEYS ===
const PARTY_KEY = "pokemonParty";
const CART_KEY = "pokemonCart";
const PREFETCH_CARDS_KEY = "prefetchedCardsV1";

// Init Firebase
const app = initializeApp(firebaseConfig);
// Use long-polling fallback for networks that block the WebChannel transport
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

// --- DOM elements ---
const boxGrid = document.getElementById("boxGrid");
const boxLabel = document.getElementById("boxLabel");
const boxStatus = document.getElementById("boxStatus");
const prevBoxBtn = document.getElementById("prevBoxBtn");
const nextBoxBtn = document.getElementById("nextBoxBtn");
const searchInput = document.getElementById("searchInput");

const previewImage = document.getElementById("previewImage");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const previewName = document.getElementById("previewName");
const previewSet = document.getElementById("previewSet");
const previewSetNumber = document.getElementById("previewSetNumber");
const previewCondition = document.getElementById("previewCondition");
const previewPrice = document.getElementById("previewPrice");

// Popup + party shelf elements
const cardPopup = document.getElementById("cardPopup");
const popupWithdrawBtn = document.getElementById("popupWithdrawBtn");
const popupCancelBtn = document.getElementById("popupCancelBtn");
const popupSummaryBtn = document.getElementById("popupSummaryBtn");

const partyShelf = document.getElementById("partyShelf");
const partyButton = document.getElementById("partyButton");
const partyCloseBtn = document.getElementById("partyCloseBtn");
const partyCheckoutBtn = document.getElementById("partyCheckoutBtn");
const partySlotsContainer = document.getElementById("partySlots");
const boxLabelEl = document.getElementById("boxLabel");
const partyPopup = document.getElementById("partyPopup");
const partyPopupDepositBtn = document.getElementById("partyPopupDepositBtn");
const partyPopupSummaryBtn = document.getElementById("partyPopupSummaryBtn");
const partyPopupCancelBtn = document.getElementById("partyPopupCancelBtn");
const closeBoxLink = document.getElementById("closeBoxLink");
const partySubtotalEl = document.getElementById("partySubtotal");
const DEFAULT_LABEL_GIF = "";
const DEFAULT_SPRITE_GIF = "";
const DEFAULT_PREVIEW_GIF = "";
const summaryModal = document.getElementById("summaryModal");
const summaryBackdrop = document.getElementById("summaryBackdrop");
const summaryCloseBtn = document.getElementById("summaryCloseBtn");
const summaryImage = document.getElementById("summaryImage");
const summaryName = document.getElementById("summaryName");
const summarySet = document.getElementById("summarySet");
const summaryNumber = document.getElementById("summaryNumber");
const summaryCondition = document.getElementById("summaryCondition");
const summaryPrice = document.getElementById("summaryPrice");
const summaryCard = document.getElementById("summaryCard");
let summaryOpen = false;
let audioCtx = null;
let userInteracted = false;

function applyFocus(el) {
  if (el && el.focus) el.focus({ preventScroll: true });
}
const summaryImageWrap = document.querySelector(".summary-image-wrap");
let summaryLens = null;
const SUMMARY_LENS_ZOOM = 1.3;
const DEFAULT_OVERLAY_GIF = "";
let overlayEl = null;
const MAX_LOCAL_VALUE = 200000;
const OVERLAY_INITIAL_DURATION_MS = 15000; // show first overlay for 15s
const OVERLAY_REPEAT_DURATION_MS = 15000; // subsequent displays last 15s
const OVERLAY_GAP_MS = 90000; // 90s pause between fog cycles
let overlayCycleTimeout = null;
let overlayHideTimeout = null;
let overlayLastIndex = -1;
// Boot overlay (store-triggered)
const bootOverlay = document.getElementById("bootOverlay");
const bootTitle = document.getElementById("bootTitle");
const bootActions = document.getElementById("bootActions");
const bootStoreBtn = document.getElementById("bootStore");
const bootAdminBtn = document.getElementById("bootAdmin");
const bootLogoffBtn = document.getElementById("bootLogoff");
const bootTrigger = document.getElementById("storeBrandTrigger");
const bootSteps = [
  { text: "Booted up the PC...", duration: 1200 },
  { text: "Which PC should be accessed?...", duration: 1200 },
  { text: "Select a PC to continue...", duration: 0, showActions: true },
];
let bootStepIndex = 0;
let bootOptionIndex = 0;
let bootTypingInterval = null;
let bootStepTimeout = null;
const bootOptionButtons = [bootStoreBtn, bootAdminBtn, bootLogoffBtn].filter(Boolean);
const themeDocRef = doc(db, "settings", "theme");

function ensureOverlayRefs() {
  if (!overlayEl) overlayEl = document.querySelector(".page-gif-overlay");
}

function markUserInteracted() {
  if (userInteracted) return;
  userInteracted = true;
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

// --- State ---
let allCards = [];
let cardsById = {};
let currentBoxIndex = 0;
let maxBoxIndex = 0;
let selectedCardId = null;
let popupCardId = null;
// unlimited party
let party = [];
let partyAutoCloseTimer = null;
let partyPopupCardId = null;
let headerFocusIndex = -1;
let cardPopupFocusIndex = -1;
let partyPopupFocusIndex = -1;
let partySelectedIndex = -1;
let partyNavEnabled = false;
let partyCloseFocus = false;
let partyCheckoutFocus = false;

// --- Helpers ---
function getBoxName(index) {
  return index === 0 ? "BOX1" : `BOX${index + 1}`;
}

function setBoxStatus(message) {
  if (boxStatus) boxStatus.textContent = "";
}

function updateBoxHeader() {
  if (boxLabel) boxLabel.textContent = getBoxName(currentBoxIndex);
}

// Sprite helpers (prefer provided URLs, then local sprite sheet, then fallback)
// Inline 1x1 transparent PNG to avoid 404s when a sprite is missing on host
const FALLBACK_SPRITE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2P4//8/AwAI/AL+XQvFeQAAAABJRU5ErkJggg==";

function normalizeNameToSprite(name) {
  return `sprites/${String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")}.png`;
}

function pickSprite(card) {
  return (
    card?.spriteUrl ||
    card?.cardImageUrl ||
    card?.imageUrl ||
    normalizeNameToSprite(card?.name)
  );
}

function attachImgFallback(imgEl) {
  if (!imgEl) return;
  imgEl.onerror = () => {
    if (imgEl.dataset.fallbackApplied) return;
    imgEl.dataset.fallbackApplied = "true";
    imgEl.src = FALLBACK_SPRITE;
  };
}

// Party storage helpers
function loadPartyFromStorage() {
  const raw = localStorage.getItem(PARTY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePartyToStorage() {
  localStorage.setItem(PARTY_KEY, JSON.stringify(party));
}

function saveCartToStorage(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function syncCartWithParty() {
  const items = [];
  let subtotal = 0;
  party.forEach((cardId) => {
    const card = cardsById[cardId];
    if (!card) return;
    const priceNum = Number(card.price);
    const price = Number.isFinite(priceNum) ? priceNum : 0;
    items.push({
      id: card.id,
      name: card.name || "Unknown",
      price,
      quantity: 1,
      // stash sprite so checkout can mirror the party view
      sprite: pickSprite(card),
      setNumber: card.setNumber ?? "",
      set: card.set ?? "",
    });
    subtotal += price;
  });
  saveCartToStorage(items);
  if (partySubtotalEl) {
    partySubtotalEl.textContent = items.length
      ? `Subtotal: $${subtotal.toFixed(2)}`
      : "";
  }
}

function openPartyShelf() {
  if (partyAutoCloseTimer) {
    clearTimeout(partyAutoCloseTimer);
    partyAutoCloseTimer = null;
  }
  if (partyShelf) partyShelf.classList.add("open");
}

function closePartyShelf() {
  if (partyAutoCloseTimer) {
    clearTimeout(partyAutoCloseTimer);
    partyAutoCloseTimer = null;
  }
  if (partyShelf) partyShelf.classList.remove("open");
  clearPartySelection();
  partyNavEnabled = false;
  partyCloseFocus = false;
}

function saveCardsToPrefetch(cards) {
  try {
    localStorage.setItem(
      PREFETCH_CARDS_KEY,
      JSON.stringify({ at: Date.now(), cards })
    );
  } catch (err) {
    console.warn("Could not cache cards locally:", err);
  }
}

function loadPrefetchedCards() {
  try {
    const raw = localStorage.getItem(PREFETCH_CARDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cards || !Array.isArray(parsed.cards)) return null;
    return parsed.cards;
  } catch {
    return null;
  }
}

// --- Load cards from Firestore ---
async function loadCards() {
  const cached = loadPrefetchedCards();
  if (cached && !allCards.length) {
    allCards = cached;
    cardsById = {};
    allCards.forEach((c) => {
      cardsById[c.id] = c;
    });
    maxBoxIndex = allCards.reduce(
      (max, c) => Math.max(max, c.boxIndex || 0),
      0
    );
    renderCurrentBox();
    renderParty();
    syncCartWithParty();
  }

  try {
    setBoxStatus("Loading cards...");
    const snap = await getDocs(collection(db, "cards"));
    allCards = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      const card = { id: docSnap.id, ...data };

      // Normalize boxIndex from boxName if needed
      let idx = 0;
      if (typeof card.boxIndex === "number" && card.boxIndex >= 0) {
        idx = card.boxIndex;
      } else if (card.boxName) {
        const match = String(card.boxName).match(/BOX(\d+)/i);
        if (match) {
          const parsedIndex = Number(match[1]) - 1;
          if (!Number.isNaN(parsedIndex) && parsedIndex >= 0) {
            idx = parsedIndex;
          }
        }
      }
      card.boxIndex = idx;

      return card;
    });

    cardsById = {};
    allCards.forEach((c) => {
      cardsById[c.id] = c;
    });

    if (allCards.length > 0) {
      maxBoxIndex = allCards.reduce(
        (max, c) => Math.max(max, c.boxIndex || 0),
        0
      );
    } else {
      maxBoxIndex = 0;
    }

    setBoxStatus("Ready.");
    renderCurrentBox();
    renderParty();
    saveCardsToPrefetch(allCards);
    syncCartWithParty();
  } catch (err) {
    console.error("[store.js] Error loading cards:", err);
    setBoxStatus("Error loading cards.");
  }
}

// --- Filtering & rendering ---
function getCardsForCurrentBox() {
  return allCards.filter((c) => {
    const inBox = (c.boxIndex || 0) === currentBoxIndex;
    const notInParty = !party.includes(c.id);
    const available = !c.held && !c.sold && (c.quantity == null || Number(c.quantity) > 0);
    return inBox && notInParty && available;
  });
}

function matchesSearch(card) {
  const search = (searchInput?.value || "").toLowerCase().trim();
  if (!search) return true;

  const name = (card.name || "").toLowerCase();
  const set = (card.set || "").toLowerCase();
  const setNum = card.setNumber != null ? String(card.setNumber) : "";
  const legacyType = (card.type || "").toLowerCase(); // fallback for old cards

  return (
    name.includes(search) ||
    set.includes(search) ||
    setNum.includes(search) ||
    legacyType.includes(search)
  );
}

function clearPreview() {
  selectedCardId = null;

  if (previewImage) {
    previewImage.src = "";
    previewImage.classList.add("hidden");
  }
  if (previewPlaceholder) {
    previewPlaceholder.textContent = "Select a card to see details.";
    previewPlaceholder.classList.remove("hidden");
  }
  if (previewName) previewName.textContent = "No card selected";
  if (previewSet) previewSet.textContent = "Set: —";
  if (previewSetNumber) previewSetNumber.textContent = "Set Number: —";
  if (previewCondition) previewCondition.textContent = "Condition: —";
  if (previewPrice) previewPrice.textContent = "Price: —";
}

function triggerPreviewFocusEffect() {
  if (!previewImage) return;
  previewImage.classList.remove("focus-reveal");
  // force reflow to restart animation
  void previewImage.offsetWidth;
  previewImage.classList.add("focus-reveal");
}

function playBeep() {
  if (!userInteracted) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioCtx.currentTime + 0.08
    );
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    // ignore audio errors
  }
}

function openSummaryModal(cardId) {
  if (!summaryModal || !summaryImage) return;
  const card = cardsById[cardId];
  if (!card) return;

  const imageUrl =
    card.cardImageUrl || card.imageUrl || card.spriteUrl || pickSprite(card);
  summaryImage.src = imageUrl || "";
  attachImgFallback(summaryImage);

  if (summaryName) summaryName.textContent = card.name || "Unknown";
  if (summarySet) summarySet.textContent = `Set: ${card.set || "Unknown"}`;
  if (summaryNumber)
    summaryNumber.textContent = `Set Number: ${card.setNumber ?? "—"}`;
  if (summaryCondition)
    summaryCondition.textContent = `Condition: ${card.condition || "—"}`;
  if (summaryPrice) {
    const n = Number(card.price);
    summaryPrice.textContent = `Price: ${
      !Number.isNaN(n) ? `$${n.toFixed(2)}` : "—"
    }`;
  }

  summaryModal.classList.remove("hidden");
  summaryOpen = true;
  ensureSummaryLens();
  updateSummaryLensBackground();
  if (summaryCard) {
    summaryCard.classList.remove("animate");
    void summaryCard.offsetWidth;
    summaryCard.classList.add("animate");
  }
  if (summaryCloseBtn) applyFocus(summaryCloseBtn);
  playBeep();
}

function closeSummaryModal() {
  if (!summaryModal) return;
  summaryModal.classList.add("hidden");
  summaryOpen = false;
  hideSummaryLens();
}

function ensureSummaryLens() {
  if (summaryLens || !summaryImageWrap) return;
  summaryLens = document.createElement("div");
  summaryLens.id = "summaryLens";
  summaryLens.className = "summary-lens hidden";
  summaryImageWrap.appendChild(summaryLens);
  summaryImageWrap.addEventListener("mousemove", handleSummaryLensMove);
  summaryImageWrap.addEventListener("mouseenter", showSummaryLens);
  summaryImageWrap.addEventListener("mouseleave", hideSummaryLens);
}

function updateSummaryLensBackground() {
  if (!summaryLens || !summaryImage || !summaryImage.src) return;
  summaryLens.style.backgroundImage = `url("${summaryImage.src}")`;
}

function showSummaryLens() {
  if (!summaryLens) return;
  summaryLens.classList.remove("hidden");
}

function hideSummaryLens() {
  if (!summaryLens) return;
  summaryLens.classList.add("hidden");
}

function handleSummaryLensMove(ev) {
  if (!summaryLens || !summaryImageWrap || !summaryImage) return;
  const rect = summaryImageWrap.getBoundingClientRect();
  const lensRect = summaryLens.getBoundingClientRect();
  const lensR = lensRect.width / 2;
  const natW = summaryImage.naturalWidth;
  const natH = summaryImage.naturalHeight;
  if (!natW || !natH) return;

  const wrapRatio = rect.width / rect.height;
  const imgRatio = natW / natH;
  let renderW = rect.width;
  let renderH = rect.height;
  if (wrapRatio > imgRatio) {
    renderH = rect.height;
    renderW = imgRatio * rect.height;
  } else {
    renderW = rect.width;
    renderH = rect.width / imgRatio;
  }
  const padX = (rect.width - renderW) / 2;
  const padY = (rect.height - renderH) / 2;

  let x = ev.clientX - rect.left - padX;
  let y = ev.clientY - rect.top - padY;

  // clamp inside the rendered image area
  x = Math.max(0, Math.min(renderW, x));
  y = Math.max(0, Math.min(renderH, y));

  const lensX = padX + x - lensR;
  const lensY = padY + y - lensR;

  summaryLens.style.left = `${lensX}px`;
  summaryLens.style.top = `${lensY}px`;

  const bgW = natW * SUMMARY_LENS_ZOOM;
  const bgH = natH * SUMMARY_LENS_ZOOM;
  const ratioX = x / renderW;
  const ratioY = y / renderH;

  summaryLens.style.backgroundSize = `${bgW}px ${bgH}px`;
  summaryLens.style.backgroundPosition = `-${ratioX * bgW - lensR}px -${
    ratioY * bgH - lensR
  }px`;
}

function renderCurrentBox() {
  if (!boxGrid) return;

  boxGrid.innerHTML = "";
  updateBoxHeader();
  // Prevent any lingering focus outline on the grid container
  boxGrid.tabIndex = -1;

  const cards = getCardsForCurrentBox().filter(matchesSearch);

  if (!cards.length) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "empty-box-message";
    emptyMsg.textContent =
      "This box is empty. Ask the Professor to add some cards!";
    boxGrid.appendChild(emptyMsg);
    clearPreview();
    closeCardPopup();
    return;
  }

  cards.forEach((card) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "card-slot";
    slot.dataset.cardId = card.id;
    slot.draggable = true;

    const img = document.createElement("img");
    img.className = "card-sprite";
    img.alt = card.name || "Card";
    img.src = pickSprite(card);
    attachImgFallback(img);

    slot.appendChild(img);

    // Click = select + show popup
    slot.addEventListener("click", () => {
      selectCard(card.id);
      openCardPopup(card.id, slot);
    });

    // Drag-and-drop support to add to party
    slot.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", card.id);
      popupCardId = card.id;
    });

    slot.addEventListener("dragend", () => {
      popupCardId = null;
    });

    boxGrid.appendChild(slot);
  });

  ensureSelectionInBox();
}

// --- Preview panel ---
function selectCard(cardId) {
  selectedCardId = cardId;
  const card = cardsById[cardId];
  if (!card) {
    clearPreview();
    return;
  }

  // highlight selected slot
  document.querySelectorAll(".card-slot").forEach((el) => {
    el.classList.toggle("selected", el.dataset.cardId === cardId);
  });

  // image
  const displayImage =
    card.cardImageUrl || card.imageUrl || card.spriteUrl || pickSprite(card);

  if (displayImage && previewImage) {
    previewImage.src = displayImage;
    attachImgFallback(previewImage);
    previewImage.classList.remove("hidden");
    triggerPreviewFocusEffect();
    if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
  } else {
    if (previewImage) {
      previewImage.src = "";
      previewImage.classList.add("hidden");
    }
    if (previewPlaceholder) {
      previewPlaceholder.textContent = "No image available for this card.";
      previewPlaceholder.classList.remove("hidden");
    }
  }

  // text
  if (previewName) previewName.textContent = card.name || "Unknown";
  if (previewSet)
    previewSet.textContent = `Set: ${card.set || "Unknown set"}`;
  if (previewSetNumber)
    previewSetNumber.textContent = `Set Number: ${
      card.setNumber || "Unknown"
    }`;

  const conditionText =
    card.condition || card.rarity || "—"; // fallback to old rarity
  if (previewCondition)
    previewCondition.textContent = `Condition: ${conditionText}`;

  let priceText = "—";
  if (card.price !== undefined && card.price !== null && card.price !== "") {
    const n = Number(card.price);
    if (!Number.isNaN(n)) {
      priceText = `$${n.toFixed(2)}`;
    }
  }
  if (previewPrice) previewPrice.textContent = `Price: ${priceText}`;
}

// --- Grid keyboard navigation helpers ---
function getVisibleSlots() {
  return Array.from(boxGrid?.querySelectorAll(".card-slot") || []);
}

function getGridColumns() {
  return 6;
}

function getSelectedSlotIndex(slots) {
  if (!slots || !slots.length || !selectedCardId) return -1;
  return slots.findIndex((slot) => slot.dataset.cardId === selectedCardId);
}

function selectSlotByIndex(index, slots) {
  const allSlots = slots || getVisibleSlots();
  if (!allSlots.length) return;
  const clamped = Math.max(0, Math.min(index, allSlots.length - 1));
  const slot = allSlots[clamped];
  const cardId = slot?.dataset?.cardId;
  if (!cardId) return;
  selectCard(cardId);
  applyFocus(slot);
  slot.scrollIntoView({ block: "nearest", inline: "nearest" });
  playBeep();
}

function clearGridSelection() {
  selectedCardId = null;
  document.querySelectorAll(".card-slot.selected").forEach((el) => {
    el.classList.remove("selected");
  });
  clearPreview();
}

function moveSelection(direction) {
  const slots = getVisibleSlots();
  if (!slots.length) return;
  const cols = getGridColumns();
  let current = getSelectedSlotIndex(slots);
  if (current === -1) current = 0;
  const total = slots.length;
  const rows = Math.ceil(total / cols);
  const lastRowStart = (rows - 1) * cols;

  if (direction === "left") {
    current = (current - 1 + total) % total;
  } else if (direction === "right") {
    current = (current + 1) % total;
  } else if (direction === "up") {
    const target = current - cols;
    if (target >= 0) {
      current = target;
    } else {
      // wrap to same column in last row
      const col = current % cols;
      let wrapped = lastRowStart + col;
      while (wrapped >= total) {
        wrapped -= cols;
      }
      current = wrapped;
    }
  } else if (direction === "down") {
    const target = current + cols;
    if (target < total) {
      current = target;
    } else {
      // wrap to same column in first row
      const col = current % cols;
      let wrapped = col;
      current = wrapped;
    }
  }

  selectSlotByIndex(current, slots);
}

// Ensure something is selected after render
function ensureSelectionInBox() {
  const slots = getVisibleSlots();
  if (!slots.length) {
    clearPreview();
    return;
  }
  const idx = getSelectedSlotIndex(slots);
  if (idx === -1) {
    selectSlotByIndex(0, slots);
  }
}

function focusBottomOfGrid() {
  const slots = getVisibleSlots();
  if (!slots.length) {
    clearPreview();
    return;
  }
  selectSlotByIndex(slots.length - 1, slots);
}

function focusGridCell(rowIndex, colIndex) {
  const slots = getVisibleSlots();
  if (!slots.length) {
    clearPreview();
    return;
  }
  const cols = getGridColumns();
  const targetIndex = Math.max(
    0,
    Math.min(slots.length - 1, (Math.max(1, rowIndex) - 1) * cols + (Math.max(1, colIndex) - 1))
  );
  selectSlotByIndex(targetIndex, slots);
}

function clearPartySelection() {
  partySelectedIndex = -1;
  document.querySelectorAll(".party-slot.key-focus").forEach((el) => {
    el.classList.remove("key-focus");
  });
  if (partyCloseBtn) partyCloseBtn.classList.remove("key-focus");
  if (partyCheckoutBtn) partyCheckoutBtn.classList.remove("key-focus");
  partyCloseFocus = false;
  partyCheckoutFocus = false;
}

function getPartySlots() {
  return Array.from(partySlotsContainer?.querySelectorAll(".party-slot") || []);
}

function applyPartySelection() {
  const slots = getPartySlots();
  slots.forEach((slot, idx) => {
    slot.classList.toggle("key-focus", idx === partySelectedIndex);
  });
}

function setLocalThemeValue(key, value) {
  try {
    localStorage.setItem(key, value || "");
  } catch {
    // swallow quota errors for oversized data URLs
  }
}

function applyBoxLabelGif() {
  const saved = localStorage.getItem("boxLabelGif");
  const url = (saved || DEFAULT_LABEL_GIF || "").trim();
  const value = url ? `url("${url}")` : "";
  if (value) {
    document.documentElement.style.setProperty("--box-label-gif", value);
  } else {
    document.documentElement.style.removeProperty("--box-label-gif");
  }
}

function applySpriteGif() {
  const saved = localStorage.getItem("spriteGif");
  const url = saved || DEFAULT_SPRITE_GIF;
  const value = url ? `url("${url}")` : "none";
  document.documentElement.style.setProperty("--sprite-gif", value);
  document.documentElement.style.setProperty("--sprite-grid-gif", value);
}

function applyPreviewGif() {
  const saved = localStorage.getItem("previewGif");
  const url = saved || DEFAULT_PREVIEW_GIF;
  const value = url ? `url("${url}")` : "none";
  document.documentElement.style.setProperty("--preview-gif", value);
  if (previewPlaceholder) {
    previewPlaceholder.classList.toggle("gif-active", Boolean(url));
  }
}

function clearOverlayCycle() {
  ensureOverlayRefs();
  if (overlayCycleTimeout) {
    clearTimeout(overlayCycleTimeout);
    overlayCycleTimeout = null;
  }
  if (overlayHideTimeout) {
    clearTimeout(overlayHideTimeout);
    overlayHideTimeout = null;
  }
  if (overlayEl) overlayEl.classList.remove("overlay-active");
  overlayLastIndex = -1;
}

function getOverlayPool() {
  ensureOverlayRefs();
  const pool = [];
  const url1 = localStorage.getItem("overlayGif");
  if (overlayEl && url1) pool.push(overlayEl);
  return pool;
}

function startOverlayCycle(hasGif) {
  clearOverlayCycle();
  const showOverlay = (duration, randomize) => {
    overlayCycleTimeout = null;
    const overlays = getOverlayPool();
    if (overlayEl) overlayEl.classList.remove("overlay-active");
    if (!overlays.length) return;
    let idx = 0;
    if (randomize && overlays.length > 1) {
      idx = (overlayLastIndex + 1) % overlays.length; // alternate to guarantee overlay2 shows
    }
    overlayLastIndex = idx;
    const target = overlays[idx];
    target.classList.add("overlay-active");
    overlayHideTimeout = setTimeout(() => {
      target.classList.remove("overlay-active");
      overlayHideTimeout = null;
      overlayCycleTimeout = setTimeout(() => {
        showOverlay(OVERLAY_REPEAT_DURATION_MS, true);
      }, OVERLAY_GAP_MS);
    }, duration);
  };

  showOverlay(OVERLAY_INITIAL_DURATION_MS, false);
}

function applyOverlayGif() {
  ensureOverlayRefs();
  const saved = localStorage.getItem("overlayGif");
  const url = saved || DEFAULT_OVERLAY_GIF;
  const value = url ? `url("${url}")` : "none";
  document.documentElement.style.setProperty("--overlay-gif", value);
  startOverlayCycle(Boolean(url));
}

async function loadThemeSettingsFromCloud() {
  try {
    const snap = await getDoc(themeDocRef);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    if ("boxLabelGif" in data) setLocalThemeValue("boxLabelGif", data.boxLabelGif || "");
    if ("spriteGif" in data) setLocalThemeValue("spriteGif", data.spriteGif || "");
    if ("previewGif" in data) setLocalThemeValue("previewGif", data.previewGif || "");
    if ("overlayGif" in data) setLocalThemeValue("overlayGif", data.overlayGif || "");
  } catch (err) {
    console.warn("Theme load failed; using local cache.", err);
  }
}

// --- Boot overlay (store trigger) ---
function clearBootTimers() {
  if (bootStepTimeout) {
    clearTimeout(bootStepTimeout);
    bootStepTimeout = null;
  }
  if (bootTypingInterval) {
    clearInterval(bootTypingInterval);
    bootTypingInterval = null;
  }
}

function bootTypeText(text, onComplete) {
  if (!bootTitle) return;
  bootTitle.textContent = "";
  let pos = 0;
  clearBootTimers();
  bootTypingInterval = setInterval(() => {
    if (pos >= text.length) {
      clearBootTimers();
      if (bootTitle.textContent.endsWith("...")) {
        const span = document.createElement("span");
        span.textContent = ".";
        span.className = "blink";
        bootTitle.appendChild(span);
      }
      if (onComplete) onComplete();
      return;
    }
    bootTitle.textContent += text.charAt(pos);
    pos += 1;
  }, 55);
}

function bootUpdateSelection(nextIndex) {
  if (!bootOptionButtons.length) return;
  if (nextIndex < 0) {
    bootOptionIndex = -1;
    bootOptionButtons.forEach((btn) => btn.classList.remove("selected"));
    return;
  }

  bootOptionIndex = (nextIndex + bootOptionButtons.length) % bootOptionButtons.length;
  bootOptionButtons.forEach((btn, i) => {
    btn.classList.toggle("selected", i === bootOptionIndex);
  });
}

function bootHandleKeyNav(ev) {
  if (!bootOverlay || bootOverlay.classList.contains("hidden")) {
    document.removeEventListener("keydown", bootHandleKeyNav);
    return;
  }
  if (!bootOptionButtons.length) return;
  if (["ArrowUp", "ArrowLeft"].includes(ev.key)) {
    ev.preventDefault();
    const target = bootOptionIndex < 0 ? 0 : bootOptionIndex - 1;
    bootUpdateSelection(target);
  } else if (["ArrowDown", "ArrowRight"].includes(ev.key)) {
    ev.preventDefault();
    const target = bootOptionIndex < 0 ? 0 : bootOptionIndex + 1;
    bootUpdateSelection(target);
  } else if (ev.key === "Enter" || ev.key === " ") {
    ev.preventDefault();
    const btn = bootOptionIndex < 0 ? null : bootOptionButtons[bootOptionIndex];
    btn?.click();
  } else if (ev.key === "Escape") {
    ev.preventDefault();
    closeBootOverlay();
  }
}

function showBootStep(i) {
  const step = bootSteps[i];
  if (!step) {
    closeBootOverlay();
    return;
  }
  bootTypeText(step.text, () => {
    if (bootActions) {
      bootActions.classList.toggle("hidden", !step.showActions);
    }

    if (step.showActions) {
      bootUpdateSelection(bootOptionIndex);
      document.addEventListener("keydown", bootHandleKeyNav);
      bootOptionButtons.forEach((btn, idx) => {
        btn.addEventListener("mouseenter", () => bootUpdateSelection(idx));
      });
      return;
    }

    bootStepTimeout = setTimeout(() => {
      showBootStep(i + 1);
    }, step.duration);
  });
}

function startBootSequence() {
  if (!bootOverlay || !bootTitle) return;
  clearBootTimers();
  bootStepIndex = 0;
  bootOptionIndex = 0;
  if (bootActions) bootActions.classList.add("hidden");
  bootOverlay.classList.remove("hidden");
  showBootStep(bootStepIndex);
}

function closeBootOverlay() {
  if (!bootOverlay) return;
  clearBootTimers();
  bootOverlay.classList.add("hidden");
  document.removeEventListener("keydown", bootHandleKeyNav);
}


function focusPartySlot(index) {
  const slots = getPartySlots();
  if (!slots.length) {
    clearPartySelection();
    return;
  }
  partyCloseFocus = false;
  partyCheckoutFocus = false;
  if (partyCloseBtn) partyCloseBtn.classList.remove("key-focus");
  if (partyCheckoutBtn) partyCheckoutBtn.classList.remove("key-focus");
  const clamped = Math.max(0, Math.min(index, slots.length - 1));
  partySelectedIndex = clamped;
  clearGridSelection();
  applyPartySelection();
  const slot = slots[clamped];
  const cardId = slot.dataset.cardId;
  if (cardId) {
    selectCard(cardId);
  }
  applyFocus(slot);
  slot.scrollIntoView({ block: "nearest", inline: "nearest" });
}

const PARTY_ROWS = 6;

function getPartyRowCol(index) {
  const row = index % PARTY_ROWS;
  const col = Math.floor(index / PARTY_ROWS);
  return { row, col };
}

function getNearestSlotIndexForColumn(col) {
  const slots = getPartySlots();
  const total = slots.length;
  if (!total) return -1;
  const maxCol = Math.ceil(total / PARTY_ROWS) - 1;
  const safeCol = Math.min(Math.max(col, 0), maxCol);
  for (let row = PARTY_ROWS - 1; row >= 0; row--) {
    const idx = findPartyIndexAt(row, safeCol, total);
    if (idx !== -1) return idx;
  }
  return total - 1;
}

function getTopSlotIndex() {
  const slots = getPartySlots();
  const total = slots.length;
  if (!total) return -1;
  const maxCol = Math.ceil(total / PARTY_ROWS) - 1;
  const idx = findPartyIndexAt(0, maxCol, total);
  if (idx !== -1) return idx;
  return 0;
}

function findPartyIndexAt(row, col, total) {
  const idx = col * PARTY_ROWS + row;
  return idx < total ? idx : -1;
}

function movePartySelection(direction) {
  const slots = getPartySlots();
  const total = slots.length;
  if (!total) return;

  if (partySelectedIndex < 0 || partySelectedIndex >= total) {
    focusPartySlot(0);
    return;
  }

  const { row, col } = getPartyRowCol(partySelectedIndex);

  if (direction === "up") {
    if (row === 0) {
      focusPartyClose();
      return;
    }
    const target = partySelectedIndex - 1;
    if (target >= col * PARTY_ROWS) focusPartySlot(target);
    return;
  }

  if (direction === "down") {
    const target = partySelectedIndex + 1;
    const colStart = col * PARTY_ROWS;
    const colEnd = Math.min(colStart + PARTY_ROWS - 1, total - 1);
    const bottomRow = colEnd - colStart;
    if (row >= bottomRow) {
      focusPartyCheckout();
    } else if (target <= colEnd) {
      focusPartySlot(target);
    } else {
      if (col === 0 && partyCloseBtn) {
        focusPartyClose();
      } else if (partyCheckoutBtn) {
        focusPartyCheckout();
      }
    }
    return;
  }

  const maxCol = Math.ceil(total / PARTY_ROWS) - 1;

  if (direction === "left") {
    for (let c = col - 1; c >= 0; c--) {
      const idx = findPartyIndexAt(row, c, total);
      if (idx !== -1) {
        focusPartySlot(idx);
        return;
      }
    }
    for (let c = maxCol; c > col; c--) {
      const idx = findPartyIndexAt(row, c, total);
      if (idx !== -1) {
        focusPartySlot(idx);
        return;
      }
    }
    return;
  }

  if (direction === "right") {
    for (let c = col + 1; c <= maxCol; c++) {
      const idx = findPartyIndexAt(row, c, total);
      if (idx !== -1) {
        focusPartySlot(idx);
        return;
      }
    }
    for (let c = 0; c < col; c++) {
      const idx = findPartyIndexAt(row, c, total);
      if (idx !== -1) {
        focusPartySlot(idx);
        return;
      }
    }
  }
}

function clearHeaderFocus() {
  headerFocusIndex = -1;
  [boxLabelEl, prevBoxBtn, nextBoxBtn, partyButton, closeBoxLink].forEach(
    (btn) => {
      if (btn) btn.classList.remove("key-focus");
    }
  );
}

function getHeaderButtons() {
  // Exclude arrow buttons from keyboard focus; they remain clickable with mouse
  return [boxLabelEl, partyButton, closeBoxLink].filter(Boolean);
}

function focusHeaderButton(index) {
  const buttons = getHeaderButtons();
  if (!buttons.length) return;
  const clamped = Math.max(0, Math.min(index, buttons.length - 1));
  clearGridSelection();
  headerFocusIndex = clamped;
  buttons.forEach((btn, idx) => {
    btn.classList.toggle("key-focus", idx === clamped);
  });
  applyFocus(buttons[clamped]);
}

function focusHeaderButtonByElement(el) {
  const buttons = getHeaderButtons();
  const idx = buttons.indexOf(el);
  if (idx !== -1) focusHeaderButton(idx);
}

function getCardPopupButtons() {
  return [popupWithdrawBtn, popupSummaryBtn, popupCancelBtn].filter(Boolean);
}

function focusCardPopupButton(index) {
  const buttons = getCardPopupButtons();
  if (!buttons.length) return;
  const clamped = Math.max(0, Math.min(index, buttons.length - 1));
  cardPopupFocusIndex = clamped;
  buttons.forEach((btn, idx) => {
    btn.classList.toggle("key-focus", idx === clamped);
  });
  applyFocus(buttons[clamped]);
}

function getPartyPopupButtons() {
  return [partyPopupDepositBtn, partyPopupSummaryBtn, partyPopupCancelBtn].filter(Boolean);
}

function focusPartyPopupButton(index) {
  const buttons = getPartyPopupButtons();
  if (!buttons.length) return;
  const clamped = Math.max(0, Math.min(index, buttons.length - 1));
  partyPopupFocusIndex = clamped;
  buttons.forEach((btn, idx) => {
    btn.classList.toggle("key-focus", idx === clamped);
  });
  applyFocus(buttons[clamped]);
}

// --- Popup helpers ---
function openCardPopup(cardId, slotEl) {
  if (!cardPopup) return;
  popupCardId = cardId;

  const rect = slotEl.getBoundingClientRect();
  const popupWidth = cardPopup.offsetWidth || 140;
  const popupHeight = cardPopup.offsetHeight || 60;
  const left =
    rect.left + window.scrollX + rect.width / 2 - popupWidth / 2;
  const top = rect.top + window.scrollY - popupHeight + 18; // lower above sprite
  cardPopup.style.left = `${left}px`;
  cardPopup.style.top = `${top}px`;
  cardPopup.classList.remove("hidden");
  focusCardPopupButton(0);
}

function closeCardPopup() {
  if (!cardPopup) return;
  cardPopup.classList.add("hidden");
  popupCardId = null;
  cardPopupFocusIndex = -1;
}

function openPartyPopup(cardId, slotEl) {
  if (!partyPopup) return;
  partyPopupCardId = cardId;
  const rect = slotEl.getBoundingClientRect();
  const popupWidth = partyPopup.offsetWidth || 140;
  const popupHeight = partyPopup.offsetHeight || 60;
  const left =
    rect.left + window.scrollX + rect.width / 2 - popupWidth / 2;
  const top = rect.top + window.scrollY - popupHeight + 18;
  partyPopup.style.left = `${left}px`;
  partyPopup.style.top = `${top}px`;
  partyPopup.classList.remove("hidden");
  focusPartyPopupButton(0);
}

function closePartyPopup() {
  if (!partyPopup) return;
  partyPopup.classList.add("hidden");
  partyPopupCardId = null;
  partyPopupFocusIndex = -1;
}

// --- Party rendering (unlimited) ---
function renderParty() {
  if (!partySlotsContainer) return;

  partySlotsContainer.innerHTML = "";

  if (!party.length) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "party-slot party-slot-empty";
    emptyEl.textContent = "No Pokémon in your party.";
    partySlotsContainer.appendChild(emptyEl);
    closePartyShelf();
    clearPartySelection();
    return;
  }

  party.forEach((cardId, index) => {
    const card = cardsById[cardId];
    if (!card) return;

    const slotEl = document.createElement("div");
    slotEl.className = "party-slot";
    slotEl.tabIndex = -1;
    slotEl.dataset.cardId = card.id;

    const img = document.createElement("img");
    img.className = "party-sprite";
    img.alt = card.name || "Card";
    img.src = pickSprite(card);
    attachImgFallback(img);

    const nameEl = document.createElement("div");
    nameEl.className = "party-name";
    nameEl.textContent = card.name || "Unknown";

    slotEl.appendChild(img);
    slotEl.appendChild(nameEl);

    // Click to deposit card back into storage
    slotEl.addEventListener("click", () => {
      focusPartySlot(index);
      openPartyPopup(cardId, slotEl);
    });

    partySlotsContainer.appendChild(slotEl);
  });

  // keep party selection in range if already set
  if (!partyNavEnabled) {
    clearPartySelection();
  } else {
    if (partySelectedIndex >= party.length) {
      partySelectedIndex = party.length - 1;
    }
    if (partySelectedIndex < 0 && party.length) {
      focusPartySlot(0);
    } else if (partySelectedIndex >= 0) {
      applyPartySelection();
    } else {
      clearPartySelection();
    }
  }

  syncCartWithParty();
}

function addCardIdToParty(cardId) {
  if (!cardsById[cardId]) return;

  if (party.includes(cardId)) {
    alert("That card is already in your party.");
    openPartyShelf();
    return;
  }

  party.push(cardId);
  savePartyToStorage();
  renderParty();
  renderCurrentBox();
  syncCartWithParty();
  openPartyShelf();

  const card = cardsById[cardId];
  const name = card?.name || "this card";
  setBoxStatus(`Withdrew "${name}" to your party.`);

  partyAutoCloseTimer = setTimeout(() => {
    closePartyShelf();
  }, 1200);
}

// --- Wire party slots (drag target container) ---
function wirePartySlots() {
  if (!partySlotsContainer) return;

  partySlotsContainer.addEventListener("dragover", (ev) => {
    ev.preventDefault();
  });

  partySlotsContainer.addEventListener("drop", (ev) => {
    ev.preventDefault();
    const cardId = ev.dataTransfer.getData("text/plain");
    if (!cardId) return;
    addCardIdToParty(cardId);
  });
}

// --- Box navigation ---
function gotoPrevBox() {
  if (currentBoxIndex === 0) return;
  currentBoxIndex -= 1;
  renderCurrentBox();
  clearPreview();
}

function gotoNextBox() {
  if (currentBoxIndex >= maxBoxIndex) return;
  currentBoxIndex += 1;
  renderCurrentBox();
  clearPreview();
}

// --- Wiring / init ---
async function init() {
  if (!boxGrid || !previewImage) {
    console.warn("[store.js] Store elements not found; skipping init.");
    return;
  }

  party = loadPartyFromStorage();
  await loadThemeSettingsFromCloud();
  updateBoxHeader();
  wirePartySlots();
  renderParty();
  applyBoxLabelGif();
  applySpriteGif();
  applyPreviewGif();
  applyOverlayGif();
  closePartyShelf();

  if (prevBoxBtn) prevBoxBtn.addEventListener("click", gotoPrevBox);
  if (nextBoxBtn) nextBoxBtn.addEventListener("click", gotoNextBox);

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderCurrentBox();
      clearPreview();
    });
  }

  if (partyCheckoutBtn) {
    partyCheckoutBtn.addEventListener("click", () => {
      window.location.href = "checkout.html";
    });
  }

  // Keyboard navigation for grid + Enter to open popup
  document.addEventListener("keydown", (ev) => {
    if (bootOverlay && !bootOverlay.classList.contains("hidden")) {
      return;
    }
    const target = ev.target;
    const isTypingField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable;

    if (isTypingField) return;

    const storagePopupOpen =
      cardPopup && !cardPopup.classList.contains("hidden");
    const partyPopupOpen =
      partyPopup && !partyPopup.classList.contains("hidden");
    const partyShelfOpen =
      partyShelf && partyShelf.classList.contains("open") && party.length;
    const summaryModalOpen = summaryOpen && summaryModal && !summaryModal.classList.contains("hidden");

    if (summaryModalOpen) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeSummaryModal();
        return;
      }
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        summaryCloseBtn?.click();
      }
      return;
    }
  if (partyPopupOpen) {
    const buttons = getPartyPopupButtons();
    if (buttons.includes(target) && partyPopupFocusIndex < 0) {
      focusPartyPopupButton(buttons.indexOf(target));
    }

      if (
        ev.key === "ArrowLeft" ||
        ev.key === "ArrowRight" ||
        ev.key === "ArrowUp" ||
        ev.key === "ArrowDown" ||
        ev.key === "Enter" ||
        ev.key === " "
      ) {
        ev.preventDefault();
        if (partyPopupFocusIndex < 0) {
          focusPartyPopupButton(0);
          return;
        }
        if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
          focusPartyPopupButton(partyPopupFocusIndex - 1);
        } else if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
          focusPartyPopupButton(partyPopupFocusIndex + 1);
        } else if (ev.key === "Enter" || ev.key === " ") {
          const btn = buttons[partyPopupFocusIndex];
          btn?.click();
        }
        return;
      }

      if (ev.key === "Escape") {
        closePartyPopup();
      }
      return;
    }

    if (storagePopupOpen) {
      const popupButtons = getCardPopupButtons();
      // Sync focus if user clicked a button
      if (popupButtons.includes(target) && cardPopupFocusIndex < 0) {
        focusCardPopupButton(popupButtons.indexOf(target));
      }

      if (
        ev.key === "ArrowLeft" ||
        ev.key === "ArrowRight" ||
        ev.key === "Enter" ||
        ev.key === " "
      ) {
        ev.preventDefault();
        if (ev.key === "ArrowLeft") {
          focusCardPopupButton(cardPopupFocusIndex - 1);
        } else if (ev.key === "ArrowRight") {
          focusCardPopupButton(cardPopupFocusIndex + 1);
        } else if (ev.key === "Enter" || ev.key === " ") {
          const buttons = getCardPopupButtons();
          const btn = buttons[cardPopupFocusIndex];
          btn?.click();
        }
        return;
      }

      if (ev.key === "Escape") {
        closeCardPopup();
      }
      return;
    }

    const headerButtons = getHeaderButtons();
    const focusedHeaderEl =
      headerFocusIndex >= 0 ? headerButtons[headerFocusIndex] : null;
    const partyShelfHasFocus =
      (partySlotsContainer &&
        partySlotsContainer.contains(document.activeElement)) ||
      (partyCloseBtn && partyCloseBtn === document.activeElement) ||
      (partyCheckoutBtn && partyCheckoutBtn === document.activeElement);

  const partyNavActive =
    partyNavEnabled &&
    partyShelfOpen &&
    (focusedHeaderEl === partyButton ||
      partyCloseFocus ||
      partyCheckoutFocus ||
      partyShelfHasFocus ||
      (partySlotsContainer && partySlotsContainer.contains(target)));

    if (
      partyNavActive &&
      (ev.key === "ArrowLeft" ||
        ev.key === "ArrowRight" ||
        ev.key === "ArrowUp" ||
        ev.key === "ArrowDown" ||
        ev.key === "Enter" ||
        ev.key === " ")
    ) {
      const slots = getPartySlots();
      if (slots.length) {
        ev.preventDefault();
        const lastIdx = slots.length - 1;

        if (partyCloseFocus) {
          if (ev.key === "ArrowUp") {
            if (partyCheckoutBtn) {
              focusPartyCheckout();
            } else {
              const idx = getNearestSlotIndexForColumn(0);
              if (idx !== -1) focusPartySlot(idx);
            }
            playBeep();
          } else if (ev.key === "ArrowDown") {
            const idx = getTopSlotIndex();
            if (idx !== -1) focusPartySlot(idx);
            playBeep();
          } else if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
            const idx =
              ev.key === "ArrowRight" && slots.length > PARTY_ROWS
                ? getNearestSlotIndexForColumn(1)
                : getNearestSlotIndexForColumn(0);
            if (idx !== -1) focusPartySlot(idx);
            playBeep();
          } else if (ev.key === "Enter" || ev.key === " ") {
            partyCloseBtn?.click();
          }
          return;
        }

        if (partyCheckoutFocus) {
          if (
            ev.key === "ArrowLeft" ||
            ev.key === "ArrowRight" ||
            ev.key === "ArrowUp" ||
            ev.key === "ArrowDown"
          ) {
            if (ev.key === "ArrowDown") {
              focusPartyClose();
              playBeep();
            } else {
              const idx =
                ev.key === "ArrowLeft"
                  ? getNearestSlotIndexForColumn(0)
                  : getNearestSlotIndexForColumn(1);
              if (idx !== -1) focusPartySlot(idx);
              playBeep();
            }
          } else if (ev.key === "Enter" || ev.key === " ") {
            partyCheckoutBtn?.click();
          }
          return;
        }

        if (partySelectedIndex < 0) {
          focusPartySlot(0);
          playBeep();
          return;
        }

        if (ev.key === "ArrowLeft" || ev.key === "ArrowRight" || ev.key === "ArrowUp" || ev.key === "ArrowDown") {
          movePartySelection(
            ev.key === "ArrowLeft"
              ? "left"
              : ev.key === "ArrowRight"
              ? "right"
              : ev.key === "ArrowUp"
              ? "up"
              : "down"
          );
          playBeep();
        } else if (ev.key === "Enter" || ev.key === " ") {
          const slotEl = slots[partySelectedIndex];
          const cardId = slotEl?.dataset?.cardId;
          if (cardId) {
            openPartyPopup(cardId, slotEl);
          }
        }
        return;
      }
    }

    if (
      ev.key === "ArrowLeft" ||
      ev.key === "ArrowRight" ||
      ev.key === "ArrowUp" ||
      ev.key === "ArrowDown"
    ) {
      ev.preventDefault();
      // If a header button already has focus but we don't have headerFocusIndex synced (e.g., mouse/tap focus), sync it
      if (headerFocusIndex < 0 && headerButtons.includes(target)) {
        focusHeaderButton(headerButtons.indexOf(target));
      }

      if (headerFocusIndex >= 0) {
        const focusedEl = headerButtons[headerFocusIndex];

        if (focusedEl === boxLabelEl) {
          if (ev.key === "ArrowLeft") gotoPrevBox();
          if (ev.key === "ArrowRight") gotoNextBox();
          if (ev.key === "ArrowUp" && partyButton) {
            const buttons = getHeaderButtons();
            const partyIdx = buttons.indexOf(partyButton);
            if (partyIdx !== -1) focusHeaderButton(partyIdx);
          }
          if (ev.key === "ArrowDown") {
            clearHeaderFocus();
            focusGridCell(3, 3);
          }
          return;
        }

        if (focusedEl === partyButton) {
          if (ev.key === "ArrowUp") {
            clearHeaderFocus();
            focusBottomOfGrid();
          } else if (ev.key === "ArrowLeft") {
            const buttons = getHeaderButtons();
            const closeIdx = buttons.indexOf(closeBoxLink);
            if (closeIdx !== -1) focusHeaderButton(closeIdx);
          } else if (ev.key === "ArrowRight") {
            const buttons = getHeaderButtons();
            const closeIdx = buttons.indexOf(closeBoxLink);
            if (closeIdx !== -1) focusHeaderButton(closeIdx);
          } else if (ev.key === "ArrowDown") {
            const buttons = getHeaderButtons();
            const labelIdx = buttons.indexOf(boxLabelEl);
            if (labelIdx !== -1) focusHeaderButton(labelIdx);
          }
          return;
        }

        if (focusedEl === closeBoxLink) {
          if (ev.key === "ArrowUp") {
            clearHeaderFocus();
            focusBottomOfGrid();
          } else if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
            const buttons = getHeaderButtons();
            const partyIdx = buttons.indexOf(partyButton);
            if (partyIdx !== -1) focusHeaderButton(partyIdx);
          } else if (ev.key === "ArrowDown") {
            const buttons = getHeaderButtons();
            const labelIdx = buttons.indexOf(boxLabelEl);
            if (labelIdx !== -1) focusHeaderButton(labelIdx);
          }
          return;
        }

        if (ev.key === "ArrowLeft") {
          focusHeaderButton(headerFocusIndex - 1);
        } else if (ev.key === "ArrowRight") {
          focusHeaderButton(headerFocusIndex + 1);
        } else if (ev.key === "ArrowDown") {
          clearHeaderFocus();
          ensureSelectionInBox();
        }
        return;
      }

      // If on first row and press up, jump to header buttons
      const slots = getVisibleSlots();
      const cols = getGridColumns();
      const idx = getSelectedSlotIndex(slots);
      const onFirstRow = idx >= 0 && idx < cols;

      if (
        ev.key === "ArrowUp" &&
        headerButtons.length &&
        (idx === -1 || onFirstRow)
      ) {
        focusHeaderButton(0); // start with box label
        return;
      }

      moveSelection(
        ev.key === "ArrowLeft"
          ? "left"
          : ev.key === "ArrowRight"
          ? "right"
          : ev.key === "ArrowUp"
          ? "up"
          : "down"
      );
      return;
    }

    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      if (headerFocusIndex >= 0) {
        const buttons = getHeaderButtons();
        const btn = buttons[headerFocusIndex];
        if (btn && btn !== boxLabelEl) btn.click();
        return;
      }

      const slots = getVisibleSlots();
      const idx = getSelectedSlotIndex(slots);
      if (idx === -1) return;
      const slotEl = slots[idx];
      const cardId = slotEl?.dataset?.cardId;
      if (!cardId) return;
      selectCard(cardId);
      openCardPopup(cardId, slotEl);
    }
  });

  if (popupWithdrawBtn) {
    popupWithdrawBtn.addEventListener("click", () => {
      if (popupCardId) addCardIdToParty(popupCardId);
      closeCardPopup();
  });
}

  if (popupCancelBtn) {
    popupCancelBtn.addEventListener("click", () => {
      closeCardPopup();
    });
  }

  if (popupSummaryBtn) {
    popupSummaryBtn.addEventListener("click", () => {
      if (popupCardId) {
        openSummaryModal(popupCardId);
        closeCardPopup();
      }
    });
  }

  if (partyCloseBtn) {
    partyCloseBtn.addEventListener("click", () => {
      closePartyShelf();
    });
  }

  // Sync header focus when clicked/tapped
  if (boxLabelEl) {
    boxLabelEl.addEventListener("click", () => focusHeaderButtonByElement(boxLabelEl));
  }
  if (partyButton) {
    partyButton.addEventListener("click", () => focusHeaderButtonByElement(partyButton));
  }
  if (closeBoxLink) {
    closeBoxLink.addEventListener("click", () => focusHeaderButtonByElement(closeBoxLink));
  }

  if (partyButton) {
    partyButton.addEventListener("click", () => {
      partyNavEnabled = true;
      if (!party.length) {
        openPartyShelf();
        setTimeout(() => {
          closePartyShelf();
          partyNavEnabled = false;
        }, 300);
        return;
      }
      openPartyShelf();
      if (partySelectedIndex < 0 && party.length) {
        focusPartySlot(0);
      } else if (partySelectedIndex >= 0) {
        applyPartySelection();
      }
    });
  }

  if (partyPopupDepositBtn) {
    partyPopupDepositBtn.addEventListener("click", () => {
      if (!partyPopupCardId) return;
      const idx = party.indexOf(partyPopupCardId);
      const card = cardsById[partyPopupCardId];
      const name = card?.name || "this card";

      if (idx !== -1) {
        party.splice(idx, 1);
        savePartyToStorage();
        renderParty();
        renderCurrentBox();
        syncCartWithParty();
        setBoxStatus(`Deposited "${name}" back into storage.`);
      }
      closePartyPopup();
    });
  }

  if (partyPopupSummaryBtn) {
    partyPopupSummaryBtn.addEventListener("click", () => {
      if (!partyPopupCardId) return;
      openSummaryModal(partyPopupCardId);
    });
  }

  if (partyPopupCancelBtn) {
    partyPopupCancelBtn.addEventListener("click", closePartyPopup);
  }

  if (summaryCloseBtn) {
    summaryCloseBtn.addEventListener("click", closeSummaryModal);
  }
  if (summaryBackdrop) {
    summaryBackdrop.addEventListener("click", closeSummaryModal);
  }
  if (summaryImage) {
    summaryImage.addEventListener("load", updateSummaryLensBackground);
  }
  document.addEventListener("pointerdown", markUserInteracted, { once: true });
  document.addEventListener("keydown", markUserInteracted, { once: true });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeSummaryModal();
    }
  });

  // Sync party popup focus when clicked/tapped
  if (partyPopupDepositBtn) {
    partyPopupDepositBtn.addEventListener("click", () =>
      focusPartyPopupButton(0)
    );
  }
  if (partyPopupSummaryBtn) {
    partyPopupSummaryBtn.addEventListener("click", () =>
      focusPartyPopupButton(1)
    );
  }
  if (partyPopupCancelBtn) {
    partyPopupCancelBtn.addEventListener("click", () =>
      focusPartyPopupButton(2)
    );
  }

  // Boot overlay triggers (store)
  if (bootTrigger) {
    bootTrigger.addEventListener("click", startBootSequence);
    bootTrigger.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        startBootSequence();
      }
    });
  }

  if (bootStoreBtn) {
    bootStoreBtn.addEventListener("click", () => {
      closeBootOverlay();
      setBoxStatus("Accessed Eli's PC.");
    });
  }

  if (bootAdminBtn) {
    bootAdminBtn.addEventListener("click", () => {
      window.location.href = "admin.html";
    });
  }

  if (bootLogoffBtn) {
    bootLogoffBtn.addEventListener("click", () => {
      closeBootOverlay();
    });
  }

  // Click-outside to close popup
  document.addEventListener("click", (ev) => {
    // Storage popup
    if (cardPopup) {
      if (
        !cardPopup.classList.contains("hidden") &&
        !cardPopup.contains(ev.target) &&
        !(boxGrid && boxGrid.contains(ev.target))
      ) {
        closeCardPopup();
      }
    }

    // Party popup
    if (partyPopup) {
      if (
        !partyPopup.classList.contains("hidden") &&
        !partyPopup.contains(ev.target) &&
        !(partySlotsContainer && partySlotsContainer.contains(ev.target))
      ) {
        closePartyPopup();
      }
    }
  });

  loadCards();
}

init();
function focusPartyClose() {
  clearGridSelection();
  const slots = getPartySlots();
  partySelectedIndex = -1;
  applyPartySelection();
  partyCloseFocus = true;
  partyCheckoutFocus = false;
  if (partyCheckoutBtn) partyCheckoutBtn.classList.remove("key-focus");
  if (partyCloseBtn) {
    partyCloseBtn.classList.add("key-focus");
    applyFocus(partyCloseBtn);
  }
}

function focusPartyCheckout() {
  clearGridSelection();
  const slots = getPartySlots();
  partySelectedIndex = -1;
  applyPartySelection();
  partyCheckoutFocus = true;
  partyCloseFocus = false;
  if (partyCloseBtn) partyCloseBtn.classList.remove("key-focus");
  if (partyCheckoutBtn) {
    partyCheckoutBtn.classList.add("key-focus");
    applyFocus(partyCheckoutBtn);
  }
}
