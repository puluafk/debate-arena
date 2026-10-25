/**
 * Vercel serverless proxy for OpenAI & Gemini.
 * API key is sent by the client per request — not stored on the server.
 */

export default async function handler(req, res) {
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
    const { provider, apiKey, model, system, messages } = req.body || {};

    if (!apiKey || typeof apiKey !== "string") {
      return res.status(400).json({ error: "Missing API key" });
    }
    if (!provider || !["openai", "gemini"].includes(provider)) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    const text =
      provider === "openai"
        ? await callOpenAI({ apiKey, model, system, messages })
        : await callGemini({ apiKey, model, system, messages });

    return res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Upstream AI request failed",
    });
  }
}

async function callOpenAI({ apiKey, model, system, messages }) {
  const body = {
    model: model || "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 400,
    messages: [
      { role: "system", content: system || "You are a debate assistant." },
      ...(messages || []).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ],
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await r.json();
  if (!r.ok) {
    throw new Error(data.error?.message || `OpenAI HTTP ${r.status}`);
  }
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callGemini({ apiKey, model, system, messages }) {
  const modelId = model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = [];
  for (const m of messages || []) {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  if (system) {
    contents.unshift({
      role: "user",
      parts: [{ text: `[System instructions]\n${system}\n\nFollow these instructions for all replies.` }],
    });
    contents.splice(1, 0, {
      role: "model",
      parts: [{ text: "Understood. I will follow the instructions." }],
    });
  }

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 400,
      },
    }),
  });

  const data = await r.json();
  if (!r.ok) {
    throw new Error(data.error?.message || `Gemini HTTP ${r.status}`);
  }
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  return text.trim();
}
