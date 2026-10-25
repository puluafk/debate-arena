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
    if (raw) {
      var settings = Object.assign({ providerFor: raw.provider || "demo", providerAgainst: raw.provider || "demo" }, raw);
      if (!settings.geminiModel || ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"].includes(settings.geminiModel)) settings.geminiModel = "gemini-2.5-flash";
      return settings;
    }
  } catch (e) {}
  try {
    const v1 = JSON.parse(localStorage.getItem("debate_arena_settings_v1"));
    if (v1) {
      return {
        provider: v1.provider || "demo",
        providerFor: v1.provider || "demo",
        providerAgainst: v1.provider || "demo",
        openaiKey: v1.provider === "openai" ? v1.apiKey || "" : "",
        geminiKey: v1.provider === "gemini" ? v1.apiKey || "" : "",
        openaiModel: v1.provider === "openai" ? v1.model || "gpt-4o-mini" : "gpt-4o-mini",
        geminiModel: v1.provider === "gemini" ? v1.model || "gemini-2.5-flash" : "gemini-2.5-flash",
      };
    }
  } catch (e) {}
  return {
    provider: "demo",
    providerFor: "demo",
    providerAgainst: "demo",
    openaiKey: "",
    geminiKey: "",
    openaiModel: "gpt-4o-mini",
    geminiModel: "gemini-2.5-flash",
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
  var left = s.providerFor || s.provider || "demo";
  var right = s.providerAgainst || s.provider || "demo";
  var names = { openai: "OpenAI", gemini: "Gemini", demo: "Demo" };
  el.textContent = names[left] + " vs " + names[right];
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
  provider = provider || s.provider || "demo";
  if (provider === "openai") {
    if (!s.openaiKey) throw new Error("Missing OpenAI API key. Open Settings to configure the " + side.toUpperCase() + " side.");
    return { provider: "openai", apiKey: s.openaiKey, model: s.openaiModel || "gpt-4o-mini" };
  }
  if (provider === "gemini") {
    if (!s.geminiKey) throw new Error("Missing Gemini API key. Open Settings to configure the " + side.toUpperCase() + " side.");
    return { provider: "gemini", apiKey: s.geminiKey, model: s.geminiModel || "gemini-2.5-flash" };
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
      provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model,
      system: opts.system, messages: [{ role: "user", content: opts.user }],
    }),
  });
  var data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || "API error " + res.status);
  return data.text || "";
}

var DEMO_DEBATES = {
  "Should students use AI to write essays?": {
    "en": {
      "for": [
        "AI helps students brainstorm and organize essays.",
        "Students should verify AI suggestions and explain their own reasoning.",
        "Teach responsible AI use and assess the writing process."
      ],
      "against": [
        "AI-generated essays can hide gaps in students' understanding.",
        "Even with disclosure, teachers may struggle to assess genuine authorship.",
        "Final essays must reflect each student's independent thinking."
      ]
    },
    "vi": {
      "for": [
        "AI giúp học sinh tìm ý tưởng và sắp xếp bài luận.",
        "Học sinh nên kiểm chứng gợi ý của AI và tự giải thích lập luận.",
        "Nên dạy sử dụng AI có trách nhiệm và đánh giá quá trình viết."
      ],
      "against": [
        "Bài viết do AI tạo có thể che giấu việc học sinh chưa hiểu bài.",
        "Dù khai báo dùng AI, giáo viên vẫn khó đánh giá năng lực thật.",
        "Bài luận cuối cùng phải thể hiện tư duy độc lập của học sinh."
      ]
    }
  },
  "Is remote work better than office work?": {
    "en": {
      "for": [
        "Remote work saves commuting time and improves flexibility.",
        "Online meetings and shared tools can maintain teamwork.",
        "Judge suitable remote roles by outcomes, not desk time."
      ],
      "against": [
        "Office work supports spontaneous collaboration and mentoring.",
        "Remote employees may feel isolated and miss informal learning.",
        "Hybrid schedules may better balance flexibility and team culture."
      ]
    },
    "vi": {
      "for": [
        "Làm việc từ xa tiết kiệm thời gian đi lại và tăng tính linh hoạt.",
        "Họp trực tuyến và công cụ chung vẫn hỗ trợ làm việc nhóm.",
        "Nên đánh giá công việc phù hợp qua kết quả thay vì giờ có mặt."
      ],
      "against": [
        "Văn phòng thuận lợi cho hợp tác và hướng dẫn nhân viên mới.",
        "Nhân viên từ xa có thể cô lập và bỏ lỡ cơ hội học hỏi.",
        "Mô hình kết hợp có thể cân bằng linh hoạt và văn hóa nhóm."
      ]
    }
  },
  "Should social media have age restrictions under 16?": {
    "en": {
      "for": [
        "Age limits may protect younger teens from harmful content.",
        "Age-appropriate design can make online spaces safer.",
        "Stronger protections are justified when privacy is respected."
      ],
      "against": [
        "Blanket bans can remove useful communities and learning resources.",
        "Age verification can invade privacy and may be bypassed.",
        "Improve platform safety and digital education rather than relying on bans."
      ]
    },
    "vi": {
      "for": [
        "Giới hạn tuổi có thể bảo vệ trẻ trước nội dung độc hại.",
        "Thiết kế phù hợp độ tuổi giúp không gian mạng an toàn hơn.",
        "Cần bảo vệ mạnh hơn nhưng vẫn tôn trọng quyền riêng tư."
      ],
      "against": [
        "Lệnh cấm toàn diện có thể tước đi cộng đồng và tài liệu hữu ích.",
        "Xác minh tuổi có thể xâm phạm riêng tư và dễ bị vượt qua.",
        "Nên cải thiện an toàn nền tảng và giáo dục kỹ năng số thay vì chỉ cấm."
      ]
    }
  },
  "Is nuclear energy essential for fighting climate change?": {
    "en": {
      "for": [
        "Nuclear power provides reliable low-carbon electricity.",
        "Firm nuclear power can complement wind and solar.",
        "Nuclear is valuable where grids need steady clean power."
      ],
      "against": [
        "Nuclear projects can be expensive and slow to build.",
        "Renewables, storage and efficiency may reduce emissions faster.",
        "It is useful in some places but not essential everywhere."
      ]
    },
    "vi": {
      "for": [
        "Điện hạt nhân cung cấp điện ít phát thải và ổn định.",
        "Nguồn điện hạt nhân ổn định có thể bổ sung cho điện gió và mặt trời.",
        "Điện hạt nhân hữu ích ở nơi cần nguồn điện sạch liên tục."
      ],
      "against": [
        "Dự án hạt nhân thường tốn kém và xây dựng lâu.",
        "Điện tái tạo, lưu trữ và tiết kiệm năng lượng có thể giảm phát thải nhanh hơn.",
        "Điện hạt nhân phù hợp một số nơi nhưng không thiết yếu ở mọi quốc gia."
      ]
    }
  },
  "Should homework be banned in schools?": {
    "en": {
      "for": [
        "Banning repetitive homework could reduce stress and inequality.",
        "Teachers can provide guided practice during class.",
        "Replace routine homework with meaningful in-class practice."
      ],
      "against": [
        "Purposeful homework reinforces lessons and independent study.",
        "Short assignments can build responsibility without overload.",
        "Limit homework rather than banning every assignment."
      ]
    },
    "vi": {
      "for": [
        "Bỏ bài tập lặp lại có thể giảm áp lực và bất bình đẳng.",
        "Giáo viên có thể tổ chức luyện tập ngay trong giờ học.",
        "Nên thay bài tập máy móc bằng luyện tập có ý nghĩa trên lớp."
      ],
      "against": [
        "Bài tập phù hợp giúp củng cố kiến thức và tự học.",
        "Bài tập ngắn giúp rèn trách nhiệm mà không gây quá tải.",
        "Nên giới hạn lượng bài thay vì cấm hoàn toàn."
      ]
    }
  }
};

