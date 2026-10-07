/** Harness / WordPress HTML: labeled bullet lists must use <strong>, never markdown bold. */
export const HARNESS_LABELED_LIST_HTML_RULE = `**LABELED LIST (HTML ONLY — NON-NEGOTIABLE)**:
- Labeled bullets: <ul><li><strong>Label</strong>: one complete sentence.</li></ul> or numbered steps <ol><li><strong>Step label</strong>: one sentence.</li></ol>.
- Correct example: <ul><li><strong>Extreme Temperature Variations</strong>: Honeycomb cells help insulate against cold drafts.</li></ul>
- Forbidden in published HTML: **Label**: or **Label** before a colon, markdown - bullets, markdown 1. lists, or asterisk bold anywhere in list items.
- Every list item that opens with a short label phrase MUST wrap that label in <strong>…</strong> immediately followed by a colon, then the sentence. Never output raw ** characters in HTML.`;
