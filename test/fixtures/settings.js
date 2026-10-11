export function settingsFixture(overrides = {}) {
  return {
    preferences: { view: 'posterwall', sort: 'pct', sortDir: 'asc', showRecent: true, autoPush: false },
    theme: 'forest', accent: { gold: '#123abc', gold2: '#789def' }, ratingSource: 'csfd',
    tmdbKey: 'test-tmdb', omdbKey: 'test-omdb', githubToken: 'test-token', autoPull: false,
    playerProto: 'portable', androidPlayer: 'mxplayer', pathMode: 'smb', smbUrlMode: 'raw',
    smbBase: 'smb://media/Filmy/', smbMap: { 'W:\\Movies\\': 'smb://media/Filmy/' },
    smbSources: [{ name: 'Filmy', url: 'smb://media/Filmy/' }, { name: 'NAS', url: 'smb://nas/Movies/' }],
    portableMode: 'vlc', portableMpcPath: 'C:\\Portable\\mpc-hc.exe', portableVlcPath: 'C:\\Portable\\vlc.exe',
    csfdMatcherUrl: 'https://matcher.example', debugMode: true,
    ...overrides
  };
}

export function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values, writes: [],
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { values.set(key, String(value)); this.writes.push(key); },
    removeItem(key) { values.delete(key); this.writes.push(key); }
  };
}