function demoReply(system) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      var side = /FOR |Advocate/i.test(system) ? "for" : "against";
      var lang = state.lang === "vi" ? "vi" : "en";
      var debate = DEMO_DEBATES[state.topic.trim()];
      var index = Math.max(0, Math.min(state.currentRound - 1, 2));
      if (debate) return resolve(debate[lang][side][index]);
      resolve(lang === "vi"
        ? "Chế độ demo: hãy chọn một trong năm chủ đề gợi ý để xem phần tranh luận mẫu."
        : "Demo mode: choose one of the five suggested topics for a sample debate.");
    }, 350);
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
  var providerFor = document.getElementById("provider-for");
  var providerAgainst = document.getElementById("provider-against");
  var openaiKey = document.getElementById("openai-key");
  var geminiKey = document.getElementById("gemini-key");
  var openaiModel = document.getElementById("openai-model");
  var geminiModel = document.getElementById("gemini-model");
  if (providerFor) providerFor.value = s.providerFor || s.provider || "demo";
  if (providerAgainst) providerAgainst.value = s.providerAgainst || s.provider || "demo";
  if (openaiKey) openaiKey.value = s.openaiKey || "";
  if (geminiKey) geminiKey.value = s.geminiKey || "";
  if (openaiModel) openaiModel.value = s.openaiModel || "gpt-4o-mini";
  if (geminiModel) {
    var savedModel = s.geminiModel || "gemini-2.5-flash";
    if (!Array.from(geminiModel.options).some(function (option) { return option.value === savedModel; })) {
      var customOption = document.createElement("option");
      customOption.value = savedModel;
      customOption.textContent = savedModel + " (saved)";
      geminiModel.appendChild(customOption);
    }
    geminiModel.value = savedModel;
  }
  var modal = document.getElementById("modal-settings");
  if (modal) modal.classList.remove("hidden");
}

function applySettingsFromForm() {
  var providerFor = document.getElementById("provider-for");
  var providerAgainst = document.getElementById("provider-against");
  var openaiKey = document.getElementById("openai-key");
  var geminiKey = document.getElementById("gemini-key");
  var openaiModel = document.getElementById("openai-model");
  var geminiModel = document.getElementById("gemini-model");
  state.settings = {
    provider: providerFor ? providerFor.value : "demo",
    providerFor: providerFor ? providerFor.value : "demo",
    providerAgainst: providerAgainst ? providerAgainst.value : "demo",
    openaiKey: openaiKey ? openaiKey.value.trim() : "",
    geminiKey: geminiKey ? geminiKey.value.trim() : "",
    openaiModel: openaiModel ? openaiModel.value : "gpt-4o-mini",
    geminiModel: geminiModel ? geminiModel.value.trim().replace(/^models\//, "") || "gemini-2.5-flash" : "gemini-2.5-flash",
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
      var pf = document.getElementById("provider-for");
      var pa = document.getElementById("provider-against");
      if (ok) ok.value = "";
      if (gk) gk.value = "";
      if (pf) pf.value = "demo";
      if (pa) pa.value = "demo";
      state.settings = {
        provider: "demo",
        providerFor: "demo",
        providerAgainst: "demo",
        openaiKey: "",
        geminiKey: "",
        openaiModel: "gpt-4o-mini",
        geminiModel: "gemini-2.5-flash",
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
