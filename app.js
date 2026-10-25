const STORAGE_KEY = "debate_arena_settings_v2";

const state = {
  settings: loadSettings(),
  topic: "",
  rounds: 3,
  lang: "en",
  currentRound: 0,
  swapped: false,
  historyFor: [],
  historyAgainst: [],
};

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw) return raw;
  } catch (e) {}
  try {
    const v1 = JSON.parse(localStorage.getItem("debate_arena_settings_v1"));
    if (v1) {
      return {
        provider: v1.provider || "demo",
        openaiKey: v1.provider === "openai" ? v1.apiKey || "" : "",
        geminiKey: v1.provider === "gemini" ? v1.apiKey || "" : "",
        openaiModel: v1.provider === "openai" ? v1.model || "gpt-4o-mini" : "gpt-4o-mini",
        geminiModel: v1.provider === "gemini" ? v1.model || "gemini-2.0-flash" : "gemini-2.0-flash",
      };
    }
  } catch (e) {}
  return {
    provider: "demo",
    openaiKey: "",
    geminiKey: "",
    openaiModel: "gpt-4o-mini",
    geminiModel: "gemini-2.0-flash",
  };
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  updateProviderBadge();
}

function updateProviderBadge() {
  const el = document.getElementById("provider-badge");
  if (!el) return;
  const p = state.settings.provider;
  const hasOpenAI = !!state.settings.openaiKey;
  const hasGemini = !!state.settings.geminiKey;
  if (p === "openai" && hasOpenAI) {
    el.textContent = "OpenAI";
    el.className = "provider-badge live";
  } else if (p === "gemini" && hasGemini) {
    el.textContent = "Gemini";
    el.className = "provider-badge live";
  } else {
    el.textContent = "Demo mode";
    el.className = "provider-badge demo";
  }
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.remove("active");
  });
  var screen = document.getElementById(id);
  if (screen) screen.classList.add("active");
}

function activeApiConfig() {
  var s = state.settings;
  if (s.provider === "openai" && s.openaiKey) {
    return { provider: "openai", apiKey: s.openaiKey, model: s.openaiModel || "gpt-4o-mini" };
  }
  if (s.provider === "gemini" && s.geminiKey) {
    return { provider: "gemini", apiKey: s.geminiKey, model: s.geminiModel || "gemini-2.0-flash" };
  }
  return null;
}

async function callAI(opts) {
  var system = opts.system;
  var user = opts.user;
  var cfg = activeApiConfig();
  if (!cfg) return demoReply(system);

  var res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      model: cfg.model,
      system: system,
      messages: [{ role: "user", content: user }],
    }),
  });
  var data = {};
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) throw new Error(data.error || "API error " + res.status);
  return data.text || "";
}

var DEMO_BANK = {
  en: {
    for: [
      "This position is practical and forward-looking. Benefits outweigh risks when safeguards are in place.",
      "Critics often exaggerate rare edge cases. Broader evidence points to net positive outcomes.",
      "Avoiding change out of fear locks us into worse problems. Careful adoption is the rational path.",
    ],
    against: [
      "This path underestimates long-term costs and concentrated power. We should proceed more slowly.",
      "The evidence is mixed at best. Scaling without stronger protections risks harming vulnerable groups.",
      "Convenience is not the same as wisdom. A safer alternative deserves priority.",
    ],
  },
  vi: {
    for: [
      "Quan diem nay thuc te va huong toi tuong lai. Loi ich lon hon rui ro neu co bien phap bao ve.",
      "Phe phan thuong phong dai truong hop ngoai le. Du lieu thuc te cho thay ket qua tich cuc voi da so.",
      "Tu choi tien bo vi so hai chi khien van de tram trong hon. Ap dung co trach nhiem la hop ly.",
    ],
    against: [
      "Huong di nay danh gia thap chi phi dai han va quyen luc tap trung. Chung ta nen cham lai.",
      "Bang chung con mau thuan. Mo rong quy mo khi thieu bao ve se gay hai nhom yeu the.",
      "Tien loi khong dong nghia voi khon ngoan. Nen chon phuong an an toan hon.",
    ],
  },
};

function demoReply(system) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      var isFor = /FOR |Advocate/i.test(system);
      var lang = state.lang === "vi" ? "vi" : "en";
      var bank = isFor ? DEMO_BANK[lang].for : DEMO_BANK[lang].against;
      var idx = state.currentRound - 1;
      if (idx < 0) idx = 0;
      if (idx >= bank.length) idx = bank.length - 1;
      var prefix = isFor ? "[FOR] " : "[AGAINST] ";
      var topicPart = state.topic ? "On \"" + state.topic + "\": " : "";
      resolve(prefix + topicPart + bank[idx]);
    }, 500 + Math.random() * 400);
  });
}

