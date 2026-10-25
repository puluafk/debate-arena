const STORAGE_KEY = "debate_arena_settings_v1";
const MODELS = {
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini (fast)" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  ],
  gemini: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  ],
};
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
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { provider: "demo", apiKey: "", model: "" };
  } catch {
    return { provider: "demo", apiKey: "", model: "" };
  }
}
function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  updateProviderBadge();
}
function updateProviderBadge() {
  const el = document.getElementById("provider-badge");
  const p = state.settings.provider;
  if (p === "demo" || !state.settings.apiKey) {
    el.textContent = "Demo mode";
    el.className = "provider-badge demo";
  } else {
    el.textContent = p === "openai" ? "OpenAI" : "Gemini";
    el.className = "provider-badge live";
  }
}
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
async function callAI({ system, user, history = [] }) {
  const { provider, apiKey, model } = state.settings;
  if (provider === "demo" || !apiKey) return demoReply(system, user, history);
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      apiKey,
      model: model || (provider === "openai" ? "gpt-4o-mini" : "gemini-2.0-flash"),
      system,
      messages: [...history, { role: "user", content: user }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data.text || "";
}
const DEMO_BANK = {
  en: {
    for: [
      "This position is practical and forward-looking. The benefits outweigh the risks when safeguards are in place.",
      "Critics exaggerate edge cases. Real-world data shows positive outcomes for most people involved.",
      "Refusing progress out of fear locks us into worse problems. Responsible adoption is the rational path.",
    ],
    against: [
      "The proposed path underestimates long-term costs and concentrated power. We should slow down.",
      "Evidence is mixed at best. Scaling this without stronger protections invites harm to vulnerable groups.",
      "Convenience is not the same as wisdom. We can reject this framing and choose a safer alternative.",
    ],
  },
  vi: {
    for: [
      "Quan điểm này thực tế và hướng tới tương lai. Lợi ích lớn hơn rủi ro nếu có biện pháp bảo vệ phù hợp.",
      "Phê phán thường phóng đại trường hợp ngoại lệ. Dữ liệu thực tế cho thấy kết quả tích cực với đa số.",
      "Từ chối tiến bộ vì sợ hãi chỉ khiến vấn đề trầm trọng hơn. Áp dụng có trách nhiệm là lựa chọn hợp lý.",
    ],
    against: [
      "Hướng đi này đánh giá thấp chi phí dài hạn và quyền lực tập trung. Chúng ta nên chậm lại.",
      "Bằng chứng còn mâu thuẫn. Mở rộng quy mô khi thiếu bảo vệ sẽ gây hại nhóm yếu thế.",
      "Tiện lợi không đồng nghĩa với khôn ngoan. Có thể bác bỏ khung này và chọn phương án an toàn hơn.",
    ],
  },
};
function demoReply(system, user, history) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const isFor = /FOR side|ủng hộ|Advocate/i.test(system);
      const lang = state.lang === "vi" ? "vi" : "en";
      const bank = isFor ? DEMO_BANK[lang].for : DEMO_BANK[lang].against;
      const i = Math.min(history.filter((h) => h.role === "assistant").length, bank.length - 1);
      const topicBit = state.topic ? ` Regarding “${state.topic}”: ` : " ";
      resolve((isFor ? "✓" : "✗") + topicBit + bank[i]);
    }, 700 + Math.random() * 600);
  });
}
function systemPrompt(side) {
  const lang = state.lang === "vi" ? "Vietnamese" : "English";
  const stance = side === "for" ? "FOR (in favor of the topic)" : "AGAINST (opposed to the topic)";
  return [
    `You are a sharp, concise debate AI arguing strictly ${stance}.`,
    `Reply in ${lang} only.`,
    "Be persuasive, use 1–2 concrete reasons, and stay under 120 words.",
    "Do not switch sides. Do not mention that you are an AI unless asked.",
    "If this is a rebuttal round, directly address the opponent's last points.",
  ].join(" ");
}
function roundLabel(round, total) {
  if (round === 1) return state.lang === "vi" ? "Mở đầu" : "Opening";
  if (round === total) return state.lang === "vi" ? "Kết luận" : "Closing";
  return state.lang === "vi" ? "Phản biện" : "Rebuttal";
}
function addBubble(side, text, round) {
  const box = document.getElementById(side === "for" ? "messages-for" : "messages-against");
  const div = document.createElement("div");
  div.className = "bubble";
  div.innerHTML = `<span class="round-tag">${roundLabel(round, state.rounds)} · R${round}</span>${escapeHtml(text)}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
}
function setStatus(visible, text) {
  const el = document.getElementById("debate-status");
  el.classList.toggle("hidden", !visible);
  if (text) document.getElementById("status-text").textContent = text;
  document.getElementById("debate-actions").classList.toggle("hidden", visible);
}
async function runRound(round) {
  state.currentRound = round;
  document.getElementById("round-num").textContent = String(round);
  const forSide = state.swapped ? "against" : "for";
  const againstSide = state.swapped ? "for" : "against";
  const userFor =
    round === 1
      ? `Topic: "${state.topic}". Give your opening argument.`
      : `Topic: "${state.topic}". Opponent said: "${state.historyAgainst[state.historyAgainst.length - 1] || ""}". Rebut and advance your case.`;
  const userAgainst =
    round === 1
      ? `Topic: "${state.topic}". Give your opening argument against it.`
      : `Topic: "${state.topic}". Opponent said: "${state.historyFor[state.historyFor.length - 1] || ""}". Rebut and advance your case.`;
  setStatus(true, state.lang === "vi" ? "AI ủng hộ đang trình bày…" : "Advocate is speaking…");
  try {
    const textFor = await callAI({ system: systemPrompt(forSide), user: userFor, history: [] });
    state.historyFor.push(textFor);
    addBubble("for", textFor, round);
    setStatus(true, state.lang === "vi" ? "AI phản đối đang trình bày…" : "Challenger is speaking…");
    const textAgainst = await callAI({ system: systemPrompt(againstSide), user: userAgainst, history: [] });
    state.historyAgainst.push(textAgainst);
    addBubble("against", textAgainst, round);
    setStatus(false);
    const nextBtn = document.getElementById("btn-next-round");
    if (round >= state.rounds) nextBtn.classList.add("hidden");
    else nextBtn.classList.remove("hidden");
  } catch (err) {
    setStatus(true, "");
    document.getElementById("status-text").textContent = "Error: " + (err.message || String(err));
    document.getElementById("debate-actions").classList.remove("hidden");
    document.getElementById("btn-next-round").classList.add("hidden");
  }
}
async function startDebate() {
  const topic = document.getElementById("topic-input").value.trim();
  if (!topic) { document.getElementById("topic-input").focus(); return; }
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
  document.getElementById("btn-next-round").classList.remove("hidden");
  showScreen("screen-debate");
  await runRound(1);
}
function finishDebate() {
  document.getElementById("result-topic").textContent = state.topic;
  document.getElementById("vote-feedback").classList.add("hidden");
  document.querySelectorAll(".vote-btn").forEach((b) => b.classList.remove("selected"));
  showScreen("screen-result");
}
function openSettings() {
  const s = state.settings;
  document.getElementById("provider-select").value = s.provider || "demo";
  document.getElementById("api-key-input").value = s.apiKey || "";
  refreshModelOptions();
  if (s.model) document.getElementById("model-select").value = s.model;
  toggleKeyBlocks();
  document.getElementById("modal-settings").classList.remove("hidden");
}
function toggleKeyBlocks() {
  const p = document.getElementById("provider-select").value;
  const needKey = p !== "demo";
  document.getElementById("key-block").classList.toggle("hidden", !needKey);
  document.getElementById("model-block").classList.toggle("hidden", !needKey);
  const hint = document.getElementById("key-hint");
  if (p === "openai") hint.innerHTML = 'Get a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com</a>';
  else if (p === "gemini") hint.innerHTML = 'Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>';
  else hint.textContent = "";
  refreshModelOptions();
}
function refreshModelOptions() {
  const p = document.getElementById("provider-select").value;
  const sel = document.getElementById("model-select");
  sel.innerHTML = "";
  (MODELS[p] || []).forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    sel.appendChild(opt);
  });
}
function applySettingsFromForm() {
  state.settings = {
    provider: document.getElementById("provider-select").value,
    apiKey: document.getElementById("api-key-input").value.trim(),
    model: document.getElementById("model-select").value || "",
  };
  saveSettings();
  document.getElementById("modal-settings").classList.add("hidden");
}
document.getElementById("btn-settings").addEventListener("click", openSettings);
document.getElementById("btn-close-settings").addEventListener("click", () => document.getElementById("modal-settings").classList.add("hidden"));
document.getElementById("provider-select").addEventListener("change", toggleKeyBlocks);
document.getElementById("btn-save-settings").addEventListener("click", applySettingsFromForm);
document.getElementById("btn-clear-key").addEventListener("click", () => {
  document.getElementById("api-key-input").value = "";
  state.settings.apiKey = "";
  state.settings.provider = "demo";
  document.getElementById("provider-select").value = "demo";
  saveSettings();
  toggleKeyBlocks();
});
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => { document.getElementById("topic-input").value = chip.dataset.topic; });
});
document.getElementById("btn-start").addEventListener("click", startDebate);
document.getElementById("btn-new").addEventListener("click", () => showScreen("screen-setup"));
document.getElementById("btn-next-round").addEventListener("click", () => {
  if (state.currentRound < state.rounds) runRound(state.currentRound + 1);
});
document.getElementById("btn-finish").addEventListener("click", finishDebate);
document.getElementById("vote-for").addEventListener("click", () => {
  document.querySelectorAll(".vote-btn").forEach((b) => b.classList.remove("selected"));
  document.getElementById("vote-for").classList.add("selected");
  const fb = document.getElementById("vote-feedback");
  fb.textContent = state.lang === "vi" ? "Bạn chọn bên ỦNG HỘ." : "You voted FOR.";
  fb.classList.remove("hidden");
});
document.getElementById("vote-against").addEventListener("click", () => {
  document.querySelectorAll(".vote-btn").forEach((b) => b.classList.remove("selected"));
  document.getElementById("vote-against").classList.add("selected");
  const fb = document.getElementById("vote-feedback");
  fb.textContent = state.lang === "vi" ? "Bạn chọn bên PHẢN ĐỐI." : "You voted AGAINST.";
  fb.classList.remove("hidden");
});
document.getElementById("btn-again").addEventListener("click", () => { state.swapped = false; showScreen("screen-setup"); });
document.getElementById("btn-swap").addEventListener("click", async () => {
  state.swapped = !state.swapped;
  state.historyFor = [];
  state.historyAgainst = [];
  document.getElementById("messages-for").innerHTML = "";
  document.getElementById("messages-against").innerHTML = "";
  showScreen("screen-debate");
  await runRound(1);
});
updateProviderBadge();
