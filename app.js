(function(){
"use strict";
var APP_VERSION = "6.3.0"; console.log("[FilmDB] v" + APP_VERSION + " loaded ✅");
var _scriptCache={};
function loadScript(url){
  if(_scriptCache[url])return _scriptCache[url];
  _scriptCache[url]=new Promise(function(ok,fail){
    var s=document.createElement("script");s.src=url;
    s.onload=ok;s.onerror=function(){delete _scriptCache[url];fail(new Error("Nepodarilo sa načítať: "+url));};
    document.head.appendChild(s);
  });
  return _scriptCache[url];
}
function loadPdfJs(){
  return loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js").then(function(){
    pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  });
}
function loadJSZip(){return loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");}
function loadChartJs(){return loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js");}

/* ── SVG icon constants — avoids duplication across cardHTML, openDet ── */
var STAR_ON  = '<svg viewBox="0 0 24 24" width="18" height="18" fill="var(--gold)" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
var STAR_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
var EYE_ON   = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
var EYE_OFF  = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
var FILM_ICO = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4"><rect x="2" y="3" width="15" height="18" rx="2"/><path d="M17 7h3l2 4-2 4h-3"/><circle cx="9" cy="12" r="3"/></svg>';
var all=[],filt=[],favs=new Set(),wl=new Set(),watched=new Set(),watchedDates={},genre="",grid=false,posterWall=false,favMode=false,wlMode=false,watchedMode=false,curId=null;

/* fpState declared here (with other global state) so applyFilters() can safely
   reference it during init(), before the Filter Panel module code runs.
   The full module with openFp/closeFp etc. is defined later in the file. */


/* ══════════════════════════════════════════════════════════
   MODULE: Config & State
   Global constants, storage keys, and runtime state variables.
   ══════════════════════════════════════════════════════════ */
var fpState={yearFrom:0,yearTo:0,minRating:0,country:"",genres:[],tag:""};
function fpActiveCount(){var n=0;if(fpState.yearFrom>0)n++;if(fpState.yearTo>0)n++;if(fpState.minRating>0)n++;if(fpState.country)n++;if(fpState.genres.length>0)n++;if(fpState.tag)n++;return n;}
var tmdbKey=localStorage.getItem("tmdb_key")||"bfbcf6821a57eed36cb07c1217d4ac1f";
var omdbKey=localStorage.getItem("omdb_key")||"9ff40e48";
var SK="mdb_v5",FK="mdb_fav5",WK="mdb_wl1",VK="mdb_watched1",VDK="mdb_wdates1",LK="mdb_live_v3",PK="mdb_prefs";
var CSFD_MATCHER_URL_KEY="mdb_csfd_matcher_url";
var DEFAULT_CSFD_MATCHER_URL="https://movie-database-comparator.vercel.app";
var csfdMatcherUrl=localStorage.getItem(CSFD_MATCHER_URL_KEY)||DEFAULT_CSFD_MATCHER_URL;
var liveCache={},liveRunning=false;
var tmdbAbortCtrl = null; // AbortController for TMDB batch
var prefs={view:"grid",sort:"num",sortDir:"desc"};
var ratingSource=localStorage.getItem('mdb_ratingsrc')||'tmdb';

function getMoviePct(m){
  if(ratingSource==='imdb'){return m._pctImdb!=null?m._pctImdb:null;}
  if(ratingSource==='csfd'){return m._pctCsfd!=null?m._pctCsfd:null;}
  var c=liveCache[m.id];return c&&c.pct!=null?c.pct:null;
}
var RATING_LABELS={tmdb:'TMDB',imdb:'IMDB',csfd:'ČSFD'};



/* ══════════════════════════════════════════════════════════
   MODULE: Bootstrap — app initialization
   ══════════════════════════════════════════════════════════ */
function init(){
  // Apply all visual layers early — prevents flash of unstyled content
  var _t=localStorage.getItem('mdb_theme1')||'dark';
  document.documentElement.setAttribute('data-skin',_t);
  document.documentElement.setAttribute('data-theme',_t);
  loadLiveCache();loadPrefs();
  var saved=null;
  try{var s=localStorage.getItem(SK);if(s){saved=JSON.parse(s);
    // Empty array [] is the clearAll sentinel — treat as intentionally empty DB
    if(!saved)saved=null;
    else if(!saved.length){saved=null;localStorage.setItem("mdb_empty","1");}
  }}catch(e){}
  if(saved){
    saved.forEach(function(m){m.year=parseInt(m.year)||0;});
  }
  var empty=localStorage.getItem("mdb_empty")==="1";
  all=empty?[]:(saved||[]);
  // Restore poster URLs from liveCache for movies that lost base64 posters
  all.forEach(function(m){
    if((!m.poster_thumb||m.poster_thumb.length<10)&&liveCache[m.id]&&liveCache[m.id].posterUrl){
      m.poster_thumb=liveCache[m.id].posterUrl;
    }
  });
  if(!saved&&!empty&&all.length>0)try{
    // First-time save: strip base64 posters, keep URL posters
    var toSave=all.map(function(m){
      var c=Object.assign({},m);
      if(c.poster_thumb&&c.poster_thumb.indexOf('data:')===0)c.poster_thumb='';
      return c;
    });
    safeSave(SK,JSON.stringify(toSave));
  }catch(e){}
  try{favs=new Set(JSON.parse(localStorage.getItem(FK)||"[]"));}catch(e){}
  try{wl=new Set(JSON.parse(localStorage.getItem(WK)||"[]"));}catch(e){}
  try{watched=new Set(JSON.parse(localStorage.getItem(VK)||"[]"));}catch(e){}
  try{watchedDates=JSON.parse(localStorage.getItem(VDK)||"{}");}catch(e){}
  if(tmdbKey&&!localStorage.getItem("tmdb_key"))localStorage.setItem("tmdb_key",tmdbKey);
  document.getElementById("loadSt").style.display="none";
  buildFuse();
  renderAll();
  // Auto-pull from GitHub on startup if enabled and token is set
  if (autoPull && typeof ghPull === "function") {
    setTimeout(function() {
      ghSetStatus("Automatické načítanie z GitHubu…", "info");
      ghPull();
    }, 800);
  }
}



/* ══════════════════════════════════════════════════════════
   MODULE: Storage — localStorage helpers
   ══════════════════════════════════════════════════════════ */
function validateLiveCache(obj){
  if(!obj||typeof obj!=="object"||Array.isArray(obj))return{};
  var clean={};
  Object.keys(obj).forEach(function(k){
    var v=obj[k];
    if(v&&typeof v==="object"&&!Array.isArray(v)&&(v.pct!=null||v.ytKey||v.posterUrl))clean[k]=v;
  });
  return clean;
}
function loadLiveCache(){
  if(typeof PREBAKED_LIVE!=="undefined"&&Object.keys(PREBAKED_LIVE).length>0){
    liveCache=validateLiveCache(PREBAKED_LIVE);try{localStorage.setItem(LK,JSON.stringify(liveCache));}catch(e){}return;
  }
  try{var r=localStorage.getItem(LK);if(r)liveCache=validateLiveCache(JSON.parse(r));}catch(e){liveCache={};}
}
function saveLiveCache(){try{localStorage.setItem(LK,JSON.stringify(liveCache));}catch(e){}}
function saveAllData(){
  saveLiveCache();
  try{
    var toSave=all.map(function(m){
      var c=Object.assign({},m);
      if(c.poster_thumb&&c.poster_thumb.indexOf("data:")===0) c.poster_thumb="";
      return c;
    });
    safeSave(SK,JSON.stringify(toSave));
  }catch(e){}
}

function safeSave(key,val){
  try{localStorage.setItem(key,val);}
  catch(e){if(e.name==='QuotaExceededError')toast('Úložisko je plné — niektoré dáta sa neuložili');console.warn('localStorage save failed:',key,e);}
}

function loadPrefs(){
  try{var p=localStorage.getItem(PK);if(p)prefs=Object.assign(prefs,JSON.parse(p));}catch(e){}
  // Migrate old sort values to new "pct"
  if(prefs.sort==="ratingTmdb"||prefs.sort==="ratingImdb")prefs.sort="pct";
  // Validate sort value exists in dropdown
  var validSorts=["num","title","year","pct","dur"];
  if(validSorts.indexOf(prefs.sort)<0)prefs.sort="num";
  savePrefs();
  grid=(prefs.view==="grid");
  posterWall=(prefs.view==="posterwall");
  {var _iv=prefs.view||'list';var ml=document.getElementById("mlist");var vt=document.getElementById("viewTog");
    if(ml)ml.className=posterWall?'mlist posterwall':grid?'mlist grid':'mlist';
    if(vt){vt.innerHTML=VIEW_ICONS[_iv]||VIEW_ICONS.list;vt.title=VIEW_TITLES[_iv]||'';}
  }
  document.getElementById("sortSel").value=prefs.sort||"num";
  updateSortDirBtn(); if(typeof syncSortPill==="function") syncSortPill();
}
function savePrefs(){try{localStorage.setItem(PK,JSON.stringify(prefs));}catch(e){}}
function updateSortDirBtn(){syncSortPill();}



/* ══════════════════════════════════════════════════════════
   MODULE: Render Pipeline — list, cards, chips
   ══════════════════════════════════════════════════════════ */
function renderAll(){
  buildChips();
  // Fuse index is rebuilt only when data changes.
  applyFilters();
}

function buildChips(){
  var gc={};
  all.forEach(function(m){(m.genres||[]).forEach(function(g){gc[g]=(gc[g]||0)+1;});});
  var sorted=Object.entries(gc).sort(function(a,b){return b[1]-a[1];});
  var bar=document.getElementById("fbar");
  if(!bar)return; // null-guard: fbar hidden in UI but must exist in DOM
  bar.innerHTML="";
  var ca=document.createElement("div");ca.className="chip"+((!genre&&!favMode)?" active":"");
  ca.id="chipAll";ca.textContent="Vsetky";
  ca.addEventListener("click",function(){setGenre("",ca);});bar.appendChild(ca);
  sorted.forEach(function(e){
    var g=e[0],cnt=e[1];var ch=document.createElement("div");
    ch.className="chip"+(genre===g?" active":"");ch.textContent=g+" ("+cnt+")";
    ch.addEventListener("click",function(){setGenre(g,ch);});bar.appendChild(ch);
  });
}
function setGenre(g,el){
  genre=g;favMode=false;
  // Sync fbar click → fpState: single-genre shortcut
  fpState.genres = g ? [g] : [];
  updateFpBadge();
  updateFpPills();
  document.getElementById("btnFav").className="hdr-act hdr-act-fav";
  document.querySelectorAll(".chip").forEach(function(c){c.classList.remove("active");});
  if(el)el.classList.add("active");applyFilters();
}

// Fuse.js instance — rebuilt when data changes
var fuseInst=null;
// Map: movie id -> {field -> [{start,end}]} highlight ranges from last fuzzy search
var fuseHighlights={};

/* ── ACCENT COLOR ── */
/* ══════════════════════════════════════════════════════════════════
   MODULE: 3-Level Color System
   Level 1 — applyTheme()       : full palette (bg+text+accent) via data-theme
   Level 2a — applyAccentColor(): accent text color (--gold/--gold2/--gold-dim)
   Level 2b — applyTextPalette(): text warmth (--text/--text2/--text3) via data-text
   Level 3  — applyBgPalette()  : background (--bg/--card/--border) via data-bg
   ══════════════════════════════════════════════════════════════════ */

var ACCENT_KEY  = 'mdb_accent';



/* ── Level 2a: Accent / text highlight color ─────────────────── */


/* ══════════════════════════════════════════════════════════
   MODULE: Theme & Skins
   ══════════════════════════════════════════════════════════ */
function applyAccentColor(gold, gold2) {
  document.documentElement.style.setProperty('--gold',  gold);
  document.documentElement.style.setProperty('--gold2', gold2);
  document.documentElement.style.setProperty('--gold-dim', hexDim(gold));
  try { localStorage.setItem(ACCENT_KEY, JSON.stringify({gold:gold,gold2:gold2})); } catch(e) {}
  document.querySelectorAll('.color-swatch').forEach(function(s) {
    s.classList.toggle('active', s.dataset.gold === gold);
  });
}

function hexDim(hex) {
  try {
    var r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    r=Math.round(r*.38); g=Math.round(g*.38); b=Math.round(b*.38);
    return '#'+[r,g,b].map(function(v){return v.toString(16).padStart(2,'0');}).join('');
  } catch(e) { return '#6b5220'; }
}


/* ── Init: restore all 3 levels from localStorage ───────────── */
function initColorPicker() {
  // L2a: accent color
  try {
    var acc = localStorage.getItem(ACCENT_KEY);
    if (acc) { var a = JSON.parse(acc); applyAccentColor(a.gold, a.gold2); }
    else      { applyAccentColor('#d4a943', '#f0c060'); }
  } catch(e)  { applyAccentColor('#d4a943', '#f0c060'); }

  // Text/BG palettes removed — unified into skin system

  // ── Accent swatch clicks ──────────────────────────────────────
  document.querySelectorAll('.color-swatch').forEach(function(s) {
    s.addEventListener('click', function() {
      applyAccentColor(s.dataset.gold, s.dataset.gold2);
      var cc = document.getElementById('colorCustom');
      if (cc) cc.value = s.dataset.gold;
    });
  });

  // ── Custom color input ────────────────────────────────────────
  var cc = document.getElementById('colorCustom');
  if (cc) {
    cc.addEventListener('input', function() {
      var h = this.value;
      try {
        var r=parseInt(h.slice(1,3),16), g=parseInt(h.slice(3,5),16), b=parseInt(h.slice(5,7),16);
        var r2=Math.min(255,Math.round(r*1.3+30)),
            g2=Math.min(255,Math.round(g*1.3+30)),
            b2=Math.min(255,Math.round(b*1.3+30));
        var h2='#'+[r2,g2,b2].map(function(v){return v.toString(16).padStart(2,'0');}).join('');
        applyAccentColor(h, h2);
        document.querySelectorAll('.color-swatch').forEach(function(s){s.classList.remove('active');});
      } catch(e) {}
    });
  }


}



/* ══════════════════════════════════════════════════════════
   MODULE: Search — Fuse.js fuzzy search + highlighting
   ══════════════════════════════════════════════════════════ */
var FUSE_OPTS={
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
function buildFuse(){
  fuseInst=new Fuse(all,FUSE_OPTS);
}



/* ══════════════════════════════════════════════════════════
   MODULE: Filters — genre chips, year, rating, country
   ══════════════════════════════════════════════════════════ */
function applyFilters(){
  const raw=(document.getElementById("srchInp")||{}).value||"";
  const q=raw.trim();
  const badge=document.getElementById("srchModeBadge");
  fuseHighlights={};

  const pool=all.filter(m=>{
    if(favMode&&!favs.has(m.id))return false;
    if(wlMode&&!wl.has(m.id))return false;
    if(watchedMode&&!watched.has(m.id))return false;
    if(fpState.genres.length>0){
      if(!fpState.genres.some(g=>(m.genres||[]).includes(g)))return false;
    }
    if(fpState.yearFrom>0&&(m.year||0)<fpState.yearFrom)return false;
    if(fpState.yearTo>0&&(m.year||0)>fpState.yearTo)return false;
    if(fpState.minRating>0){
      const pct=getMoviePct(m);
      if(pct===null||pct<fpState.minRating)return false;
    }
    if(fpState.country){
      if(!(m.country||"").toLowerCase().includes(fpState.country.toLowerCase()))return false;
    }
    if(fpState.tag){
      if(!(m._tags||[]).some(function(t){return t.toLowerCase().includes(fpState.tag.toLowerCase());}))return false;
    }
    return true;
  });

  let list;
  if(!q){
    list=pool;
    if(badge){badge.className="srch-mode-badge";badge.textContent="";}
  } else {
    const ql=q.toLowerCase();
    const exactMatches=pool.filter(m=>
      (m.title||"").toLowerCase().includes(ql)||
      (m.director||"").toLowerCase().includes(ql)||
      String(m.year||"").includes(ql)||
      (m.genres||[]).join(" ").toLowerCase().includes(ql)||
      (m._tags||[]).join(" ").toLowerCase().includes(ql)
    );
    if(exactMatches.length>0){
      list=exactMatches;
      if(badge){badge.className="srch-mode-badge exact";badge.textContent="PRESNE";}
      exactMatches.forEach(m=>{fuseHighlights[m.id]=buildExactHighlights(m,ql);});
    } else {
      if(!fuseInst)buildFuse();
      var noFilters=!favMode&&!wlMode&&!watchedMode&&fpActiveCount()===0;
      var searchInst=noFilters?fuseInst:new Fuse(pool,FUSE_OPTS);
      const results=searchInst.search(q);
      list=results.map(r=>r.item);
      if(badge){badge.className="srch-mode-badge fuzzy";badge.textContent="FUZZY ~";}
      results.forEach(r=>{fuseHighlights[r.item.id]=parseFuseMatches(r.matches);});
    }
  }

  sortList(list);
  filt=list;
  renderList(list);
  const fpN=fpActiveCount();
  const modeActive=q||favMode||wlMode||watchedMode||fpN>0;
  let label=modeActive?`${list.length} z ${all.length} filmov`:`${all.length} filmov`;
  if(wlMode&&!q&&!fpN)label=`Watchlist: ${list.length} filmov`;
  if(favMode&&!q&&!fpN)label=`Obľúbené: ${list.length} filmov`;
  if(watchedMode&&!q&&!fpN)label=`Videné: ${list.length} filmov`;
  const rc=document.getElementById("resCnt"); if(rc)rc.textContent=label;
}

/** Build highlight ranges for exact substring match */
function buildExactHighlights(m,ql){
  var out={};
  ["title","director"].forEach(function(f){
    var val=(m[f]||"").toLowerCase();
    var idx=val.indexOf(ql);
    if(idx>=0)out[f]=[{start:idx,end:idx+ql.length}];
  });
  return out;
}

/** Convert Fuse.js match indices into our highlight map format */
function parseFuseMatches(matches){
  if(!matches)return{};
  var out={};
  matches.forEach(function(m){
    if(m.indices&&m.indices.length){
      out[m.key]=m.indices.map(function(pair){return{start:pair[0],end:pair[1]+1};});
    }
  });
  return out;
}

/** Apply highlight spans to a plain text string given an array of {start,end} ranges */
function applyHL(text,ranges){
  if(!ranges||!ranges.length)return esc(text);
  // Sort and merge overlapping ranges
  var rs=ranges.slice().sort(function(a,b){return a.start-b.start;});
  var merged=[],cur=rs[0];
  for(var i=1;i<rs.length;i++){
    if(rs[i].start<=cur.end)cur={start:cur.start,end:Math.max(cur.end,rs[i].end)};
    else{merged.push(cur);cur=rs[i];}
  }
  merged.push(cur);
  var out="",pos=0;
  merged.forEach(function(r){
    if(r.start>pos)out+=esc(text.slice(pos,r.start));
    out+='<mark class="fz-hl">'+esc(text.slice(r.start,r.end))+'</mark>';
    pos=r.end;
  });
  if(pos<text.length)out+=esc(text.slice(pos));
  return out;
}

/** Get highlighted HTML for a field of movie m */
function hlField(m,field){
  var val=m[field]||"";
  var hl=fuseHighlights[m.id];
  var ranges=hl&&hl[field]?hl[field]:null;
  return applyHL(val,ranges);
}

/* ── SORT: clean, correct, simple ── */


/* ══════════════════════════════════════════════════════════
   MODULE: Sort
   ══════════════════════════════════════════════════════════ */
function sortList(list){
  var s=prefs.sort||"num";
  var asc=(prefs.sortDir||"desc")==="asc";

  if(s==="pct"){
    var rated=[],unrated=[];
    list.forEach(function(m){
      var p=getMoviePct(m);
      if(p!=null)rated.push(m);
      else unrated.push(m);
    });
    rated.sort(function(a,b){
      var pa=getMoviePct(a);
      var pb=getMoviePct(b);
      if(pa!==pb)return asc?pa-pb:pb-pa;
      return a.num-b.num;
    });
    // Unrated keep original order (sort by num)
    unrated.sort(function(a,b){return a.num-b.num;});
    // Rebuild list in place
    var merged=rated.concat(unrated);
    for(var i=0;i<list.length;i++)list[i]=merged[i];
    return;
  }

  if(s==="title"){
    list.sort(function(a,b){
      var r=a.title.localeCompare(b.title,"sk");
      if(r!==0)return asc?r:-r;
      return (parseInt(b.year)||0)-(parseInt(a.year)||0);
    });
    return;
  }

  if(s==="year"){
    list.sort(function(a,b){
      var ya=parseInt(a.year)||0,yb=parseInt(b.year)||0;
      // desc=newest first, asc=oldest first
      return asc?ya-yb:yb-ya;
    });
    return;
  }

  if(s==="dur"){
    list.sort(function(a,b){
      var da=parseInt(a.duration)||0,db=parseInt(b.duration)||0;
      if(da!==db)return asc?da-db:db-da;
      return a.num-b.num;
    });
    return;
  }

  // num (default)
  list.sort(function(a,b){return asc?a.num-b.num:b.num-a.num;});
}

var PAGE_SIZE=40,curPage=0;
function renderList(list){
  var ml=document.getElementById("mlist"),em=document.getElementById("emptySt"),nr=document.getElementById("noRes");
  if(!ml)return; // guard: DOM not ready
  if(!all.length){
    if(em)em.style.display="flex"; ml.style.display="none"; if(nr)nr.style.display="none";
    return;
  }
  em.style.display="none";
  if(!list.length){
    ml.style.display="none"; if(nr)nr.style.display="flex";
    var q=(document.getElementById("srchInp")||{}).value||"";
    var nrt=document.getElementById("noResTxt");
    if(nrt)nrt.textContent=q?"Nic pre \""+q+"\"":favMode?"Ziadne oblubene":"Ziadne filmy v zanri";
    return;
  }
  nr.style.display="none";ml.style.display=""; ml.className = posterWall ? "mlist posterwall" : (grid ? "mlist grid" : "mlist");
  curPage=0;ml.innerHTML="";
  // FIX2b: Event delegation — one listener replaces per-card listeners (1750+ → 1)
  if(ml._delegated) ml.removeEventListener("click",ml._delegated);
  ml._delegated=function(e){
    var pb=e.target.closest(".cpost-play");
    if(pb){e.preventDefault();e.stopPropagation();var pid=parseInt(pb.closest("[data-id]").dataset.id,10);playMovie(pid);return;}
    var fb=e.target.closest(".cfav,.lfav");
    if(fb){e.stopPropagation();var cid=parseInt(fb.closest("[data-id]").dataset.id,10);togFav(cid,fb);return;}
    var card=e.target.closest("[data-id]");
    if(card){openDet(parseInt(card.dataset.id,10));}
  };
  ml.addEventListener("click",ml._delegated);
  appendCards(list,ml);

  // Scroll listener na mlist (overflow-y:auto) nie na scrnBody (overflow:hidden)
  if(ml._scrollHandler) ml.removeEventListener("scroll",ml._scrollHandler);
  ml._scrollHandler=function(){
    if(ml.scrollTop+ml.clientHeight>=ml.scrollHeight-300){curPage++;appendCards(list,ml);}
  };
  ml.addEventListener("scroll",ml._scrollHandler);
}
function appendCards(list,ml){
  var start=curPage*PAGE_SIZE,end=Math.min(start+PAGE_SIZE,list.length);
  if(start>=list.length)return;
  var frag=document.createDocumentFragment();
  for(var i=start;i<end;i++){
    var w=document.createElement("div");w.innerHTML=cardHTML(list[i]);
    frag.appendChild(w.firstChild);
  }
  ml.appendChild(frag);
}



/* ══════════════════════════════════════════════════════════
   MODULE: Cards — HTML builders for grid and list modes
   ══════════════════════════════════════════════════════════ */
function pctBadge(cached,m){
  var p=m?getMoviePct(m):(cached&&cached.pct!=null?cached.pct:null);
  if(p==null)return "";
  var cls=p>=70?"pct-g":p>=50?"pct-a":"pct-b";
  var lbl=RATING_LABELS[ratingSource]||'TMDB';
  return '<div class="pct-badge '+cls+'"><div class="pct-badge-lbl">'+lbl+'</div><div class="pct-badge-val">'+p+'%</div></div>';
}

function cardHTML(m){
  const fav=favs.has(m.id), cached=liveCache[m.id];
  const genres=(m.genres||[]).slice(0,2).map(g=>`<span class="gtag">${esc(g)}</span>`).join("");
  const ym=[m.year||"",m.duration].filter(Boolean).join(" · ");
  const badge=pctBadge(cached,m);
  const titleH=hlField(m,"title");
  const dirH=m.director?hlField(m,"director"):"";
  const favBtn=`<button class="cfav" aria-label="${fav?'Odstrániť z obľúbených':'Pridať do obľúbených'}">${fav?STAR_ON:STAR_OFF}</button>`;
  if(posterWall){
    const hp=m.poster_thumb&&m.poster_thumb.length>10;
    return `<div class="pwcard" data-id="${m.id}" title="${esc(m.title||'')} (${m.year||''})">${hp?`<img class="pw-poster" src="${m.poster_thumb}" alt="${esc(m.title||'')}" loading="lazy">`:`<div class="pw-ph">${esc((m.title||'').substring(0,20))}</div>`}</div>`;
  }
  if(grid){
    const hp=m.poster_thumb&&m.poster_thumb.length>10;
    const post=hp
      ?`<div class="cpost-wrap"><img class="cpost" src="${m.poster_thumb}" alt="${esc(m.title||'')}" loading="lazy"><a class="cpost-play" href="#" title="Prehráť" aria-label="Prehráť ${esc(m.title||'')}"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg></a></div>`
      :`<div class="cpost-ph"><div class="cpost-n">#${m.num}</div>${FILM_ICO}</div>`;
    return `<div class="mcard" data-id="${m.id}">${post}<div class="cbody"><div class="cmain"><div class="ctitle">${titleH}</div><div class="cmeta">${esc(ym)}</div>${m.director?`<div class="cdir">${dirH}</div>`:""}<div class="cgenres">${genres}</div></div><div class="cbot">${badge}${favBtn}</div></div></div>`;
  }
  const lfavBtn=`<button class="lfav" aria-label="${fav?'Odstrániť z obľúbených':'Pridať do obľúbených'}">${fav?STAR_ON:STAR_OFF}</button>`;
  return `<div class="mcard lcard" data-id="${m.id}"><div class="lnum">${m.num}</div><div class="lbody"><div class="ltitle">${titleH}</div><div class="lmeta">${esc(ym)}</div></div><div class="lright">${genres}${badge}</div>${lfavBtn}</div>`;
}




/* ══════════════════════════════════════════════════════════
   MODULE: Collections — Favourites, Watchlist, Watch History
   ══════════════════════════════════════════════════════════ */
function togFav(id,btn){
  if(favs.has(id))favs.delete(id);else favs.add(id);
  safeSave(FK,JSON.stringify(Array.from(favs)));
  scheduleAutoPush('togFav');
  if(btn)btn.innerHTML=favs.has(id)?STAR_ON:STAR_OFF;
  var db=document.getElementById("dfavBtn");if(db&&curId===id)updFavBtn(db,id);
  if(favMode)applyFilters();
}
function togWl(id,btn){
  if(wl.has(id))wl.delete(id);else wl.add(id);
  safeSave(WK,JSON.stringify(Array.from(wl)));
  scheduleAutoPush('togWl');
  if(btn)btn.innerHTML=wl.has(id)?EYE_ON:EYE_OFF;
  var db=document.getElementById("dwlBtn");if(db&&curId===id)updWlBtn(db,id);
  if(wlMode)applyFilters();
}
function updWlBtn(btn,id){var w=wl.has(id);btn.innerHTML=(w?EYE_ON:EYE_OFF)+(w?' Odstrániť z Watchlist':' Watchlist');btn.className="btn-fav"+(w?" on":"");}
function updFavBtn(btn,id){var f=favs.has(id);btn.innerHTML=f?"&#11088; Odstranit":"&#9734; Oblubene";btn.className="btn-fav"+(f?" on":"");}

/* ── DETAIL ── */


/* ══════════════════════════════════════════════════════════
   MODULE: Detail View — full film info, trailer, similar
   ══════════════════════════════════════════════════════════ */
function openDet(id){
  const m=all.find(x=>x.id===id); if(!m)return;
  curId=id;
  const cached=liveCache[id];
  document.getElementById("detTitle").textContent=m.title;
  document.getElementById("detYr").textContent=[m.year||"",m.duration,m.country].filter(Boolean).join(" - ");
  const hp=m.poster_thumb&&m.poster_thumb.length>10;
  var backdropSrc=(cached&&cached.backdropUrl)||null;
  var heroSrc=backdropSrc||m.poster_thumb;
  ["detBlur","detCover"].forEach(eid=>{
    const el=document.getElementById(eid);
    el.style.display=hp?"block":"none"; if(hp)el.src=heroSrc;
  });
  if(backdropSrc){
    var coverEl=document.getElementById("detCover");
    if(coverEl){coverEl.src=backdropSrc;coverEl.style.display="block";}
    var blurEl=document.getElementById("detBlur");
    if(blurEl)blurEl.style.display="none";
  }
  const ins=document.getElementById("detInset"); ins.style.display=hp?"block":"none";
  if(hp)document.getElementById("detInsetImg").src=m.poster_thumb;
  document.getElementById("detBg").style.display=hp?"none":"block";

  const fav=favs.has(id);
  const genres=(m.genres||[]).map(g=>`<span class="dg-tag">${esc(g)}</span>`).join("");
  const items=[];
  if(m.director)items.push(["Režíser",'<a class="det-person-link" data-person="'+esc(m.director)+'">'+esc(m.director)+'</a>']);
  items.push(["Rok",esc(String(m.year||"–"))],["Dĺžka",esc(String(m.duration||"–"))],["Krajina",esc(String(m.country||"–"))],["#",esc(String(m.num))]);
  const tmdbUrl=(cached&&cached.tmdbUrl)||`https://www.themoviedb.org/search?query=${encodeURIComponent(m.title)}`;
  const imdbUrl=(cached&&cached.imdbUrl)||null;
  const csfdUrl=m._csfdUrl||null;

  // Rating pill
  let ratingHtml;
  var detPct=getMoviePct(m);
  var detLbl=RATING_LABELS[ratingSource]||'TMDB';
  if(!cached&&ratingSource==='tmdb'){
    ratingHtml=`<div class="rating-pill-na" id="ratingBox">${tmdbKey?"Načítavam…":"–"}</div>`;
  } else if(detPct!=null){
    const col=detPct>=70?"#00c853":detPct>=50?"#ffd600":"#e53935";
    ratingHtml=`<div class="rating-pill"><div class="rating-pill-lbl">${detLbl}</div><div class="rating-pill-val" style="color:${col}">${detPct}%</div></div>`;
  } else {
    ratingHtml='<div class="rating-pill-na" id="ratingBox">N/A</div>';
  }

  const html=
    `<div class="det-frow">
      ${ratingHtml}
      <button class="btn-fav${fav?" on":""}" id="dfavBtn" aria-label="Obľúbené"></button>
      <button class="btn-wl${wl.has(id)?" on":""}" id="dwlBtn" aria-label="Watchlist"></button>
      <button class="btn-watched${watched.has(id)?" on":""}" id="dwatchedBtn" aria-label="Videné"></button>
      ${watchedDates[id]?`<span class="watched-date">Videné: ${watchedDates[id]}</span>`:""}
    </div>
    ${genres?`<div class="det-genres">${genres}</div>`:""}
    <div class="sec">Prehrávanie</div>
    <div class="det-actions">
      <button id="playMovieBtn" class="sett-btn primary"><span class="sett-btn-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg></span><span class="sett-btn-label">Prehráť film</span></button>
      <button class="btn-play-copy" id="btnPlayCopy" title="Kopírovať cestu k súboru"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Kopírovať cestu</button>
    </div>
    <div class="sec">Trailer &amp; Linky</div>
    <div class="tr-row">
      <button class="btn-trailer" id="btnTr"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="vertical-align:-1px;margin-right:3px"><polygon points="6,3 20,12 6,21"/></svg>YouTube Trailer</button>
      <a class="btn-tmdb" id="btnTmdb" href="${esc(tmdbUrl)}" target="_blank">TMDB</a>
      ${imdbUrl?`<a class="btn-imdb" id="btnImdb" href="${esc(imdbUrl)}" target="_blank">★ IMDB</a>`:
               '<a class="btn-imdb" id="btnImdb" href="#" target="_blank" style="display:none">★ IMDB</a>'}
      ${csfdUrl?`<a class="btn-csfd" id="btnCsfd" href="${esc(csfdUrl)}" target="_blank">ČSFD</a>`:
               '<a class="btn-csfd" id="btnCsfd" href="#" target="_blank" style="display:none">ČSFD</a>'}
      <a class="btn-jw" href="https://www.justwatch.com/sk/vyh%C4%BEad%C3%A1va%C5%A5?q=${encodeURIComponent(m.title)}" target="_blank">&#x1F4FA; Kde pozerať</a>
      <button class="btn-match" id="btnMatch" title="Ručné TMDB párovanie">&#x2699; Párovanie</button>
    </div>
    ${m.description&&m.description.trim()?`<div class="sec">Popis</div><div class="det-desc">${esc(m.description)}</div>`:""}
    <div class="sec">Detaily</div>
    <div class="det-grid">${items.map(it=>`<div class="det-item"><div class="det-item-l">${it[0]}</div><div class="det-item-v">${it[1]}</div></div>`).join("")}</div>
    ${m.cast&&m.cast.trim()?`<div class="sec">Obsadenie</div><div class="det-cast">${m.cast.split(',').map(function(a){var n=a.trim();return n?'<a class="det-person-link" data-person="'+esc(n)+'">'+esc(n)+'</a>':'';}).filter(Boolean).join(', ')}</div>`:""}
    <div class="sec">Tagy</div>
    <div class="det-tags" id="detTags">
      ${(m._tags||[]).map(function(t){return '<span class="det-tag">'+esc(t)+'<button class="det-tag-x" data-tag="'+esc(t)+'">&times;</button></span>';}).join('')}
      <span class="det-tag-add" id="detTagAdd">+ pridať</span>
    </div>
    ${buildSimilarHtml(m)}`;

  document.getElementById("detBody").innerHTML=html;
  document.getElementById("dfavBtn").onclick=function(){togFav(id,null);updFavBtn(document.getElementById("dfavBtn"),id);};
  document.getElementById("dwlBtn").onclick=function(){togWl(id,null);updWlBtn(document.getElementById("dwlBtn"),id);};
  updFavBtn(document.getElementById("dfavBtn"),id);
  updWlBtn(document.getElementById("dwlBtn"),id);
  updWatchedBtn(document.getElementById("dwatchedBtn"),id);
  document.getElementById("dwatchedBtn").onclick=function(){togWatched(id,null);updWatchedBtn(document.getElementById("dwatchedBtn"),id);};
  document.querySelectorAll(".sim-card").forEach(c=>{c.onclick=function(){openDet(parseInt(c.dataset.sid));};});
  const playBtn=document.getElementById("playMovieBtn");
  if(playBtn){
    var _playMode = _isMobile ? (pathMode==='smb' ? 'SMB' : 'Lokálne') : (pathMode==='smb' ? 'SMB' : playerProto.toUpperCase());
    playBtn.querySelector('.sett-btn-label').textContent = 'Prehráť · ' + _playMode;
    playBtn.onclick=function(){
      var _m=all.find(function(x){return x.id===id;})||m;
      playMovie(_m.id);
    };
  }
  document.getElementById("btnPlayCopy").onclick=function(){copyMoviePath(id);};
  document.getElementById("btnTr").onclick=function(){openTrailer(id);};
  document.getElementById("btnMatch").onclick=function(){openMatchPanel(id);};
  document.querySelectorAll(".det-person-link").forEach(function(el){
    el.onclick=function(e){e.preventDefault();closeDet();var inp=document.getElementById("srchInp");if(inp){inp.value=el.dataset.person;inp.dispatchEvent(new Event("input"));}};
  });
  var tagAdd=document.getElementById("detTagAdd");
  if(tagAdd) tagAdd.onclick=function(){
    var tag=prompt("Nový tag:");
    if(!tag||!tag.trim())return;
    tag=tag.trim();
    if(!m._tags)m._tags=[];
    if(m._tags.indexOf(tag)<0){m._tags.push(tag);saveAllData();scheduleAutoPush('tag');openDet(id);}
  };
  document.querySelectorAll(".det-tag-x").forEach(function(btn){
    btn.onclick=function(e){
      e.stopPropagation();
      var tag=btn.dataset.tag;
      if(m._tags){m._tags=m._tags.filter(function(t){return t!==tag;});if(!m._tags.length)delete m._tags;saveAllData();scheduleAutoPush('tag');openDet(id);}
    };
  });
  document.getElementById("mainSc").classList.add("hidden");
  document.getElementById("detSc").classList.remove("hidden");
  document.getElementById("detBody").scrollTop=0;
  if(!cached)fetchLiveData(id);
}
function closeDet(){document.getElementById("detSc").classList.add("hidden");document.getElementById("mainSc").classList.remove("hidden");}

function fetchLiveData(id){
  var m=all.find(function(x){return x.id===id;});if(!m||!tmdbKey)return;
  if(liveCache[id]){applyLive(id,liveCache[id]);return;}
  var ac=(typeof AbortController!=="undefined")?new AbortController():null;
  var timer=setTimeout(function(){if(ac)ac.abort();},10000);
  doTMDBFetch(m,function(data){clearTimeout(timer);if(data){liveCache[id]=data;saveLiveCache();}if(curId===id)applyLive(id,data);},ac?ac.signal:null);
}
function applyLive(id,data){
  var rbox=document.getElementById("ratingBox");
  if(rbox){
    var mv=all.find(function(x){return x.id===id;});
    var p=mv?getMoviePct(mv):(data&&data.pct!=null?data.pct:null);
    var lbl=RATING_LABELS[ratingSource]||'TMDB';
    if(p!=null){
      var col=p>=70?"#00c853":p>=50?"#ffd600":"#e53935";
      rbox.outerHTML='<div class="rating-pill"><div class="rating-pill-lbl">'+lbl+'</div><div class="rating-pill-val" style="color:'+col+'">'+p+'%</div></div>';
    } else {
      rbox.outerHTML='<div class="rating-pill-na" id="ratingBox">N/A</div>';
    }
  }
  if(!data)return;
  if(data.posterUrl){
    var mv=all.find(function(x){return x.id===id;});
    if(mv) mv.poster_thumb=data.posterUrl;
    ["detBlur","detCover"].forEach(function(eid){
      var el=document.getElementById(eid);
      if(el){el.src=data.posterUrl;el.style.display='block';}
    });
    var insetEl=document.getElementById("detInsetImg");
    if(insetEl) insetEl.src=data.posterUrl;
    var insetWrap=document.getElementById("detInset");
    if(insetWrap) insetWrap.style.display='block';
    var bgEl=document.getElementById("detBg");
    if(bgEl) bgEl.style.display='none';
  }
  if(data.ytKey){var b=document.getElementById("btnTr");if(b)b.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style="vertical-align:-1px;margin-right:3px"><polygon points="6,3 20,12 6,21"/></svg>Prehrať Trailer';}
  if(data.backdropUrl){
    var coverEl=document.getElementById("detCover");
    if(coverEl){coverEl.src=data.backdropUrl;coverEl.style.display='block';coverEl.style.filter='brightness(.55)';}
    var blurEl=document.getElementById("detBlur");
    if(blurEl)blurEl.style.display='none';
  }
  if(data.tmdbUrl){var tb=document.getElementById("btnTmdb");if(tb)tb.href=data.tmdbUrl;}
  if(data.imdbUrl){var ib=document.getElementById("btnImdb");if(ib){ib.href=data.imdbUrl;ib.style.display="inline-flex";}}
  var mv2=all.find(function(x){return x.id===id;});if(mv2&&data.ytKey)mv2._yt=data.ytKey;
}



/* ══════════════════════════════════════════════════════════
   MODULE: TMDB API — batch fetch, live data, admin panel
   ══════════════════════════════════════════════════════════ */
function doTMDBFetch(m,cb,signal){
  if(!tmdbKey){cb(null);return;}
  var opts=signal?{signal:signal}:{};
  var baseUrl="https://api.themoviedb.org/3/search/movie?api_key="+tmdbKey+"&query="+encodeURIComponent(m.title)+"&language=sk";
  fetch(baseUrl+"&year="+(m.year||""),opts)
    .then(function(r){return r.json();})
    .then(function(sd){
      if(!sd.results||!sd.results.length){
        return fetch(baseUrl,opts).then(function(r2){return r2.json();});
      }
      return sd;
    })
    .then(function(sd){
      if(!sd||!sd.results||!sd.results.length){cb(null);return;}
      var res=sd.results[0],tmdbId=res.id;
      var pct=res.vote_average?Math.round(res.vote_average*10):null;
      var posterUrl=res.poster_path?"https://image.tmdb.org/t/p/w300"+res.poster_path:null;
      if(posterUrl) m.poster_thumb=posterUrl;
      return fetch("https://api.themoviedb.org/3/movie/"+tmdbId+"?api_key="+tmdbKey+"&append_to_response=videos,external_ids",opts)
        .then(function(r){return r.json();})
        .then(function(d){
          var imdbId=d.external_ids&&d.external_ids.imdb_id?d.external_ids.imdb_id:null;
          var videos=d.videos&&d.videos.results?d.videos.results:[];
          var tr=videos.find(function(v){return v.type==="Trailer"&&v.site==="YouTube";})||videos.find(function(v){return v.site==="YouTube";});
          var backdropUrl=d.backdrop_path?"https://image.tmdb.org/t/p/w1280"+d.backdrop_path:null;
          cb({pct:pct,ytKey:tr?tr.key:null,posterUrl:posterUrl,backdropUrl:backdropUrl,
              tmdbUrl:"https://www.themoviedb.org/movie/"+tmdbId,
              imdbUrl:imdbId?"https://www.imdb.com/title/"+imdbId+"/":null});
        });
    }).catch(function(e){
      if(e.name==="AbortError") return; // intentional cancel
      cb(null);
    });
}

function settStartBatch(){
  if(!tmdbKey){keyStatus("tmdbKeySt",tmdbKey);return;}
  var queue=all.filter(function(m){return!liveCache[m.id];});
  if(!queue.length){toast("Všetky dáta už načítané!");return;}
  if(tmdbAbortCtrl) tmdbAbortCtrl.abort();
  tmdbAbortCtrl=(typeof AbortController!=="undefined")?new AbortController():null;
  var batchSignal=tmdbAbortCtrl?tmdbAbortCtrl.signal:null;
  closeSett();liveRunning=true;
  var total=queue.length,done=0;
  var bar=document.getElementById("batchBar");
  bar.classList.remove("hidden");
  /* bar is in flow now */
  document.getElementById("batchInfo").textContent="0/"+total;
  document.getElementById("batchFill").style.width="0%";

  var CONCURRENCY=5;
  function runBatch(){
    if(!liveRunning||!queue.length){
      if(!queue.length||!liveRunning){
        liveRunning=false;
        if(tmdbAbortCtrl){tmdbAbortCtrl.abort();tmdbAbortCtrl=null;}
        bar.classList.add("hidden");
        /* bar is in flow now */
        saveAllData();
        renderList(filt);
        toast("Načítané: "+done+"/"+total+" filmov!");
        scheduleAutoPush('tmdb-batch');
      }
      return;
    }
    var group=queue.splice(0,CONCURRENCY);
    var pending=group.length;
    group.forEach(function(m){
      doTMDBFetch(m,function(data){
        if(data) liveCache[m.id]=data;
        done++;
        document.getElementById("batchFill").style.width=Math.round(done/total*100)+"%";
        document.getElementById("batchInfo").textContent=done+"/"+total;
        if(done%50===0) saveAllData();
        pending--;
        if(pending===0){
          if(done%20<CONCURRENCY) renderList(filt);
          setTimeout(runBatch,300);
        }
      },batchSignal);
    });
  }
  runBatch();
}

function startImdbBatch(){
  if(!omdbKey){
    var st=document.getElementById('omdbKeySt');
    if(st){st.textContent='Najprv zadajte OMDB API kľúč';st.className='sett-key-st';}
    return;
  }
  var ready=[],needTmdb=[];
  all.forEach(function(m){
    if(m._pctImdb!=null) return;
    var c=liveCache[m.id];
    var url=(c&&c.imdbUrl)||m._imdbUrl||null;
    if(url){
      var match=url.match(/tt\d+/);
      if(match){ready.push({movie:m, imdbId:match[0]});return;}
    }
    var tid=m.tmdbId||null;
    if(!tid){
      var cu=c&&c.tmdbUrl;
      if(cu){var tm=cu.match(/\/movie\/(\d+)/);if(tm)tid=parseInt(tm[1]);}
    }
    if(tid) needTmdb.push({movie:m, tmdbId:tid});
  });
  if(!ready.length&&!needTmdb.length){toast('Žiadne filmy na načítanie IMDB hodnotení');return;}
  var fill=document.getElementById('imdbPfill');
  var stEl=document.getElementById('imdbBatchSt');

  if(needTmdb.length&&tmdbKey){
    stEl.textContent='Hľadám IMDB ID cez TMDb ('+needTmdb.length+' filmov)...';
    fill.style.width='0%';
    var ti=0,resolved=0;
    function nextTmdb(){
      if(ti>=needTmdb.length){
        stEl.textContent='Nájdených '+resolved+' IMDB ID. Sťahujem hodnotenia...';
        runOmdbBatch(ready);
        return;
      }
      var it=needTmdb[ti++];
      fetch('https://api.themoviedb.org/3/movie/'+it.tmdbId+'/external_ids?api_key='+tmdbKey)
        .then(function(r){return r.json();})
        .then(function(d){
          if(d&&d.imdb_id){
            it.movie._imdbUrl='https://www.imdb.com/title/'+d.imdb_id+'/';
            ready.push({movie:it.movie, imdbId:d.imdb_id});
            resolved++;
          }
        })
        .catch(function(){})
        .then(function(){
          fill.style.width=Math.round(ti/needTmdb.length*30)+'%';
          setTimeout(nextTmdb,120);
        });
    }
    nextTmdb();
  } else {
    runOmdbBatch(ready);
  }

  function runOmdbBatch(queue){
    if(!queue.length){
      stEl.textContent='Žiadne IMDB ID nájdené';
      fill.style.width='100%';
      return;
    }
    var total=queue.length,done=0,updated=0,failed=0;
    fill.style.width='30%';
    stEl.textContent='0 / '+total;
    var idx=0;
    function next(){
      if(idx>=queue.length){
        saveAllData();
        fill.style.width='100%';
        stEl.textContent='Hotovo: '+updated+' hodnotení načítaných'+(failed?' ('+failed+' chýb)':'');
        renderList(filt);
        scheduleAutoPush('imdb-batch');
        return;
      }
      var item=queue[idx++];
      fetch('/api/omdb?i='+item.imdbId+'&apikey='+omdbKey)
        .then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
        .catch(function(){
          return fetch('https://www.omdbapi.com/?i='+item.imdbId+'&apikey='+omdbKey)
            .then(function(r){return r.json();});
        })
        .then(function(d){
          if(d&&d.Response==='True'&&d.imdbRating&&d.imdbRating!=='N/A'){
            var pct=Math.round(parseFloat(d.imdbRating)*10);
            if(!isNaN(pct)){item.movie._pctImdb=pct;updated++;}
          }
        })
        .catch(function(){failed++;})
        .then(function(){
          done++;
          fill.style.width=Math.round(30+done/total*70)+'%';
          stEl.textContent=done+' / '+total+(updated?' ('+updated+' OK)':'');
          if(done%50===0) saveAllData();
          setTimeout(next,200);
        });
    }
    next();
  }
}

function startCsfdBatch(){
  var queue=[];
  all.forEach(function(m){
    if(m._pctCsfd!=null) return;
    var url=m._csfdUrl;
    if(!url) return;
    queue.push({movie:m, url:url});
  });
  if(!queue.length){toast('Žiadne filmy s ČSFD linkom na načítanie');return;}
  var fill=document.getElementById('csfdPfill');
  var stEl=document.getElementById('csfdBatchSt');
  var total=queue.length,done=0,updated=0,failed=0;
  fill.style.width='0%';
  stEl.textContent='0 / '+total;

  var idx=0;
  function next(){
    if(idx>=queue.length){
      saveAllData();
      fill.style.width='100%';
      stEl.textContent='Hotovo: '+updated+' hodnotení načítaných'+(failed?' ('+failed+' chýb)':'');
      renderList(filt);
      scheduleAutoPush('csfd-batch');
      return;
    }
    var item=queue[idx++];
    fetch('/api/csfd?url='+encodeURIComponent(item.url))
      .then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
      .then(function(d){
        if(d&&d.rating!=null){
          item.movie._pctCsfd=d.rating;updated++;
        }
      })
      .catch(function(){failed++;})
      .then(function(){
        done++;
        fill.style.width=Math.round(done/total*100)+'%';
        stEl.textContent=done+' / '+total+(updated?' ('+updated+' OK)':'');
        if(done%50===0) saveAllData();
        setTimeout(next,300);
      });
  }
  next();
}

function openTrailer(id){
  var m=all.find(function(x){return x.id===id;});if(!m)return;
  var cached=liveCache[id];
  var ytKey=m._yt||(cached&&cached.ytKey)||null;
  if(!ytKey&&cached&&cached.ytKey) ytKey=cached.ytKey;
  if(ytKey){
    var ov=document.getElementById("trOv");
    var fr=document.getElementById("trFrame");
    fr.src="https://www.youtube.com/embed/"+ytKey+"?autoplay=1";
    ov.classList.remove("hidden");
    ov.style.display="flex";
  } else {
    window.open("https://www.youtube.com/results?search_query="+encodeURIComponent(m.title+" "+(m.year||"")+" trailer"),"_blank");
  }
}
function closeTr(){
  var fr=document.getElementById("trFrame");
  var ov=document.getElementById("trOv");
  fr.src="";
  ov.classList.add("hidden");
  ov.style.display="";
}

/* ══════════════════════════════════════════════════════════════════
   MODULE: Statistics with Chart.js
   Renders donut chart for genres, bar chart for decades, summary
   stat cards. chartInstances is tracked so we can destroy on re-open
   ══════════════════════════════════════════════════════════════════ */

var chartInstances = {}; // id → Chart instance



/* ══════════════════════════════════════════════════════════
   MODULE: Statistics — Chart.js graphs, stat cards
   ══════════════════════════════════════════════════════════ */
function destroyCharts() {
  Object.keys(chartInstances).forEach(function(k) {
    try { chartInstances[k].destroy(); } catch(e) {}
  });
  chartInstances = {};
}

function buildChart(id, config) {
  var canvas = document.getElementById(id);
  if (!canvas) return;
  destroySingleChart(id);
  chartInstances[id] = new Chart(canvas.getContext('2d'), config);
}

function destroySingleChart(id) {
  if (chartInstances[id]) { try { chartInstances[id].destroy(); } catch(e) {} delete chartInstances[id]; }
}

/* Helper: stat card HTML — used by showStats() */
function sc(icon,label,value,sub){
  return `<div class="scard"><div class="sic">${icon}</div><div><div class="slbl">${label}</div><div class="sval">${value}</div>${sub?`<div class="ssub">${sub}</div>`:""}</div></div>`;
}

function showStats(){
  if(!all.length){toast('Žiadne filmy');return;}
  destroyCharts();

  const withYear=all.filter(m=>m.year>0);
  const years=withYear.map(m=>m.year);
  const minYear=years.length?Math.min(...years):"–";
  const maxYear=years.length?Math.max(...years):"–";

  // Genre counts (top 10)
  const genreCounts={};
  all.forEach(m=>(m.genres||[]).forEach(g=>{genreCounts[g]=(genreCounts[g]||0)+1;}));
  const topGenres=Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);

  // Decade counts
  const decadeCounts={};
  withYear.forEach(m=>{const d=Math.floor(m.year/10)*10;decadeCounts[d]=(decadeCounts[d]||0)+1;});
  const decades=Object.entries(decadeCounts).sort((a,b)=>a[0]-b[0]);

  // Watch time estimate
  const totalWithDur=all.filter(m=>m.duration);
  const totalMins=totalWithDur.reduce((acc,m)=>acc+(parseInt((m.duration||"").replace(/\D/g,""))||0),0)
    +(all.length-totalWithDur.length)*105;
  const hours=Math.round(totalMins/60);

  const withLive=Object.keys(liveCache).length;
  const withPoster=all.filter(m=>m.poster_thumb&&m.poster_thumb.length>10).length;

  // Average rating (uses selected source)
  const ratedMovies=all.filter(function(m){return getMoviePct(m)!=null;});
  const avgRating=ratedMovies.length?Math.round(ratedMovies.reduce(function(a,m){return a+getMoviePct(m);},0)/ratedMovies.length):null;
  const rated=ratedMovies;

  // Top directors (top 8)
  const dirCounts={};
  all.forEach(m=>{if(m.director)(m.director).split(/,\s*/).forEach(d=>{d=d.trim();if(d)dirCounts[d]=(dirCounts[d]||0)+1;});});
  const topDirs=Object.entries(dirCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Monthly watch activity (last 12 months)
  const monthCounts={};
  Object.values(watchedDates).forEach(d=>{if(d){var mo=d.slice(0,7);monthCounts[mo]=(monthCounts[mo]||0)+1;}});
  const months=Object.entries(monthCounts).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);

  const statHtml=
    sc("🎬","FILMOV CELKOM",all.length,"")+
    sc("🕐","HODÍN SLEDOVANIA",hours,"(odhad)")+
    sc("🖼","S PLAGÁTOM",withPoster,"filmov")+
    sc("📊","TMDB DÁTA",withLive,"filmov s hodnotením")+
    (avgRating!=null?sc("⭐","PRIEMERNÉ HODNOTENIE",avgRating+'%',rated.length+' hodnotených'):"")+
    sc("❤️","OBĽÚBENÉ",favs.size,"")+
    sc("👁","WATCHLIST",wl.size,"")+
    sc("✓","VIDENÉ",watched.size,"")+
    sc("📅","ROKY",`${minYear}–${maxYear}`,"");

  // Top directors HTML
  let dirsHtml='';
  if(topDirs.length){
    dirsHtml='<div class="stat-section"><div class="stat-section-title">TOP REŽISÉRI</div><div class="stat-dir-list">';
    topDirs.forEach(([name,cnt])=>{dirsHtml+=`<div class="stat-dir-item"><span class="stat-dir-name">${esc(name)}</span><span class="stat-dir-cnt">${cnt}</span></div>`;});
    dirsHtml+='</div></div>';
  }

  let chartsHtml='<div class="stat-charts">';
  if(topGenres.length)chartsHtml+='<div class="chart-card"><div class="chart-title">TOP ŽÁNRE</div><div class="chart-wrap"><canvas id="chartGenres"></canvas></div></div>';
  if(decades.length)chartsHtml+='<div class="chart-card"><div class="chart-title">FILMY PODĽA DEKÁDY</div><div class="chart-wrap"><canvas id="chartDecades"></canvas></div></div>';
  if(months.length>1)chartsHtml+='<div class="chart-card"><div class="chart-title">SLEDOVANÉ FILMY PODĽA MESIACA</div><div class="chart-wrap"><canvas id="chartMonthly"></canvas></div></div>';
  chartsHtml+='</div>';

  document.getElementById("statBody").innerHTML=statHtml+dirsHtml+chartsHtml;
  document.getElementById("mainSc").classList.add("hidden");
  document.getElementById("statSc").classList.remove("hidden");

  const PALETTE=["#d4a943","#f0c060","#4a9eff","#22cc88","#cc44aa","#ff6644","#9966ff","#44ccff","#ff4477","#88dd44"];

  loadChartJs().then(function(){
  if(topGenres.length){
    buildChart("chartGenres",{
      type:"doughnut",
      data:{
        labels:topGenres.map(e=>e[0]),
        datasets:[{data:topGenres.map(e=>e[1]),backgroundColor:PALETTE,borderColor:"#0a0a0f",borderWidth:2}]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{
          legend:{position:"right",labels:{color:"#9090a8",font:{size:11},boxWidth:12,padding:8}},
          tooltip:{callbacks:{label(ctx){
            const total=ctx.dataset.data.reduce((a,b)=>a+b,0);
            const pct=Math.round(ctx.parsed/total*100);
            return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
          }}}
        }
      }
    });
  }

  if(decades.length){
    buildChart("chartDecades",{
      type:"bar",
      data:{
        labels:decades.map(e=>`${e[0]}s`),
        datasets:[{label:"Počet filmov",data:decades.map(e=>e[1]),backgroundColor:"#d4a943cc",borderColor:"#d4a943",borderWidth:1,borderRadius:4}]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          x:{ticks:{color:"#9090a8",font:{size:11}},grid:{color:"#2a2a3a"}},
          y:{ticks:{color:"#9090a8",font:{size:11},stepSize:1},grid:{color:"#2a2a3a"},beginAtZero:true}
        }
      }
    });
  }
  if(months.length>1){
    buildChart("chartMonthly",{
      type:"bar",
      data:{
        labels:months.map(e=>e[0]),
        datasets:[{label:"Videné",data:months.map(e=>e[1]),backgroundColor:"#22cc88cc",borderColor:"#22cc88",borderWidth:1,borderRadius:4}]
      },
      options:{
        responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          x:{ticks:{color:"#9090a8",font:{size:10},maxRotation:45},grid:{color:"#2a2a3a"}},
          y:{ticks:{color:"#9090a8",font:{size:11},stepSize:1},grid:{color:"#2a2a3a"},beginAtZero:true}
        }
      }
    });
  }
  }).catch(function(e){toast("Chart.js: "+e.message);});
}

function closeStat() {
  destroyCharts();
  document.getElementById('statSc').classList.add('hidden');
  document.getElementById('mainSc').classList.remove('hidden');
}


function keyStatus(stId,key){var st=document.getElementById(stId);if(!st)return;st.textContent=key?"Kluc je ulozeny \u2713":"Kluc nie je nastaveny";st.className="sett-key-st "+(key?"ok":"err");}


/* ══════════════════════════════════════════════════════════
   MODULE: Settings Panel
   ══════════════════════════════════════════════════════════ */
function openSett(){
  // Reset advanced section state each time panel opens
  // Sync color picker with current accent
  // Show GitHub token STATUS (never reveal the actual token)
  try {
    var ghT = localStorage.getItem('mdb_gh_token') || '';
    var ghInp = document.getElementById('ghTokenInp');
    var ghSt  = document.getElementById('ghTokenSt');
    if (ghInp) {
      ghInp.value = ''; // Never pre-fill with token
      ghInp.placeholder = ghT
        ? '••••••••••••••••••••••••••••••••••••••••'
        : 'ghp_... Personal Access Token';
    }
    if (ghSt) {
      ghSt.textContent = ghT ? '✓ Token je uložený' : '';
      ghSt.className   = ghT ? 'sett-key-st ok' : 'sett-key-st';
    }
  } catch(e) {}
  // Sync accent color picker
  try {
    var ac = JSON.parse(localStorage.getItem(ACCENT_KEY) || 'null');
    var cur = ac ? ac.gold : '#d4a943';
    var ccEl = document.getElementById('colorCustom');
    if (ccEl) ccEl.value = cur;
    document.querySelectorAll('.color-swatch').forEach(function(s) {
      s.classList.toggle('active', s.dataset.gold === cur);
    });
  } catch(e) {}

  // Sync skin chips
  var th = localStorage.getItem('mdb_theme1') || 'dark';
  document.querySelectorAll('.skin-chip').forEach(function(s) {
    s.classList.toggle('active', s.dataset.skin === th);
  });
  document.getElementById("tmdbKeyInp").value=tmdbKey;
  document.getElementById("tmdbKeyInp").type="password";
  keyStatus("tmdbKeySt",tmdbKey);
  var omdbInp=document.getElementById('omdbKeyInp');
  if(omdbInp){omdbInp.value=omdbKey;omdbInp.type='password';}
  var omdbSt=document.getElementById('omdbKeySt');
  if(omdbSt){omdbSt.textContent=omdbKey?'✓ OMDB kľúč uložený':'';omdbSt.className=omdbKey?'sett-key-st ok':'sett-key-st';}
  var imdbCount=all.filter(function(m){return m._pctImdb!=null;}).length;
  var imdbSt=document.getElementById('imdbBatchSt');
  if(imdbSt&&imdbCount)imdbSt.textContent=imdbCount+' filmov s IMDB hodnotením';
  var csfdCount=all.filter(function(m){return m._pctCsfd!=null;}).length;
  var csfdSt=document.getElementById('csfdBatchSt');
  if(csfdSt&&csfdCount)csfdSt.textContent=csfdCount+' filmov s ČSFD hodnotením';
  var matcherInp=document.getElementById('csfdMatcherUrlInp');
  if(matcherInp)matcherInp.value=csfdMatcherUrl;
  document.getElementById("ttabList").className="ttab"+(grid?"":" on");
  document.getElementById("ttabGrid").className="ttab"+(grid?" on":"");
  document.getElementById("settSortSel").value=prefs.sort||"num";
  var lc=Object.keys(liveCache).length;
  document.getElementById("settPfill").style.width=all.length?(lc/all.length*100)+"%":"0%";
  document.getElementById("settBatchSt").textContent=lc>0?lc+" z "+all.length+" filmov nacitanych":"";
  var _ig=document.getElementById("settInfoGrid");
  if(_ig)_ig.innerHTML=
    infoItem("Filmov",all.length)+infoItem("S plagatom",all.filter(function(m){return m.poster_thumb&&m.poster_thumb.length>10;}).length)+
    infoItem("Hodnotenia",lc)+infoItem("Oblubene",favs.size)+infoItem("Watchlist",wl.size)+infoItem("Videne",watched.size);
  var vt=document.getElementById("viewTog"); if(vt && vt.tagName==="SELECT") vt.value=grid?"grid":"list";
  document.querySelectorAll('#pathModeToggle .ttab').forEach(function(b){
    b.className = 'ttab' + (b.dataset.mode === pathMode ? ' on' : '');
  });
  var smbInp = document.getElementById('smbPathInp');
  if (smbInp) smbInp.value = smbBase;
  var localInp = document.getElementById('localPathInp');
  if (localInp) {
    var firstLocal = Object.keys(smbMap)[0] || 'W:\\Movies\\';
    localInp.value = firstLocal;
  }
  var smbSt = document.getElementById('smbPathSt');
  if (smbSt && smbBase) {
    var lk = Object.keys(smbMap)[0] || '';
    smbSt.textContent = '\u2713 ' + lk + ' \u2192 ' + smbBase;
    smbSt.className = 'sett-key-st ok';
  }
  // Sync autoPullTog
  const _apt=document.getElementById("autoPullTog"); if(_apt)_apt.checked=autoPull;
  // Sync rating source toggle
  document.querySelectorAll('#ratingSrcToggle .ttab').forEach(function(b){
    b.className=(b.dataset.src===ratingSource)?'ttab on':'ttab';
  });
  document.getElementById("settOverlay").classList.remove("hidden");
  document.getElementById("settPanel").classList.remove("hidden");
}

function closeSett() {
  document.getElementById("settOverlay").classList.add("hidden");
  document.getElementById("settPanel").classList.add("hidden");
}

function activateSettingsTab(tabKey){
  var key=tabKey||"appearance";
  document.querySelectorAll(".sett-tab").forEach(function(tab){
    var active=tab.dataset.tab===key;
    tab.classList.toggle("active",active);
    tab.setAttribute("aria-selected",active?"true":"false");
  });
  document.querySelectorAll(".sett-tab-panel").forEach(function(panel){
    panel.classList.toggle("active",panel.dataset.panel===key);
  });
}

function infoItem(l, v) {
  return `<div class="sett-info-item"><div class="sett-info-lbl">${l}</div><div class="sett-info-val">${v}</div></div>`;
}

var VIEW_MODES=['list','grid','posterwall'];
var VIEW_ICONS={
  list:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>',
  grid:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>',
  posterwall:'<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="1" y="1" width="4" height="6" rx="1"/><rect x="6" y="1" width="4" height="6" rx="1"/><rect x="11" y="1" width="4" height="6" rx="1"/><rect x="1" y="9" width="4" height="6" rx="1"/><rect x="6" y="9" width="4" height="6" rx="1"/><rect x="11" y="9" width="4" height="6" rx="1"/></svg>'
};
var VIEW_TITLES={list:'Prepnúť na grid',grid:'Prepnúť na poster wall',posterwall:'Prepnúť na zoznam'};
function settSetView(v){
  grid = v === 'grid';
  posterWall = v === 'posterwall';
  var ml = document.getElementById('mlist');
  var vt = document.getElementById('viewTog');
  if (ml) ml.className = posterWall ? 'mlist posterwall' : grid ? 'mlist grid' : 'mlist';
  if (vt) {
    vt.innerHTML = VIEW_ICONS[v]||VIEW_ICONS.list;
    vt.title = VIEW_TITLES[v]||'';
  }
  var tl = document.getElementById('ttabList');
  var tg = document.getElementById('ttabGrid');
  if (tl) tl.className = 'ttab' + (v==='list' ? ' on' : '');
  if (tg) tg.className = 'ttab' + (v==='grid' ? ' on' : '');
  prefs.view = v; savePrefs(); renderList(filt);
}
function settSetSort(v){prefs.sort=v;savePrefs();document.getElementById("sortSel").value=v;syncSortPill();applyFilters();}



/* ══════════════════════════════════════════════════════════
   MODULE: Import — PDF parser, file handling
   ══════════════════════════════════════════════════════════ */
function impPdf(){
  try{localStorage.removeItem("mdb_empty");}catch(e){}
  document.getElementById("fileInp").click();
}
function handleFile(){
  var file=document.getElementById("fileInp").files[0];if(!file)return;
  document.getElementById("fileInp").value="";closeSett();
  showMod("Importujem databázu",file.name);setP(2,"Čítam súbor...");
  
  var isZip = file.name.toLowerCase().endsWith('.zip');
  
  if (isZip) {
    // ── ZIP import (EMDB HTML export) ──
    loadJSZip().then(function(){return file.arrayBuffer();}).then(function(ab) {
      return parseEMDBZip(ab, setP);
    }).then(function(mv) {
      if(!mv||!mv.length){hideMod();toast("Nenašli sa filmy.");return;}
      
      // Rescue posters from existing data for movies without ZIP cover
      var posterMap={};
      try{buildMovies().forEach(function(m){if(m.poster_thumb&&m.poster_thumb.length>10)posterMap[m.num]=m.poster_thumb;});}catch(e){}
      try{var saved=localStorage.getItem(SK);if(saved){JSON.parse(saved).forEach(function(m){if(m.poster_thumb&&m.poster_thumb.length>10)posterMap[m.num]=m.poster_thumb;});}}catch(e){}
      all.forEach(function(m){if(m.poster_thumb&&m.poster_thumb.length>10)posterMap[m.num]=m.poster_thumb;});
      mv.forEach(function(m){
        if((!m.poster_thumb||m.poster_thumb.length<10)&&posterMap[m.num]) m.poster_thumb=posterMap[m.num];
      });
      
      // Also rescue liveCache data (TMDB ratings, trailers)
      mv.forEach(function(m){
        var cached = liveCache[m.id];
        if (cached) {
          if (cached.ytKey && !m._yt) m._yt = cached.ytKey;
          if (cached.posterUrl && (!m.poster_thumb || m.poster_thumb.length < 10)) m.poster_thumb = cached.posterUrl;
        }
      });
      
      all = mv;
      buildFuse(); // rebuild Fuse index after GitHub pull
      // Save — strip base64 posters to save space (keep URL posters)
      try{
        var toSave=all.map(function(m){
          var c=Object.assign({},m);
          if(c.poster_thumb&&c.poster_thumb.indexOf("data:")===0) c.poster_thumb="";
          return c;
        });
        safeSave(SK,JSON.stringify(toSave));
      }catch(e){console.warn("Save error:",e);}
      
      setP(100,"Hotovo!");
      setTimeout(function(){
        hideMod();renderAll();
        toast("Importovaných "+mv.length+" filmov (#"+mv[0].num+"-#"+mv[mv.length-1].num+")");
        if(tmdbKey){toast("Automaticky spúšťam TMDB...");setTimeout(settStartBatch,1500);}
        // AUTO-SYNC: ak je GitHub token nastavený, automaticky pushneme dáta
        if(ghToken){
          setTimeout(function(){
            toast("🔄 Auto-sync do GitHubu...");
            ghPush();
          },2000);
        }
      },500);
    }).catch(function(e){hideMod();toast("Chyba: "+e.message);console.error(e);});
  } else {
    // ── Legacy PDF import ──
    loadPdfJs().then(function(){return file.arrayBuffer();})
      .then(function(ab){setP(10,"Načítavam PDF...");return pdfjsLib.getDocument({data:ab}).promise;})
      .then(function(pdf){
        var tot=pdf.numPages,txt="",chain=Promise.resolve();
        for(var i=1;i<=tot;i++){(function(n){chain=chain.then(function(){
          return pdf.getPage(n).then(function(p){return p.getTextContent();})
            .then(function(c){var pt="";c.items.forEach(function(s){pt+=s.str;if(s.hasEOL)pt+="\n";});if(pt&&pt[pt.length-1]!=="\n")pt+="\n";txt+=pt;setP(10+Math.round(n/tot*40),"Strana "+n+"/"+tot);});
        });})(i);}
        return chain.then(function(){return txt;});
      })
      .then(function(txt){
        setP(52,"Parsovanie...");var mv=parseEMDB(txt);
        if(!mv.length){hideMod();toast("Nenašli sa filmy v PDF.");return;}
        all=mv;
        buildFuse(); // rebuild Fuse index after PDF import
        safeSave(SK,JSON.stringify(all));
        setP(100,"Hotovo!");setTimeout(function(){hideMod();renderAll();toast("Importovaných "+mv.length+" filmov");if(tmdbKey){toast("Spúšťam TMDB...");setTimeout(settStartBatch,1500);}},500);
      }).catch(function(e){hideMod();toast("Chyba: "+e.message);console.error(e);});
  }
}

function parseEMDB(text){
  var mv=[];

  // ── Step 1: Clean page headers / footers from EMDB export ──────
  // Handles both "Strana X / Y" and "Page X of Y" variants
  text = text
    .replace(/EMDB[^\n]*\n\nStrana\s+\d+\s*\/\s*\d+\n\n/g, '')
    .replace(/EMDB[^\n]*\nPage\s+\d+\s+of\s+\d+[^\n]*/g, '')
    .replace(/Vytlacene[^\n]+/g, '')
    .replace(/Printed[^\n]+/g, '');

  var lines = text.split('\n');
  var i = 0;

  // ── Step 2: Entry pattern — permissive to handle PDF reflow ─────
  // Primary:   "1738: Kouzelná výměna (2026)"
  // Alternate: "1738 : Kouzelná výměna (2026)"  — space before colon
  // Alternate: "1738:Kouzelná výměna (2026)"     — no space after colon
  var entryRe = /^(\d+)\s*:\s*(.+?)\s*\((\d{4})\)\s*$/;

  while (i < lines.length) {
    var raw = lines[i];
    var l   = raw.trim();
    var m   = l.match(entryRe);

    // If no match, try joining with next line (handles PDF line-break in title)
    if (!m && i + 1 < lines.length) {
      var joined = l + ' ' + lines[i + 1].trim();
      m = joined.match(entryRe);
      if (m) i++; // consumed an extra line
    }

    if (m) {
      var num   = parseInt(m[1]);
      var title = m[2].trim();
      var year  = parseInt(m[3]);

      // ── Meta line: "Akčný, Sci-Fi - 136 min, USA" ────────────
      var metaRaw = (lines[i + 1] || '').trim();
      var genres  = [], country = '', dur = '';

      if (metaRaw.indexOf(' - ') > -1) {
        var pts    = metaRaw.split(' - ');
        genres     = pts[0].split(',').map(function(g) { return g.trim(); }).filter(Boolean);
        var rest   = pts.slice(1).join(' - ');
        var dm     = rest.match(/(\d+)\s*min/i);
        if (dm) dur = dm[1] + ' min';
        country = rest.replace(/,?\s*\d+\s*min\w*/i, '').trim().replace(/,\s*$/, '').trim();
      } else if (metaRaw) {
        // No " - " separator: could be just genres
        genres = metaRaw.split(',').map(function(g) { return g.trim(); }).filter(Boolean);
      }

      // ── Director line ─────────────────────────────────────────
      var dirRaw = (lines[i + 2] || '').trim();
      var dir    = dirRaw
        .replace(/^Directed\s+by\s*/i, '')
        .replace(/^Reziser:\s*/i, '')
        .replace(/^Réžia:\s*/i, '')
        .trim();

      // ── Cast line ─────────────────────────────────────────────
      var castRaw = (lines[i + 3] || '').trim();
      var cast    = castRaw
        .replace(/^Obsadenie:\s*/i, '')
        .replace(/^Cast:\s*/i, '')
        .trim();

      // ── Description: gather next lines until next entry ───────
      var desc = '';
      var j    = i + 4;
      while (j < lines.length && j < i + 12) {
        var nl = lines[j].trim();
        if (nl.match(/^\d+\s*:\s*/)) break; // next entry starts
        if (nl) desc += nl + ' ';
        j++;
      }

      mv.push({
        id:          num,
        num:         num,
        title:       title,
        year:        year,
        director:    dir,
        cast:        cast,
        genres:      genres,
        country:     country,
        duration:    dur,
        description: desc.trim().substring(0, 500),
        poster_thumb: '',
        rating:      0,
        tmdbId:      null,
        moods:       []
      });

      i = j;
    } else {
      i++;
    }
  }
  return mv;
}



/* ══════════════════════════════════════════════════════════
   MODULE: Export & Reset
   ══════════════════════════════════════════════════════════ */
function exportHtml(){
  if(!Object.keys(liveCache).length){toast("Najprv nacitaj data!");return;}
  toast("Generujem HTML...");
  setTimeout(function(){
    var html=document.documentElement.outerHTML;
    var tag="<scr"+"ipt>var PREBAKED_LIVE="+JSON.stringify(liveCache).replace(/<\/script/gi,"<\\/script")+";<"+"/scr"+"ipt>";
    html=html.replace("</head>",tag+"</head>");
    var blob=new Blob([html],{type:"text/html;charset=utf-8"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;
    a.download="MarcelovaFilmovaDatabaza_"+new Date().toISOString().slice(0,10)+".html";
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
    toast("HTML subor stahnuty!");
  },200);
}
function clearLiveData(){
  if(!confirm("Vymazat vsetky nacitane hodnotenia a trailery?"))return;
  liveCache={};try{localStorage.removeItem(LK);}catch(e){}
  renderList(filt);openSett();toast("Nacitane data vymazane.");
}
function clearAllData(){
  if(!confirm('Vymazať VŠETKO?\n\nPOZOR: Ak vymažeš aj cache prehliadača, dáta sa obnovia z HTML súboru. Pre trvalé vymazanie použi GitHub Sync alebo exportuj prázdny HTML.'))return;
  try{
    safeSave(SK,JSON.stringify([]));
    localStorage.removeItem(FK);
    localStorage.removeItem(WK);
    localStorage.removeItem(VK);
    localStorage.removeItem(VDK);
    localStorage.removeItem(LK);
    localStorage.removeItem(PK);
    localStorage.setItem('mdb_empty','1');
  }catch(e){}
  liveCache={};favs=new Set();wl=new Set();watched=new Set();watchedDates={};
  genre='';fpState={yearFrom:0,yearTo:0,minRating:0,country:'',genres:[]};
  favMode=false;wlMode=false;watchedMode=false;
  prefs={view:'list',sort:'num',sortDir:'desc'};
  all=[];filt=[];closeSett();
  fuseInst=null; // reset Fuse index on clear
  var ml=document.getElementById('mlist');if(ml)ml.style.display='none';
  var es=document.getElementById('emptySt');if(es)es.style.display='flex';
  var ls=document.getElementById('loadSt');if(ls)ls.style.display='none';
  buildChips();
  toast('Databáza vymazaná.');
  // Offer persistent solution after short delay
  setTimeout(function(){
    var msg=ghToken
      ?'Pre trvalé vymazanie (aj po cache clear) ulož prázdnu DB na GitHub. Uložiť teraz?'
      :'Pre trvalé vymazanie exportuj prázdny HTML a nahraj ho na server. Exportovať teraz?';
    if(confirm(msg)){ghToken?ghPush():exportHtml();}
  },500);
}

function exportJson(){
  if(!all.length){toast('Žiadne filmy na export');return;}
  var data={
    version:APP_VERSION,
    exported:new Date().toISOString(),
    movies:all,
    favourites:Array.from(favs),
    watchlist:Array.from(wl),
    watched:Array.from(watched),
    watchedDates:watchedDates,
    liveCache:liveCache
  };
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download='filmy_backup_'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
  toast('JSON záloha stiahnutá!');
}

function findDuplicates(){
  var seen={},dupes=[];
  all.forEach(function(m){
    var key=(m.title||'').toLowerCase().trim()+'|'+(m.year||0);
    if(seen[key])dupes.push({original:seen[key],duplicate:m});
    else seen[key]=m;
  });
  if(!dupes.length){toast('Žiadne duplikáty');return;}
  closeSett();
  var html='<div class="dup-header">Nájdených '+dupes.length+' duplikátov</div>';
  dupes.forEach(function(d,i){
    html+='<div class="dup-pair" data-idx="'+i+'">'
      +'<div class="dup-item"><span class="dup-num">#'+d.original.num+'</span> '+esc(d.original.title)+' ('+d.original.year+')</div>'
      +'<div class="dup-vs">vs</div>'
      +'<div class="dup-item"><span class="dup-num">#'+d.duplicate.num+'</span> '+esc(d.duplicate.title)+' ('+d.duplicate.year+')</div>'
      +'<button class="dup-rm" data-rmid="'+d.duplicate.id+'">Odstrániť #'+d.duplicate.num+'</button>'
      +'</div>';
  });
  var sb=document.getElementById("statBody");
  sb.innerHTML=html;
  document.getElementById("mainSc").classList.add("hidden");
  document.getElementById("statSc").classList.remove("hidden");
  sb.addEventListener('click',function handler(e){
    var btn=e.target.closest('.dup-rm');
    if(!btn)return;
    var rmId=parseInt(btn.dataset.rmid,10);
    all=all.filter(function(m){return m.id!==rmId;});
    favs.delete(rmId);wl.delete(rmId);watched.delete(rmId);delete watchedDates[rmId];delete liveCache[rmId];
    btn.closest('.dup-pair').remove();
    var toSave=all.map(function(m){var c=Object.assign({},m);if(c.poster_thumb&&c.poster_thumb.indexOf("data:")===0)c.poster_thumb="";return c;});
    safeSave(SK,JSON.stringify(toSave));safeSave(FK,JSON.stringify(Array.from(favs)));safeSave(WK,JSON.stringify(Array.from(wl)));
    saveLiveCache();buildFuse();renderAll();
    toast('Film #'+btn.dataset.rmid+' odstránený');
    if(!sb.querySelector('.dup-pair')){toast('Všetky duplikáty vyriešené');closeStat();}
  });
}



/* ══════════════════════════════════════════════════════════
   MODULE: UI Utilities — modal, toast, esc()
   ══════════════════════════════════════════════════════════ */
function showMod(t,s){document.getElementById("mTtl").textContent=t;document.getElementById("mSub").textContent=s;document.getElementById("mFill").style.width="0%";document.getElementById("mStat").textContent="0%";document.getElementById("mOv").classList.remove("hidden");}
function setP(p,s){document.getElementById("mFill").style.width=p+"%";document.getElementById("mStat").textContent=s;}
function hideMod(){document.getElementById("mOv").classList.add("hidden");}
function toast(msg){
  var t=document.createElement("div");t.className="toast";
  t.setAttribute("role","status");t.textContent=msg;
  document.body.appendChild(t);
  requestAnimationFrame(function(){t.classList.add("show");});
  setTimeout(function(){t.classList.remove("show");setTimeout(function(){t.remove();},250);},3000);
}
function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}


/* ── FAST SCROLL ── */



/* ══════════════════════════════════════════════════════════
   MODULE: Fast Scroll — right-side drag handle
   ══════════════════════════════════════════════════════════ */




/* ══════════════════════════════════════════════════════
   GLOBAL ERROR BOUNDARY
   Catches uncaught JS errors and unhandled promise rejections.
   Shows a non-intrusive toast instead of silent failure.
   ══════════════════════════════════════════════════════ */
window.onerror=function(msg,src,line,col,err){
  // Ignore cross-origin script errors (no useful info available)
  if(msg==="Script error."||msg==="Script error") return false;
  console.error("[FilmDB error]",msg,"@",src+":"+line,err);
  if(typeof toast==="function") toast("⚠ Chyba: "+(err&&err.message?err.message:msg).slice(0,80));
  return false; // don't suppress default browser logging
};
window.addEventListener("unhandledrejection",function(e){
  var reason=e.reason;
  if(reason&&reason.name==="AbortError") return; // intentional cancels
  console.error("[FilmDB unhandled promise]",reason);
  if(typeof toast==="function") toast("⚠ Async chyba: "+(reason&&reason.message?reason.message:String(reason)).slice(0,80));
});


/* ══════════════════════════════════════════════════════
   SERVICE WORKER — offline shell + data caching (sw.js)
   Skipped for file:// (exported HTML backups).
   ══════════════════════════════════════════════════════ */
if("serviceWorker" in navigator && location.protocol.indexOf("http")===0){
  window.addEventListener("load",function(){
    navigator.serviceWorker.register("./sw.js").catch(function(err){
      console.warn("[FilmDB] SW registration failed:",err);
    });
  });
}


document.addEventListener("DOMContentLoaded",function(){
  init();
  var _scb = document.getElementById('settCloseBtn');
  if (_scb) _scb.addEventListener('click', closeSett);
  var _so = document.getElementById('settOverlay');
  if (_so) _so.addEventListener('click', closeSett);
  document.querySelectorAll('.sett-tab').forEach(function(tab){
    tab.addEventListener('click',function(){activateSettingsTab(tab.dataset.tab);});
  });

  // Auto-push toggle
  var _apt = document.getElementById('autoPushTog');
  if (_apt) {
    _apt.checked = prefs.autoPush !== false;
    _apt.addEventListener('change', function(){
      prefs.autoPush = this.checked;
      savePrefs();
      toast(`Auto-push: ${this.checked?'zapnutý':'vypnutý'}`);
    });
  }
  // Player protocol toggle (MPC / VLC)
  document.querySelectorAll('#playerProtoToggle .ttab').forEach(function(btn){
    btn.addEventListener('click', function(){
      playerProto = this.dataset.proto;
      localStorage.setItem(PLAYER_PROTO_KEY, playerProto);
      document.querySelectorAll('#playerProtoToggle .ttab').forEach(function(b){b.className='ttab';});
      this.className='ttab on';
      toast('Prehrávač: ' + playerProto.toUpperCase());
      var _pb2=document.getElementById('playMovieBtn');
      if(_pb2){var _l2=_pb2.querySelector('.sett-btn-label');if(_l2)_l2.textContent='Prehráť · '+playerProto.toUpperCase();}
      updatePathPreview();
    });
  });
  document.querySelectorAll('#playerProtoToggle .ttab').forEach(function(b){
    b.className = (b.dataset.proto === playerProto) ? 'ttab on' : 'ttab';
  });

  function syncSortPctLabel(){
    var o=document.getElementById('sortPctOpt');
    if(o) o.textContent='Podľa % '+RATING_LABELS[ratingSource];
  }
  syncSortPctLabel();
  document.querySelectorAll('#ratingSrcToggle .ttab').forEach(function(btn){
    btn.addEventListener('click',function(){
      ratingSource=this.dataset.src;
      localStorage.setItem('mdb_ratingsrc',ratingSource);
      document.querySelectorAll('#ratingSrcToggle .ttab').forEach(function(b){b.className='ttab';});
      this.className='ttab on';
      var stEl=document.getElementById('ratingSrcSt');
      if(stEl){stEl.textContent='✓ '+RATING_LABELS[ratingSource]+' — uložené';stEl.className='sett-key-st ok';}
      syncSortPctLabel();
      applyFilters();
      toast('Hodnotenia: '+RATING_LABELS[ratingSource]);
    });
  });
  document.querySelectorAll('#ratingSrcToggle .ttab').forEach(function(b){
    b.className=(b.dataset.src===ratingSource)?'ttab on':'ttab';
  });

  var _su=document.getElementById("settBtnPdfUpdate");if(_su)_su.addEventListener("click",impPdfUpdate);
  var _fu=document.getElementById("fileInpUpdate");if(_fu)_fu.addEventListener("change",handleFileUpdate);
  var ebZip = document.getElementById('emptyBtnZip');
  if (ebZip) ebZip.addEventListener('click', function(){document.getElementById('fileInp').click();});
  var ebPull = document.getElementById('emptyBtnPull');
  if (ebPull) ebPull.addEventListener('click', function(){ ghPull(); });

  autoCheckGitHub();
  // Path mode toggle + SMB settings
  document.querySelectorAll('#pathModeToggle .ttab').forEach(function(btn){
    btn.addEventListener('click', function(){
      pathMode = this.dataset.mode;
      localStorage.setItem(PATH_MODE_KEY, pathMode);
      document.querySelectorAll('#pathModeToggle .ttab').forEach(function(b){b.className='ttab';});
      this.className = 'ttab on';
      // Aktualizuj hint - jasné zobrazenie aktívneho stavu
var _modeLabel = pathMode === 'smb' ? 'Sieťová cesta (SMB) — aktívna' : 'Lokálna cesta — aktívna';
toast(_modeLabel);
      // Aktualizuj hint s ukážkou cesty
      var _hint = document.getElementById('pathModeHint');
      if (_hint) {
        _hint.textContent = pathMode === 'smb' ? 'Sieťová (SMB) — aktívna' : 'Lokálna cesta — aktívna';
      }
      updatePathPreview();
      // Aktualizuj detail panel ak je otvorený
      var _dpth = document.querySelector('.det-path-hint');
      // Aktualizuj play button label ak je detail otvorený
      if (curId) {
        var _pb = document.getElementById('playMovieBtn');
        if (_pb) {
          var _lbl = _pb.querySelector('.sett-btn-label');
          if (_lbl) {
            var _pm = _isMobile ? (pathMode==='smb' ? 'SMB' : 'Lokálne') : (pathMode==='smb' ? 'SMB' : playerProto.toUpperCase());
            _lbl.textContent = 'Prehráť · ' + _pm;
          }
          var _mc = all.find(function(x){return x.id===curId;});
          if (_mc) _pb.onclick = function(){ playMovie(_mc.id); };
        }
      }
    });
  // Set initial active state for pathMode buttons based on localStorage
  document.querySelectorAll('#pathModeToggle .ttab').forEach(function(b){
    b.className = (b.dataset.mode === pathMode) ? 'ttab on' : 'ttab';
  });
  });
  var smbSaveBtn = document.getElementById('smbPathSave');
  if (smbSaveBtn) smbSaveBtn.addEventListener('click', function(){
    var val = document.getElementById('smbPathInp').value.trim();
    if (val) {
      if (val[val.length-1] !== '/') val += '/';
      smbBase = val;
      localStorage.setItem(SMB_KEY, val);
    }
    // Sync smbMap s aktuálnym localPathInp
    var localVal = document.getElementById('localPathInp').value.trim();
    if (localVal && val) {
      if (localVal[localVal.length-1] !== '\\' && localVal[localVal.length-1] !== '/') localVal += '\\';
      var newMap = {};
      newMap[localVal] = val;
      smbMap = newMap;
      localStorage.setItem(SMB_MAP_KEY, JSON.stringify(newMap));
    }
    var st = document.getElementById('smbPathSt');
    if (st) { st.textContent = '✓ SMB: ' + (val||smbBase); st.className = 'sett-key-st ok'; }
    updatePathPreview();
    toast('SMB základ uložený');
  });

  // Samostatný listener pre localPathSave
  var localSaveBtn = document.getElementById('localPathSave');
  if (localSaveBtn) localSaveBtn.addEventListener('click', function(){
    var localVal = document.getElementById('localPathInp').value.trim();
    if (!localVal) { toast('Zadaj lokálny základ (napr. W:\\Movies\\)'); return; }
    if (localVal[localVal.length-1] !== '\\' && localVal[localVal.length-1] !== '/') localVal += '\\';
    // Aktualizuj smbMap: localVal → smbBase
    var newMap = {};
    newMap[localVal] = smbBase;
    smbMap = newMap;
    localStorage.setItem(SMB_MAP_KEY, JSON.stringify(newMap));
    var stL = document.getElementById('localPathSt');
    if (stL) { stL.textContent = '✓ Lokálna cesta: ' + localVal; stL.className = 'sett-key-st ok'; }
    var stS = document.getElementById('smbPathSt');
    if (stS && smbBase) { stS.textContent = '✓ SMB mapovanie: ' + localVal + '→ ' + smbBase; stS.className = 'sett-key-st ok'; }
    updatePathPreview();
    toast('Lokálny základ uložený');
  });

  var _thBtn=document.getElementById('testHandlerBtn');
  if(_thBtn) _thBtn.addEventListener('click',function(){
    var proto=playerProto||'mpc';
    var testUrl;
    var stEl=document.getElementById('testHandlerSt');
    if(pathMode==='smb'){
      var base=smbBase||'smb://DESKTOP-EGOG348/Movies/';
      if(base[base.length-1]!=='/')base+='/';
      var server=base.replace(/^smb:\/\//,'')+'test-handler.mkv';
      testUrl=proto+'://'+encodeURI(server);
    } else {
      testUrl=proto+'://W/Movies/test-handler.mkv';
    }
    if(stEl){stEl.textContent='Posielam: '+testUrl;stEl.className='sett-key-st ok';}
    console.log('[FilmDB] Test handler URL:',testUrl);
    window.location.href=testUrl;
    setTimeout(function(){
      if(stEl){stEl.innerHTML='Odoslané: <code>'+testUrl+'</code><br>Ak sa prehrávač neotvoril, handler nie je správne zaregistrovaný.';stEl.className='sett-key-st';}
    },2000);
  });

  adjustScrnBody();
  setTimeout(adjustScrnBody,100);
  initTheme();
  initColorPicker();
  updatePathPreview();
  
  document.getElementById("srchInp").addEventListener("input",function(){document.getElementById("srchClr").style.display=this.value?"block":"none";applyFilters();});
  document.getElementById("srchClr").addEventListener("click",function(){document.getElementById("srchInp").value="";this.style.display="none";applyFilters();});
  /* sortSel.change handled by initSortCycle */
  var _eviewTo=document.getElementById("viewTog");if(_eviewTo)_eviewTo.addEventListener("click",function(){
    var cur=prefs.view||'list';
    var ni=VIEW_MODES.indexOf(cur);
    settSetView(VIEW_MODES[(ni+1)%VIEW_MODES.length]);
  });
  var _ebtnSet=document.getElementById("btnSett");if(_ebtnSet)_ebtnSet.addEventListener("click",openSett);
  document.getElementById("btnStat").addEventListener("click",showStats);
  document.getElementById("btnFav").addEventListener("click",function(){
    favMode=!favMode;wlMode=false;
    this.className="hdr-act hdr-act-fav"+(favMode?" active":"");
    document.getElementById("btnWl").className="hdr-act hdr-act-wl";
    document.querySelectorAll(".chip").forEach(function(c){c.classList.remove("active");});
    if(!favMode){var ca=document.getElementById("chipAll");if(ca)ca.classList.add("active");}
    applyFilters();
  });
  document.getElementById("btnWl").addEventListener("click",function(){
    wlMode=!wlMode;favMode=false;
    this.className="hdr-act hdr-act-wl"+(wlMode?" active":"");
    document.getElementById("btnFav").className="hdr-act hdr-act-fav";
    document.querySelectorAll(".chip").forEach(function(c){c.classList.remove("active");});
    if(!wlMode){var ca=document.getElementById("chipAll");if(ca)ca.classList.add("active");}
    applyFilters();
  });
  document.getElementById("btnBack").addEventListener("click",closeDet);
  document.getElementById("btnStatCls").addEventListener("click",closeStat);
  document.getElementById("trClose").addEventListener("click",closeTr);
  document.getElementById("btnBatchStop").addEventListener("click",function(){liveRunning=false;document.getElementById("batchBar").classList.add("hidden");/* bar is in flow now */saveLiveCache();renderList(filt);toast("Prerusene.");});
  document.getElementById("fileInp").addEventListener("change",handleFile);
  /* old emptyPdfBtn removed */
  document.getElementById("settOverlay").addEventListener("click",closeSett);
  var _ettabLi=document.getElementById("ttabList");if(_ettabLi)_ettabLi.addEventListener("click",function(){settSetView("list");});
  var _ettabGr=document.getElementById("ttabGrid");if(_ettabGr)_ettabGr.addEventListener("click",function(){settSetView("grid");});
  document.getElementById("settSortSel").addEventListener("change",function(){settSetSort(this.value);});
  var _etmdbSa=document.getElementById("tmdbSaveKey");if(_etmdbSa)_etmdbSa.addEventListener("click",function(){var k=document.getElementById("tmdbKeyInp").value.trim();tmdbKey=k;localStorage.setItem("tmdb_key",k);keyStatus("tmdbKeySt",k);toast(k?"TMDB k\u013E\u00FA\u010D ulo\u017Een\u00FD":"TMDB k\u013E\u00FA\u010D vymazan\u00FD");});
  document.getElementById("settBtnPdf").addEventListener("click",impPdf);
  var _eBatch=document.getElementById("settBtnBatch");if(_eBatch)_eBatch.addEventListener("click",settStartBatch);
  var _eStop=document.getElementById("settBtnStop");if(_eStop)_eStop.addEventListener("click",function(){liveRunning=false;this.classList.add("hidden");document.getElementById("batchBar").classList.add("hidden");saveLiveCache();renderList(filt);toast("Prerusene.");});
  document.getElementById('omdbSaveKey').addEventListener('click',function(){
    var k=document.getElementById('omdbKeyInp').value.trim();
    omdbKey=k;localStorage.setItem('omdb_key',k);
    var st=document.getElementById('omdbKeySt');
    if(st){st.textContent=k?'✓ OMDB kľúč uložený':'Kľúč vymazaný';st.className='sett-key-st'+(k?' ok':'');}
    toast(k?'OMDB kľúč uložený':'OMDB kľúč vymazaný');
  });
  document.getElementById('settBtnImdb').addEventListener('click',startImdbBatch);
  var _eCsfdBatch=document.getElementById('settBtnCsfd');if(_eCsfdBatch)_eCsfdBatch.addEventListener('click',startCsfdBatch);
  var _eExport=document.getElementById("settBtnExport");if(_eExport)_eExport.addEventListener("click",exportHtml);
  var _eExportJ=document.getElementById("settBtnExportJson");if(_eExportJ)_eExportJ.addEventListener("click",exportJson);
  var _eDupes=document.getElementById("settBtnDuplicates");if(_eDupes)_eDupes.addEventListener("click",findDuplicates);
  var _eClearLv=document.getElementById("settBtnClearLive");if(_eClearLv)_eClearLv.addEventListener("click",clearLiveData);
  var _eClearAll=document.getElementById("settBtnClearAll");if(_eClearAll)_eClearAll.addEventListener("click",clearAllData);
  var _eAdmin=document.getElementById("settBtnAdmin");if(_eAdmin)_eAdmin.addEventListener("click",openAdmin);

  // Uložiť všetky nastavenia
  var _eSaveAll = document.getElementById('settBtnSaveAll');
  if (_eSaveAll) _eSaveAll.addEventListener('click', function() {
    // GitHub token
    var ghInp = document.getElementById('ghTokenInp');
    if (ghInp && ghInp.value.trim()) { ghToken = ghInp.value.trim(); localStorage.setItem(GH_KEY, ghToken); }
    // TMDB key
    var tmdbInp = document.getElementById('tmdbKeyInp');
    if (tmdbInp && tmdbInp.value.trim()) { tmdbKey = tmdbInp.value.trim(); localStorage.setItem('tmdb_key', tmdbKey); }
    // SMB base
    var smbInp = document.getElementById('smbPathInp');
    if (smbInp && smbInp.value.trim()) {
      var sv = smbInp.value.trim();
      if (sv[sv.length-1] !== '/') sv += '/';
      smbBase = sv; localStorage.setItem(SMB_KEY, sv);
    }
    // Local path
    var locInp = document.getElementById('localPathInp');
    if (locInp && locInp.value.trim()) {
      var lv = locInp.value.trim();
      if (lv[lv.length-1] !== '\\' && lv[lv.length-1] !== '/') lv += '\\';
      var nm = {}; nm[lv] = smbBase; smbMap = nm;
      localStorage.setItem(SMB_MAP_KEY, JSON.stringify(nm));
    }
    // Player proto is saved on click, no extra save needed here
    // Auto pull toggle
    var apTog = document.getElementById('autoPullTog');
    if (apTog) { localStorage.setItem(AUTO_PULL_KEY, apTog.checked ? '1' : '0'); }
    var matcherInp = document.getElementById('csfdMatcherUrlInp');
    if (matcherInp && matcherInp.value.trim()) {
      var mv = matcherInp.value.trim();
      if (mv.indexOf('http') !== 0) mv = 'https://' + mv;
      csfdMatcherUrl = mv;
      localStorage.setItem(CSFD_MATCHER_URL_KEY, mv);
    }
    // Status
    var st = document.getElementById('saveAllSt');
    if (st) { st.textContent = '✓ Nastavenia uložené'; st.className = 'sett-key-st ok'; setTimeout(function(){ st.textContent=''; }, 3000); }
    toast('Nastavenia uložené ✓');
  });
  var _eExcel=document.getElementById('settBtnExcel');
  if(_eExcel) _eExcel.addEventListener('click',function(){
    var bom='﻿';
    var rows=all.map(function(m){
      var tmdbId=m.tmdbId||(liveCache[m.id]&&liveCache[m.id].tmdbUrl?liveCache[m.id].tmdbUrl.match(/\/(\d+)/):null);
      if(tmdbId&&Array.isArray(tmdbId)) tmdbId=tmdbId[1];
      tmdbId=tmdbId||'';
      var link=m._tmdbUrl||(liveCache[m.id]&&liveCache[m.id].tmdbUrl)||'';
      if(!link&&tmdbId){
        var slug=(m.title||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
        link='https://www.themoviedb.org/movie/'+tmdbId+'-'+slug;
      }
      var title=(m.title||'').replace(/,/g,' ');
      var csfd=m._csfdUrl||'';
      var csfdPct=m._pctCsfd!=null?m._pctCsfd+'%':'';
      return (m.num||'')+','+tmdbId+','+(m.year||'')+','+title+','+link+','+csfd+','+csfdPct;
    });
    var csv=bom+rows.join('\n')+'\n';
    var blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='filmy_export_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('CSV exportované ('+all.length+' filmov)');
  });

  var _eCollage=document.getElementById('settBtnCollage');
  if(_eCollage) _eCollage.addEventListener('click',function(){closeSett();exportCollage();});

  var _eRepair=document.getElementById('settBtnRepair');
  if(_eRepair) _eRepair.addEventListener('click',function(){
    if(!tmdbKey){toast('Najprv nastav TMDB API kľúč');return;}
    var broken=all.filter(function(m){
      return !m.poster_thumb||m.poster_thumb.length<10||!m.description;
    });
    var stEl=document.getElementById('repairSt');
    if(!broken.length){
      if(stEl){stEl.textContent='Všetky filmy majú plagát aj popis.';stEl.className='sett-key-st ok';}
      toast('Žiadne poškodené filmy!');return;
    }
    if(stEl){stEl.textContent='Opravujem '+broken.length+' filmov...';stEl.className='sett-key-st';}
    var done=0,fixed=0;
    var failed=[];
    function repairNext(){
      if(done>=broken.length){
        saveAllData();renderList(filt);
        var msg='Hotovo! Opravených: '+fixed+' z '+broken.length;
        if(failed.length) msg+=' (nenájdené: '+failed.length+')';
        if(stEl){stEl.textContent=msg;stEl.className='sett-key-st'+(fixed>0?' ok':'');}
        toast('Oprava dokončená: '+fixed+'/'+broken.length);
        scheduleAutoPush('repair');
        return;
      }
      var m=broken[done];
      delete liveCache[m.id];
      doTMDBFetch(m,function(data){
        if(data){liveCache[m.id]=data;fixed++;}
        else {failed.push(m.title+' ('+m.year+')');}
        done++;
        if(stEl) stEl.textContent='Opravujem... '+done+'/'+broken.length;
        setTimeout(repairNext,350);
      },null);
    }
    repairNext();
  });

  function saveCsfdMatcherUrl(){
    var inp=document.getElementById('csfdMatcherUrlInp');
    var val=(inp&&inp.value?inp.value:csfdMatcherUrl||DEFAULT_CSFD_MATCHER_URL).trim();
    if(val&&val.indexOf('http')!==0) val='https://'+val;
    csfdMatcherUrl=val||DEFAULT_CSFD_MATCHER_URL;
    localStorage.setItem(CSFD_MATCHER_URL_KEY,csfdMatcherUrl);
    var stEl=document.getElementById('csfdImportSt');
    if(stEl){stEl.textContent='✓ Matcher URL uložená';stEl.className='sett-key-st ok';}
    toast('URL matchera uložená');
  }

  function openCsfdMatcher(){
    saveCsfdMatcherUrl();
    window.open(csfdMatcherUrl,'_blank','noopener,noreferrer');
  }

  function importCsfdMatcherExport(rawText,fileName){
    var text=String(rawText||'').replace(/^﻿/,'').trim();
    var rows=/\.json$/i.test(fileName)?parseCsfdMatcherJson(text):parseCsfdMatcherCsv(text);
    var index=buildCsfdMovieIndex();
    var links=0,ratings=0,skipped=0;

    rows.forEach(function(item){
      var movie=findCsfdTargetMovie(item,index);
      if(!movie){skipped++;return;}
      if(item.tmdbId&&!movie.tmdbId) movie.tmdbId=parseInt(item.tmdbId)||item.tmdbId;
      if(item.csfdLink){movie._csfdUrl=item.csfdLink;links++;}
      var rating=parseCsfdPercent(item.csfdRating||item.rating||item.csfdPercent);
      if(rating!=null){movie._pctCsfd=rating;ratings++;}
    });

    if(links>0||ratings>0) saveAllData();
    return {links:links,ratings:ratings,skipped:skipped};
  }

  function parseCsfdMatcherJson(text){
    var parsed=JSON.parse(text);
    var list=Array.isArray(parsed)?parsed:(parsed.rows||parsed.movies||parsed.data||[]);
    if(!Array.isArray(list)) throw new Error('JSON export neobsahuje pole riadkov.');
    return list.map(function(item){
      function pick(){
        for(var i=0;i<arguments.length;i++){
          if(arguments[i]!==undefined&&arguments[i]!==null) return arguments[i];
        }
        return '';
      }
      return {
        orderNumber:String(pick(item.orderNumber,item.num,item.rowNumber)).trim(),
        tmdbId:String(pick(item.tmdbId,item.tmdbID,item.tmdb_id)).trim(),
        title:String(pick(item.title,item.nazov,item['Názov filmu'])).trim(),
        year:String(pick(item.year,item.rok,item.Rok)).trim(),
        csfdLink:String(pick(item.csfdLink,item.csfdUrl,item._csfdUrl,item['ČSFD Link'])).trim(),
        csfdRating:String(pick(item.csfdRating,item._pctCsfd,item['ČSFD Hodnotenie'],item['ČSFD %'])).trim()
      };
    });
  }

  function parseCsfdMatcherCsv(text){
    var lines=text.split(/\r?\n/).filter(function(l){return l.trim();});
    if(!lines.length) return [];
    var first=parseCsvLine(lines[0]).map(function(v){return v.trim().toLowerCase();});
    var hasHeader=first.some(function(v){return v.indexOf('tmdb')>=0||v.indexOf('čsfd')>=0||v.indexOf('csfd')>=0||v.indexOf('rok')>=0;});
    var header=hasHeader?first:[];
    var start=hasHeader?1:0;

    function idx(names,fallback){
      for(var i=0;i<header.length;i++){
        for(var n=0;n<names.length;n++){
          if(header[i].indexOf(names[n])>=0) return i;
        }
      }
      return fallback;
    }

    var orderIdx=idx(['porad','order','#'],0);
    var tmdbIdx=idx(['tmdb'],1);
    var yearIdx=idx(['rok','year'],2);
    var titleIdx=idx(['názov','nazov','title'],3);
    var linkIdx=idx(['čsfd link','csfd link','čsfd','csfd'],5);
    var ratingIdx=idx(['hodnotenie','rating','%'],6);

    return lines.slice(start).map(function(line){
      var cols=parseCsvLine(line);
      return {
        orderNumber:(cols[orderIdx]||'').trim(),
        tmdbId:(cols[tmdbIdx]||'').trim(),
        year:(cols[yearIdx]||'').trim(),
        title:(cols[titleIdx]||'').trim(),
        csfdLink:(cols[linkIdx]||'').trim(),
        csfdRating:(cols[ratingIdx]||'').trim()
      };
    }).filter(function(item){return item.tmdbId||item.orderNumber||item.csfdLink||item.csfdRating;});
  }

  function parseCsvLine(line){
    var out=[],cur='',quoted=false;
    for(var i=0;i<line.length;i++){
      var ch=line[i];
      if(ch==='"'){
        if(quoted&&line[i+1]==='"'){cur+='"';i++;}
        else quoted=!quoted;
      }else if(ch===','&&!quoted){out.push(cur);cur='';}
      else cur+=ch;
    }
    out.push(cur);
    return out;
  }

  function buildCsfdMovieIndex(){
    var byTmdb={},byNum={};
    all.forEach(function(m){
      var tid=String(m.tmdbId||(liveCache[m.id]&&liveCache[m.id].tmdbId)||'').trim();
      if(!tid&&m._tmdbUrl){
        var mt=String(m._tmdbUrl).match(/\/movie\/(\d+)/);
        if(mt)tid=mt[1];
      }
      if(tid) byTmdb[tid]=m;
      var num=String(m.num||m.orderNumber||m.id||'').trim();
      if(num) byNum[num]=m;
    });
    return {byTmdb:byTmdb,byNum:byNum};
  }

  function findCsfdTargetMovie(item,index){
    var tid=String(item.tmdbId||'').trim();
    if(tid&&index.byTmdb[tid]) return index.byTmdb[tid];
    var num=String(item.orderNumber||'').trim();
    if(num&&index.byNum[num]) return index.byNum[num];
    return null;
  }

  function parseCsfdPercent(value){
    if(value==null||value==='') return null;
    var match=String(value).match(/(\d{1,3})/);
    if(!match) return null;
    var n=parseInt(match[1]);
    if(isNaN(n)||n<0||n>100) return null;
    return n;
  }

  var _eCsfdImp=document.getElementById('settBtnImportCsfd');
  if(_eCsfdImp) _eCsfdImp.addEventListener('click',function(){
    document.getElementById('fileInpCsfd').click();
  });
  var _eCsfdOpen=document.getElementById('settBtnOpenCsfdMatcher');
  if(_eCsfdOpen) _eCsfdOpen.addEventListener('click',openCsfdMatcher);
  var _eCsfdUrlSave=document.getElementById('csfdMatcherUrlSave');
  if(_eCsfdUrlSave) _eCsfdUrlSave.addEventListener('click',saveCsfdMatcherUrl);
  document.getElementById('fileInpCsfd').addEventListener('change',function(ev){
    var file=ev.target.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(e){
      var stEl=document.getElementById('csfdImportSt');
      try{
        var result=importCsfdMatcherExport(e.target.result||'', file.name||'');
        if(stEl){
          stEl.textContent='Linky: '+result.links+', hodnotenia: '+result.ratings+', preskočených: '+result.skipped;
          stEl.className='sett-key-st'+((result.links>0||result.ratings>0)?' ok':'');
        }
        toast('Import: '+result.links+' linkov, '+result.ratings+' hodnotení');
        if(result.links>0||result.ratings>0){applyFilters();scheduleAutoPush('csfd-matcher-import');}
      }catch(err){
        if(stEl){stEl.textContent='Import zlyhal: '+(err&&err.message?err.message:'neznáma chyba');stEl.className='sett-key-st err';}
        toast('Import ČSFD zlyhal');
      }
    };
    reader.readAsText(file,'UTF-8');
    this.value='';
  });

  document.getElementById("adminClose").addEventListener("click",closeAdmin);
  document.getElementById("adminSearchBtn").addEventListener("click",adminSearch);
  document.getElementById("adminSearchInp").addEventListener("keydown",function(e){if(e.key==="Enter")adminSearch();});
  document.getElementById("adminAddBtn").addEventListener("click",adminAddMovie);
  document.getElementById("adminCancelBtn").addEventListener("click",adminClearPreview);

  document.getElementById("matchClose").addEventListener("click",closeMatchPanel);
  document.getElementById("matchSearchBtn").addEventListener("click",matchSearch);
  document.getElementById("matchSearchInp").addEventListener("keydown",function(e){if(e.key==="Enter")matchSearch();});
  document.getElementById("matchApplyBtn").addEventListener("click",matchApply);
  document.getElementById("matchCancelBtn").addEventListener("click",function(){document.getElementById('matchPreview').classList.remove('show');matchPendingData=null;});
  document.getElementById("matchOv").addEventListener("click",function(e){if(e.target===this)closeMatchPanel();});

  // GitHub sync
  initFp();
  initSortCycle();
  initKeyboard();
  document.getElementById('btnRnd').addEventListener('click', openRandomMovie);
  document.getElementById('btnWatched').addEventListener('click', cycleWatchedMode);
  initGhSync();
  window.addEventListener('offline',function(){toast('Offline — dáta sú z cache');});
  window.addEventListener('online',function(){toast('Online');});

  document.getElementById('ghTokenSave').addEventListener('click', function() {
    var t = document.getElementById('ghTokenInp').value.trim();
    ghToken = t;
      // Validate token against GitHub API
      var stEl = document.getElementById('ghTokenSt');
      if (stEl) { stEl.textContent = 'Overujem token...'; stEl.className = 'sett-key-st info'; }
      validateGhToken(t, function(ok, info) {
        if (ok) {
          if (stEl) { stEl.textContent = '✓ Token OK — ' + info; stEl.className = 'sett-key-st ok'; }
        } else {
          if (stEl) { stEl.textContent = '❌ ' + info + ' — Skontroluj scope repo, expiráciu, SSO.'; stEl.className = 'sett-key-st err'; }
        }
      });
    if (t) {
      localStorage.setItem('mdb_gh_token', t);
      // Clear input immediately — never show token in plain text
      document.getElementById('ghTokenInp').value = '';
      document.getElementById('ghTokenInp').placeholder = '••••••••••••••••••••••••••••••••••••••••';
      var st = document.getElementById('ghTokenSt');
      if (st) { st.textContent = '✓ Token uložený'; st.className = 'sett-key-st ok'; }
      toast('GitHub token uložený');
    } else {
      localStorage.removeItem('mdb_gh_token');
      ghToken = '';
      document.getElementById('ghTokenInp').placeholder = 'ghp_... Personal Access Token';
      var st = document.getElementById('ghTokenSt');
      if (st) { st.textContent = 'Token vymazaný'; st.className = 'sett-key-st err'; }
    }
  });
  document.getElementById('ghPushBtn').addEventListener('click', ghPush);
  document.getElementById('ghPullBtn').addEventListener('click', ghPull);
  var _apt = document.getElementById('autoPullTog');
  if (_apt) {
    _apt.checked = autoPull;
    _apt.addEventListener('change', function(){
      autoPull = this.checked;
      localStorage.setItem(AUTO_PULL_KEY, this.checked ? '1' : '0');
      toast(`Auto-načítanie z GitHubu: ${this.checked?'zapnuté':'vypnuté'}`);
    });
  }
  var tx=0;
  ["detSc","statSc"].forEach(function(id){
    var el=document.getElementById(id);
    el.addEventListener("touchstart",function(e){tx=e.touches[0].clientX;},{passive:true});
    el.addEventListener("touchend",function(e){if(e.changedTouches[0].clientX-tx>65){if(id==="detSc")closeDet();else closeStat();}},{passive:true});
  });
});

/* ══════════════════════════════════════════════════════════════════
   MODULE: TMDB Admin Panel
   Lets the user search TMDB by title or ID, preview, and add a
   movie directly to the local database without a PDF import.
   ══════════════════════════════════════════════════════════════════ */

// State for the admin panel
var adminPending = null; // { tmdbData, movie } waiting for confirmation



/* ══════════════════════════════════════════════════════════
   MODULE: TMDB Admin Panel — add films directly
   ══════════════════════════════════════════════════════════ */
function openAdmin() {
  closeSett();
  document.getElementById('adminPanelSc').style.display = 'block';
  document.getElementById('adminSearchInp').focus();
  adminSetStatus('');
  adminClearPreview();
  document.getElementById('adminResults').innerHTML = '';
}

function closeAdmin() {
  document.getElementById('adminPanelSc').style.display = 'none';
  adminPending = null;
}

function adminSetStatus(msg, type) {
  var el = document.getElementById('adminStatus');
  el.textContent = msg;
  el.className = 'admin-status' + (type ? ' ' + type : '');
}

function adminClearPreview() {
  document.getElementById('adminPreview').classList.remove('show');
  adminPending = null;
}

/**
 * Search TMDB by title or by numeric ID.
 * If the query is a pure number, fetch by ID directly.
 */
function adminSearch() {
  var q = document.getElementById('adminSearchInp').value.trim();
  if (!q) return;
  if (!tmdbKey) { adminSetStatus('Chýba TMDB API kľúč — nastav ho v Nastaveniach.', 'err'); return; }

  adminSetStatus('Hľadám...'); 
  document.getElementById('adminResults').innerHTML = '';
  adminClearPreview();

  var btn = document.getElementById('adminSearchBtn');
  btn.disabled = true;

  var isId = /^\d+$/.test(q);
  var url = isId
    ? 'https://api.themoviedb.org/3/movie/' + q + '?api_key=' + tmdbKey + '&language=sk&append_to_response=videos,external_ids,credits'
    : 'https://api.themoviedb.org/3/search/movie?api_key=' + tmdbKey + '&query=' + encodeURIComponent(q) + '&language=sk&page=1';

  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.disabled = false;
      if (isId) {
        if (data.success === false) { adminSetStatus('TMDB ID nenájdené.', 'err'); return; }
        adminShowResults([data]);
      } else {
        if (!data.results || !data.results.length) { adminSetStatus('Nič sa nenašlo.', 'err'); return; }
        adminShowResults(data.results.slice(0, 6));
      }
    })
    .catch(function() {
      btn.disabled = false;
      adminSetStatus('Chyba siete. Skontroluj API kľúč.', 'err');
    });
}

/** Render a list of TMDB search results as clickable cards */
function adminShowResults(results) {
  adminSetStatus(results.length + ' výsledk' + (results.length === 1 ? '' : results.length < 5 ? 'y' : 'ov'));
  var container = document.getElementById('adminResults');
  container.innerHTML = results.map(function(r, idx) {
    var poster = r.poster_path
      ? '<img class="admin-poster" src="https://image.tmdb.org/t/p/w92' + r.poster_path + '" alt="">'
      : '<div class="admin-poster-ph">🎬</div>';
    var year = (r.release_date || '').slice(0, 4) || '?';
    var rating = r.vote_average ? Math.round(r.vote_average * 10) + '%' : '–';
    var alreadyIn = all.some(function(m) { return m.tmdbId === r.id; });
    return '<div class="admin-result-item" data-idx="' + idx + '">' +
      poster +
      '<div><div class="admin-ri-title">' + esc(r.title || r.name) +
        (alreadyIn ? '<span class="admin-ri-badge">✓ v DB</span>' : '') + '</div>' +
        '<div class="admin-ri-meta">' + year + ' · ⭐ ' + rating +
        (r.original_title && r.original_title !== r.title ? '<br>' + esc(r.original_title) : '') + '</div>' +
      '</div></div>';
  }).join('');

  // Store results data for click handler
  container._results = results;

  container.querySelectorAll('.admin-result-item').forEach(function(el) {
    el.addEventListener('click', function() {
      container.querySelectorAll('.admin-result-item').forEach(function(x) { x.classList.remove('selected'); });
      el.classList.add('selected');
      adminFetchFullAndPreview(container._results[parseInt(el.dataset.idx)].id);
    });
  });
}

/** Fetch full movie details and show preview panel */
function adminFetchFullAndPreview(tmdbId) {
  adminSetStatus('Načítavam detaily...');
  fetch('https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + tmdbKey +
        '&language=sk&append_to_response=videos,external_ids,credits')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      adminSetStatus('');
      adminBuildPreview(d);
    })
    .catch(function() { adminSetStatus('Chyba načítavania detailov.', 'err'); });
}

