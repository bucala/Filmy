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

/** Parse a single CSV line, honouring quoted fields and "" escapes.
    delim defaults to ',' — pass ';' for semicolon-delimited exports. */
export function parseCsvLine(line, delim) {
  delim = delim || ',';
  var out = [], cur = '', quoted = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delim && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Whichever of ; or , appears more often in the header line wins — EMDB's
    CSV export uses ; (Central European Excel convention). */
function detectCsvDelimiter(headerLine) {
  var semi = (headerLine.match(/;/g) || []).length;
  var comma = (headerLine.match(/,/g) || []).length;
  return semi > comma ? ';' : ',';
}

/**
 * Parse an EMDB desktop-app "export movie(s) to CSV" file into an array of
 * sparse movie objects: { num, title, year, country, genres, _localPath,
 * director:'', cast:'', duration:'', description:'', poster_thumb:'',
 * rating:0, tmdbId:null, moods:[] } — the blank/zero fields mirror parseEMDB's
 * skeleton so a CSV-sourced new movie behaves like a PDF/ZIP-sourced one.
 *
 * Column order/naming and the delimiter (; or ,) can vary between EMDB
 * versions and export configurations, so columns are resolved by matching
 * known header substrings (Slovak/Czech/English), falling back to the
 * observed default layout (č.;Obal;Titul;Rok;Štát;Žánre;Umiestnenie) when a
 * name can't be matched. The "Obal" (cover) column is intentionally ignored
 * — posters come from TMDB, not from this export.
 *
 * The result is designed to be merged via the existing mergeFields logic in
 * S.handleFileUpdate (settings.js), which only overwrites a field when the
 * new value is non-blank — so leaving a column out of the export is safe.
 */
export function parseEmdbCsv(text) {
  var noBom = String(text || '');
  if (noBom.charCodeAt(0) === 0xFEFF) noBom = noBom.slice(1);
  var lines = noBom.split(/\r?\n/).filter(function (l) { return l.trim(); });
  if (!lines.length) return [];

  var delim = detectCsvDelimiter(lines[0]);
  var header = parseCsvLine(lines[0], delim).map(function (c) { return c.trim().toLowerCase(); });

  function col(names, fallback) {
    for (var i = 0; i < header.length; i++) {
      for (var n = 0; n < names.length; n++) {
        if (header[i].indexOf(names[n]) >= 0) return i;
      }
    }
    return fallback;
  }

  var numIdx     = col(['č.', 'čís', 'cislo', 'poradie', '#'], 0);
  var titleIdx   = col(['titul', 'název', 'nazov', 'title'], 2);
  var yearIdx    = col(['rok', 'year'], 3);
  var countryIdx = col(['štát', 'stat', 'krajina', 'country'], 4);
  var genreIdx   = col(['žáner', 'zaner', 'žánre', 'genre'], 5);
  var pathIdx    = col(['umiestnenie', 'cesta', 'path', 'location'], 6);

  var hasHeader = header.some(function (h) {
    return h.indexOf('titul') >= 0 || h.indexOf('název') >= 0 || h.indexOf('nazov') >= 0 || h.indexOf('title') >= 0 ||
           h.indexOf('rok') >= 0 || h.indexOf('year') >= 0 ||
           h.indexOf('umiestnenie') >= 0 || h.indexOf('cesta') >= 0 || h.indexOf('location') >= 0;
  });
  var start = hasHeader ? 1 : 0;

  var out = [];
  for (var i = start; i < lines.length; i++) {
    var cols = parseCsvLine(lines[i], delim);
    var num = parseInt(cols[numIdx], 10);
    if (isNaN(num)) continue;
    var year = parseInt(cols[yearIdx], 10);
    var genres = (cols[genreIdx] || '').split(',').map(function (g) { return g.trim(); }).filter(Boolean);

    out.push({
      num: num,
      title: (cols[titleIdx] || '').trim(),
      year: isNaN(year) ? 0 : year,
      country: (cols[countryIdx] || '').trim(),
      genres: genres,
      _localPath: (cols[pathIdx] || '').trim(),
      director: '', cast: '', duration: '', description: '', poster_thumb: '',
      rating: 0, tmdbId: null, moods: []
    });
  }
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
