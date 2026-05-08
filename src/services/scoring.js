const { createSummary, analyzeCandidateBatch } = require("./geminiClient");

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

function sanitizeCandidateName(name, fallbackName) {
  const cleaned = (name || "").replace(/\s+/g, " ").trim();
  const fallback = (fallbackName || "").replace(/\.[^.]+$/, "");

  if (!cleaned) return fallback;

  const invalidValues = [
    "matching",
    "partial match",
    "not matching",
    "candidate",
    "best fit",
    "comparative summary",
    "summary",
    "name",
  ];

  if (invalidValues.includes(cleaned.toLowerCase())) {
    return fallback;
  }

  if (cleaned.length < 3 || cleaned.length > 80) {
    return fallback;
  }

  return cleaned;
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function scoreCandidates(jdContent, parsedCandidates, modelPreference) {
  const jdSkills = extractSkills(jdContent);
  const jdYears = extractYears(jdContent);
  const jdKeywordSet = keywordSet(jdContent);

  const results = [];

  for (let index = 0; index < parsedCandidates.length; index += 1) {
    const candidate = parsedCandidates[index];
    const cvIndex = candidate.cv_index || index + 1;
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
      cv_index: cvIndex,
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

  const batches = chunkArray(
    parsedCandidates.map((candidate, index) => ({
      cv_index: candidate.cv_index || index + 1,
      file_name: candidate.fileName,
      cv_text: candidate.text.slice(0, 14000),
      cv_text_head: candidate.text.slice(0, 2500),
    })),
    8
  );

  const aiBatchResults = [];
  const aiBatchSummaries = [];

  for (const batch of batches) {
    const aiBatch = await analyzeCandidateBatch({
      jdContent: jdContent.slice(0, 12000),
      candidates: batch,
    }).catch(() => null);

    if (Array.isArray(aiBatch?.results)) {
      aiBatchResults.push(...aiBatch.results);
    }

    if (aiBatch?.comparative_summary) {
      aiBatchSummaries.push(aiBatch.comparative_summary);
    }
  }

  if (aiBatchResults.length > 0) {
    const byIndex = new Map(aiBatchResults.map((item) => [item.cv_index, item]));

    for (const result of results) {
      const aiResult = byIndex.get(result.cv_index);
      if (!aiResult) continue;

      result.candidate_name = sanitizeCandidateName(aiResult.candidate_name, result.file_name || result.candidate_name);
      result.score = Number.isFinite(aiResult.score) ? clampScore(aiResult.score) : result.score;
      result.reasoning = aiResult.reasoning || result.reasoning;
      result.status = aiResult.status || result.status;
    }

    results.sort((left, right) => right.score - left.score);
  }

  if (results.length > 1) {
    const summaryPayload = {
      job_description: jdContent.slice(0, 4000),
      model_preference: modelPreference || "balanced",
      batch_summaries: aiBatchSummaries,
      candidates: results.slice(0, 12).map((item) => ({
        candidate_name: item.candidate_name,
        file_name: item.file_name,
        score: item.score,
        status: item.status,
        reasoning: item.reasoning,
      })),
    };

    const aiSummary = await createSummary(JSON.stringify(summaryPayload), undefined).catch(() => null);

    if (aiSummary?.comparative_summary) {
      comparativeSummary = aiSummary.comparative_summary;
    }
  } else if (aiBatchSummaries[0]) {
    comparativeSummary = aiBatchSummaries[0];
  }

  return { results, comparativeSummary };
}

module.exports = { scoreCandidates };
