/* Pure directional-navigation scoring — no DOM. Unit-tested in test/.
   Extracted from tv.js's pick() so the D-pad geometry math (exactly the
   area that caused the Settings toggle unreachability bug) can be tested
   with plain fixture coordinates instead of a real layout. */

/* candidates: { x, y, rect? }. With a source rect, compare edge distances:
   a wide button directly below must not lose to a later, narrower button
   just because its center is farther sideways. Point-only callers retain
   their original scoring. Returns the original candidate or null. */
export function nearestInDirection(dir, cx, cy, candidates, sourceRect) {
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
    if (sourceRect && c.rect) {
      var s = sourceRect, r = c.rect;
      var sr = s.left + s.width, sb = s.top + s.height;
      var rr = r.left + r.width, rb = r.top + r.height;
      if (dir === 'down' || dir === 'up') {
        primary = Math.max(0, dir === 'down' ? r.top - sb : s.top - rb);
        cross = Math.max(0, r.left - sr, s.left - rr);
        // Different-height controls on one row are not vertical neighbors
        // just because their centers differ.
        if (cross > 0 && Math.min(sb, rb) - Math.max(s.top, r.top) > Math.min(s.height, r.height) / 2) continue;
      } else {
        primary = Math.max(0, dir === 'right' ? r.left - sr : s.left - rr);
        cross = Math.max(0, r.top - sb, s.top - rb);
        if (cross > 0 && Math.min(sr, rr) - Math.max(s.left, r.left) > Math.min(s.width, r.width) / 2) continue;
      }
    }
    // Weight cross-axis so we prefer elements aligned with the travel direction.
    var score = primary + cross * 2;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}
