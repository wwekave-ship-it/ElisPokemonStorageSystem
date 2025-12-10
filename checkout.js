import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const CART_KEY = "pokemonCart";
const PARTY_KEY = "pokemonParty";
// Inline 1x1 transparent PNG to avoid 404s when no sprite is available
const FALLBACK_SPRITE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQYV2P4//8/AwAI/AL+XQvFeQAAAABJRU5ErkJggg==";
const DEFAULT_PAYMENT_ICONS = {
  venmo: "images/venmo-icon.svg",
  paypal: "images/paypal-icon.svg",
  trade: "images/trade.gif",
};
let selectedPaymentIndex = 0;
let selectedPartyIndex = 0;
let focusPanel = "payment"; // "payment" or "party"
let paymentPopupIdx = -1;
let partyPopupIdx = -1;
let summaryOpen = false;
let paymentPopupFocus = 0;
let partyPopupFocus = 0;
const PAYMENT_OPTIONS = [
  {
    id: "venmo",
    label: "Venmo",
    detail: "@elis-storage",
    desc: "Send to @elis-storage and drop your handle in the notes.",
    icon: DEFAULT_PAYMENT_ICONS.venmo,
  },
  {
    id: "paypal",
    label: "PayPal",
    detail: "paypal.me/pktmonster",
    desc: "Send via paypal.me/pktmonster (Goods & Services) and include order notes.",
    icon: DEFAULT_PAYMENT_ICONS.paypal,
  },
  {
    id: "trade",
    label: "Trade other cards",
    detail: "DM to arrange",
    desc: "Share what you have; Eli will confirm the swap.",
    icon: DEFAULT_PAYMENT_ICONS.trade,
  },
];
const PAYMENT_LINKS = {
  // Opens Venmo with amount and note; falls back to https if the app link is blocked
  venmo: (total) =>
    `https://account.venmo.com/u/DropDeadEliseo?txn=pay&audience=friends${
      Number.isFinite(total) ? `&amount=${total.toFixed(2)}` : ""
    }&note=Eli%20PC%20order`,
  paypal: (total) =>
    `https://paypal.me/pktmonster${Number.isFinite(total) ? `/${total.toFixed(2)}` : ""}`,
};
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
const themeDocRef = doc(db, "settings", "theme");
const paymentIcons = { ...DEFAULT_PAYMENT_ICONS };
const paymentPopup = document.getElementById("paymentPopup");
const paymentRequestBtn = document.getElementById("paymentRequestBtn");
const paymentCancelBtn = document.getElementById("paymentCancelBtn");
const partyPopup = document.getElementById("partyPopup");
const partyDepositBtn = document.getElementById("partyDepositBtn");
const partyCancelBtn = document.getElementById("partyCancelBtn");
const summaryModal = document.getElementById("summaryModal");
const summaryBackdrop = document.getElementById("summaryBackdrop");
const summaryCloseBtn = document.getElementById("summaryCloseBtn");
const summaryImage = document.getElementById("summaryImage");
const summaryName = document.getElementById("summaryName");
const summaryPrice = document.getElementById("summaryPrice");
let summaryLens = null;
const tradeModal = document.getElementById("tradeModal");
const tradeBackdrop = document.getElementById("tradeBackdrop");
const tradeForm = document.getElementById("tradeForm");
const tradeName = document.getElementById("tradeName");
const tradeEmail = document.getElementById("tradeEmail");
const tradePhone = document.getElementById("tradePhone");
const tradeLocation = document.getElementById("tradeLocation");
const tradeDate = document.getElementById("tradeDate");
const tradeTime = document.getElementById("tradeTime");
const tradeCancelBtn = document.getElementById("tradeCancelBtn");
const tradeDateDisplay = document.getElementById("tradeDateDisplay");
const tradeCalendar = document.getElementById("tradeCalendar");
const bootOverlay = document.getElementById("bootOverlay");
const bootTitle = document.getElementById("bootTitle");
const bootSubtitle = document.getElementById("bootSubtitle");
let tradeCalPrevBtn = null;
let tradeCalNextBtn = null;
let tradeCalMonthLabel = null;
let tradeCalGrid = null;
let tradeModalOpen = false;
let pendingPaymentLink = null;
let pendingPaymentMethod = null;
let pickupAvailability = {
  isekai: { startDate: "", endDate: "", startTime: "", endTime: "", unavailableDays: ["mon"] },
  aspen: { startDate: "", endDate: "", startTime: "", endTime: "", unavailableDays: [] },
};

const TIME_STEP_MINUTES = 30;
let calendarMonth = null;
const TRADE_REQUESTS_COLLECTION = "tradeRequests";
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1445967642828734559/55WlM-zw2Lmhsby5sYFIdmOgca4oBpQ3Y0MLHHppqKItijLmpl3oLsrj7lGsRBT-w19e"; // Optional: paste your Discord webhook URL for direct client-side notify
let bootOverlayTimer = null;

function getTodayISO() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString().slice(0, 10);
}

function updateDateDisplay() {
  if (!tradeDateDisplay) return;
  const val = tradeDate?.value;
  if (!val) {
    tradeDateDisplay.textContent = "Select a date";
    return;
  }
  const dateObj = new Date(val);
  if (Number.isNaN(dateObj.getTime())) {
    tradeDateDisplay.textContent = val;
    return;
  }
  const formatted = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateObj);
  tradeDateDisplay.textContent = formatted;
}