/** Populate the preview panel from full TMDB movie detail object */
function adminBuildPreview(d) {
  var posterUrl = d.poster_path ? 'https://image.tmdb.org/t/p/w342' + d.poster_path : '';
  var thumbUrl  = d.poster_path ? 'https://image.tmdb.org/t/p/w185' + d.poster_path : '';
  var year      = (d.release_date || '').slice(0, 4) || 0;
  var dur       = d.runtime ? d.runtime + ' min' : '';
  var pct       = d.vote_average ? Math.round(d.vote_average * 10) : null;
  var genres    = (d.genres || []).map(function(g) { return g.name; });
  var videos    = (d.videos && d.videos.results) || [];
  var trailer   = videos.find(function(v) { return v.type === 'Trailer' && v.site === 'YouTube'; })
                  || videos.find(function(v) { return v.site === 'YouTube'; });
  var imdbId    = d.external_ids && d.external_ids.imdb_id ? d.external_ids.imdb_id : null;
  var cast      = (d.credits && d.credits.cast || []).slice(0, 10).map(function(a) { return a.name; }).join(', ');
  var director  = '';
  if (d.credits && d.credits.crew) {
    var dir = d.credits.crew.find(function(c) { return c.job === 'Director'; });
    if (dir) director = dir.name;
  }
  var countries = (d.production_countries || []).map(function(c) { return c.iso_3166_1; }).join(', ');

  // Show preview card
  var pvPoster = document.getElementById('adminPvPoster');
  pvPoster.src = posterUrl || '';
  pvPoster.style.display = posterUrl ? 'block' : 'none';
  document.getElementById('adminPvTitle').textContent = d.title || d.original_title;
  document.getElementById('adminPvMeta').innerHTML =
    [year, dur, countries, pct != null ? '⭐ ' + pct + '%' : ''].filter(Boolean).join(' · ') +
    (director ? '<br>🎬 ' + esc(director) : '');
  document.getElementById('adminPvGenres').innerHTML =
    genres.map(function(g) { return '<span class="admin-pv-tag">' + esc(g) + '</span>'; }).join('');
  document.getElementById('adminPvDesc').textContent = d.overview || '';
  document.getElementById('adminPreview').classList.add('show');

  // Determine next available num (max + 1)
  var nextNum = all.length ? Math.max.apply(null, all.map(function(m) { return m.num || 0; })) + 1 : 1;

  // Build the movie object that will be inserted
  adminPending = {
    movie: {
      id:          nextNum,
      num:         nextNum,
      title:       d.title || d.original_title,
      year:        parseInt(year) || 0,
      director:    director,
      cast:        cast,
      genres:      genres,
      country:     countries,
      duration:    dur,
      description: (d.overview || '').substring(0, 500),
      poster_thumb: thumbUrl,
      rating:      0,
      tmdbId:      d.id
    },
    liveData: {
      pct:     pct,
      ytKey:   trailer ? trailer.key : null,
      backdropUrl: d.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path : null,
      tmdbUrl: 'https://www.themoviedb.org/movie/' + d.id,
      imdbUrl: imdbId ? 'https://www.imdb.com/title/' + imdbId + '/' : null
    }
  };
}

