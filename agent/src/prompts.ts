import type { Objective, MCQ, LessonStats } from "./schemas.js";

const MAX_DOC_CHARS = 40_000;

export function clampDoc(text: string): string {
  return text.slice(0, MAX_DOC_CHARS);
}

// ─── Lesson planner ──────────────────────────────────────────────────────────

export function plannerPrompt(pdfTitle: string, pdfText: string, planFeedback: string): string {
  const revision = planFeedback
    ? `\nThe student reviewed a previous draft and requested changes: "${planFeedback}". Produce a REVISED plan that honors this feedback.\n`
    : "";
  return `You are an expert curriculum designer. You are given the extracted text of a document a student wants to learn from.

Produce a lesson plan with:
- title: a short, concrete lesson title derived from the document (not generic like "Document Overview").
- difficulty: overall rating — "beginner" | "intermediate" | "advanced" — judged from the document's assumed prior knowledge.
- objectives: 3-5 learning objectives that together cover the document's core ideas. Order them so earlier objectives are prerequisites for later ones. Each objective has: id (kebab-case slug), title (<=8 words, starts with a verb: "Explain...", "Distinguish...", "Apply..."), description (1-2 sentences of what the student will be able to do), difficulty (per-objective).

Rules:
- Objectives MUST be answerable from this document alone — do not import outside topics.
- Every objective must be testable with multiple-choice questions grounded in specific document content. Skip themes the document only mentions in passing.
- Prefer conceptual understanding over rote recall where the document allows.
- If the document is too short or thin for 3 objectives, produce fewer rather than padding.
${revision}
DOCUMENT (${pdfTitle}):
"""
${clampDoc(pdfText)}
"""`;
}

// ─── MCQ generator (per objective) ───────────────────────────────────────────

export function mcqPrompt(objective: Objective, pdfText: string, n: number): string {
  return `You are an expert assessment writer. Write ${n} multiple-choice questions testing this learning objective, using ONLY the source document below.

OBJECTIVE: ${objective.title} — ${objective.description}
TARGET DIFFICULTY: ${objective.difficulty}

Author EACH question with this exact process:
1. Pick one fact, concept, or mechanism from the document that serves the objective.
2. Derive the correct answer YOURSELF, before writing any choices. For anything numeric or computational, work it out step by step and double-check the result (e.g. count decimal places one at a time).
3. Write a self-contained question — never "according to the passage above".
4. Write the correct choice's text, then exactly three distractors. Distractors must be plausible: common misconceptions or near-misses (off-by-one exponents, swapped terms, reversed causality) drawn from the material — never absurd throwaways.
5. Assign letters A-D and set correctChoiceId. Vary which letter is correct across the questions — do not put every correct answer in the same position.
6. FINAL CONSISTENCY CHECK — rewrite the question if ANY of these fail:
   - The choice at correctChoiceId contains exactly the answer you derived in step 2. This is the most common authoring error: deriving one answer but labeling a different letter correct. Re-read the choice text at your chosen letter and confirm it IS the derived answer.
   - The explanation names/describes the SAME choice as correctChoiceId — an explanation that argues for a different option than the labeled key is a fatal error.
   - The hint does not name, quote, or logically force the correct choice.

Field requirements:
- id: "${objective.id}-q1", "${objective.id}-q2", ... (unique).
- objectiveId: "${objective.id}".
- explanation: 2-3 sentences shown AFTER a correct answer. Open by affirming the correct choice's content, teach WHY it is right, and briefly why the strongest distractor is wrong.
- hint: 1-2 sentences shown after a WRONG answer. Point toward the relevant concept or method WITHOUT revealing the answer — a student reading only the hint must still have to think.
- sourceQuote: a short verbatim (or near-verbatim) snippet from the document that grounds the correct answer.
- Vary cognitive level: at least one recall and one application/why question per objective when the material allows.
- Do not reuse the same fact across two questions.

SOURCE DOCUMENT:
"""
${clampDoc(pdfText)}
"""`;
}

// ─── Answer-key audit (independent solve-and-compare) ───────────────────────

/**
 * Second-pass verification: a separate call solves each generated question
 * independently and reports the letter it derives. Questions whose stored key
 * disagrees with the independent solve are DROPPED before the student ever
 * sees them (this catches the classic failure where the explanation argues
 * for choice A but correctChoiceId says B).
 */
export function answerKeyAuditPrompt(questions: MCQ[], pdfText: string): string {
  const rendered = questions
    .map(
      (q) =>
        `id: ${q.id}\nQ: ${q.question}\n${q.choices.map((c) => `${c.id}: ${c.text}`).join("\n")}`,
    )
    .join("\n\n");
  return `You are auditing the answer key of a quiz. For EACH question below, solve it yourself using ONLY the source document, and report the letter (A-D) of the choice YOU determine to be correct.

Rules:
- Derive every answer independently. Do NOT try to guess what the quiz author intended.
- For numeric or computational questions, compute step by step before choosing.
- If the document does not clearly support any choice, pick the most defensible one.

QUESTIONS:
${rendered}

SOURCE DOCUMENT:
"""
${clampDoc(pdfText)}
"""`;
}

// ─── Summarizer (LLM narrates already-computed stats) ────────────────────────

export function summaryPrompt(lessonTitle: string, stats: LessonStats): string {
  return `You are a supportive learning coach. Turn these quiz statistics into a short performance report for the lesson "${lessonTitle}". Be honest but encouraging; never shame retries or hints — they are how mastery learning works.

STATS (already computed — do not recompute, just narrate):
${JSON.stringify(stats, null, 2)}

Produce:
- headline: one sentence overall assessment.
- objectiveBreakdown: one sentence per objective (use the objective titles).
- studyTips: exactly 3 tips, each tied to a SPECIFIC weak objective or error pattern visible in the stats (e.g. "You needed two tries on X — revisit ..."). Reference the actual objective topics; generic advice like "study more" is banned.
- encouragement: one closing line.`;
}
