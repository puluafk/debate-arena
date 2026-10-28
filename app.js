const STORAGE_KEY = "debate_arena_settings_v3";

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
    var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (raw) return normalizeSettings(raw);
  } catch (e) {}
  try {
    var v2 = JSON.parse(localStorage.getItem("debate_arena_settings_v2"));
    if (v2) return normalizeSettings(v2);
  } catch (e) {}
  try {
    var v1 = JSON.parse(localStorage.getItem("debate_arena_settings_v1"));
    if (v1) {
      return normalizeSettings({
        providerFor: v1.provider || "demo",
        providerAgainst: v1.provider || "demo",
        openaiKey: v1.provider === "openai" ? v1.apiKey || "" : "",
        geminiKey: v1.provider === "gemini" ? v1.apiKey || "" : "",
        openaiModel: v1.model || "gpt-4o-mini",
        geminiModel: "gemini-2.5-flash",
      });
    }
  } catch (e) {}
  return normalizeSettings({});
}

function normalizeSettings(s) {
  s = s || {};
  return {
    providerFor: s.providerFor || s.provider || "demo",
    providerAgainst: s.providerAgainst || s.provider || "demo",
    openaiKey: s.openaiKey || "",
    geminiKey: s.geminiKey || "",
    claudeKey: s.claudeKey || "",
    openaiModel: s.openaiModel || "gpt-4o-mini",
    geminiModel: s.geminiModel || "gemini-2.5-flash",
    claudeModel: s.claudeModel || "claude-sonnet-4-20250514",
  };
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  updateProviderBadge();
}

function updateProviderBadge() {
  var el = document.getElementById("provider-badge");
  if (!el) return;
  var s = state.settings;
  var names = { openai: "OpenAI", gemini: "Gemini", claude: "Claude", demo: "Demo" };
  var left = s.providerFor || "demo";
  var right = s.providerAgainst || "demo";
  el.textContent = (names[left] || left) + " vs " + (names[right] || right);
  el.className = "provider-badge " + (left === "demo" && right === "demo" ? "demo" : "live");
}

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.remove("active");
  });
  var screen = document.getElementById(id);
  if (screen) screen.classList.add("active");
}

function activeApiConfig(side) {
  var s = state.settings;
  var provider = side === "for" ? s.providerFor : s.providerAgainst;
  provider = provider || "demo";
  if (provider === "openai") {
    if (!s.openaiKey) throw new Error("Missing OpenAI API key for the " + side.toUpperCase() + " side.");
    return { provider: "openai", apiKey: s.openaiKey, model: s.openaiModel || "gpt-4o-mini" };
  }
  if (provider === "gemini") {
    if (!s.geminiKey) throw new Error("Missing Gemini API key for the " + side.toUpperCase() + " side.");
    return { provider: "gemini", apiKey: s.geminiKey, model: s.geminiModel || "gemini-2.5-flash" };
  }
  if (provider === "claude") {
    if (!s.claudeKey) throw new Error("Missing Claude API key for the " + side.toUpperCase() + " side.");
    return { provider: "claude", apiKey: s.claudeKey, model: s.claudeModel || "claude-sonnet-4-20250514" };
  }
  return null;
}

async function callAI(opts) {
  var cfg = activeApiConfig(opts.side);
  if (!cfg) return demoReply(opts.system);
  var res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      model: cfg.model,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    }),
  });
  var data = {};
  try {
    data = await res.json();
  } catch (e) {}
  if (!res.ok) throw new Error(data.error || "API error " + res.status);
  return data.text || "";
}

var DEMO_DEBATES = {
  "Should students use AI to write essays?": {
    en: {
      for: [
        "AI helps students brainstorm and organize essays.",
        "Students should verify AI suggestions and explain their own reasoning.",
        "Teach responsible AI use and assess the writing process.",
      ],
      against: [
        "AI-generated essays can hide gaps in students' understanding.",
        "Even with disclosure, teachers may struggle to assess genuine authorship.",
        "Final essays must reflect each student's independent thinking.",
      ],
    },
    vi: {
      for: [
        "AI giup hoc sinh tim y tuong va sap xep bai luan.",
        "Hoc sinh nen kiem chung goi y cua AI va tu giai thich lap luan.",
        "Nen day su dung AI co trach nhiem va danh gia qua trinh viet.",
      ],
      against: [
        "Bai viet do AI tao co the che giau viec hoc sinh chua hieu bai.",
        "Du khai bao dung AI, giao vien van kho danh gia nang luc that.",
        "Bai luan cuoi cung phai the hien tu duy doc lap cua hoc sinh.",
      ],
    },
  },
};

