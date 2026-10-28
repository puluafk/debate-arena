const STORAGE_KEY = "debate_arena_settings_v3";
const NAMES = { openai: "OpenAI", gemini: "Gemini", claude: "Claude", demo: "Demo" };
const state = {
  settings: loadSettings(), topic: "", rounds: 3, lang: "en",
  currentRound: 0, swapped: false, historyFor: [], historyAgainst: [], busy: false
};
function loadSettings() {
  try { var r = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (r) return normalizeSettings(r); } catch (e) {}
  try { var v2 = JSON.parse(localStorage.getItem("debate_arena_settings_v2")); if (v2) return normalizeSettings(v2); } catch (e) {}
  return normalizeSettings({});
}
function normalizeSettings(s) {
  s = s || {};
  return {
    providerFor: s.providerFor || s.provider || "demo",
    providerAgainst: s.providerAgainst || s.provider || "demo",
    openaiKey: s.openaiKey || "", geminiKey: s.geminiKey || "", claudeKey: s.claudeKey || "",
    openaiModel: s.openaiModel || "gpt-4o-mini",
    geminiModel: s.geminiModel || "gemini-2.5-flash",
    claudeModel: s.claudeModel || "claude-sonnet-4-20250514"
  };
}
function saveSettings() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings)); updateMatchupUI(); }
function labelFor(p) { return NAMES[p] || p || "Demo"; }
function updateMatchupUI() {
  var s = state.settings, left = s.providerFor || "demo", right = s.providerAgainst || "demo";
  var text = labelFor(left) + " vs " + labelFor(right);
  var badge = document.getElementById("provider-badge");
  if (badge) { badge.textContent = text; badge.className = "provider-badge " + (left === "demo" && right === "demo" ? "demo" : "live"); }
  var live = document.getElementById("matchup-live"); if (live) live.textContent = text;
  document.querySelectorAll(".ai-pick").forEach(function (g) {
    var side = g.getAttribute("data-side"), cur = side === "for" ? left : right;
    g.querySelectorAll(".ai-btn").forEach(function (btn) {
      var on = btn.getAttribute("data-provider") === cur;
      btn.classList.toggle("active", on); btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  });
  var nf = document.getElementById("name-for"), na = document.getElementById("name-against");
  if (nf) nf.textContent = labelFor(left) + " · Advocate";
  if (na) na.textContent = labelFor(right) + " · Challenger";
  var vnf = document.getElementById("vote-name-for"), vna = document.getElementById("vote-name-against");
  if (vnf) vnf.textContent = labelFor(left) + " · Advocate";
  if (vna) vna.textContent = labelFor(right) + " · Challenger";
  var hint = document.getElementById("matchup-hint");
  if (hint) {
    var need = [];
    if ((left === "openai" || right === "openai") && !s.openaiKey) need.push("OpenAI");
    if ((left === "gemini" || right === "gemini") && !s.geminiKey) need.push("Gemini");
    if ((left === "claude" || right === "claude") && !s.claudeKey) need.push("Claude");
    hint.textContent = need.length ? "Add API key in Settings for: " + need.join(", ") : "Keys are set in Settings if you pick OpenAI, Gemini, or Claude.";
  }
}
function setProvider(side, provider) {
  if (["demo","openai","gemini","claude"].indexOf(provider) === -1) return;
  if (side === "for") state.settings.providerFor = provider; else state.settings.providerAgainst = provider;
  saveSettings();
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(function (s) { s.classList.remove("active"); });
  var el = document.getElementById(id); if (el) el.classList.add("active");
}
function activeApiConfig(side) {
  var s = state.settings, provider = (side === "for" ? s.providerFor : s.providerAgainst) || "demo";
  if (provider === "openai") {
    if (!s.openaiKey) throw new Error("Missing OpenAI key. Open Settings or pick Demo.");
    return { provider: "openai", apiKey: s.openaiKey, model: s.openaiModel || "gpt-4o-mini" };
  }
  if (provider === "gemini") {
    if (!s.geminiKey) throw new Error("Missing Gemini key. Open Settings or pick Demo.");
    return { provider: "gemini", apiKey: s.geminiKey, model: s.geminiModel || "gemini-2.5-flash" };
  }
  if (provider === "claude") {
    if (!s.claudeKey) throw new Error("Missing Claude key. Open Settings or pick Demo.");
    return { provider: "claude", apiKey: s.claudeKey, model: s.claudeModel || "claude-sonnet-4-20250514" };
  }
  return null;
}
async function callAI(opts) {
  var cfg = activeApiConfig(opts.side);
  if (!cfg) return demoReply(opts.system);
  var res = await fetch("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model, system: opts.system, messages: [{ role: "user", content: opts.user }] })
  });
  var data = {}; try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || "API error " + res.status);
  return data.text || "";
}
function demoReply(system) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      var side = /FOR |Advocate/i.test(system) ? "for" : "against";
      var lang = state.lang === "vi" ? "vi" : "en";
      var generic = {
        en: {
          for: "Claim: The affirmative case is stronger when benefits are concrete and risks are manageable. Reason 1: Clear rules can capture gains without ignoring harm. Reason 2: Rejecting the idea entirely discards useful options. Conclusion: Support with conditions, not a blank check.",
          against: "Claim: The negative case is stronger when costs and uncertainty are material. Reason 1: Weak evidence means the burden of proof is not met. Reason 2: Safer alternatives exist. Conclusion: Oppose or delay until safeguards improve."
        },
        vi: {
          for: "Lap luan: Ben ung ho manh hon khi loi ich ro va rui ro kiem soat duoc. Ly do 1: Quy tac giup can bang. Ly do 2: Bac bo toan bo se mat lua chon huu ich. Ket luan: Ung ho co dieu kien.",
          against: "Lap luan: Ben phan doi manh hon khi chi phi va bat dinh ro. Ly do 1: Bang chung yeu. Ly do 2: Con phuong an an toan hon. Ket luan: Phan doi hoac hoan."
        }
      };
      resolve(generic[lang][side]);
    }, 600);
  });
}
function systemPrompt(side) {
  var lang = state.lang === "vi" ? "Vietnamese" : "English";
  var stance = side === "for" ? "FOR (in favor)" : "AGAINST (opposed)";
  return "You are a rigorous debate advocate arguing strictly " + stance + ". Reply in " + lang + " only. Never switch sides. Structure: Claim; 2-3 reasons; support; rebuttal if needed; short conclusion. Under 220 words.";
}
function buildUserPrompt(side, round) {
  var phase = round === 1 ? "opening" : round >= state.rounds ? "closing" : "rebuttal";
  var opponent = side === "for" ? (state.historyAgainst[state.historyAgainst.length - 1] || "") : (state.historyFor[state.historyFor.length - 1] || "");
  var lines = ['Topic: "' + state.topic + '".', "Phase: " + phase + " (round " + round + " of " + state.rounds + ")."];
  if (round === 1) lines.push(side === "for" ? "Give a rigorous opening case in favor." : "Give a rigorous opening case against.");
  else { lines.push("Opponent's last argument:"); lines.push('"' + opponent + '"'); lines.push("Rebut their strongest points and advance your case."); }
  if (round >= state.rounds) lines.push("End with a firm closing.");
  return lines.join("\n");
}
function roundLabel(round, total) {
  if (round === 1) return state.lang === "vi" ? "Mo dau" : "Opening";
  if (round === total) return state.lang === "vi" ? "Ket luan" : "Closing";
  return state.lang === "vi" ? "Phan bien" : "Rebuttal";
}
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function setSpeaking(side) {
  var f = document.querySelector(".side-for"), a = document.querySelector(".side-against");
  if (f) f.classList.toggle("speaking", side === "for");
  if (a) a.classList.toggle("speaking", side === "against");
}
function clearSpeaking() { setSpeaking(null); }
function addPlaceholder(side, round) {
  var box = document.getElementById(side === "for" ? "messages-for" : "messages-against");
  if (!box) return null;
  var div = document.createElement("div");
  div.className = "bubble bubble-pending";
  div.innerHTML = '<span class="round-tag">' + roundLabel(round, state.rounds) + " · R" + round + '</span><span class="pending-dots">…</span>';
  box.appendChild(div); box.scrollTop = box.scrollHeight; return div;
}
function finalizeBubble(el, text) {
  if (!el) return;
  el.classList.remove("bubble-pending");
  var tag = el.querySelector(".round-tag");
  el.innerHTML = (tag ? tag.outerHTML : "") + escapeHtml(text);
  if (el.parentElement) el.parentElement.scrollTop = el.parentElement.scrollHeight;
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/\n/g, "<br/>");
}
function setStatus(visible, text) {
  var el = document.getElementById("debate-status");
  if (!el) return;
  el.classList.toggle("hidden", !visible);
  if (text) { var st = document.getElementById("status-text"); if (st) st.textContent = text; }
  var actions = document.getElementById("debate-actions");
  if (actions) actions.classList.toggle("hidden", visible);
}
async function speakSide(side, stanceSide, round) {
  setSpeaking(side);
  setStatus(true, side === "for" ? (state.lang === "vi" ? "FOR dang trinh bay…" : "FOR is speaking…") : (state.lang === "vi" ? "AGAINST dang trinh bay…" : "AGAINST is speaking…"));
  var pending = addPlaceholder(side, round);
  var text = await callAI({ side: side, system: systemPrompt(stanceSide), user: buildUserPrompt(side, round) });
  finalizeBubble(pending, text);
  if (side === "for") state.historyFor.push(text); else state.historyAgainst.push(text);
  await wait(400);
}
async function runRound(round) {
  if (state.busy) return;
  state.busy = true; state.currentRound = round;
  var roundEl = document.getElementById("round-num"); if (roundEl) roundEl.textContent = String(round);
  updateMatchupUI();
  var forStance = state.swapped ? "against" : "for", againstStance = state.swapped ? "for" : "against";
  var nextBtn = document.getElementById("btn-next-round"), finishBtn = document.getElementById("btn-finish");
  if (nextBtn) nextBtn.disabled = true; if (finishBtn) finishBtn.disabled = true;
  try {
    await speakSide("for", forStance, round); clearSpeaking(); await wait(250);
    await speakSide("against", againstStance, round); clearSpeaking();
    setStatus(false);
    if (nextBtn) { nextBtn.disabled = false; if (round >= state.rounds) nextBtn.classList.add("hidden"); else nextBtn.classList.remove("hidden"); }
    if (finishBtn) finishBtn.disabled = false;
  } catch (err) {
    clearSpeaking();
    document.querySelectorAll(".bubble-pending").forEach(function (el) { el.remove(); });
    setStatus(true, "");
    var st = document.getElementById("status-text"); if (st) st.textContent = "Error: " + (err.message || String(err));
    var actions = document.getElementById("debate-actions"); if (actions) actions.classList.remove("hidden");
    if (nextBtn) { nextBtn.classList.add("hidden"); nextBtn.disabled = false; }
    if (finishBtn) finishBtn.disabled = false;
  }
  state.busy = false;
}
async function startDebate() {
  if (state.busy) return;
  var topicInput = document.getElementById("topic-input");
  var topic = topicInput ? topicInput.value.trim() : "";
  if (!topic) { if (topicInput) topicInput.focus(); return; }
  state.topic = topic;
  state.rounds = Number(document.getElementById("rounds-select").value) || 3;
  state.lang = document.getElementById("lang-select").value;
  state.currentRound = 0; state.historyFor = []; state.historyAgainst = [];
  document.getElementById("debate-topic").textContent = topic;
  document.getElementById("round-total").textContent = String(state.rounds);
  document.getElementById("messages-for").innerHTML = "";
  document.getElementById("messages-against").innerHTML = "";
  var nextBtn = document.getElementById("btn-next-round"); if (nextBtn) nextBtn.classList.remove("hidden");
  updateMatchupUI(); showScreen("screen-debate"); await runRound(1);
}
function finishDebate() {
  if (state.busy) return;
  document.getElementById("result-topic").textContent = state.topic;
  document.getElementById("vote-feedback").classList.add("hidden");
  document.querySelectorAll(".vote-btn").forEach(function (b) { b.classList.remove("selected"); });
  updateMatchupUI(); showScreen("screen-result");
}
function openSettings() {
  var s = state.settings;
  setVal("openai-key", s.openaiKey || ""); setVal("gemini-key", s.geminiKey || ""); setVal("claude-key", s.claudeKey || "");
  setVal("openai-model", s.openaiModel || "gpt-4o-mini"); setVal("gemini-model", s.geminiModel || "gemini-2.5-flash"); setVal("claude-model", s.claudeModel || "claude-sonnet-4-20250514");
  var modal = document.getElementById("modal-settings"); if (modal) modal.classList.remove("hidden");
}
function setVal(id, value) { var el = document.getElementById(id); if (el) el.value = value; }
function applySettingsFromForm() {
  state.settings.openaiKey = ((document.getElementById("openai-key") || {}).value || "").trim();
  state.settings.geminiKey = ((document.getElementById("gemini-key") || {}).value || "").trim();
  state.settings.claudeKey = ((document.getElementById("claude-key") || {}).value || "").trim();
  state.settings.openaiModel = (document.getElementById("openai-model") || {}).value || "gpt-4o-mini";
  state.settings.geminiModel = ((document.getElementById("gemini-model") || {}).value || "gemini-2.5-flash").replace(/^models\//, "");
  state.settings.claudeModel = (document.getElementById("claude-model") || {}).value || "claude-sonnet-4-20250514";
  saveSettings();
  var modal = document.getElementById("modal-settings"); if (modal) modal.classList.add("hidden");
}
function bind() {
  document.querySelectorAll(".ai-pick .ai-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var g = btn.closest(".ai-pick"), side = g ? g.getAttribute("data-side") : null, p = btn.getAttribute("data-provider");
      if (side && p) setProvider(side, p);
    });
  });
  var btnSettings = document.getElementById("btn-settings"); if (btnSettings) btnSettings.addEventListener("click", openSettings);
  var btnClose = document.getElementById("btn-close-settings");
  if (btnClose) btnClose.addEventListener("click", function () { document.getElementById("modal-settings").classList.add("hidden"); });
  var btnSave = document.getElementById("btn-save-settings"); if (btnSave) btnSave.addEventListener("click", applySettingsFromForm);
  var btnClear = document.getElementById("btn-clear-key");
  if (btnClear) btnClear.addEventListener("click", function () {
    setVal("openai-key", ""); setVal("gemini-key", ""); setVal("claude-key", "");
    state.settings.openaiKey = ""; state.settings.geminiKey = ""; state.settings.claudeKey = ""; saveSettings();
  });
  document.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () { document.getElementById("topic-input").value = chip.getAttribute("data-topic") || ""; });
  });
  var btnStart = document.getElementById("btn-start"); if (btnStart) btnStart.addEventListener("click", startDebate);
  var btnNew = document.getElementById("btn-new");
  if (btnNew) btnNew.addEventListener("click", function () { if (!state.busy) showScreen("screen-setup"); });
  var btnNext = document.getElementById("btn-next-round");
  if (btnNext) btnNext.addEventListener("click", function () { if (!state.busy && state.currentRound < state.rounds) runRound(state.currentRound + 1); });
  var btnFinish = document.getElementById("btn-finish"); if (btnFinish) btnFinish.addEventListener("click", finishDebate);
  var voteFor = document.getElementById("vote-for");
  if (voteFor) voteFor.addEventListener("click", function () {
    document.querySelectorAll(".vote-btn").forEach(function (b) { b.classList.remove("selected"); });
    voteFor.classList.add("selected");
    var fb = document.getElementById("vote-feedback");
    if (fb) { fb.textContent = state.lang === "vi" ? "Ban chon ben UNG HO." : "You voted FOR."; fb.classList.remove("hidden"); }
  });
  var voteAgainst = document.getElementById("vote-against");
  if (voteAgainst) voteAgainst.addEventListener("click", function () {
    document.querySelectorAll(".vote-btn").forEach(function (b) { b.classList.remove("selected"); });
    voteAgainst.classList.add("selected");
    var fb = document.getElementById("vote-feedback");
    if (fb) { fb.textContent = state.lang === "vi" ? "Ban chon ben PHAN DOI." : "You voted AGAINST."; fb.classList.remove("hidden"); }
  });
  var btnAgain = document.getElementById("btn-again");
  if (btnAgain) btnAgain.addEventListener("click", function () { state.swapped = false; showScreen("screen-setup"); });
  var btnSwap = document.getElementById("btn-swap");
  if (btnSwap) btnSwap.addEventListener("click", async function () {
    if (state.busy) return;
    var a = state.settings.providerFor;
    state.settings.providerFor = state.settings.providerAgainst;
    state.settings.providerAgainst = a; saveSettings();
    state.swapped = !state.swapped; state.historyFor = []; state.historyAgainst = [];
    document.getElementById("messages-for").innerHTML = ""; document.getElementById("messages-against").innerHTML = "";
    showScreen("screen-debate"); await runRound(1);
  });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { bind(); updateMatchupUI(); });
else { bind(); updateMatchupUI(); }