/** Insert the pending movie into the live database */
function adminAddMovie() {
  if (!adminPending) return;
  var m   = adminPending.movie;
  var ld  = adminPending.liveData;

  // Add to runtime array
  all.push(m);

  // Save live data (rating, trailer, links)
  liveCache[m.id] = ld;
  saveLiveCache();

  // Persist the movie list (strip posters to stay under localStorage limit)
  adminSaveAll();

  toast(`✅ "${m.title}" pridaný do databázy!`);
  buildFuse();   // rebuild search index
  renderAll();
  closeAdmin();
  if (ghToken && prefs.autoPush !== false) {
    setTimeout(function() { toast('☁ Ukladám na GitHub...'); ghPush(); }, 800);
  }
}

/** Save all[] to localStorage (posters stripped — restored from buildMovies() on load) */
function adminSaveAll() {
  try {
    var toSave = all.map(function(m) {
      var copy = Object.assign({}, m);
      // Keep URL posters (TMDB), only strip base64 data URIs
      if (copy.poster_thumb && copy.poster_thumb.indexOf('data:') === 0) copy.poster_thumb = '';
      return copy;
    });
    safeSave(SK, JSON.stringify(toSave));
  } catch(e) {
    console.warn('[Admin] localStorage save failed:', e);
  }
}

