const { createSummary } = require("./geminiClient");

const KNOWN_SKILLS = [
  "react",
  "react native",
  "node",
  "express",
  "typescript",
  "javascript",
  "python",
  "java",
  "sql",
  "postgresql",
  "mongodb",
  "redis",
  "docker",
  "aws",
  "azure",
  "gcp",
  "kubernetes",
  "graphql",
  "rest",
  "fastapi",
  "django",
  "next.js",
  "expo",
  "html",
  "css",
  "tailwind",
  "machine learning",
  "nlp",
  "llm",
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "have",
  "will",
  "your",
  "you",
  "our",
  "are",
  "has",
  "was",
  "were",
  "who",
  "their",
  "them",
  "into",
  "about",
  "than",
  "then",
  "using",
  "used",
  "able",
  "must",
  "should",
]);

function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function extractSkills(text) {
  const haystack = normalize(text);
  return KNOWN_SKILLS.filter((skill) => haystack.includes(skill));
}

function extractYears(text) {
  const matches = [...normalize(text).matchAll(/(\d+)\+?\s+years?/g)];
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((match) => Number.parseInt(match[1], 10)));
}

function extractName(text, fallbackName) {
  const firstLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  const likely = firstLines.find((line) => /^[a-z .'-]{4,}$/i.test(line) && line.split(" ").length <= 4);
  return likely || fallbackName.replace(/\.[^.]+$/, "");
}

function keywordSet(text) {
  return new Set(
    normalize(text)
      .split(/[^a-z0-9+#.]+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
  );
}

function jaccardSimilarity(a, b) {
  const intersection = [...a].filter((item) => b.has(item)).length;
  const union = new Set([...a, ...b]).size || 1;
  return intersection / union;
}

function cosineSimilarity(a, b) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildReasoning({ matchedSkills, missingSkills, semanticScore, experienceGap }) {
  const reasons = [];

  if (matchedSkills.length > 0) {
    reasons.push(`Matched skills: ${matchedSkills.slice(0, 6).join(", ")}.`);
  }

  if (missingSkills.length > 0) {
    reasons.push(`Missing or unclear skills: ${missingSkills.slice(0, 4).join(", ")}.`);
  }

  reasons.push(`Overall profile similarity was ${semanticScore}% based on server-side scoring.`);

  if (experienceGap > 0) {
    reasons.push(`Experience appears about ${experienceGap} year(s) below the role expectation.`);
  }

  return reasons.join(" ");
}

function getStatus(score) {
  if (score >= 75) return "Matching";
  if (score >= 45) return "Partial Match";
  return "Not Matching";
}

async function scoreCandidates(jdContent, parsedCandidates, modelPreference) {
  const jdSkills = extractSkills(jdContent);
  const jdYears = extractYears(jdContent);
  const jdKeywordSet = keywordSet(jdContent);

  const results = [];

  for (const candidate of parsedCandidates) {
    const candidateSkills = extractSkills(candidate.text);
    const matchedSkills = candidateSkills.filter((skill) => jdSkills.includes(skill));
    const missingSkills = jdSkills.filter((skill) => !candidateSkills.includes(skill));
    const candidateYears = extractYears(candidate.text);
    const candidateKeywords = keywordSet(candidate.text);

    let semanticScore = Math.round(jaccardSimilarity(jdKeywordSet, candidateKeywords) * 100);

    const skillScore = jdSkills.length > 0 ? (matchedSkills.length / jdSkills.length) * 100 : semanticScore;
    const experienceScore =
      jdYears > 0
        ? Math.max(0, 100 - Math.max(0, jdYears - candidateYears) * 20)
        : 75;

    const score = clampScore(semanticScore * 0.5 + skillScore * 0.35 + experienceScore * 0.15);
    const status = getStatus(score);

    results.push({
      candidate_name: extractName(candidate.text, candidate.fileName),
      score,
      reasoning: buildReasoning({
        matchedSkills,
        missingSkills,
        semanticScore,
        experienceGap: Math.max(0, jdYears - candidateYears),
      }),
      status,
      file_name: candidate.fileName,
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
      semantic_score: semanticScore,
    });
  }

  results.sort((left, right) => right.score - left.score);

  let comparativeSummary = `Best fit: ${results[0]?.candidate_name || "N/A"} with a score of ${results[0]?.score || 0}.`;

  if (results.length > 1) {
    comparativeSummary += ` ${results[0].candidate_name} led mainly on skill alignment, followed by ${results
      .slice(1, 3)
      .map((item) => `${item.candidate_name} (${item.score}%)`)
      .join(", ")}.`;
  }

  const summaryPayload = {
    job_description: jdContent.slice(0, 4000),
    model_preference: modelPreference || "balanced",
    candidates: results.slice(0, 8).map((item) => ({
      candidate_name: item.candidate_name,
      file_name: item.file_name,
      score: item.score,
      status: item.status,
      reasoning: item.reasoning,
      matched_skills: item.matched_skills,
      missing_skills: item.missing_skills,
    })),
  };

  const aiSummary = await createSummary(JSON.stringify(summaryPayload), undefined).catch(() => null);

  if (aiSummary?.comparative_summary) {
    comparativeSummary = aiSummary.comparative_summary;
  }

  if (Array.isArray(aiSummary?.candidate_reasoning)) {
    const reasoningByName = new Map(
      aiSummary.candidate_reasoning.map((item) => [item.candidate_name, item.reasoning])
    );

    for (const result of results) {
      if (reasoningByName.has(result.candidate_name)) {
        result.reasoning = reasoningByName.get(result.candidate_name);
      }
    }
  }

  return { results, comparativeSummary };
}

module.exports = { scoreCandidates };