function ensureCalendarShell() {
  if (!tradeCalendar || tradeCalendar.dataset.ready) return;
  tradeCalendar.innerHTML = `
    <div class="trade-calendar-header">
      <div class="trade-calendar-nav">
        <button type="button" data-cal-prev aria-label="Previous month">‹</button>
        <button type="button" data-cal-next aria-label="Next month">›</button>
      </div>
      <div class="trade-calendar-title" data-cal-title></div>
    </div>
    <div class="trade-calendar-weekdays">
      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
    </div>
    <div class="trade-calendar-grid" data-cal-grid></div>
  `;
  tradeCalPrevBtn = tradeCalendar.querySelector("[data-cal-prev]");
  tradeCalNextBtn = tradeCalendar.querySelector("[data-cal-next]");
  tradeCalMonthLabel = tradeCalendar.querySelector("[data-cal-title]");
  tradeCalGrid = tradeCalendar.querySelector("[data-cal-grid]");
  tradeCalendar.dataset.ready = "true";
  tradeCalPrevBtn?.addEventListener("click", () => shiftCalendarMonth(-1));
  tradeCalNextBtn?.addEventListener("click", () => shiftCalendarMonth(1));
}

function applyFocus(el) {
  if (el && el.focus) el.focus({ preventScroll: true });
}

function setSelectedPayment(index) {
  const clamped = Math.max(0, Math.min(PAYMENT_OPTIONS.length - 1, index));
  selectedPaymentIndex = clamped;
  const opt = PAYMENT_OPTIONS[clamped];
  if (opt) {
    document.body.dataset.selectedPayment = opt.id;
  }
}

function setFocusPanel(panel, cartOverride) {
  focusPanel = panel;
  const cartData = cartOverride || loadCart();
  renderPaymentOptions(document.body.dataset.selectedPayment || PAYMENT_OPTIONS[selectedPaymentIndex]?.id);
  renderPartyGrid(cartData);
  if (focusPanel === "payment") {
    focusCurrentPayment();
  } else if (focusPanel === "party") {
    focusCurrentParty();
  }
}

function getPaymentButtons() {
  const opts = Array.from(
    document.getElementById("paymentOptions")?.querySelectorAll(".payment-option") || []
  );
  if (backToStoreLink) opts.push(backToStoreLink);
  return opts;
}

function clearPaymentKeyFocus() {
  getPaymentButtons().forEach((btn) => {
    btn.classList.remove("key-focus", "selected");
  });
}

function focusBackToStore() {
  if (!backToStoreLink) return;
  clearPaymentKeyFocus();
  backToStoreLink.classList.add("key-focus");
  applyFocus(backToStoreLink);
}

function focusCurrentPayment() {
  const buttons = getPaymentButtons();
  const btn = buttons[selectedPaymentIndex];
  if (btn) {
    clearPaymentKeyFocus();
    btn.classList.add("key-focus");
    applyFocus(btn);
  }
}

function focusCurrentParty() {
  const slots = getPartySlots();
  const slot = slots[selectedPartyIndex];
  if (slot) applyFocus(slot);
}

function getPartySlots() {
  return Array.from(document.getElementById("partyGrid")?.querySelectorAll(".party-slot-card") || []);
}

function getPartyGridCols() {
  const slots = getPartySlots();
  if (slots.length < 2) return 1;
  const top = slots[0].getBoundingClientRect().top;
  let cols = 0;
  for (const slot of slots) {
    if (Math.abs(slot.getBoundingClientRect().top - top) < 1) {
      cols += 1;
    } else {
      break;
    }
  }
  return Math.max(1, cols);
}

function isPartyEdge(direction, total, cols) {
  const idx = selectedPartyIndex >= 0 ? selectedPartyIndex : 0;
  const row = Math.floor(idx / cols);
  const col = idx % cols;
  if (direction === "left") return col === 0;
  if (direction === "right") {
    const lastRowStart = Math.floor((total - 1) / cols) * cols;
    const rowEnd = Math.min(total - 1, lastRowStart + cols - 1);
    return col === cols - 1 || idx === rowEnd;
  }
  if (direction === "up") return row === 0;
  if (direction === "down") return idx + cols >= total;
  return false;
}

function movePartySelection(direction) {
  const slots = getPartySlots();
  const total = slots.length;
  if (!total) return false;
  const cols = getPartyGridCols();
  let idx = selectedPartyIndex >= 0 ? selectedPartyIndex : 0;
  const row = Math.floor(idx / cols);
  const col = idx % cols;

  if (direction === "left") {
    if (col > 0) idx -= 1;
    else idx = Math.max(0, Math.min(total - 1, (row - 1) * cols + (cols - 1)));
  } else if (direction === "right") {
    if (col < cols - 1 && idx + 1 < total) idx += 1;
    else idx = Math.min(total - 1, (row + 1) * cols);
  } else if (direction === "up") {
    if (row > 0) idx -= cols;
    else idx = ((Math.floor((total - 1) / cols)) * cols) + col;
    if (idx >= total) idx = total - 1;
  } else if (direction === "down") {
    if (idx + cols < total) idx += cols;
    else idx = col;
    if (idx >= total) idx = total - 1;
  }

  const changed = idx !== selectedPartyIndex;
  selectedPartyIndex = idx;
  return changed;
}

function mapPaymentToPartyIndex(paymentIdx, side = "right") {
  const slots = getPartySlots();
  const total = slots.length;
  if (!total) return 0;
  const cols = getPartyGridCols();
  const rows = Math.max(1, Math.ceil(total / cols));
  const maxPay = Math.max(1, PAYMENT_OPTIONS.length - 1);
  const rowFromPayment = Math.round((paymentIdx / maxPay) * (rows - 1));
  const rowStart = rowFromPayment * cols;
  const rowEnd = Math.min(total - 1, rowStart + cols - 1);
  return side === "left" ? rowStart : rowEnd;
}

function mapPartyToPaymentIndex(partyIdx) {
  const slots = getPartySlots();
  const total = slots.length;
  if (!total) return selectedPaymentIndex;
  const cols = getPartyGridCols();
  const rows = Math.max(1, Math.ceil(total / cols));
  const row = Math.floor(partyIdx / cols);
  const maxPay = Math.max(1, PAYMENT_OPTIONS.length - 1);
  const paymentIdx = Math.round((row / Math.max(1, rows - 1)) * maxPay);
  return Math.max(0, Math.min(PAYMENT_OPTIONS.length - 1, paymentIdx));
}