/* ══════════════════════════════════════════════════════════
   MODULE: Manual TMDB Match — pair existing movie with TMDB
   ══════════════════════════════════════════════════════════ */
var matchMovieId=null;
var matchPendingData=null;

function openMatchPanel(id){
  var m=all.find(function(x){return x.id===id;});if(!m)return;
  matchMovieId=id;
  matchPendingData=null;
  var info=document.getElementById('matchMovieInfo');
  var poster=m.poster_thumb&&m.poster_thumb.length>10?'<img src="'+esc(m.poster_thumb)+'" alt="">':'';
  info.innerHTML=poster+'<div><div class="mmi-text"><b>#'+m.num+'</b> '+esc(m.title)+'</div><div class="mmi-sub">'+(m.year||'?')+' · '+(m.director||'–')+'</div></div>';
  document.getElementById('matchSearchInp').value=m.title;
  document.getElementById('matchStatus').textContent='';
  document.getElementById('matchResults').innerHTML='';
  document.getElementById('matchPreview').classList.remove('show');
  var ov=document.getElementById('matchOv');
  ov.classList.remove('hidden');
  ov.style.display='flex';
  document.getElementById('matchSearchInp').focus();
}

function closeMatchPanel(){
  var ov=document.getElementById('matchOv');
  ov.classList.add('hidden');
  ov.style.display='';
  matchMovieId=null;matchPendingData=null;
}

