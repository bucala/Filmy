import { beforeEach, describe, expect, it, vi } from 'vitest';
import { esc } from '../src/lib/text.js';

vi.mock('../src/state.js', () => ({ S: {} }));
import { S } from '../src/state.js';
import '../src/render.js';

const movie = {
  id: 7, num: 7, title: 'Film', year: 2024, duration: '110 min', genres: ['Dráma'],
  director: 'Director', cast: 'First Actor, Second Actor, Third Actor, Fourth Actor',
  _pctCsfd: 84
};
beforeEach(() => {
  Object.assign(S, {
    favs: new Set(), liveCache: {}, grid: false, posterWall: false, bulkMode: false, copyMode: false,
    ratingSource: 'csfd', RATING_LABELS: { csfd: 'ČSFD' }, STAR_OFF: '*', FILM_ICO: '',
    hlField: (m, field) => esc(m[field] || ''), getMoviePct: m => m._pctCsfd
  });
});

describe('movie card metadata', () => {
  it.each(['list', 'grid', 'posterwall'])('shows three actors below the director in %s view', view => {
    S.grid = view === 'grid'; S.posterWall = view === 'posterwall';
    const html = S.cardHTML(movie);
    for (const actor of ['First Actor', 'Second Actor', 'Third Actor']) expect(html).toContain(actor);
    expect(html).not.toContain('Fourth Actor');
    expect(html.indexOf('Director')).toBeLessThan(html.indexOf('First Actor'));
  });
  it('escapes cast names in both text and tooltip attributes', () => {
    S.grid = true;
    const html = S.cardHTML({ ...movie, cast: 'Actor <script>, "Quoted", A & B, Fourth Actor' });
    expect(html).toContain('Actor &lt;script&gt;, &quot;Quoted&quot;, A &amp; B');
    expect(html).not.toContain('<script>');
  });
  it('omits the cast row when no actors are known and uses the selected ČSFD rating', () => {
    S.grid = true;
    const html = S.cardHTML({ ...movie, cast: '' });
    expect(html).not.toContain('class="ccast"');
    expect(html).toContain('ČSFD');
    expect(html).toContain('84%');
  });
});
