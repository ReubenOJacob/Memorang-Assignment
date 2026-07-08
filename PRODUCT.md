# Product

## Register

product

## Users

Two audiences, one surface. Primary: a learner who has a PDF (lecture notes, a chapter, a paper) and wants to actually retain it — they upload, approve a lesson plan, and work through tutored quiz questions in a single sitting at a desk, usually daytime, reading-heavy context. Secondary: a technical reviewer evaluating this as an engineering assignment — they will notice craft, restraint, and interaction details, and will screen-record it (Loom).

## Product Purpose

Turn a static PDF into an interactive, mastery-based lesson: plan → human approval → MCQ loop with hints and explanations → honest performance summary. Success looks like a learner finishing the loop without friction and a reviewer thinking "this feels like a real product, not a demo."

## Brand Personality

Focused, calm, credible. A quiet study companion, not a cheerleader and not a corporate LMS. Feedback moments (correct/incorrect) are the emotional peaks — everything else stays out of the way. Three words: composed, legible, precise.

## Anti-references

- Generic AI-tool aesthetic: purple gradients, glassmorphism, glowing orbs, sparkle iconography, "magic" language.
- Gamified kids-app look: confetti, mascots, XP bars, bouncy oversized buttons.
- Flat unthemed dark mode (the failure mode this document exists to prevent): near-black voids with floating gray boxes.

## Design Principles

1. **Paper first.** Light is the only theme — this is a reading and studying surface, and it must look identical on every machine and in every screen recording, regardless of OS theme.
2. **Feedback is the product.** Green/red grading moments, hints, and explanations get the strongest color and motion; chrome gets almost none.
3. **One accent, spent carefully.** A single warm accent carries progress and action; correctness semantics (green/red) are reserved for grading only.
4. **Motion informs, never performs.** Transitions confirm state changes (answer graded, plan approved); nothing animates for decoration.
5. **The demo is a screen recording.** Every state (empty, loading, error, retry) must look composed when paused on a random frame.

## Accessibility & Inclusion

WCAG AA contrast targets. Correctness never communicated by color alone (icons + text always pair with green/red). Native radio semantics in the quiz widget with visible focus rings. Respect prefers-reduced-motion: all nonessential animation collapses to opacity changes.
