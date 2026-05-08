const { config } = require("../config");

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
let geminiKeyIndex = 0;

function extractJson(text) {
  const cleaned = (text || "").replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

function getGeminiKeys() {
  const keys = [...config.geminiApiKeys];

  if (config.geminiApiKey) {
    keys.push(config.geminiApiKey);
  }

  return [...new Set(keys)];
}

function nextGeminiKey(keys) {
  const key = keys[geminiKeyIndex % keys.length];
  geminiKeyIndex = (geminiKeyIndex + 1) % keys.length;
  return key;
}

async function createSummary(prompt, model) {
  const keys = getGeminiKeys();
  if (keys.length === 0) return null;

  const selectedModel = model || config.geminiModel;

  let lastError;

  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const apiKey = nextGeminiKey(keys);
    const response = await fetch(`${GEMINI_API_BASE}/${selectedModel}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
        contents: [
          {
            parts: [
              {
                text: [
                  "You are a recruiting assistant.",
                  "Return JSON only with this shape:",
                  '{ "comparative_summary": "string", "candidate_reasoning": [{ "candidate_name": "string", "reasoning": "string" }] }',
                  "Keep reasoning concise, practical, and recruiter-friendly.",
                  "",
                  prompt,
                ].join("\n"),
              },
            ],
          },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return extractJson(text);
    }

    const errorText = await response.text();
    lastError = new Error(`Gemini summary request failed: ${response.status} ${errorText}`);

    if (response.status < 500 && response.status !== 429) {
      break;
    }
  }

  throw lastError;
}

module.exports = { createSummary };
