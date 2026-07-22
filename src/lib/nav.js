/* Pure directional-navigation scoring — no DOM. Unit-tested in test/.
   Extracted from tv.js's pick() so the D-pad geometry math (exactly the
   area that caused the Settings toggle unreachability bug) can be tested
   with plain fixture coordinates instead of a real layout. */

/* candidates: array of { x, y } centers. Returns the winning candidate
   object (same reference passed in), or null if none lie in that direction. */
export function nearestInDirection(dir, cx, cy, candidates) {
  var best = null, bestScore = Infinity;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var dx = c.x - cx, dy = c.y - cy;
    var primary, cross;
    if (dir === 'right') { if (dx <= 1) continue; primary = dx; cross = Math.abs(dy); }
    else if (dir === 'left') { if (dx >= -1) continue; primary = -dx; cross = Math.abs(dy); }
    else if (dir === 'down') { if (dy <= 1) continue; primary = dy; cross = Math.abs(dx); }
    else if (dir === 'up') { if (dy >= -1) continue; primary = -dy; cross = Math.abs(dx); }
    else continue;
    // Weight cross-axis so we prefer elements aligned with the travel direction.
    var score = primary + cross * 2;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}