function getPaymentPopupButtons() {
  return [paymentCancelBtn, paymentRequestBtn].filter(Boolean);
}

function focusPaymentPopupButton(index) {
  const buttons = getPaymentPopupButtons();
  if (!buttons.length) return;
  const clamped = Math.max(0, Math.min(index, buttons.length - 1));
  paymentPopupFocus = clamped;
  buttons.forEach((btn, idx) => {
    btn.classList.toggle("key-focus", idx === clamped);
  });
  applyFocus(buttons[clamped]);
}

function getPartyPopupButtons() {
  // Default focus goes to Cancel first, then Deposit
  return [partyCancelBtn, partyDepositBtn].filter(Boolean);
}

function focusPartyPopupButton(index) {
  const buttons = getPartyPopupButtons();
  if (!buttons.length) return;
  const clamped = Math.max(0, Math.min(index, buttons.length - 1));
  partyPopupFocus = clamped;
  buttons.forEach((btn, idx) => {
    btn.classList.toggle("key-focus", idx === clamped);
  });
  applyFocus(buttons[clamped]);
}

function attachImgFallback(imgEl) {
  if (!imgEl) return;
  imgEl.onerror = () => {
    if (imgEl.dataset.fallbackApplied) return;
    imgEl.dataset.fallbackApplied = "true";
    imgEl.src = FALLBACK_SPRITE;
  };
}

function normalizeNameToSprite(name) {
  return `sprites/${String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")}.png`;
}

