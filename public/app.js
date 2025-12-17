
import { sdk } from "https://esm.sh/@farcaster/miniapp-sdk@0.2.1";
import { Attribution } from "https://esm.sh/ox/erc8021";

/**
 * ====================================================
 * REQUIRED CONSTANTS
 * ====================================================
 */
const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base mainnet USDC
const USDC_DECIMALS = 6;

const BUILDER_CODE = "bc_4tcf5clw";
const RECIPIENT = "0x5eC6AF0798b25C563B102d3469971f1a8d598121"; // checksummed burn address (safe default; replace for production)

/**
 * ====================================================
 * UTILITIES
 * ====================================================
 */
const $ = (sel, el = document) => el.querySelector(sel);

function isHexString(v) {
  return typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v);
}

function strip0x(hex) {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

function pad32(hexNo0x) {
  return hexNo0x.padStart(64, "0");
}

function isAddressLike(addr) {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/**
 * NOTE: strict checksum validation requires keccak.
 * In Mini Apps we keep validation lightweight and rely on wallet failure for bad checksum.
 */
function validateRecipientOrThrow(addr) {
  if (!isAddressLike(addr)) throw new Error("Recipient address is not a valid 20-byte hex address.");
  if (addr === "0x0000000000000000000000000000000000000000") throw new Error("Recipient cannot be zero address.");
  return addr;
}

function parseUsdToUsdcUnits(usdString) {
  // Accept plain decimals with up to 6 decimals.
  const s = String(usdString ?? "").trim();
  if (!s) throw new Error("Enter an amount.");
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Amount must be a number.");
  const [whole, frac = ""] = s.split(".");
  if (frac.length > USDC_DECIMALS) throw new Error("USDC supports up to 6 decimal places.");
  const fracPadded = frac.padEnd(USDC_DECIMALS, "0");
  const units = BigInt(whole) * (10n ** BigInt(USDC_DECIMALS)) + BigInt(fracPadded || "0");
  if (units <= 0n) throw new Error("Amount must be greater than 0.");
  return units;
}

function toHexUint(value) {
  if (typeof value !== "bigint") throw new Error("toHexUint expects bigint");
  if (value < 0n) throw new Error("Negative bigint");
  return "0x" + value.toString(16);
}

function encodeErc20TransferData(to, amountUnits) {
  // Selector a9059cbb + padded recipient + padded amount (32 bytes each)
  const selector = "a9059cbb";
  const toPadded = pad32(strip0x(to).toLowerCase());
  const amtPadded = pad32(amountUnits.toString(16));
  return "0x" + selector + toPadded + amtPadded;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toast(message, kind = "info") {
  const el = $("#toast");
  el.innerHTML = message;
  el.classList.add("show");
  el.dataset.kind = kind;
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(() => el.classList.remove("show"), 2800);
}

/**
 * ====================================================
 * MINI APP INIT (CRITICAL)
 * ====================================================
 */
async function initMiniApp() {
  // Call ready() as soon as our UI is stable.
  // If this is not called, the host can keep showing the splash screen.
  try {
    await sdk.actions.ready();
  } catch (e) {
    // If outside a host, ready() may fail; do not crash.
    console.warn("sdk.actions.ready() failed (likely not in a mini app host).", e);
  }
}

/**
 * ====================================================
 * UI + STATE
 * ====================================================
 */
const TOKENS = {
  ETH: { symbol: "ETH", sludge: "Blue Sludge", colorA: "#1478ff", colorB: "#00d1ff" },
  USDC: { symbol: "USDC", sludge: "Green Sludge", colorA: "#2cff7f", colorB: "#00ffb5" },
  DAI: { symbol: "DAI", sludge: "Amber Sludge", colorA: "#f1d24a", colorB: "#ff9f1a" },
  DEGEN: { symbol: "DEGEN", sludge: "Magenta Sludge", colorA: "#ff38f2", colorB: "#b400ff" },
};

const state = {
  a: "ETH",
  b: "USDC",
  tvl: 128_400_000,
  apy: 0.142, // 14.2%
  risk: 0.62,
  sheetOpen: false,
  tip: {
    preset: 5,
    custom: "",
    cta: "Send USDC", // Send USDC → Preparing tip… → Confirm in wallet → Sending… → Send again
    busy: false,
  },
};

function computePool(a, b) {
  // deterministic but "alive"
  const key = `${a}-${b}`;
  let seed = 0;
  for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  const r = (seed % 10_000) / 10_000;
  const baseApy = 0.06 + r * 0.34; // 6% .. 40%
  const vol = 0.2 + (1 - r) * 0.75;
  const tvl = 12_000_000 + Math.floor(r * 220_000_000);
  return { apy: baseApy, risk: vol, tvl };
}

function fmtMoney(n) {
  return Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtPct(x) {
  return (x * 100).toFixed(1) + "%";
}

function mixColor(c1, c2) {
  // hex -> rgb mix
  const h = (c) => strip0x(c.replace("#", ""));
  const a = h(c1);
  const b = h(c2);
  const to = (s) => parseInt(s, 16);
  const r = Math.round((to(a.slice(0, 2)) + to(b.slice(0, 2))) / 2);
  const g = Math.round((to(a.slice(2, 4)) + to(b.slice(2, 4))) / 2);
  const bl = Math.round((to(a.slice(4, 6)) + to(b.slice(4, 6))) / 2);
  const hx = (n) => n.toString(16).padStart(2, "0");
  return "#" + hx(r) + hx(g) + hx(bl);
}

function radiationLabel(apy) {
  if (apy < 0.1) return "Low";
  if (apy < 0.2) return "Elevated";
  if (apy < 0.3) return "Hazardous";
  return "Critical";
}

function render() {
  const aTok = TOKENS[state.a];
  const bTok = TOKENS[state.b];

  const mix = mixColor(aTok.colorA, bTok.colorA);
  const { apy, risk, tvl } = computePool(state.a, state.b);
  state.apy = apy;
  state.risk = risk;
  state.tvl = tvl;

  $("#tokenA").value = state.a;
  $("#tokenB").value = state.b;

  $("#sludgeA").textContent = aTok.sludge;
  $("#sludgeB").textContent = bTok.sludge;
  $("#tvl").textContent = fmtMoney(state.tvl);
  $("#apy").textContent = fmtPct(state.apy);
  $("#radLevel").textContent = `${radiationLabel(state.apy)} • ${fmtPct(state.apy)}`;
  $("#risk").textContent = fmtPct(state.risk);

  $("#meterFill").style.width = `${Math.min(100, Math.max(8, state.apy * 220))}%`;
  $("#mixerGoo").setAttribute("stop-color", mix);
  $("#mixerGoo2").setAttribute("stop-color", mixColor(aTok.colorB, bTok.colorB));
  $("#gooLabel").textContent = `${aTok.symbol} + ${bTok.symbol} → ${mix.toUpperCase()} Goo`;

  // tip sheet
  const sheet = $("#sheetBackdrop");
  sheet.classList.toggle("show", state.sheetOpen);
  $("#cta").textContent = state.tip.cta;
  $("#cta").disabled = state.tip.busy || !canSendTips();
  $("#builderStatus").innerHTML = canSendTips()
    ? "Builder code: <b>OK</b>"
    : "Builder code: <b>missing</b> (sending disabled)";
  $("#recipientStatus").innerHTML = isAddressLike(RECIPIENT)
    ? `Recipient: <b>${RECIPIENT.slice(0, 6)}…${RECIPIENT.slice(-4)}</b>`
    : "Recipient: <b>invalid</b>";

  // preset buttons active state
  for (const btn of document.querySelectorAll("[data-preset]")) {
    const v = Number(btn.getAttribute("data-preset"));
    btn.classList.toggle("active", state.tip.preset === v && !state.tip.custom);
  }
  $("#customAmount").value = state.tip.custom;
  $("#stateLine").innerHTML = state.tip.busy ? `<span class="spinner"></span>${state.tip.cta}` : state.tip.cta;
}

function canSendTips() {
  // per requirements: if RECIPIENT or BUILDER_CODE is still TODO, disable sending
  if (!BUILDER_CODE || BUILDER_CODE.includes("TODO")) return false;
  if (!RECIPIENT || RECIPIENT.includes("TODO")) return false;
  if (!isAddressLike(RECIPIENT)) return false;
  return true;
}

function setCta(text, busy) {
  state.tip.cta = text;
  state.tip.busy = !!busy;
  render();
}

/**
 * ====================================================
 * WALLET / TIP LOGIC (ERC-5792 wallet_sendCalls)
 * ====================================================
 */
async function getProvider() {
  // Prefer host-injected provider via SDK
  try {
    const p = await sdk.wallet.getEthereumProvider();
    if (p) return p;
  } catch (e) {
    // ignore
  }
  if (window.ethereum) return window.ethereum;
  throw new Error("No Ethereum provider found. Open this inside a Farcaster/Base Mini App host.");
}

async function ensureBaseMainnet(provider) {
  const chainId = await provider.request({ method: "eth_chainId", params: [] });
  if (chainId === "0x2105") return;
  // allow sepolia too but prefer mainnet
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x2105" }],
    });
  } catch (e) {
    throw new Error("Please switch to Base Mainnet (0x2105) in your wallet to send USDC.");
  }
}

async function sendTip({ amountUsd }) {
  if (!canSendTips()) {
    toast("Set a real <b>BUILDER_CODE</b> + <b>RECIPIENT</b> to enable tipping.", "warn");
    return;
  }

  const provider = await getProvider();
  await ensureBaseMainnet(provider);

  const accounts = await provider.request({ method: "eth_requestAccounts", params: [] });
  const from = accounts?.[0];
  if (!from) throw new Error("No account connected.");

  const recipient = validateRecipientOrThrow(RECIPIENT);
  const units = parseUsdToUsdcUnits(amountUsd);

  const data = encodeErc20TransferData(recipient, units);

  // builder code attribution (REQUIRED)
  const dataSuffix = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });

  const payload = {
    version: "2.0.0",
    from,
    chainId: "0x2105",
    atomicRequired: true,
    calls: [
      {
        to: USDC_CONTRACT,
        value: "0x0",
        data,
      },
    ],
    capabilities: {
      dataSuffix,
    },
  };

  // UX: animate for 1–1.5s BEFORE wallet opens
  setCta("Preparing tip…", true);
  await sleep(1200);

  setCta("Confirm in wallet", true);
  try {
    // EIP-5792: wallet_sendCalls
    const result = await provider.request({ method: "wallet_sendCalls", params: [payload] });
    // Some wallets return call bundle hash; treat as success.
    setCta("Sending…", true);
    await sleep(800);
    setCta("Send again", false);
    toast(`Tip sent: <b>$${amountUsd}</b> USDC`, "ok");
    return result;
  } catch (e) {
    // user rejection is commonly code 4001
    const msg = String(e?.message || e || "");
    if (e?.code === 4001 || /user rejected|rejected/i.test(msg)) {
      setCta("Send USDC", false);
      toast("Tip cancelled (user rejected).", "warn");
      return;
    }
    setCta("Send USDC", false);
    throw e;
  }
}

