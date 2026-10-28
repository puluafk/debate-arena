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
        "Claim: Students should be allowed to use AI for essays under clear rules. Reason 1: AI can support brainstorming and structure without replacing the student's final argument. Reason 2: Banning tools students already use pushes misuse underground; guided use teaches verification and citation. Conclusion: Assess process and original reasoning, not a total ban.",
        "Rebuttal: The risk of shallow work is real, but it comes from weak assessment design, not from the tool itself. If teachers require outlines, source checks, and oral defense, AI becomes a drafting aid rather than a substitute. Evidence from classroom practice shows process-based grading reduces pure copy-paste. Therefore restrictions should target cheating methods, not learning assistance.",
        "Closing: A strict ban is hard to enforce and ignores workplace reality where AI is common. A tighter policy—disclose AI use, require student-owned thesis and evidence, and grade reasoning—protects learning while keeping useful support. That is the more rigorous and practical position.",
      ],
      against: [
        "Claim: Students should not use AI to write essays as a default school practice. Reason 1: Essay writing trains original analysis; outsourcing sentences weakens that skill. Reason 2: Teachers cannot reliably separate assisted text from student understanding, so grades lose validity. Conclusion: Core writing work should remain human-authored.",
        "Rebuttal: Calling AI a neutral 'helper' understates how easily it produces complete paragraphs that students may not fully grasp. Disclosure rules help, but they do not restore the cognitive work of constructing an argument. If the educational goal is independent thinking, allowing AI drafting systematically undermines the assessment signal.",
        "Closing: Schools can teach AI literacy in separate exercises without making essay authorship dependent on models. For graded essays, the stricter standard—student-generated prose and reasoning—better protects learning outcomes and fairness.",
      ],
    },
    vi: {
      for: [
        "Lap luan: Hoc sinh nen duoc dung AI viet bai luan neu co quy tac ro. Ly do 1: AI ho tro lay y va bo cuc, khong nhat thiet thay the lap luan cuoi. Ly do 2: Cam hoan toan de day viec dung len, con huong dan giup day kiem chung va trich dan. Ket luan: Danh gia qua trinh va lap luan goc, khong cam tuyet doi.",
        "Phan bien: Rui ro bai nong la co that, nhung den tu cach cham diem yeu, khong chi tu cong cu. Neu bat buoc dan y, kiem nguon va bao ve mieng, AI tro thanh tro thu chu khong thay the. Vay han che can nham vao gian lan, khong xoa tro giup hoc tap.",
        "Ket luan: Cam ngat kho thi hanh va lech voi thuc te noi lam viec. Chinh sach chat: cong khai dung AI, giu luan diem va bang chung cua hoc sinh, cham tu duy — vua bao ve hoc, vua giu ho tro huu ich.",
      ],
      against: [
        "Lap luan: Khong nen coi viec dung AI viet bai luan la mac dinh. Ly do 1: Viet luan ren phan tich doc lap; giao cau cho may lam yeu ky nang do. Ly do 2: Giao vien kho tach van AI va hieu biet that, diem mat gia tri. Ket luan: Phan viet cot loi phai do hoc sinh tu viet.",
        "Phan bien: Goi AI la 'tro giup trung lap' coi nhe viec no co the viet ca doan ma hoc sinh khong nam vung. Cong khai co ich nhung khong thay the viec tu xay dung lap luan. Neu muc tieu la tu duy doc lap, de AI soan bai lam yeu tin hieu danh gia.",
        "Ket luan: Co the day AI o bai rieng, khong de bai cham diem phu thuoc model. Voi bai luan tinh diem, tieu chuan chat — van va lap luan do hoc sinh tao — bao ve ket qua hoc tot hon.",
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
          for:
            "Claim: The affirmative side is stronger when benefits are concrete and risks are manageable. Reason 1: Clear rules and oversight can capture gains without ignoring harm. Reason 2: Rejecting the idea entirely discards useful options instead of improving design. Conclusion: Support the proposal with conditions, not a blank check.",
          against:
            "Claim: The negative side is stronger when costs and uncertainty are material. Reason 1: Unintended consequences and weak evidence mean the burden of proof is not met. Reason 2: Safer alternatives exist without locking in the proposed path. Conclusion: Oppose or delay until safeguards and evidence improve.",
        },
        vi: {
          for:
            "Lap luan: Ben ung ho manh hon khi loi ich ro va rui ro kiem soat duoc. Ly do 1: Quy tac va giam sat giup can bang. Ly do 2: Bac bo toan bo se mat lua chon huu ich. Ket luan: Ung ho co dieu kien, khong de trong.",
          against:
            "Lap luan: Ben phan doi manh hon khi chi phi va bat dinh ro. Ly do 1: He qua phu va bang chung yeu nen chua du de chap nhan. Ly do 2: Con phuong an an toan hon. Ket luan: Phan doi hoac hoan cho den khi co bao ve va bang chung tot hon.",
        },
      };
      resolve(generic[lang][side]);
    }, 350);
  });
}

function systemPrompt(side) {
  var lang = state.lang === "vi" ? "Vietnamese" : "English";
  var stance =
    side === "for"
      ? "FOR (in favor of the topic / proposal)"
      : "AGAINST (opposed to the topic / proposal)";
  return [
    "You are a rigorous debate advocate arguing strictly " + stance + ".",
    "Reply in " + lang + " only. Never switch sides.",
    "Write a tight argument, not slogans. Structure every reply as:",
    "1) Claim (one clear sentence).",
    "2) Reasons (2–3 reasons; each reason must explain why, not just assert).",
    "3) Support (example, mechanism, comparison, or plausible evidence — no fabricated statistics or fake citations).",
    "4) If the user message includes the opponent's text: Rebuttal (address their strongest point directly).",
    "5) Conclusion (one sentence that follows from the reasons).",
    "Rules: stay under 220 words; no empty rhetoric; no both-sides hedging; no admitting the opposite stance is correct.",
  ].join(" ");
}

function buildUserPrompt(side, round) {
  var phase =
    round === 1 ? "opening" : round >= state.rounds ? "closing" : "rebuttal";
  var opponent =
    side === "for"
      ? state.historyAgainst[state.historyAgainst.length - 1] || ""
      : state.historyFor[state.historyFor.length - 1] || "";

  var lines = [
    'Topic: "' + state.topic + '".',
    "Phase: " + phase + " (round " + round + " of " + state.rounds + ").",
  ];

  if (round === 1) {
    lines.push(
      side === "for"
        ? "Give a rigorous opening case in favor of the topic."
        : "Give a rigorous opening case against the topic."
    );
  } else {
    lines.push("Opponent's last argument:");
    lines.push('"' + opponent + '"');
    lines.push(
      side === "for"
        ? "Rebut their strongest points and advance your affirmative case with tighter reasoning."
        : "Rebut their strongest points and advance your negative case with tighter reasoning."
    );
  }

  if (round >= state.rounds) {
    lines.push("End with a firm closing that summarizes why your side should win.");
  }

  return lines.join("\n");
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
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
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

  setStatus(true, state.lang === "vi" ? "AI ung ho dang trinh bay..." : "Advocate is speaking...");
  try {
    var textFor = await callAI({
      side: "for",
      system: systemPrompt(forSide),
      user: buildUserPrompt("for", round),
    });
    state.historyFor.push(textFor);
    addBubble("for", textFor, round);

    setStatus(true, state.lang === "vi" ? "AI phan doi dang trinh bay..." : "Challenger is speaking...");
    var textAgainst = await callAI({
      side: "against",
      system: systemPrompt(againstSide),
      user: buildUserPrompt("against", round),
    });
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