function loadParty() {
  const raw = localStorage.getItem(PARTY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveParty(partyIds) {
  localStorage.setItem(PARTY_KEY, JSON.stringify(partyIds));
}

function clearPartyAndCart() {
  saveParty([]);
  saveCart([]);
  setFocusPanel("payment", []);
}

function showBootMessage(title, subtitle, duration = 2000) {
  if (!bootOverlay) return;
  if (bootTitle) bootTitle.textContent = title;
  if (bootSubtitle) bootSubtitle.textContent = subtitle;
  bootOverlay.classList.remove("hidden");
  if (bootOverlayTimer) clearTimeout(bootOverlayTimer);
  bootOverlayTimer = setTimeout(() => {
    bootOverlay.classList.add("hidden");
  }, duration);
}

function applyLocalPaymentIcons() {
  Object.keys(DEFAULT_PAYMENT_ICONS).forEach((key) => {
    const saved = localStorage.getItem(`paymentIcon_${key}`);
    if (saved) paymentIcons[key] = saved;
  });
}

function loadCart() {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function getCartTotal(cartItems = []) {
  return cartItems.reduce((sum, item) => {
    const val = Number(item.price);
    return Number.isNaN(val) ? sum : sum + val;
  }, 0);
}

function renderPartyGrid(cart) {
  const grid = document.getElementById("partyGrid");
  const emptyMsg = document.getElementById("cartEmptyMessage");
  const totalEl = document.getElementById("cartTotal");
  if (!grid) return;

  grid.innerHTML = "";
  const total = cart.reduce((sum, item) => {
    const priceNum = Number(item.price) || 0;
    return sum + priceNum * item.quantity;
  }, 0);

  if (!cart.length) {
    emptyMsg.style.display = "block";
    totalEl.textContent = "";
    return;
  }

  emptyMsg.style.display = "none";

  cart.forEach((item, index) => {
    const priceNum = Number(item.price) || 0;
    const subtotal = priceNum * item.quantity;

    const slot = document.createElement("div");
    slot.className = "party-slot-card";
    slot.tabIndex = -1;

    const sprite = item.sprite || normalizeNameToSprite(item.name);
    const img = document.createElement("img");
    img.className = "party-slot-sprite";
    img.alt = item.name || "Card";
    img.src = sprite;
    attachImgFallback(img);

    const name = document.createElement("div");
    name.className = "party-slot-name";
    name.textContent = item.name || "Unknown";

    const meta = document.createElement("div");
    meta.className = "party-slot-meta";
    meta.textContent = `Qty ${item.quantity} • $${priceNum.toFixed(2)}`;

    slot.appendChild(img);
    slot.appendChild(name);
    slot.appendChild(meta);

    const handlePartyActivate = (ev) => {
      ev.preventDefault();
      selectedPartyIndex = index;
      setSelectedPayment(mapPartyToPaymentIndex(selectedPartyIndex));
      focusPanel = "party";
      renderPaymentOptions(document.body.dataset.selectedPayment || PAYMENT_OPTIONS[selectedPaymentIndex]?.id);
      renderPartyGrid(cart);
      requestAnimationFrame(() => {
        const slotsFresh = getPartySlots();
        const anchor = slotsFresh[selectedPartyIndex] || slot;
        openPartyPopup(selectedPartyIndex, anchor);
        focusCurrentParty();
      });
      ev.stopPropagation();
    };

    slot.addEventListener("click", handlePartyActivate);
    slot.addEventListener("mousedown", (ev) => {
      if (ev.button === 2) {
        handlePartyActivate(ev);
      }
    });
    slot.addEventListener("contextmenu", handlePartyActivate);

    grid.appendChild(slot);
  });

  const clamped = Math.max(0, Math.min(selectedPartyIndex, cart.length - 1));
  selectedPartyIndex = clamped;
  const slots = Array.from(grid.querySelectorAll(".party-slot-card"));
  slots.forEach((slot, idx) => {
    const isFocus = focusPanel === "party" && idx === clamped;
    slot.classList.toggle("selected", isFocus);
    slot.classList.toggle("key-focus", isFocus);
    if (isFocus) {
      applyFocus(slot);
    }
  });

  totalEl.textContent = `Total: $${total.toFixed(2)}`;
}

function renderPaymentOptions(selectedId) {
  const container = document.getElementById("paymentOptions");
  if (!container) return;
  container.innerHTML = "";

  PAYMENT_OPTIONS.forEach((opt, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const isSelected = selectedId ? opt.id === selectedId : idx === selectedPaymentIndex;
    if (isSelected) selectedPaymentIndex = idx;
    btn.className = "payment-option";
    btn.dataset.method = opt.id;
    btn.tabIndex = -1;

    const label = document.createElement("div");
    label.className = "payment-option-label";
    label.textContent = opt.label;

    const icon = document.createElement("img");
    icon.className = "payment-option-icon";
    icon.alt = `${opt.label} icon`;
    icon.src = paymentIcons[opt.id] || opt.icon || DEFAULT_PAYMENT_ICONS[opt.id];
    icon.onerror = () => {
      const fallback = DEFAULT_PAYMENT_ICONS[opt.id];
      if (fallback && icon.src !== fallback) {
        icon.src = fallback;
      }
    };

    const detail = document.createElement("div");
    detail.className = "payment-option-detail";
    detail.textContent = opt.detail;

    btn.appendChild(icon);
    btn.appendChild(label);
    btn.appendChild(detail);

    btn.addEventListener("click", () => {
      setSelectedPayment(idx);
      focusPanel = "payment";
      renderPaymentOptions(opt.id);
      renderPartyGrid(loadCart());
      requestAnimationFrame(() => {
        const buttons = getPaymentButtons();
        const anchor = buttons[selectedPaymentIndex] || btn;
        openPaymentPopup(selectedPaymentIndex, anchor);
        focusCurrentPayment();
      });
    });

    container.appendChild(btn);
  });

  const buttons = Array.from(container.querySelectorAll(".payment-option"));
  buttons.forEach((btn, idx) => {
    const isFocus = focusPanel === "payment" && idx === selectedPaymentIndex;
    btn.classList.toggle("selected", isFocus);
    btn.classList.toggle("key-focus", isFocus);
  });
  const focused = buttons[selectedPaymentIndex];
  if (focusPanel === "payment" && focused) {
    applyFocus(focused);
  }
}

function closeSummaryModal() {
  if (!summaryModal) return;
  summaryModal.classList.add("hidden");
  summaryOpen = false;
  if (summaryLens) summaryLens.classList.add("hidden");
}

function ensureSummaryLens() {
  if (summaryLens || !summaryImage) return;
  summaryLens = document.createElement("div");
  summaryLens.id = "checkoutSummaryLens";
  summaryLens.className = "summary-lens hidden";
  summaryImage.parentElement?.appendChild(summaryLens);
  summaryImage.parentElement?.addEventListener("mousemove", handleSummaryLensMove);
  summaryImage.parentElement?.addEventListener("mouseenter", showSummaryLens);
  summaryImage.parentElement?.addEventListener("mouseleave", hideSummaryLens);
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
  if (!summaryLens || !summaryImage) return;
  const rect = summaryImage.getBoundingClientRect();
  const lensRect = summaryLens.getBoundingClientRect();
  const lensR = lensRect.width / 2;
  const natW = summaryImage.naturalWidth;
  const natH = summaryImage.naturalHeight;
  if (!natW || !natH) return;

  let x = ev.clientX - rect.left;
  let y = ev.clientY - rect.top;
  x = Math.max(0, Math.min(rect.width, x));
  y = Math.max(0, Math.min(rect.height, y));
  const lensX = x - lensR;
  const lensY = y - lensR;
  summaryLens.style.left = `${lensX}px`;
  summaryLens.style.top = `${lensY}px`;

  const bgW = natW * 1.4;
  const bgH = natH * 1.4;
  const ratioX = x / rect.width;
  const ratioY = y / rect.height;
  summaryLens.style.backgroundSize = `${bgW}px ${bgH}px`;
  summaryLens.style.backgroundPosition = `-${ratioX * bgW - lensR}px -${
    ratioY * bgH - lensR
  }px`;
}

function openSummaryForIndex(idx) {
  if (!summaryModal || !summaryImage) return;
  const cartItems = loadCart();
  if (idx < 0 || idx >= cartItems.length) return;
  const item = cartItems[idx];
  const imgSrc = item.sprite || normalizeNameToSprite(item.name);
  closePartyPopup();
  summaryImage.src = imgSrc;
  attachImgFallback(summaryImage);
  summaryName.textContent = item.name || "Unknown";
  summaryPrice.textContent = `$${(Number(item.price) || 0).toFixed(2)}`;
  ensureSummaryLens();
  updateSummaryLensBackground();
  summaryModal.classList.remove("hidden");
  summaryOpen = true;
}

async function loadPaymentIconsFromCloud() {
  try {
    const snap = await getDoc(themeDocRef);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    if (data.paymentIcons) {
      Object.entries(data.paymentIcons).forEach(([key, val]) => {
        if (val) {
          paymentIcons[key] = val;
          localStorage.setItem(`paymentIcon_${key}`, val);
        }
      });
    }
    if (data.pickupAvailability) {
      const avail = data.pickupAvailability;
      pickupAvailability = {
        isekai: {
          startDate: "",
          endDate: "",
          startTime: "",
          endTime: "",
          unavailableDays: ["mon"],
          ...(avail.isekai || {}),
        },
        aspen: {
          startDate: "",
          endDate: "",
          startTime: "",
          endTime: "",
          unavailableDays: [],
          ...(avail.aspen || {}),
        },
      };
      // Support legacy timeWindow if present
      ["isekai", "aspen"].forEach((key) => {
      const entry = pickupAvailability[key];
      if (entry && !entry.startTime && entry.timeWindow) {
        entry.startTime = entry.timeWindow;
      }
      if (!Array.isArray(entry.unavailableDays)) {
        entry.unavailableDays = key === "isekai" ? ["mon"] : [];
      }
      if (!entry.dayTimes) entry.dayTimes = {};
    });
    applyPickupAvailabilityToForm();
    }
  } catch (err) {
    console.warn("Failed to load payment icons from cloud.", err);
  }
}

function closePaymentPopup() {
  if (!paymentPopup) return;
  paymentPopup.classList.add("hidden");
  paymentPopupIdx = -1;
  paymentPopupFocus = 0;
}

function openPaymentPopup(index, anchorEl) {
  if (!paymentPopup || !anchorEl) return;
  paymentPopupIdx = index;
  positionPopup(paymentPopup, anchorEl);
  focusPaymentPopupButton(0);
}

function closePartyPopup() {
  if (!partyPopup) return;
  partyPopup.classList.add("hidden");
  partyPopupIdx = -1;
  partyPopupFocus = 0;
}

function normalizeLocationKey(loc) {
  if (!loc) return "";
  const lower = loc.toLowerCase();
  if (lower.includes("isekai")) return "isekai";
  if (lower.includes("aspen")) return "aspen";
  return "";
}

function applyPickupAvailabilityToForm() {
  if (!tradeLocation) return;
  const key = normalizeLocationKey(tradeLocation.value);
  const data = pickupAvailability[key] || {};
  const todayISO = getTodayISO();
  if (tradeDate) {
    const startMin = data.startDate ? data.startDate : todayISO;
    tradeDate.min = startMin < todayISO ? todayISO : startMin;
    if (data.endDate) tradeDate.max = data.endDate;
    else tradeDate.removeAttribute("max");
    // clear preset if it falls outside allowable range
    if (tradeDate.value && (tradeDate.value < tradeDate.min || (tradeDate.max && tradeDate.value > tradeDate.max))) {
      tradeDate.value = "";
    }
  }
  populateTimeOptionsForDate(tradeDate?.value || "");
  validateTradeDate();
  renderCalendar();
  updateDateDisplay();
}

function isDateBlocked(dateStr) {
  if (!tradeLocation || !dateStr) return false;
  const key = normalizeLocationKey(tradeLocation.value);
  const data = pickupAvailability[key] || {};
  const blocked = data.unavailableDays || [];
  if (!blocked.length) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const dayIdx = date.getUTCDay(); // 0 Sun .. 6 Sat
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = map[dayIdx];
  return blocked.includes(dayKey);
}

function findNextAvailableDate(startStr) {
  const todayISO = getTodayISO();
  let date = startStr ? new Date(startStr) : new Date(todayISO);
  if (Number.isNaN(date.getTime())) date = new Date(todayISO);
  const earliest = new Date(todayISO);
  for (let i = 0; i < 31; i++) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + i);
    if (candidate < earliest) continue;
    const iso = candidate.toISOString().slice(0, 10);
    if (!isDateBlocked(iso)) return iso;
  }
  return startStr || "";
}

function parseTimeToMinutes(str) {
  if (!str || !/^\d{2}:\d{2}/.test(str)) return null;
  const [h, m] = str.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatTimeLabel(mins) {
  const hours24 = Math.floor(mins / 60);
  const minutes = mins % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}

function getDateLimitsForLocation() {
  const todayISO = getTodayISO();
  const key = normalizeLocationKey(tradeLocation?.value);
  const data = pickupAvailability[key] || {};
  const min = data.startDate ? (data.startDate < todayISO ? todayISO : data.startDate) : todayISO;
  const max = data.endDate || null;
  return { min, max };
}

function shiftCalendarMonth(delta) {
  if (!calendarMonth) calendarMonth = new Date();
  calendarMonth.setMonth(calendarMonth.getMonth() + delta);
  renderCalendar();
}

function renderCalendar() {
  if (!tradeCalendar) return;
  ensureCalendarShell();
  if (!calendarMonth) calendarMonth = new Date();
  const { min, max } = getDateLimitsForLocation();
  const minDate = new Date(min);
  const maxDate = max ? new Date(max) : null;

  // Clamp calendarMonth within bounds
  if (calendarMonth < minDate) calendarMonth = new Date(minDate);
  if (maxDate && calendarMonth > maxDate) calendarMonth = new Date(maxDate);

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (tradeCalMonthLabel) {
    const formatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
    tradeCalMonthLabel.textContent = formatter.format(firstOfMonth);
  }

  if (tradeCalPrevBtn) {
    const prevMonth = new Date(year, month - 1, 1);
    const prevAllowed = !minDate || prevMonth >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    tradeCalPrevBtn.disabled = !prevAllowed;
  }
  if (tradeCalNextBtn) {
    const nextMonth = new Date(year, month + 1, 1);
    const nextAllowed = !maxDate || nextMonth <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    tradeCalNextBtn.disabled = !nextAllowed;
  }

  if (tradeCalGrid) {
    tradeCalGrid.innerHTML = "";
    for (let i = 0; i < startWeekday; i++) {
      const spacer = document.createElement("div");
      tradeCalGrid.appendChild(spacer);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const iso = dateObj.toISOString().slice(0, 10);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "trade-day";
      button.textContent = day;

      const todayISO = getTodayISO();
      const todayDate = new Date(todayISO);
      const isUnavailable =
        (minDate && dateObj < minDate) ||
        (maxDate && dateObj > maxDate) ||
        isDateBlocked(iso);

      if (isUnavailable) {
        button.classList.add("unavailable");
        button.disabled = true;
      }
      if (iso === todayISO) button.classList.add("today");
      if (tradeDate && tradeDate.value === iso) button.classList.add("selected");

      button.addEventListener("click", () => {
        if (isUnavailable) return;
        if (tradeDate) tradeDate.value = iso;
        updateDateDisplay();
        validateTradeDate();
      });

      tradeCalGrid.appendChild(button);
    }
  }
  updateDateDisplay();
}

function getTimeWindowForDate(dateStr) {
  const key = normalizeLocationKey(tradeLocation?.value);
  const data = pickupAvailability[key] || {};
  if (!dateStr) return { start: "", end: "", dayOverride: null };
  const dayIdx = new Date(dateStr).getUTCDay();
  const dayKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][dayIdx];
  const override = (data.dayTimes || {})[dayKey] || null;
  return {
    start: override?.start || data.startTime || "",
    end: override?.end || data.endTime || "",
    dayOverride: override,
  };
}

function populateTimeOptionsForDate(dateStr) {
  if (!tradeTime) return;
  tradeTime.innerHTML = "";
  if (!dateStr) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "Select a date first";
    tradeTime.appendChild(placeholder);
    tradeTime.disabled = true;
    tradeTime.setCustomValidity("Select a date first.");
    return;
  }
  tradeTime.disabled = false;
  const window = getTimeWindowForDate(dateStr);
  const startMins = parseTimeToMinutes(window.start);
  const endMins = parseTimeToMinutes(window.end);

  if (startMins == null || endMins == null || endMins <= startMins) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No times available";
    opt.disabled = true;
    opt.selected = true;
    tradeTime.appendChild(opt);
    tradeTime.setCustomValidity("No available times for this day.");
    tradeTime.disabled = true;
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = "Select a time";
  tradeTime.appendChild(placeholder);

  for (let mins = startMins; mins <= endMins; mins += TIME_STEP_MINUTES) {
    const timeStr = minutesToTime(mins);
    const opt = document.createElement("option");
    opt.value = timeStr;
    opt.textContent = formatTimeLabel(mins);
    tradeTime.appendChild(opt);
  }

  tradeTime.setCustomValidity("");
}

