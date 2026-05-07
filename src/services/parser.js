const fs = require("fs/promises");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

async function parseFile(file) {
  const name = file.originalname || "candidate";
  const mimeType = file.mimetype || "application/octet-stream";
  const buffer = file.buffer || (file.path ? await fs.readFile(file.path) : null);

  if (!buffer) {
    throw new Error(`No file contents found for ${name}`);
  }

  if (mimeType === "application/pdf" || name.toLowerCase().endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    return parsed.text || "";
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.toLowerCase().endsWith(".docx")
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value || "";
  }

  if (mimeType.startsWith("text/") || name.toLowerCase().endsWith(".txt")) {
    return buffer.toString("utf8");
  }

  throw new Error(`Unsupported file type for ${name}`);
}

module.exports = { parseFile };
