module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    var body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }

    var provider = body.provider;
    var apiKey = body.apiKey;
    var model = body.model;
    var system = body.system;
    var messages = body.messages;

    if (!apiKey || typeof apiKey !== "string") {
      return res.status(400).json({ error: "Missing API key" });
    }
    if (!provider || ["openai", "gemini", "claude"].indexOf(provider) === -1) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    var text;
    if (provider === "openai") {
      text = await callOpenAI(apiKey, model, system, messages);
    } else if (provider === "gemini") {
      text = await callGemini(apiKey, model, system, messages);
    } else {
      text = await callClaude(apiKey, model, system, messages);
    }

    return res.status(200).json({ text: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: (err && err.message) || "Upstream AI request failed",
    });
  }
};

async function callOpenAI(apiKey, model, system, messages) {
  var body = {
    model: model || "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 400,
    messages: [{ role: "system", content: system || "You are a debate assistant." }].concat(
      (messages || []).map(function (m) {
        return {
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        };
      })
    ),
  };

  var r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  var data = await r.json();
  if (!r.ok) {
    throw new Error((data.error && data.error.message) || "OpenAI HTTP " + r.status);
  }
  return (
    (data.choices &&
      data.choices[0] &&
      data.choices[0].message &&
      data.choices[0].message.content &&
      data.choices[0].message.content.trim()) ||
    ""
  );
}

async function callGemini(apiKey, model, system, messages) {
  var modelId = String(model || "gemini-2.5-flash").replace(/^models\//, "");
  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    modelId +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  var contents = [];
  if (system) {
    contents.push({
      role: "user",
      parts: [{ text: "[System instructions]\n" + system + "\n\nFollow these instructions for all replies." }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I will follow the instructions." }],
    });
  }
  (messages || []).forEach(function (m) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  });

  var r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: contents,
      generationConfig: { temperature: 0.8, maxOutputTokens: 400 },
    }),
  });

  var data = await r.json();
  if (!r.ok) {
    throw new Error((data.error && data.error.message) || "Gemini HTTP " + r.status);
  }
  var parts =
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts;
  if (!parts) return "";
  return parts
    .map(function (p) {
      return p.text || "";
    })
    .join("")
    .trim();
}

async function callClaude(apiKey, model, system, messages) {
  var body = {
    model: model || "claude-sonnet-4-20250514",
    max_tokens: 400,
    temperature: 0.8,
    system: system || "You are a debate assistant.",
    messages: (messages || []).map(function (m) {
      return {
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      };
    }),
  };

  var r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  var data = await r.json();
  if (!r.ok) {
    throw new Error((data.error && data.error.message) || "Claude HTTP " + r.status);
  }
  var blocks = data.content || [];
  return blocks
    .map(function (b) {
      return b.type === "text" ? b.text || "" : "";
    })
    .join("")
    .trim();
}