async function saveTradeRequest(payload) {
  const colRef = collection(db, TRADE_REQUESTS_COLLECTION);
  const enriched = {
    ...payload,
    status: "pending",
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(colRef, enriched);
  return docRef.id;
}

async function updateCardsFlags(cardIds = [], updates = {}) {
  if (!cardIds.length) return;
  const batch = writeBatch(db);
  cardIds.forEach((id) => {
    batch.set(doc(db, "cards", id), updates, { merge: true });
  });
  await batch.commit();
}

async function sendDiscordWebhook(payload, requestId) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    const { name, email, phone, location, date, time, cart = [] } = payload;
    const cartLines =
      cart.length === 0
        ? "No items."
        : cart
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
              return `• ${label}${setNum}${price ? ` (${price})` : ""}`;
            })
            .join("\\n");
    const total = cart.reduce((sum, item) => {
      const val = Number(item.price);
      return Number.isNaN(val) ? sum : sum + val;
    }, 0);

    const payloadBody = {
      username: "Eli Trade Requests",
      embeds: [
        {
          title: "New Pickup Request (client)",
          color: 0x3bc7ff,
          fields: [
            {
              name: "Customer",
              value: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || "N/A"}`,
              inline: false,
            },
            {
              name: "Pickup",
              value: `Location: ${location}\nDate: ${date}\nTime: ${time}`,
              inline: false,
            },
            {
              name: "Items",
              value: cartLines || "No items.",
              inline: false,
            },
            {
              name: "Total",
              value: cart.length ? `$${total.toFixed(2)}` : "—",
              inline: true,
            },
            {
              name: "Request ID",
              value: requestId || "N/A",
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    };

    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadBody),
    });
  } catch (err) {
    console.warn("Discord webhook failed (client)", err);
  }
}

function validateTradeDate() {
  if (!tradeDate) return;
  const val = tradeDate.value;
  const blocked = isDateBlocked(val);
  if (blocked) {
    tradeDate.setCustomValidity("Selected date is not available for pickup.");
  } else {
  tradeDate.setCustomValidity("");
  }
  tradeDate.reportValidity?.();
  populateTimeOptionsForDate(tradeDate.value);
  renderCalendar();
  updateDateDisplay();
}

function openTradeModal() {
  if (!tradeModal) return;
  if (tradeLocation && !tradeLocation.value) {
    const first = tradeLocation.querySelector("option[value]:not([disabled])");
    if (first) tradeLocation.value = first.value;
  }
  applyPickupAvailabilityToForm();
  if (tradeDate) {
    tradeDate.value = "";
  }
  populateTimeOptionsForDate("");
  tradeModal.classList.remove("hidden");
  tradeModalOpen = true;
  closePaymentPopup();
  setTimeout(() => {
    if (tradeDateDisplay && tradeDateDisplay.focus) {
      tradeDateDisplay.focus();
    } else if (tradeName && tradeName.focus) {
      tradeName.focus();
    }
  }, 0);
}

function closeTradeModal() {
  if (!tradeModal) return;
  tradeModal.classList.add("hidden");
  tradeModalOpen = false;
  pendingPaymentLink = null;
  pendingPaymentMethod = null;
}

function positionPopup(popupEl, anchorEl) {
  if (!popupEl || !anchorEl) return;
  popupEl.classList.remove("hidden");
  // allow the browser to render to measure size
  popupEl.style.left = "-9999px";
  popupEl.style.top = "-9999px";
  const popRect = popupEl.getBoundingClientRect();
  const anchorRect = anchorEl.getBoundingClientRect();
  let left = anchorRect.left + window.scrollX + anchorRect.width / 2 - popRect.width / 2;
  let top = anchorRect.top + window.scrollY - popRect.height - 8;
  // clamp inside viewport
  left = Math.max(8, Math.min(left, window.innerWidth - popRect.width - 8));
  if (top < 8) top = anchorRect.bottom + window.scrollY + 8;
  popupEl.style.left = `${left}px`;
  popupEl.style.top = `${top}px`;
}

function openPartyPopup(index, anchorEl) {
  if (!partyPopup || !anchorEl) return;
  partyPopupIdx = index;
  positionPopup(partyPopup, anchorEl);
  focusPartyPopupButton(0);
}

document.addEventListener("DOMContentLoaded", async () => {
  showBootMessage("Communication Standby...", "Please wait", 1500);
  const cart = loadCart();
  applyLocalPaymentIcons();
  document.body.dataset.selectedPayment = "venmo";
  setFocusPanel("payment", cart);
  await loadPaymentIconsFromCloud();
  setFocusPanel("payment", cart);

  document.addEventListener("keydown", (ev) => {
    const paymentPopupOpen =
      paymentPopup && !paymentPopup.classList.contains("hidden");
    const partyPopupOpen =
      partyPopup && !partyPopup.classList.contains("hidden");
    const tradeModalIsOpen =
      tradeModalOpen && tradeModal && !tradeModal.classList.contains("hidden");
    const summaryModalOpen =
      summaryOpen && summaryModal && !summaryModal.classList.contains("hidden");

    if (tradeModalIsOpen) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeTradeModal();
      }
      return;
    }

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

    if (paymentPopupOpen) {
      if (
        ev.key === "ArrowLeft" ||
        ev.key === "ArrowRight" ||
        ev.key === "ArrowUp" ||
        ev.key === "ArrowDown" ||
        ev.key === "Enter" ||
        ev.key === " "
      ) {
        ev.preventDefault();
    const buttons = getPaymentPopupButtons();
    if (!buttons.length) return;
    if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
      focusPaymentPopupButton(paymentPopupFocus - 1);
    } else if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
      focusPaymentPopupButton(paymentPopupFocus + 1);
    } else if (ev.key === "Enter" || ev.key === " ") {
      const btn = buttons[paymentPopupFocus];
      btn?.click();
    }
  } else if (ev.key === "Escape") {
    closePaymentPopup();
  }
  return;
}

    if (partyPopupOpen) {
      if (
        ev.key === "ArrowLeft" ||
        ev.key === "ArrowRight" ||
        ev.key === "ArrowUp" ||
        ev.key === "ArrowDown" ||
        ev.key === "Enter" ||
        ev.key === " "
      ) {
        ev.preventDefault();
        const buttons = getPartyPopupButtons();
        if (!buttons.length) return;
        if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
          focusPartyPopupButton(partyPopupFocus - 1);
        } else if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
          focusPartyPopupButton(partyPopupFocus + 1);
        } else if (ev.key === "Enter" || ev.key === " ") {
          const btn = buttons[partyPopupFocus];
          btn?.click();
        }
      } else if (ev.key === "Escape") {
        closePartyPopup();
      }
      return;
    }

    const target = ev.target;
    const isTypingField =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable;
    if (isTypingField) return;

    const cartItems = loadCart();
    const partyHasItems = cartItems.length > 0;

    if (ev.key === "ArrowUp" || ev.key === "ArrowDown") {
      ev.preventDefault();
      if (focusPanel === "payment") {
        const lastPaymentIdx = PAYMENT_OPTIONS.length - 1;
        const isOnBackLink =
          backToStoreLink && document.activeElement === backToStoreLink;

        // Move from back link back to last payment on ArrowUp
        if (ev.key === "ArrowUp" && isOnBackLink) {
          setSelectedPayment(lastPaymentIdx);
          renderPaymentOptions(document.body.dataset.selectedPayment);
          focusCurrentPayment();
          return;
        }

        // Move from last payment down into the Back to PC link
        if (ev.key === "ArrowDown" && selectedPaymentIndex === lastPaymentIdx && backToStoreLink) {
          clearPaymentKeyFocus();
          backToStoreLink.classList.add("key-focus");
          applyFocus(backToStoreLink);
          return;
        }

        const delta = ev.key === "ArrowUp" ? -1 : 1;
        setSelectedPayment(selectedPaymentIndex + delta);
        renderPaymentOptions(document.body.dataset.selectedPayment);
        focusCurrentPayment();
      } else if (focusPanel === "party" && partyHasItems) {
        const moved = movePartySelection(ev.key === "ArrowUp" ? "up" : "down");
        if (moved) {
          setFocusPanel("party", cartItems);
        }
      }
      return;
    }

    if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
      ev.preventDefault();
      if (focusPanel === "party" && partyHasItems) {
        const cols = getPartyGridCols();
        const total = cartItems.length;
        const idx = selectedPartyIndex >= 0 ? selectedPartyIndex : 0;
        const col = cols > 0 ? idx % cols : 0;
        if (ev.key === "ArrowLeft") {
          if (col === 0) {
            setSelectedPayment(mapPartyToPaymentIndex(idx));
            setFocusPanel("payment", cartItems);
          } else {
            selectedPartyIndex = Math.max(0, idx - 1);
            setFocusPanel("party", cartItems);
          }
          return;
        }
        if (ev.key === "ArrowRight") {
          const atRightEdge = col === cols - 1 || idx === total - 1;
          if (atRightEdge) {
            setSelectedPayment(mapPartyToPaymentIndex(idx));
            setFocusPanel("payment", cartItems);
          } else {
            selectedPartyIndex = Math.min(total - 1, idx + 1);
            setFocusPanel("party", cartItems);
          }
          return;
        }
      }
      if (ev.key === "ArrowLeft") {
        // from payment, jump to the right column of the nearest party row
        if (partyHasItems) {
          selectedPartyIndex = mapPaymentToPartyIndex(selectedPaymentIndex, "right");
          setFocusPanel("party", cartItems);
        } else {
          setFocusPanel("payment", cartItems);
        }
      } else if (ev.key === "ArrowRight" && partyHasItems) {
        // from payment, jump to the left column of the nearest party row
        selectedPartyIndex = mapPaymentToPartyIndex(selectedPaymentIndex, "left");
        setFocusPanel("party", cartItems);
      }
      return;
    }

    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      if (focusPanel === "payment") {
        const opt = PAYMENT_OPTIONS[selectedPaymentIndex];
        document.body.dataset.selectedPayment = opt.id;
        setFocusPanel("payment", cartItems);
        const buttons = Array.from(
          document.getElementById("paymentOptions")?.querySelectorAll(".payment-option") ||
            []
        );
        const anchor = buttons[selectedPaymentIndex];
        if (anchor) openPaymentPopup(selectedPaymentIndex, anchor);
      } else if (focusPanel === "party" && partyHasItems) {
        const slots = Array.from(
          document.getElementById("partyGrid")?.querySelectorAll(".party-slot-card") || []
        );
        const anchor = slots[selectedPartyIndex];
        if (anchor) openPartyPopup(selectedPartyIndex, anchor);
      }
    }
  });

  if (tradeLocation) {
    tradeLocation.addEventListener("change", applyPickupAvailabilityToForm);
    if (!tradeLocation.value) {
      const first = tradeLocation.querySelector("option[value]:not([disabled])");
      if (first) tradeLocation.value = first.value;
    }
    applyPickupAvailabilityToForm();
  }

  if (tradeDate) {
    tradeDate.addEventListener("change", validateTradeDate);
    // clear time options until a date is picked
    populateTimeOptionsForDate("");
    updateDateDisplay();
  }

  if (tradeModal) {
    // prevent clicks inside the modal (including calendar) from triggering outside-close
    tradeModal.addEventListener("click", (ev) => {
      ev.stopPropagation();
    });
  }

  renderCalendar();

  if (summaryCloseBtn) summaryCloseBtn.addEventListener("click", closeSummaryModal);
  if (summaryBackdrop) summaryBackdrop.addEventListener("click", closeSummaryModal);
  if (summaryImage) summaryImage.addEventListener("load", updateSummaryLensBackground);

  if (paymentRequestBtn) {
    paymentRequestBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation(); // avoid immediate document click close
      const selected = PAYMENT_OPTIONS[selectedPaymentIndex]?.id;
      const cart = loadCart();
      const total = getCartTotal(cart);
      pendingPaymentMethod = selected || null;
      pendingPaymentLink = selected && PAYMENT_LINKS[selected] ? PAYMENT_LINKS[selected](total) : null;
      openTradeModal();
    });
  }


  if (paymentCancelBtn) {
    paymentCancelBtn.addEventListener("click", closePaymentPopup);
  }

  if (partyDepositBtn) {
    partyDepositBtn.addEventListener("click", () => {
      const cartItems = loadCart();
      if (partyPopupIdx < 0 || partyPopupIdx >= cartItems.length) return;
      const item = cartItems[partyPopupIdx];
      const partyIds = loadParty().filter((id) => id !== item.id);
      saveParty(partyIds);
      cartItems.splice(partyPopupIdx, 1);
      saveCart(cartItems);
      setFocusPanel("party", cartItems);
      closePartyPopup();
    });
  }

  if (partyCancelBtn) {
    partyCancelBtn.addEventListener("click", closePartyPopup);
  }

  if (tradeCancelBtn) {
    tradeCancelBtn.addEventListener("click", closeTradeModal);
  }

  if (tradeBackdrop) {
    tradeBackdrop.addEventListener("click", closeTradeModal);
  }

  if (tradeForm) {
    tradeForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!tradeTime) return;
      const name = (tradeName?.value || "").trim();
      const email = (tradeEmail?.value || "").trim();
      const phone = (tradePhone?.value || "").trim();
      const location = (tradeLocation?.value || "").trim();
      const date = (tradeDate?.value || "").trim();
      const time = (tradeTime?.value || "").trim();
      if (!name || !email || !location || !time || !date) return;
      const cartItems = loadCart();
      const cardIds = cartItems.map((c) => c.id).filter(Boolean);
      const redirectUrl = pendingPaymentLink;
      const paymentMethod = pendingPaymentMethod;
      const payload = {
        name,
        email,
        phone,
        location,
        date,
        time,
        paymentMethod,
        cart: cartItems,
        cardIds,
      };
      const submitBtn = tradeForm.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;
      saveTradeRequest(payload)
        .then((id) => {
          updateCardsFlags(cardIds, { held: true, sold: false });
          clearPartyAndCart();
          sendDiscordWebhook(payload, id);
          showBootMessage("Trainer sent over request!", "We’ll prep your pickup", 2500);
          closeTradeModal();
          if (redirectUrl) {
            window.open(redirectUrl, "_blank");
          }
          pendingPaymentLink = null;
          pendingPaymentMethod = null;
        })
        .catch(() => {
          alert("Could not send request. Please try again.");
        })
        .finally(() => {
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  document.addEventListener("click", (ev) => {
    if (
      paymentPopup &&
      !paymentPopup.classList.contains("hidden") &&
      !paymentPopup.contains(ev.target) &&
      !(document.getElementById("paymentOptions")?.contains(ev.target))
    ) {
      closePaymentPopup();
    }
    if (
      partyPopup &&
      !partyPopup.classList.contains("hidden") &&
      !partyPopup.contains(ev.target) &&
      !(document.getElementById("partyGrid")?.contains(ev.target))
    ) {
      closePartyPopup();
    }
    if (
      summaryModal &&
      !summaryModal.classList.contains("hidden") &&
      !summaryModal.contains(ev.target)
    ) {
      closeSummaryModal();
    }
    if (
      tradeModal &&
      !tradeModal.classList.contains("hidden") &&
      !tradeModal.contains(ev.target)
    ) {
      closeTradeModal();
    }
  });

  if (backToStoreLink) {
    backToStoreLink.tabIndex = 0;
    backToStoreLink.addEventListener("click", (ev) => {
      ev.preventDefault();
      window.location.href = "store.html";
    });
    backToStoreLink.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        window.location.href = "store.html";
      }
      if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setSelectedPayment(PAYMENT_OPTIONS.length - 1);
        renderPaymentOptions(document.body.dataset.selectedPayment);
        focusCurrentPayment();
      }
    });
  }
});
