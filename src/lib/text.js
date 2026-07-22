/* Pure text/string helpers — no DOM, no shared state. Unit-tested in test/. */

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function hexDim(hex) {
  try {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = Math.round(r * .38); g = Math.round(g * .38); b = Math.round(b * .38);
    return '#' + [r, g, b].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  } catch (e) { return '#6b5220'; }
}

export function removeDiacritics(str) {
  var map = {
    'á': 'a', 'Á': 'A', 'č': 'c', 'Č': 'C', 'ď': 'd', 'Ď': 'D', 'é': 'e', 'É': 'E',
    'ě': 'e', 'Ě': 'E', 'í': 'i', 'Í': 'I', 'ň': 'n', 'Ň': 'N', 'ó': 'o', 'Ó': 'O',
    'ö': 'o', 'Ö': 'O', 'ř': 'r', 'Ř': 'R', 'š': 's', 'Š': 'S', 'ť': 't', 'Ť': 'T',
    'ú': 'u', 'Ú': 'U', 'ů': 'u', 'Ů': 'U', 'ü': 'u', 'Ü': 'U', 'ý': 'y', 'Ý': 'Y',
    'ž': 'z', 'Ž': 'Z', 'ä': 'a', 'Ä': 'A', 'ľ': 'l', 'Ľ': 'L', 'ĺ': 'l', 'Ĺ': 'L',
    'ŕ': 'r', 'Ŕ': 'R', 'ô': 'o', 'Ô': 'O', 'ë': 'e', 'ï': 'i', 'ñ': 'n', 'ç': 'c',
    'à': 'a', 'â': 'a', 'è': 'e', 'ê': 'e', 'ì': 'i', 'î': 'i', 'ò': 'o', 'ù': 'u', 'û': 'u'
  };
  return str.replace(/[^\x00-\x7F]/g, function (ch) { return map[ch] || ch; });
}

export function buildMovieFilename(m) {
  var title = removeDiacritics(m.title || '');
  title = title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
  return (m.year || '0000') + ' - ' + title + '.mkv';
}

/* Builds a responsive srcset from a TMDB "w<N>/<path>" poster/backdrop
   URL, letting the browser pick the best-fitting size instead of always
   downloading whatever fixed size happens to be stored. Returns '' for
   non-TMDB URLs (data: URIs, "original" size, empty/missing posters). */
export function tmdbSrcset(url) {
  var m = /^(https:\/\/image\.tmdb\.org\/t\/p\/)w\d+(\/.+)$/.exec(url || '');
  if (!m) return '';
  var base = m[1], path = m[2];
  return [92, 154, 185, 342, 500].map(function (w) { return base + 'w' + w + path + ' ' + w + 'w'; }).join(', ');
}

export function normalizeSlashes(s) {
  return s.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
}

export function levenshtein(a, b, maxDist) {
  var m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  if (Math.abs(m - n) > (maxDist || Infinity)) return Math.abs(m - n);
  if (m < n) { var t = a; a = b; b = t; t = m; m = n; n = t; }
  var prev = [], curr = [];
  for (var j = 0; j <= n; j++) prev[j] = j;
  for (var i = 1; i <= m; i++) {
    curr[0] = i;
    var rowMin = i;
    for (j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1]
        : Math.min(prev[j - 1], prev[j], curr[j - 1]) + 1;
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (maxDist && rowMin > maxDist) return maxDist + 1;
    var tmp = prev; prev = curr; curr = tmp;
  }
  return prev[n];
}
