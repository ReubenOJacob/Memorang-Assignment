import { extractText, getDocumentProxy } from "unpdf";

// pdf.js/unpdf need the Node runtime — NOT edge.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_CHARS = 40_000;

export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data with a `file` field." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "PDF too large (max 15 MB)." }, { status: 413 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "Only PDF files are supported." }, { status: 415 });
  }

  let cleaned: string;
  let totalPages = 0;
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const result = await extractText(pdf, { mergePages: true });
    totalPages = result.totalPages;
    const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
    cleaned = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch (err) {
    console.error("[upload] parse failed:", (err as Error).message);
    return Response.json({ error: "Could not parse this PDF. It may be corrupted." }, { status: 422 });
  }

  if (cleaned.length < 200) {
    return Response.json(
      { error: "No extractable text found — is this a scanned/image-only PDF? OCR is not supported." },
      { status: 422 },
    );
  }

  const truncated = cleaned.length > MAX_CHARS;
  return Response.json({
    title: file.name.replace(/\.pdf$/i, ""),
    text: cleaned.slice(0, MAX_CHARS),
    truncated,
    totalPages,
  });
}