/**
 * ====================================================
 * APP SHELL
 * ====================================================
 */
function mount() {
  const app = $("#app");
  app.innerHTML = `
    <div class="container">
      <div class="header">
        <div class="brand">
          <img alt="Yield-Vats" src="/assets/icon-1024.png" />
          <div class="title">
            <strong>Yield-Vats</strong>
            <span>Cyber-Industrial Lab • Radiation Level = APY</span>
          </div>
        </div>
        <div class="pills">
          <div class="pill"><span class="dot"></span><b id="radLevel">—</b><span>radiation</span></div>
          <div class="pill"><b id="tvl">—</b><span>TVL</span></div>
          <button id="openTip" class="pill" style="border-color:rgba(53,255,135,0.35);color:var(--text);background:rgba(53,255,135,0.10)"><b>Tip</b><span>USDC</span></button>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="warningStripe"></div>
          <div class="cardHeader">
            <div>
              <h2>Pool Reactor</h2>
              <p>Select two sludges. The machinery will blend them into a volatile yield compound. Don’t spill it.</p>
            </div>
            <button id="randomize" class="btnGhost">Randomize</button>
          </div>
          <div class="cardBody">
            <div class="row">
              <div class="select">
                <label for="tokenA">Input Vat A</label>
                <select id="tokenA">
                  ${Object.keys(TOKENS).map((k) => `<option value="${k}">${k}</option>`).join("")}
                </select>
                <div class="smallNote">Contents: <b id="sludgeA">—</b></div>
              </div>
              <div class="select">
                <label for="tokenB">Input Vat B</label>
                <select id="tokenB">
                  ${Object.keys(TOKENS).map((k) => `<option value="${k}">${k}</option>`).join("")}
                </select>
                <div class="smallNote">Contents: <b id="sludgeB">—</b></div>
              </div>
            </div>

            <div class="kpis">
              <div class="kpi"><div class="k">Radiation Level (APY)</div><div class="v" id="apy">—</div></div>
              <div class="kpi"><div class="k">Volatility Leak Risk</div><div class="v" id="risk">— <small>est.</small></div></div>
            </div>

            <div class="gauge">
              <div class="gaugeTop">
                <div class="label">SKEUO GAUGE</div>
                <div class="value"><span id="gooLabel">—</span></div>
              </div>
              <div class="meter"><div id="meterFill"></div></div>
              <div class="smallNote">Open the valve to “deposit” (coming soon). For now, you can tip the lab in USDC.</div>
            </div>

            <div class="mixer" aria-label="Mixer animation">
              <svg viewBox="0 0 900 520" role="img">
                <defs>
                  <linearGradient id="goo" x1="0" y1="0" x2="1" y2="0">
                    <stop id="mixerGoo" offset="0%" stop-color="#7d2cff"></stop>
                    <stop id="mixerGoo2" offset="100%" stop-color="#00ffb5"></stop>
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <!-- pipes -->
                <g opacity="0.85">
                  <rect x="60" y="110" width="300" height="40" rx="18" fill="#2a2f2a" stroke="#a56a3a" stroke-width="4"/>
                  <rect x="540" y="110" width="300" height="40" rx="18" fill="#2a2f2a" stroke="#a56a3a" stroke-width="4"/>
                  <rect x="410" y="90" width="80" height="120" rx="18" fill="#2a2f2a" stroke="#a56a3a" stroke-width="4"/>
                </g>

                <!-- vats -->
                <g>
                  <rect x="100" y="170" width="220" height="290" rx="42" fill="rgba(20,26,20,0.85)" stroke="rgba(53,255,135,0.28)" stroke-width="4"/>
                  <rect x="580" y="170" width="220" height="290" rx="42" fill="rgba(20,26,20,0.85)" stroke="rgba(53,255,135,0.28)" stroke-width="4"/>

                  <rect x="120" y="330" width="180" height="26" rx="13" fill="#f1d24a"/>
                  <rect x="600" y="330" width="180" height="26" rx="13" fill="#f1d24a"/>
                  <g opacity="0.85">
                    <path d="M120 330 L170 330 L300 356 L250 356 Z" fill="rgba(0,0,0,0.55)"/>
                    <path d="M600 330 L650 330 L780 356 L730 356 Z" fill="rgba(0,0,0,0.55)"/>
                  </g>
                </g>

                <!-- sludge flows (animated) -->
                <g filter="url(#glow)">
                  <path id="flowA" d="M210 190 C210 150 170 150 170 130 L360 130" fill="none" stroke="#1478ff" stroke-width="14" stroke-linecap="round" stroke-dasharray="18 18">
                    <animate attributeName="stroke-dashoffset" values="0;36" dur="1.2s" repeatCount="indefinite"/>
                  </path>
                  <path id="flowB" d="M690 190 C690 150 730 150 730 130 L540 130" fill="none" stroke="#2cff7f" stroke-width="14" stroke-linecap="round" stroke-dasharray="18 18">
                    <animate attributeName="stroke-dashoffset" values="0;36" dur="1.2s" repeatCount="indefinite"/>
                  </path>
                </g>

                <!-- reactor chamber -->
                <g>
                  <rect x="330" y="220" width="240" height="240" rx="60" fill="rgba(10,10,10,0.55)" stroke="rgba(241,210,74,0.35)" stroke-width="5"/>
                  <circle cx="450" cy="340" r="86" fill="url(#goo)" opacity="0.9" filter="url(#glow)">
                    <animate attributeName="r" values="82;92;82" dur="2.4s" repeatCount="indefinite"/>
                  </circle>
                  <!-- bolts -->
                  ${Array.from({length:12}).map((_,i)=>{
                    const ang=i*(Math.PI*2/12);
                    const x=450+Math.cos(ang)*120;
                    const y=340+Math.sin(ang)*120;
                    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="rgba(165,106,58,0.9)"/>`;
                  }).join("")}
                </g>

                <!-- pressure gauge -->
                <g transform="translate(90,80)">
                  <circle cx="0" cy="0" r="48" fill="rgba(6,8,6,0.85)" stroke="rgba(241,210,74,0.45)" stroke-width="4"/>
                  <path d="M-32 0 A32 32 0 0 1 32 0" fill="none" stroke="rgba(53,255,135,0.25)" stroke-width="6"/>
                  <line x1="0" y1="0" x2="26" y2="-8" stroke="rgba(241,210,74,0.9)" stroke-width="4" stroke-linecap="round">
                    <animateTransform attributeName="transform" type="rotate" values="-30 0 0; 30 0 0; -30 0 0" dur="2.2s" repeatCount="indefinite"/>
                  </line>
                </g>

                <!-- valve -->
                <g transform="translate(810,420)">
                  <circle cx="0" cy="0" r="42" fill="rgba(6,8,6,0.85)" stroke="rgba(53,255,135,0.35)" stroke-width="4"/>
                  <path d="M-26 0 L26 0" stroke="rgba(53,255,135,0.9)" stroke-width="6" stroke-linecap="round"/>
                  <path d="M0 -26 L0 26" stroke="rgba(53,255,135,0.9)" stroke-width="6" stroke-linecap="round"/>
                  <circle cx="0" cy="0" r="10" fill="rgba(241,210,74,0.9)"/>
                  <animateTransform attributeName="transform" type="rotate" values="0 810 420; 12 810 420; 0 810 420" dur="1.8s" repeatCount="indefinite"/>
                </g>
              </svg>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="warningStripe"></div>
          <div class="cardHeader">
            <div>
              <h2>Lab Console</h2>
              <p>Diagnostics, chain status, and the tip control panel.</p>
            </div>
            <button id="checkHost" class="btnGhost">Check Host</button>
          </div>
          <div class="cardBody">
            <div class="kpi">
              <div class="k">Mini App Host</div>
              <div class="v" style="font-size:14px">
                <span id="hostStatus">Detecting…</span>
              </div>
            </div>

            <div class="kpi" style="margin-top:10px">
              <div class="k">Tip System</div>
              <div class="v" style="font-size:14px; display:flex; flex-direction:column; gap:8px">
                <div id="builderStatus">—</div>
                <div id="recipientStatus">—</div>
                <button id="openTip2" class="btnPrimary">Open Tip Valve</button>
              </div>
              <div class="smallNote">
                Tips are sent as <b>USDC</b> on <b>Base Mainnet</b> using <b>ERC-5792 wallet_sendCalls</b>.
              </div>
            </div>

            <div class="smallNote">
              <b>Safety:</b> This app is intentionally “danger lab” themed. Your funds are not used for swaps or pools yet—only optional USDC tipping.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tip bottom sheet -->
    <div id="sheetBackdrop" class="bottomSheetBackdrop" aria-hidden="true">
      <div class="bottomSheet" role="dialog" aria-modal="true" aria-label="Tip in USDC">
        <div class="sheetTop">
          <div class="handle"></div>
          <button id="closeSheet" class="btnDanger" style="padding:10px 12px;border-radius:14px">Close</button>
        </div>
        <div class="sheetTitle">
          <h3>Tip the Lab (USDC)</h3>
          <div class="chip">Base Mainnet</div>
        </div>
        <div class="sheetBody">
          <div class="presetRow">
            <button class="presetBtn" data-preset="1">$1</button>
            <button class="presetBtn" data-preset="5">$5</button>
            <button class="presetBtn" data-preset="10">$10</button>
            <button class="presetBtn" data-preset="25">$25</button>
          </div>
          <div style="margin-top:12px">
            <label for="customAmount">Custom amount (USD)</label>
            <input id="customAmount" inputmode="decimal" placeholder="e.g. 3.50" />
            <div class="smallNote">USDC has 6 decimals. Invalid / zero amounts are rejected.</div>
          </div>

          <div class="stateLine" id="stateLine">Send USDC</div>
        </div>
        <div class="sheetFooter">
          <button id="cta" class="btnPrimary" style="flex:1">Send USDC</button>
          <button id="copyLink" class="btnGhost">Copy Link</button>
        </div>
      </div>
    </div>

    <div id="toast" class="toast"></div>
  `;

  // events
  $("#tokenA").addEventListener("change", (e) => {
    state.a = e.target.value;
    if (state.b === state.a) state.b = "USDC";
    render();
  });
  $("#tokenB").addEventListener("change", (e) => {
    state.b = e.target.value;
    if (state.a === state.b) state.a = "ETH";
    render();
  });

  $("#randomize").addEventListener("click", () => {
    const keys = Object.keys(TOKENS);
    const a = keys[Math.floor(Math.random() * keys.length)];
    let b = keys[Math.floor(Math.random() * keys.length)];
    if (b === a) b = keys[(keys.indexOf(b) + 1) % keys.length];
    state.a = a;
    state.b = b;
    render();
  });

  const openSheet = () => {
    state.sheetOpen = true;
    render();
    if (!canSendTips()) toast("Sending is disabled until BUILDER_CODE + RECIPIENT are set.", "warn");
  };
  const closeSheet = () => {
    state.sheetOpen = false;
    render();
  };

  $("#openTip").addEventListener("click", openSheet);
  $("#openTip2").addEventListener("click", openSheet);
  $("#closeSheet").addEventListener("click", closeSheet);
  $("#sheetBackdrop").addEventListener("click", (e) => {
    if (e.target === $("#sheetBackdrop")) closeSheet();
  });

  for (const btn of document.querySelectorAll("[data-preset]")) {
    btn.addEventListener("click", () => {
      state.tip.preset = Number(btn.getAttribute("data-preset"));
      state.tip.custom = "";
      setCta("Send USDC", false);
      render();
    });
  }

  $("#customAmount").addEventListener("input", (e) => {
    state.tip.custom = e.target.value;
    // deactivate presets visually when custom is in progress
    setCta("Send USDC", false);
    render();
  });

  $("#cta").addEventListener("click", async () => {
    try {
      if (!canSendTips()) {
        toast("Replace BUILDER_CODE + RECIPIENT in <b>app.js</b> before sending.", "warn");
        return;
      }
      const amount = state.tip.custom.trim() ? state.tip.custom.trim() : String(state.tip.preset);
      await sendTip({ amountUsd: amount });
    } catch (e) {
      console.error(e);
      toast(`Error: ${String(e?.message || e)}`, "error");
    }
  });

  $("#copyLink").addEventListener("click", async () => {
    const url = "https://nurrabby.com/";
    try {
      await navigator.clipboard.writeText(url);
      toast("Copied: <b>https://nurrabby.com/</b>", "ok");
    } catch {
      toast("Copy failed. Your host may block clipboard.", "warn");
    }
  });

  $("#checkHost").addEventListener("click", async () => {
    await updateHostStatus();
  });

  updateHostStatus();
  render();
}

async function updateHostStatus() {
  const el = $("#hostStatus");
  try {
    const ctx = await sdk.context;
    const has = !!ctx;
    el.innerHTML = has
      ? `<b style="color:var(--ok)">Detected</b> • ${ctx?.host?.name || "Host"}`
      : `<b style="color:var(--danger)">Not detected</b>`;
  } catch {
    el.innerHTML = `<b style="color:var(--danger)">Not detected</b> • open in Farcaster/Base app`;
  }
}

/**
 * ====================================================
 * BOOT
 * ====================================================
 */
mount();
await initMiniApp();
render();
