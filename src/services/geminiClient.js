const { config } = require("../config");

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function extractJson(text) {
  const cleaned = (text || "").replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

async function createSummary(prompt, model) {
  if (!config.geminiApiKey) return null;

  const selectedModel = model || config.geminiModel;
  const response = await fetch(`${GEMINI_API_BASE}/${selectedModel}:generateContent?key=${config.geminiApiKey}`, {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini summary request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return extractJson(text);
}

module.exports = { createSummary };