function demoReply(system) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      var side = /FOR |Advocate/i.test(system) ? "for" : "against";
      var lang = state.lang === "vi" ? "vi" : "en";
      var debate = DEMO_DEBATES[state.topic.trim()];
      var index = Math.max(0, Math.min(state.currentRound - 1, 2));
      if (debate && debate[lang] && debate[lang][side]) {
        return resolve(debate[lang][side][index] || debate[lang][side][0]);
      }
      var generic = {
        en: {
          for: "On this topic, the case in favor is practical: benefits can outweigh risks with clear safeguards and accountability.",
          against: "On this topic, caution is warranted: costs, unintended harms, and weaker evidence mean we should not rush ahead.",
        },
        vi: {
          for: "Ve chu de nay, ben ung ho nhan manh loi ich thuc te neu co bien phap bao ve ro rang.",
          against: "Ve chu de nay, ben phan doi nhan manh rui ro, chi phi va can than trong khi mo rong.",
        },
      };
      resolve(generic[lang][side]);
    }, 350);
  });
}

function systemPrompt(side) {
  var lang = state.lang === "vi" ? "Vietnamese" : "English";
  var stance = side === "for" ? "FOR (in favor of the topic)" : "AGAINST (opposed to the topic)";
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
    var textFor = await callAI({ side: "for", system: systemPrompt(forSide), user: userFor });
    state.historyFor.push(textFor);
    addBubble("for", textFor, round);

    setStatus(true, state.lang === "vi" ? "AI phan doi dang trinh bay..." : "Challenger is speaking...");
    var textAgainst = await callAI({ side: "against", system: systemPrompt(againstSide), user: userAgainst });
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
  setVal("provider-for", s.providerFor || "demo");
  setVal("provider-against", s.providerAgainst || "demo");
  setVal("openai-key", s.openaiKey || "");
  setVal("gemini-key", s.geminiKey || "");
  setVal("claude-key", s.claudeKey || "");
  setVal("openai-model", s.openaiModel || "gpt-4o-mini");
  setVal("gemini-model", s.geminiModel || "gemini-2.5-flash");
  setVal("claude-model", s.claudeModel || "claude-sonnet-4-20250514");
  var modal = document.getElementById("modal-settings");
  if (modal) modal.classList.remove("hidden");
}

function setVal(id, value) {
  var el = document.getElementById(id);
  if (el) el.value = value;
}

function applySettingsFromForm() {
  state.settings = {
    providerFor: (document.getElementById("provider-for") || {}).value || "demo",
    providerAgainst: (document.getElementById("provider-against") || {}).value || "demo",
    openaiKey: ((document.getElementById("openai-key") || {}).value || "").trim(),
    geminiKey: ((document.getElementById("gemini-key") || {}).value || "").trim(),
    claudeKey: ((document.getElementById("claude-key") || {}).value || "").trim(),
    openaiModel: (document.getElementById("openai-model") || {}).value || "gpt-4o-mini",
    geminiModel: ((document.getElementById("gemini-model") || {}).value || "gemini-2.5-flash").replace(/^models\//, ""),
    claudeModel: (document.getElementById("claude-model") || {}).value || "claude-sonnet-4-20250514",
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
      setVal("openai-key", "");
      setVal("gemini-key", "");
      setVal("claude-key", "");
      setVal("provider-for", "demo");
      setVal("provider-against", "demo");
      state.settings = normalizeSettings({});
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
  if (btnNew) btnNew.addEventListener("click", function () { showScreen("screen-setup"); });

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
      document.querySelectorAll(".vote-btn").forEach(function (b) { b.classList.remove("selected"); });
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
      document.querySelectorAll(".vote-btn").forEach(function (b) { b.classList.remove("selected"); });
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
