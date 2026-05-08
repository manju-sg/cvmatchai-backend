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

async function requestGeminiJson(prompt, model) {
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

async function createSummary(prompt, model) {
  return requestGeminiJson(
    [
      "You are a recruiting assistant.",
      "Return JSON only with this shape:",
      '{ "comparative_summary": "string", "candidate_reasoning": [{ "candidate_name": "string", "reasoning": "string" }] }',
      "Keep reasoning concise, practical, and recruiter-friendly.",
      "",
      prompt,
    ].join("\n"),
    model
  );
}

async function analyzeCandidateBatch({ jdContent, candidates, model }) {
  const candidateBlocks = candidates
    .map(
      (candidate) => `
CANDIDATE ${candidate.cv_index}
FILE_NAME: ${candidate.file_name}
TOP_OF_CV:
${candidate.cv_text_head}

CV_TEXT:
${candidate.cv_text}
`.trim()
    )
    .join("\n\n====================\n\n");

  const prompt = `
You are an expert HR recruitment assistant.
Below is a Job Description and ${candidates.length} candidate CV(s) as extracted text.

JOB DESCRIPTION:
${jdContent}

TASK:
1. For each candidate CV, extract the candidate's correct full name from the CV text.
2. Prefer the name appearing at the top of the CV.
3. Do not return labels like "Candidate", "Matching", "Summary", file names, or job titles as candidate_name unless no real name exists in the CV.
4. If a CV truly has no visible human name, use the file name without extension.
5. Analyze each candidate individually against the Job Description.
6. Provide a match score from 0 to 100 for each.
7. Provide clear, concise reasoning for each score.
8. Determine a status for each: "Matching", "Partial Match", or "Not Matching".
9. Provide a "comparative_summary" explaining who is the best fit and a brief comparison between candidates.
10. Preserve the exact cv_index for each candidate so the response can be mapped back correctly.

CANDIDATES:
${candidateBlocks}

RESPONSE FORMAT (JSON ONLY):
{
  "results": [
    {
      "cv_index": 1,
      "candidate_name": "Name",
      "score": 85,
      "reasoning": "Individual reasoning here...",
      "status": "Matching"
    }
  ],
  "comparative_summary": "Detailed comparison and ranking here..."
}
`;

  return requestGeminiJson(prompt, model);
}

module.exports = { createSummary, analyzeCandidateBatch };
