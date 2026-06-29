/* Pure parsing helpers — no DOM, no shared state. Unit-tested in test/. */

/** Parse EMDB plain-text (PDF) export into a movie array. */
export function parseEMDB(text) {
  var mv = [];

  text = text
    .replace(/EMDB[^\n]*\n\nStrana\s+\d+\s*\/\s*\d+\n\n/g, '')
    .replace(/EMDB[^\n]*\nPage\s+\d+\s+of\s+\d+[^\n]*/g, '')
    .replace(/Vytlacene[^\n]+/g, '')
    .replace(/Printed[^\n]+/g, '');

  var lines = text.split('\n');
  var i = 0;

  var entryRe = /^(\d+)\s*:\s*(.+?)\s*\((\d{4})\)\s*$/;

  while (i < lines.length) {
    var raw = lines[i];
    var l = raw.trim();
    var m = l.match(entryRe);

    if (!m && i + 1 < lines.length) {
      var joined = l + ' ' + lines[i + 1].trim();
      m = joined.match(entryRe);
      if (m) i++;
    }

    if (m) {
      var num = parseInt(m[1]);
      var title = m[2].trim();
      var year = parseInt(m[3]);

      var metaRaw = (lines[i + 1] || '').trim();
      var genres = [], country = '', dur = '';

      if (metaRaw.indexOf(' - ') > -1) {
        var pts = metaRaw.split(' - ');
        genres = pts[0].split(',').map(function (g) { return g.trim(); }).filter(Boolean);
        var rest = pts.slice(1).join(' - ');
        var dm = rest.match(/(\d+)\s*min/i);
        if (dm) dur = dm[1] + ' min';
        country = rest.replace(/,?\s*\d+\s*min\w*/i, '').trim().replace(/,\s*$/, '').trim();
      } else if (metaRaw) {
        genres = metaRaw.split(',').map(function (g) { return g.trim(); }).filter(Boolean);
      }

      var dirRaw = (lines[i + 2] || '').trim();
      var dir = dirRaw
        .replace(/^Directed\s+by\s*/i, '')
        .replace(/^Reziser:\s*/i, '')
        .replace(/^Réžia:\s*/i, '')
        .trim();

      var castRaw = (lines[i + 3] || '').trim();
      var cast = castRaw
        .replace(/^Obsadenie:\s*/i, '')
        .replace(/^Cast:\s*/i, '')
        .trim();

      var desc = '';
      var j = i + 4;
      while (j < lines.length && j < i + 12) {
        var nl = lines[j].trim();
        if (nl.match(/^\d+\s*:\s*/)) break;
        if (nl) desc += nl + ' ';
        j++;
      }

      mv.push({
        id: num,
        num: num,
        title: title,
        year: year,
        director: dir,
        cast: cast,
        genres: genres,
        country: country,
        duration: dur,
        description: desc.trim().substring(0, 500),
        poster_thumb: '',
        rating: 0,
        tmdbId: null,
        moods: []
      });

      i = j;
    } else {
      i++;
    }
  }
  return mv;
}

/** Parse a single CSV line, honouring quoted fields and "" escapes. */
export function parseCsvLine(line) {
  var out = [], cur = '', quoted = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Extract a 0–100 percentage from arbitrary CSFD rating text. */
export function parseCsfdPercent(value) {
  if (value == null || value === '') return null;
  var match = String(value).match(/(\d{1,3})/);
  if (!match) return null;
  var n = parseInt(match[1]);
  if (isNaN(n) || n < 0 || n > 100) return null;
  return n;
}
