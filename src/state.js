/* AUTO-SPLIT from app.js. Shared state/functions live on the S namespace. */
export const S = {};

S.APP_VERSION = "6.3.0";
S._scriptCache = {};
S.STAR_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="var(--gold)" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
S.STAR_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
S.EYE_ON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
S.EYE_OFF = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
S.FILM_ICO = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><rect x="2" y="3" width="15" height="18" rx="2"/><path d="M17 7h3l2 4-2 4h-3"/><circle cx="9" cy="12" r="3"/></svg>';
S.all = [];
S.filt = [];
S.favs = new Set();
S.wl = new Set();
S.watched = new Set();
S.watchedDates = {};
S.genre = "";
S.grid = false;
S.posterWall = false;
S.favMode = false;
S.wlMode = false;
S.watchedMode = false;
S.curId = null;
S.fpState = {yearFrom:0,yearTo:0,minRating:0,country:"",genres:[],tag:""};
S.tmdbKey = localStorage.getItem("tmdb_key")||"bfbcf6821a57eed36cb07c1217d4ac1f";
S.omdbKey = localStorage.getItem("omdb_key")||"9ff40e48";
S.SK = "mdb_v5";
S.FK = "mdb_fav5";
S.WK = "mdb_wl1";
S.VK = "mdb_watched1";
S.VDK = "mdb_wdates1";
S.LK = "mdb_live_v3";
S.PK = "mdb_prefs";
S.CSFD_MATCHER_URL_KEY = "mdb_csfd_matcher_url";
S.DEFAULT_CSFD_MATCHER_URL = "https://movie-database-comparator.vercel.app";
S.csfdMatcherUrl = localStorage.getItem(S.CSFD_MATCHER_URL_KEY)||S.DEFAULT_CSFD_MATCHER_URL;
S.liveCache = {};
S.liveRunning = false;
S.tmdbAbortCtrl = null;
S.prefs = {view:"grid",sort:"num",sortDir:"desc"};
S.ratingSource = localStorage.getItem('mdb_ratingsrc')||'tmdb';
S.RATING_LABELS = {tmdb:'TMDB',imdb:'IMDB',csfd:'ČSFD'};
S.fuseInst = null;
S.fuseHighlights = {};
S.ACCENT_KEY = 'mdb_accent';
S.FUSE_OPTS = {
  includeScore:true,
  includeMatches:true,
  minMatchCharLength:2,
  threshold:0.42,        // 0=exact, 1=match anything
  ignoreLocation:true,
  keys:[
    {name:"title",      weight:0.55},
    {name:"director",   weight:0.20},
    {name:"year",       weight:0.10},
    {name:"genres",     weight:0.10},
    {name:"description",weight:0.05}
  ]
};
S.PAGE_SIZE = 40;
S.curPage = 0;
S.chartInstances = {};
S.VIEW_MODES = ['list','grid','posterwall'];
S.VIEW_ICONS = {
  list:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>',
  grid:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
  posterwall:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="1" y="1" width="4" height="6" rx="1"/><rect x="6" y="1" width="4" height="6" rx="1"/><rect x="11" y="1" width="4" height="6" rx="1"/><rect x="1" y="9" width="4" height="6" rx="1"/><rect x="6" y="9" width="4" height="6" rx="1"/><rect x="11" y="9" width="4" height="6" rx="1"/></svg>'
};
S.VIEW_TITLES = {list:'Prepnúť na grid',grid:'Prepnúť na poster wall',posterwall:'Prepnúť na zoznam'};
S.adminPending = null;
S.matchMovieId = null;
S.matchPendingData = null;
S.GH_KEY = 'mdb_gh_token';
S.GH_REPO = 'bucala/Filmy';
S.GH_FILE = 'data.json';
S.GH_LIVE_FILE = 'data-live.json';
S.GH_ETAG_KEY = 'mdb_gh_etags';
S.GH_BRANCH = 'main';
S.AUTO_PULL_KEY = 'mdb_auto_pull';
S.autoPull = localStorage.getItem(S.AUTO_PULL_KEY) !== '0';
S.ghToken = localStorage.getItem('mdb_gh_token') || '';
S._ghPullRunning = false;
S.THEME_KEY = 'mdb_theme1';
S.THEME_ACCENTS = {
  dark:    { gold: '#d4a943', gold2: '#f0c060' },
  slate:   { gold: '#5aabff', gold2: '#88ccff' },
  crimson: { gold: '#e85555', gold2: '#ff8080' },
  forest:  { gold: '#6ac840', gold2: '#98f060' },
  linen:   { gold: '#7a5c18', gold2: '#a07a28' },
  paper:   { gold: '#1a4e7c', gold2: '#2a70b0' },
  // legacy aliases for backwards compatibility
  gold:    { gold: '#d4a943', gold2: '#f0c060' },
  teal:    { gold: '#22ccaa', gold2: '#66ffdd' },
  violet:  { gold: '#cc55ff', gold2: '#ee99ff' }
};
S._autoThemeMq = window.matchMedia('(prefers-color-scheme: dark)');
S.SMB_KEY = 'mdb_smb_base';
S.PLAYER_PROTO_KEY = 'mdb_player_proto';
S.playerProto = localStorage.getItem(S.PLAYER_PROTO_KEY) || 'mpc';
S.PATH_MODE_KEY = 'mdb_path_mode';
S.SMB_URL_MODE_KEY = 'mdb_smb_url_mode';
S.smbBase = localStorage.getItem(S.SMB_KEY) || 'smb://DESKTOP-EGOG348/Movies/';
S.pathMode = localStorage.getItem(S.PATH_MODE_KEY) || 'smb';
S.smbUrlMode = localStorage.getItem(S.SMB_URL_MODE_KEY) || 'proto';
S.SMB_MAP_KEY = 'mdb_smb_map';
S.smbMap = undefined;
S._isAndroid = /android/i.test(navigator.userAgent);
S._isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
S._isMobile = S._isAndroid||S._isiOS;
S.autoPushTimer = null;
S.ghPushInProgress = false;
S.bulkMode = false;
S.bulkSel = new Set();
S.COUNTRY_FLAGS = {
  'usa':'&#127482;&#127480;','united states':'&#127482;&#127480;','us':'&#127482;&#127480;',
  'uk':'&#127468;&#127463;','united kingdom':'&#127468;&#127463;','great britain':'&#127468;&#127463;',
  'france':'&#127467;&#127479;','fr':'&#127467;&#127479;',
  'germany':'&#127465;&#127466;','de':'&#127465;&#127466;',
  'czech republic':'&#127464;&#127487;','cz':'&#127464;&#127487;','czechia':'&#127464;&#127487;',
  'slovakia':'&#127480;&#127472;','sk':'&#127480;&#127472;',
  'italy':'&#127470;&#127481;','japan':'&#127471;&#127477;','spain':'&#127466;&#127480;',
  'south korea':'&#127472;&#127479;','korea':'&#127472;&#127479;','canada':'&#127464;&#127462;',
  'australia':'&#127462;&#127482;','india':'&#127470;&#127475;','china':'&#127464;&#127475;',
  'sweden':'&#127480;&#127466;','denmark':'&#127465;&#127472;','norway':'&#127475;&#127476;',
  'russia':'&#127479;&#127482;','poland':'&#127477;&#127473;','hungary':'&#127469;&#127482;',
  'ireland':'&#127470;&#127466;','belgium':'&#127463;&#127466;','netherlands':'&#127475;&#127473;',
  'new zealand':'&#127475;&#127487;','brazil':'&#127463;&#127479;','mexico':'&#127474;&#127485;',
  'argentina':'&#127462;&#127479;','austria':'&#127462;&#127481;','switzerland':'&#127464;&#127469;',
  'finland':'&#127467;&#127470;','turkey':'&#127481;&#127479;','romania':'&#127479;&#127476;',
  'portugal':'&#127477;&#127481;','thailand':'&#127481;&#127469;','south africa':'&#127487;&#127462;'
};
S.dragSrcId = null;