function matchSearch(){
  var q=document.getElementById('matchSearchInp').value.trim();
  if(!q)return;
  if(!tmdbKey){document.getElementById('matchStatus').textContent='Chýba TMDB API kľúč';return;}
  document.getElementById('matchStatus').textContent='Hľadám...';
  document.getElementById('matchResults').innerHTML='';
  document.getElementById('matchPreview').classList.remove('show');
  var btn=document.getElementById('matchSearchBtn');
  btn.disabled=true;
  var isId=/^\d+$/.test(q);
  var url=isId
    ?'https://api.themoviedb.org/3/movie/'+q+'?api_key='+tmdbKey+'&language=sk&append_to_response=videos,external_ids,credits'
    :'https://api.themoviedb.org/3/search/movie?api_key='+tmdbKey+'&query='+encodeURIComponent(q)+'&language=sk&page=1';
  fetch(url).then(function(r){return r.json();}).then(function(data){
    btn.disabled=false;
    if(isId){
      if(data.success===false){document.getElementById('matchStatus').textContent='TMDB ID nenájdené.';return;}
      matchShowResults([data]);
    } else {
      if(!data.results||!data.results.length){document.getElementById('matchStatus').textContent='Nič sa nenašlo.';return;}
      matchShowResults(data.results.slice(0,30));
    }
  }).catch(function(){btn.disabled=false;document.getElementById('matchStatus').textContent='Chyba siete.';});
}

function matchShowResults(results){
  document.getElementById('matchStatus').textContent=results.length+' výsledk'+(results.length===1?'':results.length<5?'y':'ov');
  var container=document.getElementById('matchResults');
  container.innerHTML=results.map(function(r,idx){
    var poster=r.poster_path?'<img class="admin-poster" src="https://image.tmdb.org/t/p/w92'+r.poster_path+'" alt="">':'<div class="admin-poster-ph">🎬</div>';
    var year=(r.release_date||'').slice(0,4)||'?';
    var rating=r.vote_average?Math.round(r.vote_average*10)+'%':'–';
    return '<div class="admin-result-item" data-idx="'+idx+'">'+poster+'<div><div class="admin-ri-title">'+esc(r.title||r.name)+'</div><div class="admin-ri-meta">'+year+' · ⭐ '+rating+(r.original_title&&r.original_title!==r.title?'<br>'+esc(r.original_title):'')+'</div></div></div>';
  }).join('');
  container._results=results;
  container.querySelectorAll('.admin-result-item').forEach(function(el){
    el.addEventListener('click',function(){
      container.querySelectorAll('.admin-result-item').forEach(function(x){x.classList.remove('selected');});
      el.classList.add('selected');
      matchFetchFull(container._results[parseInt(el.dataset.idx)].id);
    });
  });
}

function matchFetchFull(tmdbId){
  document.getElementById('matchStatus').textContent='Načítavam detaily...';
  fetch('https://api.themoviedb.org/3/movie/'+tmdbId+'?api_key='+tmdbKey+'&language=sk&append_to_response=videos,external_ids,credits')
    .then(function(r){return r.json();})
    .then(function(d){
      document.getElementById('matchStatus').textContent='';
      var posterUrl=d.poster_path?'https://image.tmdb.org/t/p/w342'+d.poster_path:'';
      var thumbUrl=d.poster_path?'https://image.tmdb.org/t/p/w185'+d.poster_path:'';
      var year=(d.release_date||'').slice(0,4)||'?';
      var dur=d.runtime?d.runtime+' min':'';
      var pct=d.vote_average?Math.round(d.vote_average*10):null;
      var genres=(d.genres||[]).map(function(g){return g.name;});
      var videos=(d.videos&&d.videos.results)||[];
      var trailer=videos.find(function(v){return v.type==='Trailer'&&v.site==='YouTube';})||videos.find(function(v){return v.site==='YouTube';});
      var imdbId=d.external_ids&&d.external_ids.imdb_id?d.external_ids.imdb_id:null;
      var cast=(d.credits&&d.credits.cast||[]).slice(0,10).map(function(a){return a.name;}).join(', ');
      var director='';
      if(d.credits&&d.credits.crew){var dir=d.credits.crew.find(function(c){return c.job==='Director';});if(dir)director=dir.name;}
      var countries=(d.production_countries||[]).map(function(c){return c.iso_3166_1;}).join(', ');

      var pvPoster=document.getElementById('matchPvPoster');
      pvPoster.src=posterUrl||'';pvPoster.style.display=posterUrl?'block':'none';
      document.getElementById('matchPvTitle').textContent=d.title||d.original_title;
      document.getElementById('matchPvMeta').innerHTML=[year,dur,countries,pct!=null?'⭐ '+pct+'%':''].filter(Boolean).join(' · ')+(director?'<br>🎬 '+esc(director):'');
      document.getElementById('matchPvGenres').innerHTML=genres.map(function(g){return '<span class="admin-pv-tag">'+esc(g)+'</span>';}).join('');
      document.getElementById('matchPreview').classList.add('show');

      matchPendingData={
        posterUrl:thumbUrl,description:(d.overview||'').substring(0,500),
        director:director,cast:cast,genres:genres,country:countries,
        duration:dur,tmdbId:d.id,
        liveData:{pct:pct,ytKey:trailer?trailer.key:null,
          backdropUrl:d.backdrop_path?'https://image.tmdb.org/t/p/w1280'+d.backdrop_path:null,
          tmdbUrl:'https://www.themoviedb.org/movie/'+d.id,
          imdbUrl:imdbId?'https://www.imdb.com/title/'+imdbId+'/':null,
          posterUrl:thumbUrl}
      };
    }).catch(function(){document.getElementById('matchStatus').textContent='Chyba načítavania.';});
}

function matchApply(){
  if(!matchPendingData||!matchMovieId)return;
  var m=all.find(function(x){return x.id===matchMovieId;});if(!m)return;
  var d=matchPendingData;
  var changes=[];
  if(d.director&&m.director&&m.director!==d.director) changes.push('Réžia: "'+m.director+'" → "'+d.director+'"');
  if(d.description&&m.description&&m.description!==d.description) changes.push('Popis: prepísaný ('+d.description.length+' znakov)');
  if(d.cast&&m.cast&&m.cast!==d.cast) changes.push('Obsadenie: prepísané');
  if(d.genres&&d.genres.length&&m.genres&&m.genres.join(',')!==d.genres.join(',')) changes.push('Žánre: '+m.genres.join(', ')+' → '+d.genres.join(', '));
  if(d.country&&m.country&&m.country!==d.country) changes.push('Krajina: "'+m.country+'" → "'+d.country+'"');
  if(d.duration&&m.duration&&m.duration!==d.duration) changes.push('Dĺžka: '+m.duration+' → '+d.duration);

  if(changes.length>0){
    var msg='Nasledujúce polia budú prepísané:\n\n'+changes.join('\n')+'\n\nPokračovať?';
    if(!confirm(msg)) return;
  }

  if(d.posterUrl)m.poster_thumb=d.posterUrl;
  if(d.description)m.description=d.description;
  if(d.director)m.director=d.director;
  if(d.cast)m.cast=d.cast;
  if(d.genres&&d.genres.length)m.genres=d.genres;
  if(d.country)m.country=d.country;
  if(d.duration)m.duration=d.duration;
  if(d.tmdbId)m.tmdbId=d.tmdbId;
  liveCache[m.id]=d.liveData;
  saveLiveCache();
  adminSaveAll();
  toast('✓ Film "'+m.title+'" spárovaný s TMDB #'+d.tmdbId);
  closeMatchPanel();
  openDet(m.id);
  renderAll();
  scheduleAutoPush('match');
}

/* ══════════════════════════════════════════════════════════════════
   MODULE: GitHub Online Sync
   Reads/writes a `data.json` file in the same GitHub repo using
   the GitHub REST API and a Personal Access Token (PAT).
   ══════════════════════════════════════════════════════════════════ */

var GH_KEY        = 'mdb_gh_token';
var GH_REPO       = 'bucala/Filmy';
var GH_FILE       = 'data.json';
var GH_BRANCH     = 'main';
var AUTO_PULL_KEY = 'mdb_auto_pull';
var autoPull      = localStorage.getItem(AUTO_PULL_KEY) !== '0'; // default: ON
var ghToken       = localStorage.getItem('mdb_gh_token') || '';

/* ══════════════════════════════════════════════════════════
   MODULE: GitHub Sync — push/pull data.json
   ══════════════════════════════════════════════════════════ */


function ghSetStatus(msg, type) {
  var el = document.getElementById('ghSyncStatus');
  if (el) { el.textContent = msg; el.className = 'sync-status ' + (type || 'info'); }
  var mb = document.getElementById('mainPullStatus');
  var mt = document.getElementById('mainPullStatusText');
  var ep = document.getElementById('emptyPullStatus');
  if (mt) mt.textContent = msg;
  if (ep) ep.textContent = msg;
  if (mb) {
    if (type === 'ok') {
      var bar = document.getElementById('mainPullBar');
      if (bar) bar.style.width = '100%';
      setTimeout(function(){
        mb.classList.add('hidden');
        if (bar) bar.style.width = '0%';
        /* bar is in flow now */
      }, 1400);
    } else if (type === 'err') {
      mb.classList.remove('hidden');
      mb.style.borderBottomColor = '#e05555';
      /* bar is in flow now */
      setTimeout(function(){
        mb.classList.add('hidden');
        mb.style.borderBottomColor = '';
        /* bar is in flow now */
      }, 3500);
    } else {
      mb.classList.remove('hidden');
      mb.style.borderBottomColor = '';
      /* bar is in flow now */
    }
  }
}

function ghPullProgress(pct) {
  var bar = document.getElementById('mainPullBar');
  if (bar) bar.style.width = pct + '%';
}

function ghHeaders() {
  return {
    'Authorization': 'token ' + ghToken,
    'Accept':        'application/vnd.github.v3+json',
    'Content-Type':  'application/json'
  };
}

function ghApiFileUrl() {
  return 'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE + '?ref=' + GH_BRANCH;
}