function systemPrompt(side) {
  var lang = state.lang === "vi" ? "Vietnamese" : "English";
  var stance =
    side === "for"
      ? "FOR (in favor of the topic)"
      : "AGAINST (opposed to the topic)";
  return (
    "You are a sharp, concise debate AI arguing strictly " +
    stance +
    ". Reply in " +
    lang +
    " only. Be persuasive, use 1-2 concrete reasons, stay under 120 words. Do not switch sides."
  );
}

function roundLabel(round, total) {
  if (round === 1) return state.lang === "vi" ? "Mo dau" : "Opening";
  if (round === total) return state.lang === "vi" ? "Ket luan" : "Closing";
  return state.lang === "vi" ? "Phan bien" : "Rebuttal";
}

function addBubble(side, text, round) {
  var box = document.getElementById(side === "for" ? "messages-for" : "messages-against");
  if (!box) return;
  var div = document.createElement("div");
  div.className = "bubble";
  div.innerHTML =
    '<span class="round-tag">' +
    roundLabel(round, state.rounds) +
    " · R" +
    round +
    "</span>" +
    escapeHtml(text);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

function setStatus(visible, text) {
  var el = document.getElementById("debate-status");
  if (!el) return;
  el.classList.toggle("hidden", !visible);
  if (text) {
    var st = document.getElementById("status-text");
    if (st) st.textContent = text;
  }
  var actions = document.getElementById("debate-actions");
  if (actions) actions.classList.toggle("hidden", visible);
}

async function runRound(round) {
  state.currentRound = round;
  var roundEl = document.getElementById("round-num");
  if (roundEl) roundEl.textContent = String(round);

  var forSide = state.swapped ? "against" : "for";
  var againstSide = state.swapped ? "for" : "against";

  var userFor =
    round === 1
      ? 'Topic: "' + state.topic + '". Give your opening argument.'
      : 'Topic: "' +
        state.topic +
        '". Opponent said: "' +
        (state.historyAgainst[state.historyAgainst.length - 1] || "") +
        '". Rebut and advance your case.';

  var userAgainst =
    round === 1
      ? 'Topic: "' + state.topic + '". Give your opening argument against it.'
      : 'Topic: "' +
        state.topic +
        '". Opponent said: "' +
        (state.historyFor[state.historyFor.length - 1] || "") +
        '". Rebut and advance your case.';

  setStatus(true, state.lang === "vi" ? "AI ung ho dang trinh bay..." : "Advocate is speaking...");
  try {
    var textFor = await callAI({ system: systemPrompt(forSide), user: userFor });
    state.historyFor.push(textFor);
    addBubble("for", textFor, round);

    setStatus(true, state.lang === "vi" ? "AI phan doi dang trinh bay..." : "Challenger is speaking...");
    var textAgainst = await callAI({ system: systemPrompt(againstSide), user: userAgainst });
    state.historyAgainst.push(textAgainst);
    addBubble("against", textAgainst, round);

    setStatus(false);
    var nextBtn = document.getElementById("btn-next-round");
    if (nextBtn) {
      if (round >= state.rounds) nextBtn.classList.add("hidden");
      else nextBtn.classList.remove("hidden");
    }
  } catch (err) {
    setStatus(true, "");
    var st = document.getElementById("status-text");
    if (st) st.textContent = "Error: " + (err.message || String(err));
    var actions = document.getElementById("debate-actions");
    if (actions) actions.classList.remove("hidden");
    var nextBtn2 = document.getElementById("btn-next-round");
    if (nextBtn2) nextBtn2.classList.add("hidden");
  }
}

async function startDebate() {
  var topicInput = document.getElementById("topic-input");
  var topic = topicInput ? topicInput.value.trim() : "";
  if (!topic) {
    if (topicInput) topicInput.focus();
    return;
  }
  state.topic = topic;
  state.rounds = Number(document.getElementById("rounds-select").value) || 3;
  state.lang = document.getElementById("lang-select").value;
  state.currentRound = 0;
  state.historyFor = [];
  state.historyAgainst = [];
  document.getElementById("debate-topic").textContent = topic;
  document.getElementById("round-total").textContent = String(state.rounds);
  document.getElementById("messages-for").innerHTML = "";
  document.getElementById("messages-against").innerHTML = "";
  var nextBtn = document.getElementById("btn-next-round");
  if (nextBtn) nextBtn.classList.remove("hidden");
  showScreen("screen-debate");
  await runRound(1);
}

function finishDebate() {
  document.getElementById("result-topic").textContent = state.topic;
  document.getElementById("vote-feedback").classList.add("hidden");
  document.querySelectorAll(".vote-btn").forEach(function (b) {
    b.classList.remove("selected");
  });
  showScreen("screen-result");
}

function openSettings() {
  var s = state.settings;
  var providerSelect = document.getElementById("provider-select");
  var openaiKey = document.getElementById("openai-key");
  var geminiKey = document.getElementById("gemini-key");
  var openaiModel = document.getElementById("openai-model");
  var geminiModel = document.getElementById("gemini-model");
  if (providerSelect) providerSelect.value = s.provider || "demo";
  if (openaiKey) openaiKey.value = s.openaiKey || "";
  if (geminiKey) geminiKey.value = s.geminiKey || "";
  if (openaiModel) openaiModel.value = s.openaiModel || "gpt-4o-mini";
  if (geminiModel) geminiModel.value = s.geminiModel || "gemini-2.0-flash";
  var modal = document.getElementById("modal-settings");
  if (modal) modal.classList.remove("hidden");
}

function applySettingsFromForm() {
  var providerSelect = document.getElementById("provider-select");
  var openaiKey = document.getElementById("openai-key");
  var geminiKey = document.getElementById("gemini-key");
  var openaiModel = document.getElementById("openai-model");
  var geminiModel = document.getElementById("gemini-model");
  state.settings = {
    provider: providerSelect ? providerSelect.value : "demo",
    openaiKey: openaiKey ? openaiKey.value.trim() : "",
    geminiKey: geminiKey ? geminiKey.value.trim() : "",
    openaiModel: openaiModel ? openaiModel.value : "gpt-4o-mini",
    geminiModel: geminiModel ? geminiModel.value : "gemini-2.0-flash",
  };
  saveSettings();
  var modal = document.getElementById("modal-settings");
  if (modal) modal.classList.add("hidden");
}

function bind() {
  var btnSettings = document.getElementById("btn-settings");
  if (btnSettings) btnSettings.addEventListener("click", openSettings);

  var btnClose = document.getElementById("btn-close-settings");
  if (btnClose) {
    btnClose.addEventListener("click", function () {
      document.getElementById("modal-settings").classList.add("hidden");
    });
  }

  var btnSave = document.getElementById("btn-save-settings");
  if (btnSave) btnSave.addEventListener("click", applySettingsFromForm);

  var btnClear = document.getElementById("btn-clear-key");
  if (btnClear) {
    btnClear.addEventListener("click", function () {
      var ok = document.getElementById("openai-key");
      var gk = document.getElementById("gemini-key");
      var ps = document.getElementById("provider-select");
      if (ok) ok.value = "";
      if (gk) gk.value = "";
      if (ps) ps.value = "demo";
      state.settings = {
        provider: "demo",
        openaiKey: "",
        geminiKey: "",
        openaiModel: "gpt-4o-mini",
        geminiModel: "gemini-2.0-flash",
      };
      saveSettings();
    });
  }

  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      document.getElementById("topic-input").value = chip.getAttribute("data-topic") || "";
    });
  });

  var btnStart = document.getElementById("btn-start");
  if (btnStart) btnStart.addEventListener("click", startDebate);

  var btnNew = document.getElementById("btn-new");
  if (btnNew) {
    btnNew.addEventListener("click", function () {
      showScreen("screen-setup");
    });
  }

  var btnNext = document.getElementById("btn-next-round");
  if (btnNext) {
    btnNext.addEventListener("click", function () {
      if (state.currentRound < state.rounds) runRound(state.currentRound + 1);
    });
  }

  var btnFinish = document.getElementById("btn-finish");
  if (btnFinish) btnFinish.addEventListener("click", finishDebate);

  var voteFor = document.getElementById("vote-for");
  if (voteFor) {
    voteFor.addEventListener("click", function () {
      document.querySelectorAll(".vote-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      voteFor.classList.add("selected");
      var fb = document.getElementById("vote-feedback");
      if (fb) {
        fb.textContent = state.lang === "vi" ? "Ban chon ben UNG HO." : "You voted FOR.";
        fb.classList.remove("hidden");
      }
    });
  }

  var voteAgainst = document.getElementById("vote-against");
  if (voteAgainst) {
    voteAgainst.addEventListener("click", function () {
      document.querySelectorAll(".vote-btn").forEach(function (b) {
        b.classList.remove("selected");
      });
      voteAgainst.classList.add("selected");
      var fb = document.getElementById("vote-feedback");
      if (fb) {
        fb.textContent = state.lang === "vi" ? "Ban chon ben PHAN DOI." : "You voted AGAINST.";
        fb.classList.remove("hidden");
      }
    });
  }

  var btnAgain = document.getElementById("btn-again");
  if (btnAgain) {
    btnAgain.addEventListener("click", function () {
      state.swapped = false;
      showScreen("screen-setup");
    });
  }

  var btnSwap = document.getElementById("btn-swap");
  if (btnSwap) {
    btnSwap.addEventListener("click", async function () {
      state.swapped = !state.swapped;
      state.historyFor = [];
      state.historyAgainst = [];
      document.getElementById("messages-for").innerHTML = "";
      document.getElementById("messages-against").innerHTML = "";
      showScreen("screen-debate");
      await runRound(1);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    bind();
    updateProviderBadge();
  });
} else {
  bind();
  updateProviderBadge();
}
