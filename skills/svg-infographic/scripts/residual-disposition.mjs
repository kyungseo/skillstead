// Residual disposition — the decision alone, with no I/O and no exit.
//
// Dead space at the bottom of a page is either small enough to be breathing room or large enough
// that the scenario must say why it is there. That decision lives here rather than in the generator
// so it can be exercised at its own boundaries: the floor is crossed by real layouts only by
// accident, and a rule that can only be tested when some TypePack happens to land near it is a rule
// with no test. The caller keeps every message and exit code it had — this module returns them.

// A residual under the floor is breathing room, not undeclared dead space.
export const RESIDUAL_FLOOR = 0.08;
// A declaration is the value that matches the measurement, not a maximum; this is the slack allowed
// between the declared number and the measured one.
export const RESIDUAL_TOL = 8;

// Looking up a residual declaration: a missing treatment (plus calibration) entry, or a differing
// ID, is **fail-closed**. Passing without an entry would reopen "undeclared dead space".
export function residualEntry(decl, treatment, calibration) {
  if (Array.isArray(decl.by_treatment)) {
    const hit = decl.by_treatment.find((e) => e.treatment === treatment
      && (e.calibration === undefined ? calibration === null : e.calibration === calibration));
    if (!hit) return { error: `residual_disposition declares no entry for treatment "${treatment}"${calibration ? ` + calibration "${calibration}"` : ""} — declare the measured value instead of reusing another treatment's` };
    if (!Number.isFinite(Number(hit.bottom))) return { error: `residual_disposition entry for "${treatment}" has no numeric bottom` };
    return { bottom: hit.bottom, calibration: hit.calibration ?? null };
  }
  // A single declaration is for flat only — using it with a treatment on would disagree with the measurement.
  if (treatment !== "flat") return { error: `residual_disposition is declared once (flat only) but treatment "${treatment}" is active — declare it per treatment with by_treatment` };
  // The by_treatment branch checks this; without the same check here a declaration whose entries
  // were emptied falls through to an undefined bottom, and `Math.abs(NaN - measured) > tol` is
  // false — so a malformed declaration would pass the gate by accident.
  if (!Number.isFinite(Number(decl.bottom)))
    return { error: `residual_disposition declares no entry for treatment "${treatment}" with a numeric bottom` };
  return { bottom: decl.bottom, calibration: null };
}

// Returns { disposition } on success (disposition is null when nothing is owed) or { error }.
// Below the floor the declaration is never read at all: there is nothing to compare against, so
// crediting the artifact with an entry — even the right one — would be attributing a check that
// did not happen.
export function residualDisposition({ residual, contentHeight, declaration, treatment, calibration = null }) {
  if (!(residual.bottom > RESIDUAL_FLOOR * contentHeight)) return { disposition: null };
  if (!declaration) {
    return { error: `bottom residual ${residual.bottom}px (${Math.round(100 * residual.bottom / contentHeight)}% of the contentBox) exceeds the ${Math.round(100 * RESIDUAL_FLOOR)}% floor and the scenario declares no residual_disposition — declare it with a reason or choose a preset/variant that fills the page` };
  }
  const want = residualEntry(declaration, treatment, calibration);
  if (want.error) return { error: want.error };
  if (Math.abs(Number(want.bottom) - residual.bottom) > RESIDUAL_TOL) {
    return { error: `declared residual_disposition.bottom ${want.bottom}px does not match the measured ${residual.bottom}px (tol ${RESIDUAL_TOL}px, treatment ${treatment}${want.calibration ? ` + ${want.calibration}` : ""})` };
  }
  return { disposition: { reason: declaration.reason ?? null, treatment,
    calibration: want.calibration ?? null, bottom: Number(want.bottom) } };
}