function ghPush() {
  if (!ghToken) { ghSetStatus('Nastav GitHub token.', 'err'); return; }
  if (ghPushInProgress) { scheduleAutoPush('busy'); return; }
  ghPushInProgress = true;
  if (!all || !all.length) {
    ghPushInProgress = false;
    ghSetStatus('Žiadne dáta na uloženie. Najprv importuj alebo načítaj.', 'err');
    toast('Databáza je prázdna');
    return;
  }
  ghSetStatus(`Pripravujem ${all.length} filmov na upload...`, 'info');

  var payload = {
    version:   1,
    updated:   new Date().toISOString(),
    movies:    all.map(function(m) {
      var c = Object.assign({}, m);
      if (c.poster_thumb && c.poster_thumb.indexOf('data:') === 0) c.poster_thumb = '';
      return c;
    }),
    liveCache: liveCache,
    favourites: Array.from(favs),
    watchlist:  Array.from(wl),
    watched:    Array.from(watched),
    watchedDates: watchedDates
  };

  var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
  const baseUrl = `https://api.github.com/repos/${GH_REPO}`;
  var hdrs    = ghHeaders();

  // ── Simple approach: GET current SHA from Contents API, then PUT ──
  // This is more reliable than the Git Data API tree traversal
  function doWrite(sha) {
    var body = {
      message: `FilmDB sync ${new Date().toISOString().slice(0,10)}`,
      content: encoded,
      branch:  GH_BRANCH
    };
    if (sha) body.sha = sha;

    return fetch(`${baseUrl}/contents/${GH_FILE}`, {
      method: 'PUT', headers: hdrs, body: JSON.stringify(body)
    }).then(function(r) {
      return r.json().then(function(d) { return { status: r.status, ok: r.ok, d: d }; });
    });
  }

  // Step 1: Get current file SHA (or null if file doesn't exist)
  fetch(`${baseUrl}/contents/${GH_FILE}?ref=${GH_BRANCH}`, { headers: hdrs })
    .then(function(r) {
      if (r.status === 401) {
        ghSetStatus('❌ Token odmietnutý (401). Skontroluj: scope repo, expiráciu, SSO.', 'err');
        toast('GitHub 401: Token neplatný. Vygeneruj nový PAT s scope repo.');
        throw new Error('401');
      }
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('GET failed: ' + r.status);
      return r.json().then(function(d) {
        // Pre veľké súbory d.sha môže chýbať → použij git/trees API
        if (d.sha) return d.sha;
        // Fallback: get SHA via git trees
        return fetch(`${baseUrl}/git/trees/${GH_BRANCH}`, { headers: hdrs })
          .then(function(tr) { return tr.json(); })
          .then(function(tree) {
            var f = (tree.tree||[]).find(function(x){ return x.path === GH_FILE; });
            return f ? f.sha : null;
          });
      });
    })
    // Step 2: Write with the SHA
    .then(function(sha) {
      ghSetStatus('Nahrávam dáta…', 'info');
      return doWrite(sha);
    })
    .then(function(res) {
      if (res.ok) {
        ghPushInProgress = false;
        var ts = new Date().toLocaleTimeString('sk');
        ghSetStatus(`✓ Uložené ${ts} · ${all.length} filmov`, 'ok');
        toast('Databáza uložená na GitHub!');
      } else if (res.status === 409 || res.status === 422) {
        ghSetStatus('SHA mismatch, opakujem…', 'info');
        setTimeout(function(){
          fetch(`${baseUrl}/contents/${GH_FILE}?ref=${GH_BRANCH}&t=${Date.now()}`, { headers: hdrs, cache: 'no-store' })
            .then(function(r2) {
              if (!r2.ok) throw new Error('Retry GET failed: ' + r2.status);
              return r2.json();
            })
            .then(function(d2) {
              if (!d2.sha) {
                return fetch(`${baseUrl}/git/trees/${GH_BRANCH}`, { headers: hdrs, cache: 'no-store' })
                  .then(function(tr){return tr.json();})
                  .then(function(tree){
                    var f=(tree.tree||[]).find(function(x){return x.path===GH_FILE;});
                    return f?f.sha:null;
                  });
              }
              return d2.sha;
            })
            .then(function(sha2){ return doWrite(sha2); })
            .then(function(res2) {
              ghPushInProgress = false;
              if (res2.ok) {
                ghSetStatus(`✓ Uložené (2. pokus) · ${all.length} filmov`, 'ok');
                toast('Databáza uložená na GitHub!');
              } else {
                ghSetStatus(`Chyba retry: ${(res2.d&&res2.d.message)||res2.status}`, 'err');
              }
            })
            .catch(function(e2){ghPushInProgress=false;ghSetStatus(`Retry zlyhalo: ${e2.message}`, 'err');});
        }, 1500);
      } else {
        ghPushInProgress = false;
        ghSetStatus(`Chyba: ${(res.d&&res.d.message)||'HTTP '+res.status}`, 'err');
      }
    })
    .catch(function(e) {
      ghPushInProgress = false;
      if(e.message!=='401')ghSetStatus(`Sieťová chyba: ${e.message}`, 'err');
    });
}

