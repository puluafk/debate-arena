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
  } catch {}
  // migrate v1
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
  } catch {}
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
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

function activeApiConfig() {
  const s = state.settings;
  if (s.provider === "openai" && s.openaiKey) {
    return { provider: "openai", apiKey: s.openaiKey, model: s.openaiModel || "gpt-4o-mini" };
  }
  if (s.provider === "gemini" && s.geminiKey) {
    return { provider: "gemini", apiKey: s.geminiKey, model: s.geminiModel || "gemini-2.0-flash" };
  }
  return null;
}

async function callAI({ system, user }) {
  const cfg = activeApiConfig();
  if (!cfg) return demoReply(system);

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      model: cfg.model,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "API error " + res.status);
  return data.text || "";
}

const DEMO_BANK = {
  en: {
    for: [
      "This position is practical and forward-looking. Benefits outweigh risks with proper safeguards.",
      "Critics exaggerate edge cases. Real-world data shows positive outcomes for most people.",
      "Refusing progress out of fear locks us into worse problems. Responsible adoption is rational.",
    ],
    against: [
      "This path underestimates long-term costs and concentrated power. We should slow down.",
      "Evidence is mixed. Scaling without stronger protections invites harm to vulnerable groups.",
      "Convenience is not wisdom. We can reject this framing and choose a safer alternative.",
    ],
  },
  vi: {
    for: [
      "Quan điểm này thực tế. Lợi ích lớn hơn rủi ro nếu có biện pháp bảo vệ phù hợp.",
      "Phê phán thường phóng đại ngoại lệ. Dữ liệu thực tế cho thấy kết quả tích cực với đa số.",
      "Từ chối tiến bộ vì sợ hãi khiến vấn đề trầm trọng hơn. Áp dụng có trách nhiệm là hợp lý.",
    ],
    against: [
      "Hướng đi này đánh giá thấp chi phí dài hạn. Chúng ta nên chậm lại.",
      "Bằng chứng còn mâu thuẫn. Mở rộng khi thiếu bảo vệ sẽ gây hại nhóm yếu thế.",
      "Tiện lợi không đồng nghĩa khôn ngoan. Nên chọn phương án an toàn hơn.",
    ],
  },
};

function demoReply(system) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const isFor = /FOR |ủng hộ|Advocate/i.test(system);
      const lang = state.lang === "vi" ? "vi" : "en";
      const bank = isFor ? DEMO_BANK[lang].for : DEMO_BANK[lang].against;
      const i = Math.min(state.currentRound - 1, bank.length - 1);
      const topicBit = state.topic ? " Regarding “" + state.topic + “”: " : " ";
      resolve((isFor ? "✓" : "✗") + topicBit + bank[Math.max(0, i)]);
    }, 600 + Math.random() * 500);
  });
}

function systemPrompt(side) {
  const lang = state.lang === "vi" ? "Vietnamese" : "English";
  const stance = side === "for" ? "FOR (in favor of the topic)" : "AGAINST (opposed to the topic)";
  return (
    "You are a sharp, concise debate AI arguing strictly " +
    stance +
    ". Reply in " +
    lang +
    " only. Be persuasive, use 1–2 concrete reasons, stay under 120 words. Do not switch sides."
  );
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
      ? 'Topic: "' + state.topic + '". Give your opening argument.'
      : 'Topic: "' +
        state.topic +
        '". Opponent said: "' +
        (state.historyAgainst[state.historyAgainst.length - 1] || "") +
        '". Rebut and advance your case.';

  const userAgainst =
    round === 1
      ? 'Topic: "' + state.topic + '". Give your opening argument against it.'
      : 'Topic: "' +
        state.topic +
        '". Opponent said: "' +
        (state.historyFor[state.historyFor.length - 1] || "") +
        '". Rebut and advance your case.';

  setStatus(true, state.lang === "vi" ? "AI ủng hộ đang trình bày…" : "Advocate is speaking…");
  try {
    const textFor = await callAI({ system: systemPrompt(forSide), user: userFor });
    state.historyFor.push(textFor);
    addBubble("for", textFor, round);

    setStatus(true, state.lang === "vi" ? "AI phản đối đang trình bày…" : "Challenger is speaking…");
    const textAgainst = await callAI({ system: systemPrompt(againstSide), user: userAgainst });
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
  if (!topic) {
    document.getElementById("topic-input").focus();
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
  document.getElementById("openai-key").value = s.openaiKey || "";
  document.getElementById("gemini-key").value = s.geminiKey || "";
  document.getElementById("openai-model").value = s.openaiModel || "gpt-4o-mini";
  document.getElementById("gemini-model").value = s.geminiModel || "gemini-2.0-flash";
  document.getElementById("modal-settings").classList.remove("hidden");
}

function applySettingsFromForm() {
  state.settings = {
    provider: document.getElementById("provider-select").value,
    openaiKey: document.getElementById("openai-key").value.trim(),
    geminiKey: document.getElementById("gemini-key").value.trim(),
    openaiModel: document.getElementById("openai-model").value,
    geminiModel: document.getElementById("gemini-model").value,
  };
  saveSettings();
  document.getElementById("modal-settings").classList.add("hidden");
}

document.getElementById("btn-settings").addEventListener("click", openSettings);
document.getElementById("btn-close-settings").addEventListener("click", () => {
  document.getElementById("modal-settings").classList.add("hidden");
});
document.getElementById("btn-save-settings").addEventListener("click", applySettingsFromForm);
document.getElementById("btn-clear-key").addEventListener("click", () => {
  document.getElementById("openai-key").value = "";
  document.getElementById("gemini-key").value = "";
  document.getElementById("provider-select").value = "demo";
  state.settings = {
    provider: "demo",
    openaiKey: "",
    geminiKey: "",
    openaiModel: "gpt-4o-mini",
    geminiModel: "gemini-2.0-flash",
  };
  saveSettings();
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.getElementById("topic-input").value = chip.dataset.topic;
  });
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

document.getElementById("btn-again").addEventListener("click", () => {
  state.swapped = false;
  showScreen("screen-setup");
});
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
