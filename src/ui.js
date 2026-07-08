/* AUTO-SPLIT from app.js. Shared state/functions live on the S namespace. */
import { S } from './state.js';
import { hexDim } from './lib/text.js';

S.loadPrefs = function loadPrefs(){
  try{var p=localStorage.getItem(S.PK);if(p)S.prefs=Object.assign(S.prefs,JSON.parse(p));}catch(e){}
  // Migrate old sort values to new "pct"
  if(S.prefs.sort==="ratingTmdb"||S.prefs.sort==="ratingImdb")S.prefs.sort="pct";
  // Validate sort value exists in dropdown
  var validSorts=["num","title","year","pct","dur"];
  if(validSorts.indexOf(S.prefs.sort)<0)S.prefs.sort="num";
  S.savePrefs();
  S.grid=(S.prefs.view==="grid");
  S.posterWall=(S.prefs.view==="posterwall");
  {var _iv=S.prefs.view||'list';var ml=document.getElementById("mlist");var vt=document.getElementById("viewTog");
    if(ml)ml.className=S.posterWall?'mlist posterwall':S.grid?'mlist grid':'mlist';
    if(vt){vt.innerHTML=S.VIEW_ICONS[_iv]||S.VIEW_ICONS.list;vt.title=S.VIEW_TITLES[_iv]||'';}
  }
  document.getElementById("sortSel").value=S.prefs.sort||"num";
  S.updateSortDirBtn(); if(typeof S.syncSortPill==="function") S.syncSortPill();
};

S.savePrefs = function savePrefs(){try{localStorage.setItem(S.PK,JSON.stringify(S.prefs));}catch(e){}};

S.updateSortDirBtn = function updateSortDirBtn(){S.syncSortPill();};

S.applyAccentColor = function applyAccentColor(gold, gold2) {
  var root = document.documentElement.style;
  root.setProperty('--gold',  gold);
  root.setProperty('--gold2', gold2);
  root.setProperty('--gold-dim', hexDim(gold));
  // Keep rgba() tints and on-primary text contrast in sync with the accent.
  var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(gold);
  if (m) {
    var r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
    root.setProperty('--gold-rgb', r + ',' + g + ',' + b);
    var lum = (0.299*r + 0.587*g + 0.114*b) / 255;
    root.setProperty('--on-primary', lum > 0.55 ? '#141114' : '#ffffff');
  }
  try { localStorage.setItem(S.ACCENT_KEY, JSON.stringify({gold:gold,gold2:gold2})); } catch(e) {}
  document.querySelectorAll('.color-swatch').forEach(function(s) {
    s.classList.toggle('active', s.dataset.gold === gold);
  });
};

S.initColorPicker = function initColorPicker() {
  // L2a: accent color
  try {
    var acc = localStorage.getItem(S.ACCENT_KEY);
    if (acc) { var a = JSON.parse(acc); S.applyAccentColor(a.gold, a.gold2); }
    else      { S.applyAccentColor('#d4a943', '#f0c060'); }
  } catch(e)  { S.applyAccentColor('#d4a943', '#f0c060'); }

  // Text/BG palettes removed — unified into skin system

  // ── Accent swatch clicks ──────────────────────────────────────
  document.querySelectorAll('.color-swatch').forEach(function(s) {
    s.addEventListener('click', function() {
      S.applyAccentColor(s.dataset.gold, s.dataset.gold2);
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
        S.applyAccentColor(h, h2);
        document.querySelectorAll('.color-swatch').forEach(function(s){s.classList.remove('active');});
      } catch(e) {}
    });
  }


};

S.keyStatus = function keyStatus(stId,key){var st=document.getElementById(stId);if(!st)return;st.textContent=key?"Kluc je ulozeny \u2713":"Kluc nie je nastaveny";st.className="sett-key-st "+(key?"ok":"err");};

S.showMod = function showMod(t,s){document.getElementById("mTtl").textContent=t;document.getElementById("mSub").textContent=s;document.getElementById("mFill").style.width="0%";document.getElementById("mStat").textContent="0%";document.getElementById("mOv").classList.remove("hidden");};

S.setP = function setP(p,s){document.getElementById("mFill").style.width=p+"%";document.getElementById("mStat").textContent=s;};

S.hideMod = function hideMod(){document.getElementById("mOv").classList.add("hidden");};

S.toast = function toast(msg){
  var t=document.createElement("div");t.className="toast";
  t.setAttribute("role","status");t.textContent=msg;
  document.body.appendChild(t);
  requestAnimationFrame(function(){t.classList.add("show");});
  setTimeout(function(){t.classList.remove("show");setTimeout(function(){t.remove();},250);},3000);
};

S.applyTheme = function applyTheme(skinId) {
  var resolved = skinId;
  if (skinId === 'auto') {
    resolved = S._autoThemeMq.matches ? 'dark' : 'linen';
  }
  document.documentElement.setAttribute('data-skin',  resolved);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.removeAttribute('data-text');
  document.documentElement.removeAttribute('data-bg');
  try { localStorage.setItem(S.THEME_KEY, skinId); } catch(e) {}
  localStorage.removeItem(S.ACCENT_KEY);
  var acc = S.THEME_ACCENTS[resolved];
  if (acc) S.applyAccentColor(acc.gold, acc.gold2);
  document.querySelectorAll('.skin-chip').forEach(function(s) {
    s.classList.toggle('active', s.dataset.skin === skinId);
  });
};

S.initTheme = function initTheme() {
  var saved = localStorage.getItem(S.THEME_KEY) || 'dark';
  S.applyTheme(saved);
  // Wire skin-chip clicks
  document.querySelectorAll('.skin-chip').forEach(function(s) {
    s.addEventListener('click', function() {
      S.applyTheme(s.dataset.skin);
      var acc = S.THEME_ACCENTS[s.dataset.skin];
      if (acc) { var cc = document.getElementById('colorCustom'); if (cc) cc.value = acc.gold; }
    });
  });
};

S.syncSortPill = function syncSortPill(){
  var cur = S.prefs.sort || 'num';
  var sel = document.getElementById('sortSel');
  var dirBtn = document.getElementById('sortDir');
  if (sel) sel.value = cur;
  var asc = (S.prefs.sortDir || 'desc') === 'asc';
  if (dirBtn){
    dirBtn.innerHTML = asc ? '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="14" x2="8" y2="2"/><polyline points="4,6 8,2 12,6"/></svg>' : '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="2" x2="8" y2="14"/><polyline points="4,10 8,14 12,10"/></svg>';
    dirBtn.title = asc ? 'Zostupne' : 'Vzostupne';
  }
};

S.initSortCycle = function initSortCycle(){
  document.getElementById('sortDir').addEventListener('click',function(){
    S.prefs.sortDir = (S.prefs.sortDir||'desc')==='desc' ? 'asc' : 'desc';
    S.savePrefs(); S.syncSortPill(); S.applyFilters();
  });
  document.getElementById('sortSel').addEventListener('change',function(e){
    S.prefs.sort = e.target.value;
    S.savePrefs(); S.syncSortPill(); S.applyFilters();
  });
  S.syncSortPill();
};

S.adjustScrnBody = function adjustScrnBody(){
  var hdr=document.querySelector('#mainSc .hdr');
  var sb=document.getElementById('scrnBody');
  if(!hdr||!sb)return;
  var h=hdr.offsetHeight;
  sb.style.top=h+'px';
};