function ghPull() {
  ghPullProgress(10);
  ghSetStatus('Načítavam z GitHubu…', 'info');

  // Bez tokenu: použijeme public raw URL (len čítanie)
  // S tokenom: použijeme API URL (vyšší rate limit, private repo)
  var ghPullAttempt = function(attempt) {
  // GitHub Contents API má CORS hlavičky → funguje bez tokenu pre public repo
  var pullUrl     = ghApiFileUrl() + '&t=' + Date.now();
  var pullHeaders = ghToken ? ghHeaders() : { 'Accept': 'application/vnd.github.v3+json' };
  fetch(pullUrl, { headers: pullHeaders })
    .then(function(r) {
      if (r.status === 401) throw new Error('401_UNAUTH');
      if (r.status === 403) {
        var reset = r.headers.get('X-RateLimit-Reset');
        var wait  = reset ? Math.ceil((reset*1000 - Date.now())/60000) : '?';
        throw new Error(`403_RATELIMIT:${wait}`);
      }
      if (r.status === 429) throw new Error('429_RATELIMIT');
      if (r.status === 404) throw new Error('404');
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(function(file) {
      // Pre veľké súbory (>1MB) GitHub API nevracia content → použijeme download_url
      if (!file) throw new Error('data.json neexistuje na GitHub — najprv ulož (Push).');
      if (!file.content && file.download_url) {
        // Fallback: fetch priamo cez download_url (raw URL, bez CORS problémov pre public repo)
        return fetch(file.download_url + '?t=' + Date.now())
          .then(function(r2) { if (!r2.ok) throw new Error('download_url failed: ' + r2.status); return r2.text(); })
          .then(function(rawText) {
            var payload2;
            try { payload2 = JSON.parse(rawText); } catch(je) { throw new Error('Neplatný JSON: ' + je.message); }
            return payload2;
          });
      }
      if (!file.content) {
        throw new Error('data.json neobsahuje dáta — najprv ulož databázu cez Push.');
      }
      var b64clean = file.content.replace(/\s/g, '');
      var binary   = atob(b64clean);
      var bytes    = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var raw = new TextDecoder('utf-8').decode(bytes);
      var payload;
      try { payload = JSON.parse(raw); }
      catch(je) { throw new Error('Neplatný JSON: ' + je.message + ' (veľkosť: ' + raw.length + 'B)'); }
      return payload;
    })
    .then(function(payload) {

      if (!payload.movies || !payload.movies.length) {
        ghSetStatus('Súbor data.json je prázdny — najprv ulož (Push).', 'err');
        return;
      }

      // Restore posters from baked-in C00 data
      var bakedMap = {};
      try {
        buildMovies().forEach(function(m) {
          if (m.poster_thumb && m.poster_thumb.length > 10) bakedMap[m.num] = m.poster_thumb;
        });
      } catch(e) {}
      all.forEach(function(m) {
        if (m.poster_thumb && m.poster_thumb.length > 10) bakedMap[m.num] = m.poster_thumb;
      });
      payload.movies.forEach(function(m) {
        // Restore base64 poster from C00 if poster is empty (URL posters preserved)
        if ((!m.poster_thumb||m.poster_thumb.length<10) && bakedMap[m.num]) m.poster_thumb = bakedMap[m.num];
      });

      ghPullProgress(50);
      all = payload.movies;
      if (payload.liveCache) {
        Object.assign(liveCache, payload.liveCache);
        saveLiveCache();
      }
      if (payload.favourites) { favs = new Set(payload.favourites); safeSave(FK, JSON.stringify(payload.favourites)); }
      if (payload.watchlist)  { wl = new Set(payload.watchlist);    safeSave(WK, JSON.stringify(payload.watchlist)); }
      if (payload.watched)    { watched = new Set(payload.watched); safeSave(VK, JSON.stringify(payload.watched)); }
      if (payload.watchedDates) { watchedDates = payload.watchedDates; safeSave(VDK, JSON.stringify(payload.watchedDates)); }
      // Restore poster URLs from liveCache for movies without poster
      all.forEach(function(m){
        if((!m.poster_thumb||m.poster_thumb.length<10)&&liveCache[m.id]&&liveCache[m.id].posterUrl){
          m.poster_thumb=liveCache[m.id].posterUrl;
        }
      });

      try {
        var toSave = all.map(function(m) {
          var c = Object.assign({}, m);
          // Keep URL posters, only strip base64 data URIs
          if (c.poster_thumb && c.poster_thumb.indexOf('data:') === 0) c.poster_thumb = '';
          return c;
        });
        safeSave(SK, JSON.stringify(toSave));
      } catch(e) {}

      ghPullProgress(80);
      var ts2=new Date().toLocaleTimeString('sk');
      buildFuse();
      renderAll();
      ghPullProgress(100);
      ghSetStatus('✓ Načítané ' + ts2 + ' · ' + all.length + ' filmov', 'ok');
      toast('Databáza načítaná z GitHubu!');
    })
    .catch(function(e) {
      if (e.message.indexOf('404') >= 0) {
        ghSetStatus('data.json ešte neexistuje — najprv ulož (Push).', 'err');
      } else if (e.message.indexOf('401_UNAUTH') >= 0) {
        ghSetStatus('⚠ Neplatný GitHub token — skontroluj nastavenia.', 'err');
      } else if (e.message.indexOf('403_RATELIMIT') >= 0) {
        var wait = e.message.split(':')[1] || '?';
        ghSetStatus(`⏳ GitHub rate limit — skús znova o ${wait} min.`, 'err');
      } else if (e.message.indexOf('429_RATELIMIT') >= 0) {
        ghSetStatus('⏳ GitHub rate limit — skús znova o chvíľu.', 'err');
      } else if (attempt < 2) {
        ghSetStatus(`Opakujem pokus ${attempt+1}/2…`, 'info');
        setTimeout(function() { ghPullAttempt(attempt + 1); }, 3000);
        return;
      } else {
        ghSetStatus(`Chyba: ${e.message}`, 'err');
      }
    });
  };
  ghPullAttempt(0);
}

function initGhSync() {
  ghToken = localStorage.getItem('mdb_gh_token') || '';
  // Never pre-fill token — show placeholder dots if token exists
  var inp = document.getElementById('ghTokenInp');
  var st  = document.getElementById('ghTokenSt');
  if (inp) inp.value = '';
  if (inp && ghToken) inp.placeholder = '••••••••••••••••••••••••••••••••••••••••';
  if (st && ghToken)  { st.textContent = '✓ Token je uložený'; st.className = 'sett-key-st ok'; }
}


/* ══════════════════════════════════════════════════════════════════
   MODULE: Advanced Filter Panel
   State: fpState holds all active filter criteria.
   The genre chips in fbar (single genre) and the panel's multi-genre
   checkboxes work as ONE unified genre filter — fbar is a quick
   shortcut into the panel's genre selection.
   ══════════════════════════════════════════════════════════════════ */

/* fpState and fpActiveCount() are declared at the top of the IIFE
   (near other state vars) to ensure they are available when applyFilters()
   runs during init(). See state vars section above. */

/* Open the filter panel, populating dynamic content from current data */


/* ══════════════════════════════════════════════════════════
   MODULE: Advanced Filter Panel
   ══════════════════════════════════════════════════════════ */
function openFp() {
  closeSett();
  var panel   = document.getElementById('fpPanel');
  var overlay = document.getElementById('fpOverlay');

  // ── Populate country dropdown ────────────────────────────────
  var countries = {};
  all.forEach(function(m) {
    (m.country || '').split(/[,\/]/).forEach(function(c) {
      var t = c.trim();
      if (t) countries[t] = (countries[t] || 0) + 1;
    });
  });
  var cSorted = Object.entries(countries).sort(function(a,b) { return b[1]-a[1]; });
  var cSel = document.getElementById('fpCountry');
  cSel.innerHTML = '<option value="">Všetky krajiny</option>';
  cSorted.forEach(function(e) {
    var opt = document.createElement('option');
    opt.value = e[0];
    opt.textContent = e[0] + ' (' + e[1] + ')';
    if (e[0] === fpState.country) opt.selected = true;
    cSel.appendChild(opt);
  });

  // ── Populate genre checkboxes ─────────────────────────────────
  var gc = {};
  all.forEach(function(m) { (m.genres||[]).forEach(function(g) { gc[g]=(gc[g]||0)+1; }); });
  var gSorted = Object.entries(gc).sort(function(a,b) { return b[1]-a[1]; });
  var gBox = document.getElementById('fpGenreChips');
  gBox.innerHTML = '';
  gSorted.forEach(function(e) {
    var g   = e[0];
    var cnt = e[1];
    var ch  = document.createElement('div');
    ch.className = 'fp-genre-chip' + (fpState.genres.indexOf(g) >= 0 ? ' on' : '');
    ch.textContent = g + ' (' + cnt + ')';
    ch.dataset.genre = g;
    ch.addEventListener('click', function() {
      var idx = fpState.genres.indexOf(g);
      if (idx >= 0) fpState.genres.splice(idx, 1);
      else          fpState.genres.push(g);
      ch.classList.toggle('on', fpState.genres.indexOf(g) >= 0);
    });
    gBox.appendChild(ch);
  });

  // ── Restore slider / year / tag values ──────────────────────────────
  document.getElementById('fpYearFrom').value    = fpState.yearFrom || '';
  document.getElementById('fpYearTo').value      = fpState.yearTo   || '';
  document.getElementById('fpRatingSlider').value = fpState.minRating;
  document.getElementById('fpRatingVal').textContent = fpState.minRating + '%';
  var tagInp=document.getElementById('fpTag');if(tagInp)tagInp.value=fpState.tag||'';

  overlay.classList.add('open');
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeFp() {
  document.getElementById('fpPanel').classList.remove('open');
  document.getElementById('fpOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* Apply panel values → fpState → applyFilters */
function applyFp() {
  fpState.yearFrom  = parseInt(document.getElementById('fpYearFrom').value)  || 0;
  fpState.yearTo    = parseInt(document.getElementById('fpYearTo').value)    || 0;
  fpState.minRating = parseInt(document.getElementById('fpRatingSlider').value) || 0;
  fpState.country   = document.getElementById('fpCountry').value;
  fpState.tag       = (document.getElementById('fpTag')||{}).value||'';
  // genres already updated live via chip clicks

  // Sync fbar: if exactly one genre is selected in panel, reflect it in fbar
  if (fpState.genres.length === 1) {
    genre = fpState.genres[0];
  } else {
    genre = '';  // fbar shows "Všetky" when 0 or 2+ genres selected
  }
  buildChips();  // re-render fbar to show active state

  closeFp();
  updateFpBadge();
  updateFpPills();
  applyFilters();
}

/* Reset all panel filters */
function resetFp() {
  fpState = { yearFrom:0, yearTo:0, minRating:0, country:'', genres:[], tag:'' };
  genre   = '';
  document.getElementById('fpYearFrom').value     = '';
  document.getElementById('fpYearTo').value       = '';
  document.getElementById('fpRatingSlider').value = 0;
  document.getElementById('fpRatingVal').textContent = '0%';
  document.getElementById('fpCountry').value      = '';
  var tagInp=document.getElementById('fpTag');if(tagInp)tagInp.value='';
  document.querySelectorAll('.fp-genre-chip').forEach(function(c) { c.classList.remove('on'); });
  buildChips();
  closeFp();
  updateFpBadge();
  updateFpPills();
  applyFilters();
}

/* Update the badge count on the filter button */
function updateFpBadge() {
  var cnt   = fpActiveCount();
  var badge = document.getElementById('fpBadge');
  var btn   = document.getElementById('fpBtn');
  badge.textContent = cnt;
  badge.className   = 'fp-badge' + (cnt ? ' show' : '');
  btn.className     = 'ctrl-btn fp-btn' + (cnt ? ' active' : '');
}

/* Render dismissible pills showing active filters */
function updateFpPills() {
  var pills = document.getElementById('fpPills');
  pills.innerHTML = '';

  function pill(label, resetFn) {
    var p  = document.createElement('div');
    p.className = 'fp-pill';
    var x  = document.createElement('span');
    x.className = 'fp-pill-x';
    x.textContent = '✕';
    x.addEventListener('click', resetFn);
    p.appendChild(document.createTextNode(label));
    p.appendChild(x);
    pills.appendChild(p);
  }

  if (fpState.yearFrom > 0 || fpState.yearTo > 0) {
    var yr = (fpState.yearFrom || '…') + '–' + (fpState.yearTo || '…');
    pill('📅 ' + yr, function() { fpState.yearFrom=0; fpState.yearTo=0; updateFpBadge(); updateFpPills(); applyFilters(); });
  }
  if (fpState.minRating > 0) {
    pill('⭐ min ' + fpState.minRating + '%', function() { fpState.minRating=0; updateFpBadge(); updateFpPills(); applyFilters(); });
  }
  if (fpState.country) {
    pill('🌍 ' + fpState.country, function() { fpState.country=''; updateFpBadge(); updateFpPills(); applyFilters(); });
  }
  fpState.genres.forEach(function(g) {
    pill('🎬 ' + g, function() {
      var i = fpState.genres.indexOf(g);
      if (i >= 0) fpState.genres.splice(i,1);
      if (genre === g) genre = '';
      buildChips();
      updateFpBadge();
      updateFpPills();
      applyFilters();
    });
  });
  // pills live inside the header — re-measure so the list doesn't hide under it
  adjustScrnBody();
}

function initFp() {
  document.getElementById('fpBtn').addEventListener('click', openFp);
  document.getElementById('fpClose').addEventListener('click', closeFp);
  document.getElementById('fpOverlay').addEventListener('click', closeFp);
  document.getElementById('fpApply').addEventListener('click', applyFp);
  document.getElementById('fpReset').addEventListener('click', resetFp);
  document.getElementById('fpRatingSlider').addEventListener('input', function() {
    document.getElementById('fpRatingVal').textContent = this.value + '%';
  });
}


/* ══════════════════════════════════════════════════════════════════
   MODULE: Random Movie
   Picks a random film from the current filtered list and opens
   its detail view. Respects all active filters.
   ══════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════
   MODULE: Random Movie
   ══════════════════════════════════════════════════════════ */
function openRandomMovie() {
  if (!filt || !filt.length) { toast('Ziadne filmy na vyber.'); return; }
  var pick = filt[Math.floor(Math.random() * filt.length)];
  openDet(pick.id);
}


/* ══════════════════════════════════════════════════════════════════
   MODULE: Watch History
   Tracks which films have been seen and when. Provides:
   - togWatched(id) — mark/unmark as seen (stores ISO date)
   - "Videné" header button — filter to seen films
   - "Nevidené" accessible via same button (cycle: all → seen → unseen)
   - Watched date shown in detail view
   ══════════════════════════════════════════════════════════════════ */



/* ══════════════════════════════════════════════════════════
   MODULE: Watch History — mark films as seen
   ══════════════════════════════════════════════════════════ */
function togWatched(id, btn) {
  if (watched.has(id)) {
    watched.delete(id);
    delete watchedDates[id];
  } else {
    watched.add(id);
    watchedDates[id] = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }
  try { localStorage.setItem(VK,  JSON.stringify(Array.from(watched))); }    catch(e) {}
  try { localStorage.setItem(VDK, JSON.stringify(watchedDates)); }           catch(e) {}
  scheduleAutoPush('togWatched');
  if (btn) updWatchedBtn(btn, id);
  // Update detail view badge if open
  var db = document.getElementById('dwatchedBtn');
  if (db && curId === id) updWatchedBtn(db, id);
  if (watchedMode) applyFilters();
}

function updWatchedBtn(btn, id) {
  var seen = watched.has(id);
  btn.innerHTML = seen ? '✓ Videne' : '– Nevidene';
  btn.className = 'btn-fav' + (seen ? ' on' : '');
}

/* Cycle: all → videné → nevidené → all */
function cycleWatchedMode() {
  watchedMode = !watchedMode;
  // Deactivate other collection filters
  if (watchedMode) { favMode = false; wlMode = false;
    document.getElementById("btnFav").className="hdr-act hdr-act-fav";
    document.getElementById("btnWl").className="hdr-act hdr-act-wl";
  }
  var btn = document.getElementById('btnWatched');
  btn.className = 'hdr-act hdr-act-watch' + (watchedMode ? ' active' : '');
  btn.title     = watchedMode ? 'Videne — klikni pre Vsetky' : 'Zobrazit videne filmy';
  applyFilters();
}


/* ══════════════════════════════════════════════════════════════════
   MODULE: Keyboard Shortcuts
   /      → focus search input
   Escape → close open overlays (detail, trailer, settings, filter)
   ←  →   → navigate between films in detail view (prev/next)
   ══════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════
   MODULE: Keyboard Shortcuts — /, Esc, ← →
   ══════════════════════════════════════════════════════════ */
function initKeyboard() {
  document.addEventListener('keydown', function(e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var inInput = (tag === 'input' || tag === 'textarea' || tag === 'select');

    // / → focus search
    if (e.key === '/' && !inInput) {
      e.preventDefault();
      var inp = document.getElementById('srchInp');
      if (inp) { inp.focus(); inp.select(); }
      return;
    }

    // Escape → close topmost overlay
    if (e.key === 'Escape') {
      if (!document.getElementById('matchOv').classList.contains('hidden')) {
        closeMatchPanel(); return;
      }
      if (!document.getElementById('trOv').classList.contains('hidden')) {
        closeTr(); return;
      }
      if (document.getElementById('fpPanel').classList.contains('open')) {
        closeFp(); return;
      }
      if (!document.getElementById('settOverlay').classList.contains('hidden')) {
        closeSett(); return;
      }
      var adminEl = document.getElementById('adminPanelSc');
      if (adminEl && adminEl.offsetParent !== null) {
        closeAdmin(); return;
      }
      if (!document.getElementById('statSc').classList.contains('hidden')) {
        closeStat(); return;
      }
      if (!document.getElementById('detSc').classList.contains('hidden')) {
        document.getElementById('btnBack').click(); return;
      }
      return;
    }

    // ← → navigate films in detail view
    if (!document.getElementById('detSc').classList.contains('hidden') && !inInput) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!curId || !filt.length) return;
        var idx = -1;
        for (var fi = 0; fi < filt.length; fi++) { if (filt[fi].id === curId) { idx = fi; break; } }
        if (idx < 0) return;
        var next = e.key === 'ArrowRight'
          ? filt[idx + 1] || filt[0]
          : filt[idx - 1] || filt[filt.length - 1];
        if (next) openDet(next.id);
      }
    }
  });
}


/* ══════════════════════════════════════════════════════════════════
   MODULE: Similar Films
   Finds films in the local DB that share the most genres with the
   current film, excluding the film itself. Falls back to same
   director if genres are sparse. Returns top N results.
   ══════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════
   MODULE: Similar Films — genre/director scoring
   ══════════════════════════════════════════════════════════ */
function getSimilarFilms(movie, n) {
  n = n || 4;
  var scored = all
    .filter(function(m) { return m.id !== movie.id; })
    .map(function(m) {
      var score = 0;
      // Genre overlap (primary signal)
      (movie.genres || []).forEach(function(g) {
        if ((m.genres || []).indexOf(g) >= 0) score += 2;
      });
      // Same director (secondary)
      if (movie.director && m.director && movie.director === m.director) score += 3;
      // Same decade
      if (movie.year && m.year && Math.abs(movie.year - m.year) <= 5) score += 1;
      return { m: m, score: score };
    })
    .filter(function(x) { return x.score > 0; })
    .sort(function(a, b) { return b.score - a.score; });
  return scored.slice(0, n).map(function(x) { return x.m; });
}

function buildSimilarHtml(movie){
  const similar=getSimilarFilms(movie,6);
  if(!similar.length)return "";
  const cards=similar.map(m=>{
    const poster=m.poster_thumb&&m.poster_thumb.length>10
      ?`<img class="sim-poster" src="${m.poster_thumb}" alt="" loading="lazy">`
      :'<div class="sim-poster-ph">🎬</div>';
    return `<div class="sim-card" data-sid="${m.id}">${poster}<div class="sim-title">${esc(m.title)}</div></div>`;
  }).join("");
  return `<div class="sec">PODOBNÉ FILMY</div><div class="similar-row" id="simRow">${cards}</div>`;
}


/* ══════════════════════════════════════════════════════════════════
   ARCHITECTURE NOTES — Pre-Refactoring Audit Checklist
   ══════════════════════════════════════════════════════════════════

   CURRENT STRUCTURE (single-file):
   ┌─ index.html
   │  ├─ <head>      CDN scripts (pdf.js, Fuse.js, Chart.js), PWA manifest
   │  ├─ <style>     All CSS (~280 lines) — variables, components, screens
   │  ├─ <body>      All HTML — screens: mainSc, detSc, statSc, adminPanelSc
   │  └─ <script>    Single IIFE (~2200 lines total):
   │     ├─ DATA     C00..C21 baked-in movie arrays + buildMovies()
   │     ├─ STATE    Global vars: all, filt, favs, wl, watched, genre, etc.
   │     ├─ STORAGE  SK, FK, WK, VK, VDK, LK, PK, GH_KEY, ACCENT_KEY
   │     └─ MODULES  (in order of declaration):
   │        · init()            — app bootstrap, localStorage restore
   │        · renderAll()       — rebuild chips + fuse + filter
   │        · buildChips()      — fbar genre chip generation
   │        · setGenre()        — fbar click handler (syncs fpState)
   │        · applyFilters()    — main filter/search pipeline
   │        · buildFuse()       — Fuse.js index rebuild
   │        · applyAccentColor()— CSS var --gold override
   │        · initColorPicker() — settings color swatches
   │        · applyHL() hlField()— fuzzy search highlight helpers
   │        · sortList()        — sort filt array in place
   │        · cardHTML()        — card HTML string builder
   │        · renderList()      — virtual scroll / DOM update
   │        · openDet()         — detail screen builder
   │        · togFav/Wl/Watched()— collection toggles
   │        · showStats()       — Chart.js stats screen
   │        · closeStat()       — destroys Chart.js instances
   │        · openAdmin()       — TMDB admin panel
   │        · adminSearch/Fetch/Preview/Add() — TMDB API flow
   │        · ghPush/Pull()     — GitHub sync
   │        · [Filter Panel]    — fpState, openFp, applyFp, resetFp
   │        · [Random Movie]    — openRandomMovie()
   │        · [Watch History]   — togWatched, cycleWatchedMode
   │        · [Similar Films]   — getSimilarFilms, buildSimilarHtml
   │        · [Keyboard]        — initKeyboard()
   │        · DOMContentLoaded  — all event listener wiring

   PLANNED REFACTORING (future audit):
   ┌─ index.html      — HTML skeleton only, links to CSS/JS
   ├─ style.css       — all styles (split by component if >500 lines)
   ├─ data.json       — movie data (replaces C00..C21 baked-in)
   ├─ app.js          — IIFE → ES modules
   │  ├─ state.js     — global state + localStorage keys
   │  ├─ db.js        — buildMovies(), parseEMDB(), handleFile()
   │  ├─ filter.js    — applyFilters(), buildChips(), setGenre(), fpState
   │  ├─ ui.js        — cardHTML(), renderList(), openDet(), openAdmin()
   │  ├─ sync.js      — ghPush(), ghPull(), adminSaveAll()
   │  ├─ stats.js     — showStats(), Chart.js wrappers
   │  └─ init.js      — DOMContentLoaded wiring
   └─ sw.js           — Service Worker (offline cache)

   KNOWN TECHNICAL DEBT:
   · C00..C21 base64 posters baked in HTML (~17MB) — move to data.json + CDN
   · genre var (single) + fpState.genres (array) are partially duplicated
   · No error boundary around TMDB fetch flows
   · liveCache not validated on load (could contain stale/invalid entries)
   · buildChips() rebuilds entire DOM on every renderAll() — can be diffed

   ══════════════════════════════════════════════════════════════════ */


/* ══════════════════════════════════════════════════════════════════
   MODULE: Theme Palette
   Applies a data-theme to <html> which activates a CSS variable set.
   The color picker (--gold override) works ON TOP of the theme,
   so each theme has its own accent color as default, but the user
   can still override with the custom color picker.
   ══════════════════════════════════════════════════════════════════ */

var THEME_KEY = 'mdb_theme1';
var THEME_ACCENTS = {
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



/* ══════════════════════════════════════════════════════════
   MODULE: Theme (unified skin system)
   ══════════════════════════════════════════════════════════ */
var _autoThemeMq = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(skinId) {
  var resolved = skinId;
  if (skinId === 'auto') {
    resolved = _autoThemeMq.matches ? 'dark' : 'linen';
  }
  document.documentElement.setAttribute('data-skin',  resolved);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.removeAttribute('data-text');
  document.documentElement.removeAttribute('data-bg');
  try { localStorage.setItem(THEME_KEY, skinId); } catch(e) {}
  localStorage.removeItem(ACCENT_KEY);
  var acc = THEME_ACCENTS[resolved];
  if (acc) applyAccentColor(acc.gold, acc.gold2);
  document.querySelectorAll('.skin-chip').forEach(function(s) {
    s.classList.toggle('active', s.dataset.skin === skinId);
  });
}

_autoThemeMq.addEventListener('change', function() {
  if (localStorage.getItem(THEME_KEY) === 'auto') applyTheme('auto');
});

function initTheme() {
  var saved = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(saved);
  // Wire skin-chip clicks
  document.querySelectorAll('.skin-chip').forEach(function(s) {
    s.addEventListener('click', function() {
      applyTheme(s.dataset.skin);
      var acc = THEME_ACCENTS[s.dataset.skin];
      if (acc) { var cc = document.getElementById('colorCustom'); if (cc) cc.value = acc.gold; }
    });
  });
}


/* ══════════════════════════════════════════════════════════════════
   MODULE: Header Overflow Drawer
   At narrow widths, secondary action buttons slide into a drawer
   that opens from the right side of the header.
   The drawer buttons are duplicates wired to the same actions.
   ══════════════════════════════════════════════════════════════════ */





/* ══════════════════════════════════════════════════════════
   MODULE: Header Overflow Drawer — mobile navigation
   ══════════════════════════════════════════════════════════ */






/* ══════════════════════════════════════════════════════════════════
   MODULE: Sort Cycle Pill
   sortCycle button cycles: Por.→Rok→A–Z→%→Por.
   sortDir button flips asc/desc
   Both sync with hidden #sortSel for backward compatibility
   ══════════════════════════════════════════════════════════════════ */

function syncSortPill(){
  var cur = prefs.sort || 'num';
  var sel = document.getElementById('sortSel');
  var dirBtn = document.getElementById('sortDir');
  if (sel) sel.value = cur;
  var asc = (prefs.sortDir || 'desc') === 'asc';
  if (dirBtn){
    dirBtn.innerHTML = asc ? '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="14" x2="8" y2="2"/><polyline points="4,6 8,2 12,6"/></svg>' : '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="14"/><polyline points="4,10 8,14 12,10"/></svg>';
    dirBtn.title = asc ? 'Zostupne' : 'Vzostupne';
  }
}

function initSortCycle(){
  document.getElementById('sortDir').addEventListener('click',function(){
    prefs.sortDir = (prefs.sortDir||'desc')==='desc' ? 'asc' : 'desc';
    savePrefs(); syncSortPill(); applyFilters();
  });
  document.getElementById('sortSel').addEventListener('change',function(e){
    prefs.sort = e.target.value;
    savePrefs(); syncSortPill(); applyFilters();
  });
  syncSortPill();
}



/* ══════════════════════════════════════════════════════════════════
   FEATURE: PDF Update — merge/diff import
   Reads PDF, compares with current data, only adds/updates differences.
   ══════════════════════════════════════════════════════════════════ */
function impPdfUpdate(){
  try{localStorage.removeItem("mdb_empty");}catch(e){}
  document.getElementById("fileInpUpdate").click();
}

function handleFileUpdate(){
  var file=document.getElementById("fileInpUpdate").files[0];if(!file)return;
  document.getElementById("fileInpUpdate").value="";closeSett();
  showMod("Aktualizujem dáta","Porovnávam s existujúcou databázou...");setP(2,"Čítam súbor...");
  
  var isZip = file.name.toLowerCase().endsWith('.zip');
  var parsePromise;
  
  if (isZip) {
    parsePromise = loadJSZip().then(function(){return file.arrayBuffer();}).then(function(ab){ return parseEMDBZip(ab, setP); });
  } else {
    // Legacy PDF
    parsePromise = loadPdfJs().then(function(){return file.arrayBuffer();}).then(function(ab){
      setP(10,"PDF...");return pdfjsLib.getDocument({data:ab}).promise;
    }).then(function(pdf){
      var tot=pdf.numPages,txt="",chain=Promise.resolve();
      for(var i=1;i<=tot;i++){(function(n){chain=chain.then(function(){
        return pdf.getPage(n).then(function(p){return p.getTextContent();}).then(function(c){
          var pt="";c.items.forEach(function(s){pt+=s.str;if(s.hasEOL)pt+="\n";});if(pt&&pt[pt.length-1]!=="\n")pt+="\n";txt+=pt;setP(10+Math.round(n/tot*45),"Strana "+n+"/"+tot);
        });
      });})(i);}
      return chain.then(function(){return parseEMDB(txt);});
    });
  }
  
  parsePromise.then(function(newMovies){
    if(!newMovies||!newMovies.length){hideMod();toast("Nenašli sa filmy.");return;}
    setP(90,"Porovnávam...");
    var existMap={};
    all.forEach(function(m){existMap[m.num]=m;});
    var added=0,updated=0,unchanged=0;
    var mergeFields=["title","year","duration","director","genres","country","cast","description","_localPath","_yt","_tmdbUrl","_imdbUrl","_csfdUrl","_pctImdb","_pctCsfd","tmdbId","_tags"];
    newMovies.forEach(function(nm){
      var existing=existMap[nm.num];
      if(!existing){
        nm.id=nm.num;all.push(nm);existMap[nm.num]=nm;added++;
      } else {
        var changed=false;
        mergeFields.forEach(function(f){
          var nv=nm[f],ev=existing[f];
          if(nv&&String(nv).trim()&&String(nv).trim()!==String(ev||"").trim()){
            existing[f]=nm[f];changed=true;
          }
        });
        // Update poster only if new one exists and old doesn't
        if(nm.poster_thumb&&nm.poster_thumb.length>10&&(!existing.poster_thumb||existing.poster_thumb.length<10)){
          existing.poster_thumb=nm.poster_thumb;changed=true;
        }
        if(changed) updated++; else unchanged++;
      }
    });
    all.sort(function(a,b){return(a.num||0)-(b.num||0);});
    filt=all.slice();
    var toSave=all.map(function(m){var c=Object.assign({},m);if(c.poster_thumb&&c.poster_thumb.indexOf("data:")===0)c.poster_thumb="";return c;});safeSave(SK,JSON.stringify(toSave));
    applyFilters();setP(100,"Hotovo!");
    setTimeout(function(){hideMod();toast("✓ +"+added+" nových, "+updated+" upravených, "+unchanged+" bez zmeny");},600);
  }).catch(function(err){hideMod();toast("Chyba: "+err.message);console.error(err);});
}



/* ══════════════════════════════════════════════════════════════════
   LAYOUT: Dynamic header height adjustment for #scrnBody
   ══════════════════════════════════════════════════════════════════ */
function adjustScrnBody(){
  var hdr=document.querySelector('#mainSc .hdr');
  var sb=document.getElementById('scrnBody');
  if(!hdr||!sb)return;
  var h=hdr.offsetHeight;
  sb.style.top=h+'px';
}
window.addEventListener('resize',adjustScrnBody);
window.addEventListener('load',adjustScrnBody);


/* extractPostersFromPdf (~140 lines) removed — never called. Restore from git history if needed. */
function extractPostersFromPdf(){}


/* ══════════════════════════════════════════════════════════════════
   MODULE: VLC Local Playback via SMB
   Builds mpc:// URLs from movie metadata to play local .mkv files
   File naming convention: "YYYY - Title (no diacritics).mkv"
   SMB share path configurable in settings
   ══════════════════════════════════════════════════════════════════ */
var SMB_KEY     = 'mdb_smb_base';
var PLAYER_PROTO_KEY = 'mdb_player_proto';
var playerProto = localStorage.getItem(PLAYER_PROTO_KEY) || 'mpc';

var PATH_MODE_KEY = 'mdb_path_mode';
var smbBase    = localStorage.getItem(SMB_KEY) || 'smb://DESKTOP-EGOG348/Movies/';
var pathMode   = localStorage.getItem(PATH_MODE_KEY) || 'smb'; // 'local' or 'smb'

// SMB mapping: local drive letter → SMB share
// W:\Movies\ → smb://DESKTOP-EGOG348/Movies/
var SMB_MAP_KEY = 'mdb_smb_map';
var smbMap;
try { smbMap = JSON.parse(localStorage.getItem(SMB_MAP_KEY) || '{}'); } catch(e) { smbMap = {}; }
if (!smbMap || typeof smbMap !== 'object' || !Object.keys(smbMap).length) smbMap = {"W:\\\\Movies\\\\":"smb://DESKTOP-EGOG348/Movies/"};

function removeDiacritics(str) {
  var map = {
    'á':'a','Á':'A','č':'c','Č':'C','ď':'d','Ď':'D','é':'e','É':'E',
    'ě':'e','Ě':'E','í':'i','Í':'I','ň':'n','Ň':'N','ó':'o','Ó':'O',
    'ö':'o','Ö':'O','ř':'r','Ř':'R','š':'s','Š':'S','ť':'t','Ť':'T',
    'ú':'u','Ú':'U','ů':'u','Ů':'U','ü':'u','Ü':'U','ý':'y','Ý':'Y',
    'ž':'z','Ž':'Z','ä':'a','Ä':'A','ľ':'l','Ľ':'L','ĺ':'l','Ĺ':'L',
    'ŕ':'r','Ŕ':'R','ô':'o','Ô':'O','ë':'e','ï':'i','ñ':'n','ç':'c',
    'à':'a','â':'a','è':'e','ê':'e','ì':'i','î':'i','ò':'o','ù':'u','û':'u'
  };
  return str.replace(/[^\x00-\x7F]/g, function(ch){ return map[ch] || ch; });
}

function buildMovieFilename(m) {
  var title = removeDiacritics(m.title || '');
  title = title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
  return (m.year || '0000') + ' - ' + title + '.mkv';
}

function localPathToSmb(localPath) {
  // Convert W:\Movies\file.mkv → smb://DESKTOP-EGOG348/Movies/file.mkv
  var p = localPath.replace(/\\/g, '/');
  // Try each mapping
  for (var local in smbMap) {
    var localNorm = local.replace(/\\/g, '/');
    if (p.indexOf(localNorm) === 0 || p.toLowerCase().indexOf(localNorm.toLowerCase()) === 0) {
      return smbMap[local] + p.substring(localNorm.length);
    }
  }
  // Fallback: replace drive letter with smbBase
  var driveMatch = p.match(/^([A-Z]):\//i);
  if (driveMatch) {
    var base = smbBase;
    if (base[base.length-1] !== '/') base += '/';
    return base + p.substring(3); // skip "W:/"
  }
  return p;
}

function getMoviePath(m) {
  var rawPath = m._localPath || '';
  if (!rawPath) {
    rawPath = 'W:/Movies/' + buildMovieFilename(m);
  } else {
    rawPath = rawPath.replace(/\\/g, '/');
  }
  if (pathMode === 'smb') {
    return localPathToSmb(rawPath);
  }
  return rawPath;
}

var _isAndroid=/android/i.test(navigator.userAgent);
var _isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
var _isMobile=_isAndroid||_isiOS;

function updatePathPreview(){
  var el=document.getElementById('playPathPreview');
  if(!el)return;
  var sample='2026 - Tom Clancys Jack Ryan.mkv';
  var proto=playerProto||'mpc';
  if(pathMode==='smb'){
    var base=smbBase||'smb://DESKTOP-EGOG348/Movies/';
    if(base[base.length-1]!=='/')base+='/';
    var smbPath=base+sample;
    var server=smbPath.replace(/^smb:\/\//,'');
    var protoUrl=proto+'://'+encodeURI(server);
    var uncPath='\\\\'+server.replace(/\//g,'\\');
    el.innerHTML='<b style="color:#81c784">Aktívna cesta:</b> '+smbPath.replace(/</g,'&lt;')+'<br>'+
      '<b style="color:#81c784">Protokol:</b> <code>'+protoUrl.replace(/</g,'&lt;')+'</code><br>'+
      '<b style="color:#81c784">Handler otvorí:</b> '+uncPath.replace(/</g,'&lt;');
  } else {
    var localBase='W:\\Movies\\';
    for(var k in smbMap){localBase=k;break;}
    localBase=localBase.replace(/\//g,'\\');
    if(localBase[localBase.length-1]!=='\\') localBase+='\\';
    var localPath=localBase+sample;
    var fwdPath=localPath.replace(/\\/g,'/');
    var driveStripped=fwdPath.replace(/^([A-Za-z]):/,'$1');
    var protoUrl=proto+'://'+encodeURI(driveStripped);
    el.innerHTML='<b style="color:#81c784">Aktívna cesta:</b> '+localPath.replace(/</g,'&lt;')+'<br>'+
      '<b style="color:#81c784">Protokol:</b> <code>'+protoUrl.replace(/</g,'&lt;')+'</code><br>'+
      '<b style="color:#81c784">Handler otvorí:</b> '+localPath.replace(/</g,'&lt;');
  }
}

function playMovie(id){
  var m=all.find(function(x){return x.id===id;});
  if(!m)return;
  var path=getMoviePath(m);
  if(!path){toast('Cesta k súboru nie je nastavená.');return;}

  if(_isAndroid){
    var scheme=pathMode==='smb'?'smb':'file';
    var target=pathMode==='smb'?path.replace(/^smb:\/\//,''):path;
    window.location.href='intent://'+target+'#Intent;scheme='+scheme+';type=video/*;end';
    return;
  }

  // PC — clipboard gets Windows backslash path, protocol gets forward-slash path
  var clipPath=path.replace(/\//g,'\\');
  if(pathMode==='smb'&&clipPath.indexOf('smb:\\\\')==0){
    clipPath='\\\\'+clipPath.substring(6);
  }
  copyToClip(clipPath);

  var protoPath=path.replace(/\\/g,'/');
  if(pathMode==='smb'){
    if(protoPath.indexOf('smb://')==0) protoPath=protoPath.substring(6);
  }
  var proto=playerProto||'mpc';
  window.location.href=proto+'://'+encodeURI(protoPath);

  var label=proto.toUpperCase();
  setTimeout(function(){
    toast('Cesta skopírovaná. Ak sa '+label+' neotvoril, skontroluj registráciu '+proto+':// handlera.');
  },800);
}

function copyToClip(text){
  if(navigator.clipboard){
    navigator.clipboard.writeText(text).catch(function(){});
  } else {
    var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
  }
}


function copyMoviePath(id) {
  
  var m = all.find(function(x) { return x.id === id; });
  if (!m) return;
  var path = getMoviePath(m);
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(path).then(function() {
      toast('Cesta skopírovaná (' + (pathMode==='smb'?'Sieťová':'Lokálna') + '): ' + path);
    });
  } else {
    // Fallback
    prompt('Cesta k súboru:', path);
  }
}


/* ══════════════════════════════════════════════════════════════════
   MODULE: EMDB ZIP Import
   Reads EMDB HTML export ZIP, parses index.html + movie HTML files,
   extracts covers/posters, builds movie array for the database.
   ══════════════════════════════════════════════════════════════════ */
function parseEMDBZip(zipData, progressCb) {
  if (typeof JSZip === 'undefined') {
    return Promise.reject(new Error('JSZip knižnica sa nenačítala'));
  }
  progressCb(5, 'Načítavam ZIP...');
  
  return JSZip.loadAsync(zipData).then(function(zip) {
    progressCb(10, 'Čítam index.html...');
    
    // Find index.html (in root or HTML/ subfolder)
    var indexPath = null;
    zip.forEach(function(path) {
      if (path.match(/^(HTML\/)?index\.html$/i) && !path.match(/patch/i)) {
        indexPath = path;
      }
    });
    
    if (!indexPath) {
      throw new Error('index.html nenájdený v ZIP');
    }
    
    return zip.file(indexPath).async('string').then(function(indexHtml) {
      progressCb(15, 'Parsovanie zoznamu filmov...');
      
      // Decode HTML entities helper
      var textarea = document.createElement('textarea');
      function decEnt(s) { textarea.innerHTML = s; return textarea.value; }
      
      // Parse all movies from "all-movies" section thumbnails
      var movies = [];
      var thumbRe = /<li class="thumbnail">\s*<a href="movies\/(\d+)\.html">.*?<div class="thumbnail-text">\s*(\d+)<br\/?>(.+?)\s*<\/div>/gs;
      var match;
      while ((match = thumbRe.exec(indexHtml)) !== null) {
        var num = parseInt(match[1]);
        var titleYear = decEnt(match[3]).replace(/\u00a0/g, ' ').trim();
        var ym = titleYear.match(/^(.+?)\s*\((\d{4})\)$/);
        movies.push({
          id: num, num: num,
          title: ym ? ym[1].trim() : titleYear,
          year: ym ? parseInt(ym[2]) : null,
          director: '', genres: [], country: '', duration: '',
          cast: '', description: '', poster_thumb: '',
          rating: 0, tmdbId: null, moods: [],
          _yt: null, _tmdbUrl: null, _imdbUrl: null,
          _localPath: ''
        });
      }
      
      progressCb(20, 'Nájdených ' + movies.length + ' filmov');
      
      // Build movie map by num for easy lookup
      var movieMap = {};
      movies.forEach(function(m) { movieMap[m.num] = m; });
      
      // Parse individual movie HTML files for detailed data
      var movieFiles = [];
      zip.forEach(function(path) {
        if (path.match(/^(HTML\/)?movies\/\d+\.html$/i) && !path.match(/patch/i)) {
          movieFiles.push(path);
        }
      });
      
      progressCb(25, 'Parsovanie ' + movieFiles.length + ' detailných súborov...');
      
      var detailChain = Promise.resolve();
      var detailsDone = 0;
      
      movieFiles.forEach(function(mfPath) {
        detailChain = detailChain.then(function() {
          return zip.file(mfPath).async('string').then(function(mhtml) {
            mhtml = decEnt(mhtml);
            
            // Extract movie number from filename
            var numMatch = mfPath.match(/(\d+)\.html$/);
            if (!numMatch) return;
            var num = parseInt(numMatch[1]);
            var m = movieMap[num];
            if (!m) return;
            
            // Title from <title> tag (more reliable)
            var titleM = mhtml.match(/<title>\d+\s*-\s*(.+?)\s*\((\d{4})\)<\/title>/);
            if (titleM) {
              m.title = titleM[1].trim();
              m.year = parseInt(titleM[2]);
            }
            
            // Director
            var dirM = mhtml.match(/<b>Re.is.r:<\/b>\s*(.*?)<\/p>/s);
            if (dirM) m.director = dirM[1].replace(/<[^>]+>/g, '').trim();
            
            // Genres
            var genM = mhtml.match(/<b>.{1,5}nre:<\/b>\s*(.*?)<\/p>/s);
            if (genM) m.genres = genM[1].replace(/<[^>]+>/g, '').trim().split(',').map(function(g){return g.trim();}).filter(Boolean);
            
            // Country + Duration
            var statM = mhtml.match(/<b>.t.t:<\/b>\s*(.*?)<\/p>/s);
            if (statM) {
              var statStr = statM[1].replace(/<[^>]+>/g, '').trim();
              var durM = statStr.match(/(\d+)\s*min/);
              if (durM) m.duration = durM[1] + ' min';
              m.country = statStr.replace(/,?\s*\d+\s*min.t/, '').trim();
            }
            
            // YouTube trailer
            var ytM = mhtml.match(/youtube\.com\/watch\?v=([^"&]+)/);
            if (ytM) m._yt = ytM[1];
            
            // TMDB ID + URL
            var tmdbM = mhtml.match(/themoviedb\.org\/movie\/(\d+)/);
            if (tmdbM) {
              m.tmdbId = parseInt(tmdbM[1]);
              m._tmdbUrl = 'https://www.themoviedb.org/movie/' + tmdbM[1];
            }
            
            // IMDB URL
            var imdbM = mhtml.match(/imdb\.com\/title\/(tt\d+)/);
            if (imdbM) m._imdbUrl = 'https://www.imdb.com/title/' + imdbM[1] + '/';
            
            // Local file path
            var pathM = mhtml.match(/<b>Umiestnenie:<\/b>\s*(.*?)<\/p>/);
            if (pathM) m._localPath = pathM[1].trim();
            
            // Video src as backup path
            if (!m._localPath) {
              var vidM = mhtml.match(/<video[^>]+src="([^"]+)"/);
              if (vidM) m._localPath = vidM[1];
            }
            
            // Description
            var descM = mhtml.match(/<b>Obsah deja:<\/b><br>\s*(.*?)<\/p>/s);
            if (descM) m.description = descM[1].replace(/<[^>]+>/g, '').trim().substring(0, 500);
            
            // Cast
            var castNames = [];
            var actorRe = /<span class="actor-name">(.*?)<\/span>/g;
            var am;
            while ((am = actorRe.exec(mhtml)) !== null) {
              castNames.push(am[1].trim());
            }
            if (castNames.length) m.cast = castNames.join(', ');
            
            // RT score
            var rtM = mhtml.match(/class="percentage">(\d+)%/);
            if (rtM) m._rtScore = parseInt(rtM[1]);
            
            detailsDone++;
            if (detailsDone % 10 === 0) {
              progressCb(25 + Math.round(detailsDone / movieFiles.length * 20),
                'Detail ' + detailsDone + '/' + movieFiles.length);
            }
          });
        });
      });
      
      return detailChain.then(function() {
        progressCb(50, 'Extrahujem plagáty...');
        
        // Extract poster images from covers/
        var coverFiles = [];
        zip.forEach(function(path) {
          if (path.match(/^(HTML\/)?covers\/\d{6}\.jpg$/i) && !path.match(/patch/i)) {
            coverFiles.push(path);
          }
        });
        
        var coverChain = Promise.resolve();
        var coversDone = 0;
        
        coverFiles.forEach(function(cPath) {
          coverChain = coverChain.then(function() {
            return zip.file(cPath).async('base64').then(function(b64) {
              var numMatch = cPath.match(/(\d+)\.jpg$/i);
              if (!numMatch) return;
              var num = parseInt(numMatch[1]);
              var m = movieMap[num];
              if (m) {
                m.poster_thumb = 'data:image/jpeg;base64,' + b64;
              }
              coversDone++;
              if (coversDone % 10 === 0) {
                progressCb(50 + Math.round(coversDone / coverFiles.length * 35),
                  'Plagáty ' + coversDone + '/' + coverFiles.length);
              }
            });
          });
        });
        
        return coverChain.then(function() {
          progressCb(90, 'Finalizácia...');
          // Sort by num descending (newest first in original order)
          movies.sort(function(a, b) { return a.num - b.num; });
          return movies;
        });
      });
    });
  });
}


function validateGhToken(token, cb) {
  fetch('https://api.github.com/user', {
    headers: {'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json'}
  }).then(function(r) {
    if (r.status === 200) return r.json().then(function(u) { cb(true, u.login); });
    if (r.status === 401) cb(false, 'Token neplatný alebo expiroval');
    else cb(false, 'HTTP ' + r.status);
  }).catch(function(e) { cb(false, e.message); });
}


/* ══════════════════════════════════════════════════════════════════
   AUTO-PULL: If no local data but GitHub token exists, offer to load
   ══════════════════════════════════════════════════════════════════ */
function autoCheckGitHub() {
  if (all.length > 0) return;
  var es = document.getElementById('emptySt');
  if (!ghToken) {
    if (es) es.style.display = 'flex';
    return;
  }
  // If autoPull is enabled, init() already scheduled a ghPull — don't double-fetch.
  if (autoPull) return;
  toast('Žiadne lokálne dáta. Načítavam z GitHubu...');
  setTimeout(function() { ghPull(); }, 600);
}


/* ── Auto-push to GitHub (5s debounce) ──────────────────────────── */
function exportCollage(){
  var src=filt.length?filt:all;
  var movies=src.filter(function(m){return m.poster_thumb&&m.poster_thumb.length>10;});
  if(!movies.length){toast('Žiadne filmy s plagátmi');return;}
  var max=60;
  if(movies.length>max)movies=movies.slice(0,max);
  var cols=Math.ceil(Math.sqrt(movies.length*1.5));
  var rows=Math.ceil(movies.length/cols);
  var pw=150,ph=225;
  var canvas=document.createElement('canvas');
  canvas.width=cols*pw;canvas.height=rows*ph;
  var ctx=canvas.getContext('2d');
  ctx.fillStyle='#0a0a0f';ctx.fillRect(0,0,canvas.width,canvas.height);
  var loaded=0;
  movies.forEach(function(m,i){
    var img=new Image();
    img.crossOrigin='anonymous';
    img.onload=function(){
      var col=i%cols,row=Math.floor(i/cols);
      ctx.drawImage(img,col*pw,row*ph,pw,ph);
      loaded++;
      if(loaded>=movies.length){
        canvas.toBlob(function(blob){
          var a=document.createElement('a');
          a.href=URL.createObjectURL(blob);
          a.download='filmy_collage_'+new Date().toISOString().slice(0,10)+'.png';
          a.click();URL.revokeObjectURL(a.href);
          toast('Koláž exportovaná ('+movies.length+' filmov)');
        },'image/png');
      }
    };
    img.onerror=function(){loaded++;if(loaded>=movies.length)img.onload();};
    img.src=m.poster_thumb;
  });
}

var autoPushTimer = null;
var ghPushInProgress = false;
function scheduleAutoPush(reason) {
  if (!ghToken || prefs.autoPush === false) return;
  if (autoPushTimer) clearTimeout(autoPushTimer);
  autoPushTimer = setTimeout(function() {
    autoPushTimer = null;
    if (ghPushInProgress) { scheduleAutoPush('deferred'); return; }
    if (all && all.length) ghPush();
  }, 5000);
}
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden' && autoPushTimer) {
    clearTimeout(autoPushTimer); autoPushTimer = null;
    if (!ghPushInProgress && ghToken && all && all.length) ghPush();
  }
});


/* Auto Dark/Light Theme — integrated into applyTheme above */


/* ══════════════════════════════════════════════════════════
   MODULE: Duplicate Detection
   ══════════════════════════════════════════════════════════ */
function levenshtein(a, b) {
  var m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  var d = [];
  for (var i = 0; i <= m; i++) d[i] = [i];
  for (var j = 0; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) {
    for (j = 1; j <= n; j++) {
      d[i][j] = a[i-1] === b[j-1] ? d[i-1][j-1]
        : Math.min(d[i-1][j-1], d[i-1][j], d[i][j-1]) + 1;
    }
  }
  return d[m][n];
}

function findDuplicates() {
  var groups = [], seen = new Set();
  for (var i = 0; i < all.length; i++) {
    if (seen.has(i)) continue;
    var group = [all[i]];
    var ti = (all[i].title || '').toLowerCase().trim();
    var yi = all[i].year || 0;
    var tidi = all[i].tmdb_id || all[i].id;
    for (var j = i + 1; j < all.length; j++) {
      if (seen.has(j)) continue;
      var tj = (all[j].title || '').toLowerCase().trim();
      var yj = all[j].year || 0;
      var tidj = all[j].tmdb_id || all[j].id;
      var dup = false;
      if (tidi && tidj && tidi === tidj && i !== j) dup = true;
      if (!dup && ti === tj && ti.length > 0) dup = true;
      if (!dup && yi === yj && yi > 0 && ti.length > 2 && tj.length > 2 && levenshtein(ti, tj) <= 2) dup = true;
      if (dup) { group.push(all[j]); seen.add(j); }
    }
    if (group.length > 1) { groups.push(group); seen.add(i); }
  }
  return groups;
}

function openDupPanel() {
  var groups = findDuplicates();
  var el = document.getElementById('dupContent');
  if (!groups.length) {
    el.innerHTML = '<div class="dup-empty">Ziadne duplikaty nenajdene</div>';
  } else {
    var h = '';
    groups.forEach(function(g, gi) {
      h += '<div class="dup-group"><div class="dup-group-hdr">Skupina ' + (gi+1) + ' (' + g.length + ' filmy)</div>';
      g.forEach(function(m) {
        var poster = m.poster_thumb && m.poster_thumb.length > 10
          ? '<img class="dup-poster" src="' + esc(m.poster_thumb) + '" alt="">'
          : '<div class="dup-poster" style="background:var(--card2)"></div>';
        h += '<div class="dup-row">' + poster +
          '<div class="dup-info"><div class="dup-title">' + esc(m.title || '') + '</div>' +
          '<div class="dup-meta">#' + m.num + ' | ' + (m.year || '?') + ' | ID:' + m.id + '</div></div>' +
          '<button class="dup-del" data-id="' + m.id + '" title="Odstranit">&#x2715;</button></div>';
      });
      h += '</div>';
    });
    el.innerHTML = h;
  }
  document.getElementById('dupOv').classList.remove('hidden');
  el.addEventListener('click', function(e) {
    var btn = e.target.closest('.dup-del');
    if (!btn) return;
    var id = parseInt(btn.dataset.id, 10);
    if (!confirm('Naozaj odstranit film #' + id + '?')) return;
    all = all.filter(function(m) { return m.id !== id; });
    filt = filt.filter(function(m) { return m.id !== id; });
    favs.delete(id); wl.delete(id); watched.delete(id);
    safeSave(SK, JSON.stringify(all));
    safeSave(FK, JSON.stringify(Array.from(favs)));
    scheduleAutoPush('dup-delete');
    toast('Film odstraneny');
    openDupPanel();
    renderAll();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var dupBtn = document.getElementById('settBtnDuplicates');
  if (dupBtn) dupBtn.addEventListener('click', openDupPanel);
  var dupClose = document.getElementById('dupClose');
  if (dupClose) dupClose.addEventListener('click', function() { document.getElementById('dupOv').classList.add('hidden'); });
  var dupOv = document.getElementById('dupOv');
  if (dupOv) dupOv.addEventListener('click', function(e) { if (e.target === dupOv) dupOv.classList.add('hidden'); });
});


/* ══════════════════════════════════════════════════════════
   MODULE: Bulk Edit
   ══════════════════════════════════════════════════════════ */
var bulkMode = false, bulkSel = new Set();

function toggleBulkMode() {
  bulkMode = !bulkMode;
  bulkSel.clear();
  var ml = document.getElementById('mlist');
  var inl = document.getElementById('bulkInline');
  var btn = document.getElementById('btnBulk');
  if (bulkMode) {
    ml.classList.add('bulk-mode');
    inl.classList.remove('hidden');
    btn.classList.add('on');
  } else {
    ml.classList.remove('bulk-mode');
    inl.classList.add('hidden');
    btn.classList.remove('on');
    ml.querySelectorAll('.bulk-sel').forEach(function(c) { c.classList.remove('bulk-sel'); });
  }
  updateBulkCnt();
}

function updateBulkCnt() {
  var el = document.getElementById('bulkCnt');
  if (el) el.textContent = bulkSel.size + ' vybraných';
  var cb = document.getElementById('bulkSelAllCb');
  if (cb) {
    var ml = document.getElementById('mlist');
    var total = ml ? ml.querySelectorAll('[data-id]').length : 0;
    cb.checked = total > 0 && bulkSel.size >= total;
    cb.indeterminate = bulkSel.size > 0 && bulkSel.size < total;
  }
}

function bulkToggleCard(card) {
  var id = parseInt(card.dataset.id, 10);
  if (bulkSel.has(id)) { bulkSel.delete(id); card.classList.remove('bulk-sel'); }
  else { bulkSel.add(id); card.classList.add('bulk-sel'); }
  updateBulkCnt();
}

document.addEventListener('DOMContentLoaded', function() {
  var btnBulk = document.getElementById('btnBulk');
  if (btnBulk) btnBulk.addEventListener('click', toggleBulkMode);

  document.getElementById('mlist').addEventListener('click', function(e) {
    if (!bulkMode) return;
    var card = e.target.closest('[data-id]');
    if (!card) return;
    e.preventDefault(); e.stopPropagation();
    bulkToggleCard(card);
  }, true);

  var bulkSelAllCb = document.getElementById('bulkSelAllCb');
  if (bulkSelAllCb) bulkSelAllCb.addEventListener('change', function() {
    var ml = document.getElementById('mlist');
    var cards = ml.querySelectorAll('[data-id]');
    var shouldSelect = bulkSelAllCb.checked;
    cards.forEach(function(c) {
      var id = parseInt(c.dataset.id, 10);
      if (shouldSelect) { bulkSel.add(id); c.classList.add('bulk-sel'); }
      else { bulkSel.delete(id); c.classList.remove('bulk-sel'); }
    });
    updateBulkCnt();
  });

  var bulkFav = document.getElementById('bulkFav');
  if (bulkFav) bulkFav.addEventListener('click', function() {
    bulkSel.forEach(function(id) { favs.add(id); });
    safeSave(FK, JSON.stringify(Array.from(favs)));
    toast(bulkSel.size + ' filmov pridanych do oblubenych');
    scheduleAutoPush('bulk-fav');
  });

  var bulkWl = document.getElementById('bulkWl');
  if (bulkWl) bulkWl.addEventListener('click', function() {
    bulkSel.forEach(function(id) { wl.add(id); });
    safeSave(WK, JSON.stringify(Array.from(wl)));
    toast(bulkSel.size + ' filmov pridanych do watchlistu');
    scheduleAutoPush('bulk-wl');
  });

  var bulkWatched = document.getElementById('bulkWatched');
  if (bulkWatched) bulkWatched.addEventListener('click', function() {
    bulkSel.forEach(function(id) { watched.add(id); watchedDates[id] = Date.now(); });
    safeSave(VK, JSON.stringify(Array.from(watched)));
    safeSave(VDK, JSON.stringify(watchedDates));
    toast(bulkSel.size + ' filmov oznacenych ako videne');
    scheduleAutoPush('bulk-watched');
  });

  var bulkRm = document.getElementById('bulkRm');
  if (bulkRm) bulkRm.addEventListener('click', function() {
    if (!bulkSel.size) return;
    if (!confirm('Naozaj odstranit ' + bulkSel.size + ' filmov?')) return;
    all = all.filter(function(m) { return !bulkSel.has(m.id); });
    bulkSel.forEach(function(id) { favs.delete(id); wl.delete(id); watched.delete(id); });
    safeSave(SK, JSON.stringify(all));
    safeSave(FK, JSON.stringify(Array.from(favs)));
    toast(bulkSel.size + ' filmov odstranenych');
    toggleBulkMode();
    renderAll();
    scheduleAutoPush('bulk-rm');
  });
});


/* ══════════════════════════════════════════════════════════
   MODULE: Film Map
   ══════════════════════════════════════════════════════════ */
var COUNTRY_FLAGS = {
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

function openMapPanel() {
  var counts = {};
  all.forEach(function(m) {
    var c = (m.country || '').trim();
    if (!c) return;
    c.split(/[,\/]/).forEach(function(part) {
      var p = part.trim();
      if (p) counts[p] = (counts[p] || 0) + 1;
    });
  });
  var sorted = Object.entries(counts).sort(function(a, b) { return b[1] - a[1]; });
  var maxCnt = sorted.length ? sorted[0][1] : 1;
  var total = sorted.reduce(function(s, e) { return s + e[1]; }, 0);
  var h = '<div class="map-total">' + sorted.length + ' krajin | ' + total + ' filmov celkovo</div><div class="map-grid">';
  sorted.forEach(function(e) {
    var name = e[0], cnt = e[1];
    var key = name.toLowerCase();
    var flag = COUNTRY_FLAGS[key] || '&#127988;';
    var pct = Math.round(cnt / maxCnt * 100);
    h += '<div class="map-country" data-country="' + esc(name) + '"><span class="map-flag">' + flag + '</span>' +
      '<div style="flex:1;min-width:0"><div class="map-cname">' + esc(name) + '</div>' +
      '<div class="map-bar" style="width:' + pct + '%"></div></div>' +
      '<span class="map-ccnt">' + cnt + '</span></div>';
  });
  h += '</div>';
  document.getElementById('mapContent').innerHTML = h;
  document.getElementById('mapOv').classList.remove('hidden');
  document.getElementById('mapContent').addEventListener('click', function(e) {
    var card = e.target.closest('.map-country');
    if (!card) return;
    document.getElementById('mapOv').classList.add('hidden');
    fpState.country = card.dataset.country;
    updateFpBadge();
    updateFpPills();
    applyFilters();
    toast('Filter: ' + card.dataset.country);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var btnMap = document.getElementById('btnMap');
  if (btnMap) btnMap.addEventListener('click', openMapPanel);
  var mapClose = document.getElementById('mapClose');
  if (mapClose) mapClose.addEventListener('click', function() { document.getElementById('mapOv').classList.add('hidden'); });
  var mapOv = document.getElementById('mapOv');
  if (mapOv) mapOv.addEventListener('click', function(e) { if (e.target === mapOv) mapOv.classList.add('hidden'); });
});


/* ══════════════════════════════════════════════════════════
   MODULE: Timeline
   ══════════════════════════════════════════════════════════ */
function openTimeline() {
  var byYear = {};
  all.forEach(function(m) {
    var y = m.year || 0;
    if (y < 1900) return;
    if (!byYear[y]) byYear[y] = [];
    byYear[y].push(m);
  });
  var years = Object.keys(byYear).map(Number).sort(function(a, b) { return a - b; });
  var h = '<div class="tl-scroll"><div class="tl-track">';
  years.forEach(function(y) {
    var ms = byYear[y];
    var isDecade = y % 10 === 0;
    h += '<div class="tl-year">';
    h += '<div class="tl-posters">';
    var show = ms.slice(0, 5);
    show.forEach(function(m) {
      if (m.poster_thumb && m.poster_thumb.length > 10) {
        h += '<img class="tl-poster" src="' + esc(m.poster_thumb) + '" data-id="' + m.id + '" title="' + esc(m.title || '') + '" loading="lazy">';
      }
    });
    if (ms.length > 5) h += '<div class="tl-cnt">+' + (ms.length - 5) + '</div>';
    h += '</div>';
    h += '<div class="tl-label' + (isDecade ? ' tl-decade' : '') + '">' + y + '</div>';
    h += '<div class="tl-cnt">' + ms.length + '</div>';
    h += '</div>';
  });
  h += '</div></div>';
  document.getElementById('timelineContent').innerHTML = h;
  document.getElementById('timelineOv').classList.remove('hidden');
  document.getElementById('timelineContent').addEventListener('click', function(e) {
    var poster = e.target.closest('.tl-poster');
    if (poster && poster.dataset.id) {
      document.getElementById('timelineOv').classList.add('hidden');
      openDet(parseInt(poster.dataset.id, 10));
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var btnTl = document.getElementById('btnTimeline');
  if (btnTl) btnTl.addEventListener('click', openTimeline);
  var tlClose = document.getElementById('timelineClose');
  if (tlClose) tlClose.addEventListener('click', function() { document.getElementById('timelineOv').classList.add('hidden'); });
  var tlOv = document.getElementById('timelineOv');
  if (tlOv) tlOv.addEventListener('click', function(e) { if (e.target === tlOv) tlOv.classList.add('hidden'); });
});


/* ══════════════════════════════════════════════════════════
   MODULE: Decade Overview
   ══════════════════════════════════════════════════════════ */
function openDecadePanel() {
  var byDecade = {};
  all.forEach(function(m) {
    var y = m.year || 0;
    if (y < 1900) return;
    var dec = Math.floor(y / 10) * 10;
    if (!byDecade[dec]) byDecade[dec] = [];
    byDecade[dec].push(m);
  });
  var decades = Object.keys(byDecade).map(Number).sort(function(a, b) { return b - a; });
  var h = '';
  decades.forEach(function(dec) {
    var ms = byDecade[dec];
    var genreCnt = {};
    var dirCnt = {};
    ms.forEach(function(m) {
      (m.genres || []).forEach(function(g) { genreCnt[g] = (genreCnt[g] || 0) + 1; });
      if (m.director) dirCnt[m.director] = (dirCnt[m.director] || 0) + 1;
    });
    var topGenre = Object.entries(genreCnt).sort(function(a, b) { return b[1] - a[1]; })[0];
    var topDir = Object.entries(dirCnt).sort(function(a, b) { return b[1] - a[1]; })[0];
    h += '<div class="dec-group">';
    h += '<div class="dec-hdr"><span class="dec-title">' + dec + 's</span>';
    h += '<span class="dec-stat">' + ms.length + ' filmov</span>';
    if (topGenre) h += '<span class="dec-genre">' + esc(topGenre[0]) + '</span>';
    if (topDir) h += '<span class="dec-stat">Top: ' + esc(topDir[0]) + '</span>';
    h += '</div>';
    h += '<div class="dec-scroll">';
    ms.sort(function(a, b) { return (a.year || 0) - (b.year || 0); });
    ms.forEach(function(m) {
      h += '<div class="dec-card" data-id="' + m.id + '">';
      if (m.poster_thumb && m.poster_thumb.length > 10) {
        h += '<img class="dec-poster" src="' + esc(m.poster_thumb) + '" alt="" loading="lazy">';
      } else {
        h += '<div class="dec-ph">' + esc((m.title || '').substring(0, 15)) + '</div>';
      }
      h += '<div class="dec-name">' + esc(m.title || '') + '</div></div>';
    });
    h += '</div></div>';
  });
  document.getElementById('decadeContent').innerHTML = h;
  document.getElementById('decadeOv').classList.remove('hidden');
  document.getElementById('decadeContent').addEventListener('click', function(e) {
    var card = e.target.closest('.dec-card');
    if (card && card.dataset.id) {
      document.getElementById('decadeOv').classList.add('hidden');
      openDet(parseInt(card.dataset.id, 10));
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var btnDec = document.getElementById('btnDecade');
  if (btnDec) btnDec.addEventListener('click', openDecadePanel);
  var decClose = document.getElementById('decadeClose');
  if (decClose) decClose.addEventListener('click', function() { document.getElementById('decadeOv').classList.add('hidden'); });
  var decOv = document.getElementById('decadeOv');
  if (decOv) decOv.addEventListener('click', function(e) { if (e.target === decOv) decOv.classList.add('hidden'); });
});


/* ══════════════════════════════════════════════════════════
   MODULE: Quick Add
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  var settBtn = document.getElementById('settBtnQuickAdd');
  var ov = document.getElementById('quickAddOv');
  var panel = document.getElementById('quickAddPanel');
  var inp = document.getElementById('quickAddInp');
  var btn = document.getElementById('quickAddSearch');
  var results = document.getElementById('quickAddResults');
  var status = document.getElementById('quickAddStatus');
  var close = document.getElementById('quickAddClose');

  if (!settBtn) return;

  settBtn.addEventListener('click', function() {
    document.getElementById('settOv').classList.add('hidden');
    ov.classList.remove('hidden');
    inp.value = ''; results.innerHTML = ''; status.textContent = '';
    setTimeout(function() { inp.focus(); }, 100);
  });

  if (close) close.addEventListener('click', function() { ov.classList.add('hidden'); });
  if (ov) ov.addEventListener('click', function(e) { if (e.target === ov) ov.classList.add('hidden'); });

  function qaSearch() {
    var q = (inp.value || '').trim();
    if (!q) return;
    status.textContent = 'Hladam...';
    results.innerHTML = '';
    var key = tmdbKey;
    fetch('https://api.themoviedb.org/3/search/movie?api_key=' + key + '&query=' + encodeURIComponent(q) + '&language=sk-SK')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        status.textContent = '';
        if (!data.results || !data.results.length) { status.textContent = 'Nic nenajdene'; return; }
        var h = '';
        data.results.slice(0, 8).forEach(function(r) {
          var poster = r.poster_path ? 'https://image.tmdb.org/t/p/w92' + r.poster_path : '';
          var yr = (r.release_date || '').substring(0, 4);
          var exists = all.some(function(m) { return m.tmdb_id === r.id || m.id === r.id; });
          h += '<div class="qa-card">';
          h += poster ? '<img class="qa-poster" src="' + esc(poster) + '" loading="lazy">' : '<div class="qa-poster" style="background:var(--card2)"></div>';
          h += '<div class="qa-info"><div class="qa-title">' + esc(r.title || '') + '</div>';
          h += '<div class="qa-meta">' + yr + ' | TMDB:' + r.id + '</div></div>';
          h += '<button class="qa-add" data-tmdb="' + r.id + '"' + (exists ? ' disabled title="Uz existuje"' : '') + '>' + (exists ? 'Existuje' : '+ Pridat') + '</button>';
          h += '</div>';
        });
        results.innerHTML = h;
      })
      .catch(function() { status.textContent = 'Chyba pri hladani'; });
  }

  btn.addEventListener('click', qaSearch);
  inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') qaSearch(); });

  results.addEventListener('click', function(e) {
    var addBtn = e.target.closest('.qa-add');
    if (!addBtn || addBtn.disabled) return;
    var tmdbId = parseInt(addBtn.dataset.tmdb, 10);
    addBtn.disabled = true;
    addBtn.textContent = '...';
    var key = tmdbKey;
    fetch('https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + key + '&language=sk-SK&append_to_response=credits,videos')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var maxNum = all.reduce(function(mx, m) { return Math.max(mx, m.num || 0); }, 0);
        var genres = (d.genres || []).map(function(g) { return g.name; });
        var dir = '';
        if (d.credits && d.credits.crew) {
          var dc = d.credits.crew.find(function(c) { return c.job === 'Director'; });
          if (dc) dir = dc.name;
        }
        var movie = {
          id: d.id,
          tmdb_id: d.id,
          num: maxNum + 1,
          title: d.title || '',
          year: parseInt((d.release_date || '').substring(0, 4)) || 0,
          director: dir,
          genres: genres,
          country: (d.production_countries || []).map(function(c) { return c.name; }).join(', '),
          duration: d.runtime || 0,
          poster_thumb: d.poster_path ? 'https://image.tmdb.org/t/p/w342' + d.poster_path : '',
          _tags: []
        };
        liveCache[movie.id] = {
          pct: d.vote_average ? Math.round(d.vote_average * 10) : null,
          posterUrl: movie.poster_thumb,
          backdrop: d.backdrop_path ? 'https://image.tmdb.org/t/p/w780' + d.backdrop_path : '',
          overview: d.overview || '',
          trailer: '',
          cast: d.credits && d.credits.cast ? d.credits.cast.slice(0, 10).map(function(c) { return c.name; }).join(', ') : '',
          countries: movie.country
        };
        if (d.videos && d.videos.results) {
          var tr = d.videos.results.find(function(v) { return v.type === 'Trailer' && v.site === 'YouTube'; });
          if (tr) liveCache[movie.id].trailer = tr.key;
        }
        all.push(movie);
        safeSave(SK, JSON.stringify(all));
        safeSave(LK, JSON.stringify(liveCache));
        buildFuse();
        renderAll();
        scheduleAutoPush('quick-add');
        addBtn.textContent = 'Pridany';
        toast(movie.title + ' pridany');
      })
      .catch(function() { addBtn.textContent = 'Chyba'; addBtn.disabled = false; });
  });
});


/* ══════════════════════════════════════════════════════════
   MODULE: Drag & Drop Reorder
   ══════════════════════════════════════════════════════════ */
var dragSrcId = null;

document.addEventListener('DOMContentLoaded', function() {
  var ml = document.getElementById('mlist');
  if (!ml) return;

  ml.addEventListener('dragstart', function(e) {
    if (bulkMode || posterWall) return;
    var card = e.target.closest('[data-id]');
    if (!card) return;
    dragSrcId = parseInt(card.dataset.id, 10);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragSrcId));
  });

  ml.addEventListener('dragover', function(e) {
    if (dragSrcId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    var card = e.target.closest('[data-id]');
    ml.querySelectorAll('.drag-over').forEach(function(c) { c.classList.remove('drag-over'); });
    if (card) card.classList.add('drag-over');
  });

  ml.addEventListener('dragleave', function(e) {
    var card = e.target.closest('[data-id]');
    if (card) card.classList.remove('drag-over');
  });

  ml.addEventListener('drop', function(e) {
    e.preventDefault();
    ml.querySelectorAll('.drag-over,.dragging').forEach(function(c) { c.classList.remove('drag-over', 'dragging'); });
    var card = e.target.closest('[data-id]');
    if (!card || dragSrcId === null) { dragSrcId = null; return; }
    var targetId = parseInt(card.dataset.id, 10);
    if (dragSrcId === targetId) { dragSrcId = null; return; }
    var srcIdx = all.findIndex(function(m) { return m.id === dragSrcId; });
    var tgtIdx = all.findIndex(function(m) { return m.id === targetId; });
    if (srcIdx < 0 || tgtIdx < 0) { dragSrcId = null; return; }
    var item = all.splice(srcIdx, 1)[0];
    all.splice(tgtIdx, 0, item);
    all.forEach(function(m, i) { m.num = i + 1; });
    safeSave(SK, JSON.stringify(all));
    renderAll();
    scheduleAutoPush('drag-reorder');
    toast('Poradie zmenene');
    dragSrcId = null;
  });

  ml.addEventListener('dragend', function() {
    ml.querySelectorAll('.drag-over,.dragging').forEach(function(c) { c.classList.remove('drag-over', 'dragging'); });
    dragSrcId = null;
  });
});

(function patchCards() {
  var origAppend = appendCards;
  appendCards = function(list, ml) {
    origAppend(list, ml);
    if (!posterWall) {
      ml.querySelectorAll('[data-id]:not([draggable])').forEach(function(c) {
        c.setAttribute('draggable', 'true');
      });
    }
  };
})();


/* ══════════════════════════════════════════════════════════
   MODULE: Share / QR
   ══════════════════════════════════════════════════════════ */
function openSharePanel(movieId) {
  var m = all.find(function(x) { return x.id === movieId; });
  if (!m) return;
  var c = liveCache[m.id] || {};
  var tmdbUrl = m.tmdb_id ? 'https://www.themoviedb.org/movie/' + m.tmdb_id : '';
  var text = m.title + ' (' + (m.year || '?') + ')';
  if (m.director) text += '\nReziser: ' + m.director;
  if (m.genres && m.genres.length) text += '\nZanre: ' + m.genres.join(', ');
  var pct = getMoviePct(m);
  if (pct != null) text += '\nHodnotenie: ' + pct + '%';
  if (tmdbUrl) text += '\n' + tmdbUrl;

  var h = '<div class="share-text">' + esc(text).replace(/\n/g, '<br>') + '</div>';
  h += '<div class="share-btns">';
  if (navigator.share) {
    h += '<button class="share-btn primary" id="shareNative">Zdielat</button>';
  }
  h += '<button class="share-btn" id="shareCopy">Kopirovat text</button>';
  if (tmdbUrl) h += '<button class="share-btn" id="shareTmdb">Otvorit TMDB</button>';
  h += '</div>';

  document.getElementById('shareContent').innerHTML = h;
  document.getElementById('shareOv').classList.remove('hidden');

  var nativeBtn = document.getElementById('shareNative');
  if (nativeBtn) nativeBtn.addEventListener('click', function() {
    navigator.share({ title: m.title, text: text, url: tmdbUrl || undefined }).catch(function() {});
  });

  var copyBtn = document.getElementById('shareCopy');
  if (copyBtn) copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(text).then(function() {
      copyBtn.textContent = 'Skopirovane!';
      setTimeout(function() { copyBtn.textContent = 'Kopirovat text'; }, 2000);
    });
  });

  var tmdbBtn = document.getElementById('shareTmdb');
  if (tmdbBtn) tmdbBtn.addEventListener('click', function() {
    window.open(tmdbUrl, '_blank');
  });
}

document.addEventListener('DOMContentLoaded', function() {
  var shareBtn = document.getElementById('btnShare');
  if (shareBtn) shareBtn.addEventListener('click', function() {
    if (curId) openSharePanel(curId);
  });
  var shareClose = document.getElementById('shareClose');
  if (shareClose) shareClose.addEventListener('click', function() { document.getElementById('shareOv').classList.add('hidden'); });
  var shareOv = document.getElementById('shareOv');
  if (shareOv) shareOv.addEventListener('click', function(e) { if (e.target === shareOv) shareOv.classList.add('hidden'); });
});

})();
