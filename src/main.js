/* AUTO-SPLIT from app.js. Shared state/functions live on the S namespace. */
import { S } from './state.js';
import './storage.js';
import './ui.js';
import './render.js';
import './players.js';
import './sync.js';
import './settings.js';
import './tv.js';
import { esc, levenshtein } from './lib/text.js';
import { parseCsfdPercent, parseCsvLine } from './lib/parse.js';

if (S.debugMode) console.log("[FilmDB] v" + S.APP_VERSION + " loaded ✅");

S.loadScript = function loadScript(url){
  if(S._scriptCache[url])return S._scriptCache[url];
  S._scriptCache[url]=new Promise(function(ok,fail){
    var s=document.createElement("script");s.src=url;
    s.onload=ok;s.onerror=function(){delete S._scriptCache[url];fail(new Error("Nepodarilo sa načítať: "+url));};
    document.head.appendChild(s);
  });
  return S._scriptCache[url];
};

S.loadPdfJs = function loadPdfJs(){
  return S.loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js").then(function(){
    pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  });
};

S.loadJSZip = function loadJSZip(){return S.loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");};

S.loadChartJs = function loadChartJs(){return S.loadScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js");};

S.init = function init(){
  // Apply all visual layers early — prevents flash of unstyled content
  var _t=localStorage.getItem('mdb_theme1')||'dark';
  document.documentElement.setAttribute('data-skin',_t);
  document.documentElement.setAttribute('data-theme',_t);
  S.loadLiveCache();S.loadPrefs();
  var saved=null;
  try{var s=localStorage.getItem(S.SK);if(s){saved=JSON.parse(s);
    // Empty array [] is the clearAll sentinel — treat as intentionally empty DB
    if(!saved)saved=null;
    else if(!saved.length){saved=null;localStorage.setItem("mdb_empty","1");}
  }}catch(e){}
  if(saved){
    saved.forEach(function(m){m.year=parseInt(m.year)||0;});
  }
  var empty=localStorage.getItem("mdb_empty")==="1";
  S.all=empty?[]:(saved||[]);
  // Restore poster URLs from liveCache for movies that lost base64 posters
  S.all.forEach(function(m){
    if((!m.poster_thumb||m.poster_thumb.length<10)&&S.liveCache[m.id]&&S.liveCache[m.id].posterUrl){
      m.poster_thumb=S.liveCache[m.id].posterUrl;
    }
  });
  if(!saved&&!empty&&S.all.length>0)try{
    // First-time save: strip base64 posters, keep URL posters
    var toSave=S.all.map(function(m){
      var c=Object.assign({},m);
      if(c.poster_thumb&&c.poster_thumb.indexOf('data:')===0)c.poster_thumb='';
      return c;
    });
    S.safeSave(S.SK,JSON.stringify(toSave));
  }catch(e){}
  try{S.favs=new Set(JSON.parse(localStorage.getItem(S.FK)||"[]"));}catch(e){}
  try{S.wl=new Set(JSON.parse(localStorage.getItem(S.WK)||"[]"));}catch(e){}
  try{S.watched=new Set(JSON.parse(localStorage.getItem(S.VK)||"[]"));}catch(e){}
  try{S.watchedDates=JSON.parse(localStorage.getItem(S.VDK)||"{}");}catch(e){}
  if(S.tmdbKey&&!localStorage.getItem("tmdb_key"))localStorage.setItem("tmdb_key",S.tmdbKey);
  document.getElementById("loadSt").style.display="none";
  S.buildFuse();
  S.renderAll();
  // Auto-pull from GitHub on startup if enabled and token is set
  if (S.autoPull && typeof S.ghPull === "function") {
    setTimeout(function() {
      S.ghSetStatus("Automatické načítanie z GitHubu…", "info");
      S.ghPull();
    }, 800);
  }
};

window.onerror=function(msg,src,line,col,err){
  // Ignore cross-origin script errors (no useful info available)
  if(msg==="Script error."||msg==="Script error") return false;
  console.error("[FilmDB error]",msg,"@",src+":"+line,err);
  if(typeof S.toast==="function") S.toast("⚠ Chyba: "+(err&&err.message?err.message:msg).slice(0,80));
  return false; // don't suppress default browser logging
};

window.addEventListener("unhandledrejection",function(e){
  var reason=e.reason;
  if(reason&&reason.name==="AbortError") return; // intentional cancels
  console.error("[FilmDB unhandled promise]",reason);
  if(typeof S.toast==="function") S.toast("⚠ Async chyba: "+(reason&&reason.message?reason.message:String(reason)).slice(0,80));
});

if("serviceWorker" in navigator && location.protocol.indexOf("http")===0){
  window.addEventListener("load",function(){
    navigator.serviceWorker.register("./sw.js").catch(function(err){
      console.warn("[FilmDB] SW registration failed:",err);
    });
  });
}

document.addEventListener("DOMContentLoaded",function(){
  S.init();
  var _scb = document.getElementById('settCloseBtn');
  if (_scb) _scb.addEventListener('click', S.closeSett);
  var _so = document.getElementById('settOverlay');
  if (_so) _so.addEventListener('click', S.closeSett);
  document.querySelectorAll('.sett-tab').forEach(function(tab){
    tab.addEventListener('click',function(){S.activateSettingsTab(tab.dataset.tab);});
  });

  // Auto-push toggle
  var _apt = document.getElementById('autoPushTog');
  if (_apt) {
    _apt.checked = S.prefs.autoPush !== false;
    _apt.addEventListener('change', function(){
      S.prefs.autoPush = this.checked;
      S.savePrefs();
      S.toast(`Auto-push: ${this.checked?'zapnutý':'vypnutý'}`);
    });
  }
  // Player protocol toggle (MPC / VLC / Portable)
  var _portWrap = document.getElementById('portableSettingsWrap');
  document.querySelectorAll('#playerProtoToggle .ttab').forEach(function(btn){
    btn.addEventListener('click', function(){
      S.playerProto = this.dataset.proto;
      localStorage.setItem(S.PLAYER_PROTO_KEY, S.playerProto);
      document.querySelectorAll('#playerProtoToggle .ttab').forEach(function(b){b.className='ttab';});
      this.className='ttab on';
      if(_portWrap) _portWrap.style.display = S.playerProto==='portable' ? 'block' : 'none';
      S.toast('Prehrávač: ' + S.getPlayModeLabel());
      var _pb2=document.getElementById('playMovieBtn');
      if(_pb2){var _l2=_pb2.querySelector('.sett-btn-label');if(_l2)_l2.textContent='Prehráť · '+S.getPlayModeLabel();}
      S.updatePathPreview();
    });
  });
  document.querySelectorAll('#playerProtoToggle .ttab').forEach(function(b){
    b.className = (b.dataset.proto === S.playerProto) ? 'ttab on' : 'ttab';
  });
  if(_portWrap) _portWrap.style.display = S.playerProto==='portable' ? 'block' : 'none';

  // Windows desktop (Electron) — show which installed players the native
  // bridge detected; playback then launches them directly, so the mpc:///
  // vlc:// registry handlers are not needed inside the desktop app.
  (function(){
    var st=document.getElementById('winPlayersSt');
    if(!window.filmyNative||typeof window.filmyNative.detectPlayers!=='function')return;
    var embBtn=document.getElementById('protoEmbedded');
    if(embBtn)embBtn.style.display='';
    if(!st)return;
    st.style.display='block';
    st.textContent='Detegujem nainštalované prehrávače...';
    window.filmyNative.detectPlayers().then(function(d){
      if(!d)return;
      S._winPlayers=d;
      function line(name,exe){return (exe?'✓ ':'✗ ')+name+(exe?'':' (nenájdený)');}
      st.innerHTML='<b style="color:#81c784">Windows appka</b> — prehrávanie ide priamo cez nainštalované prehrávače (reg handlery nie sú potrebné):<br>'+
        line('VLC',d.vlc)+' &nbsp;·&nbsp; '+line('MPC-HC',d.mpcHc)+' &nbsp;·&nbsp; '+line('MPC-BE',d.mpcBe);
    }).catch(function(){st.textContent='';});
  })();

  // Portable settings wiring
  (function(){
    var ptToggle = document.getElementById('portableTypeToggle');
    var mpcInp = document.getElementById('portableMpcInp');
    var vlcInp = document.getElementById('portableVlcInp');
    var mpcSave = document.getElementById('portableMpcSave');
    var vlcSave = document.getElementById('portableVlcSave');
    var stEl = document.getElementById('portablePathSt');
    var dlReg = document.getElementById('portableDownloadReg');
    var dlBat = document.getElementById('portableDownloadBat');

    if(mpcInp) mpcInp.value = localStorage.getItem('mdb_portable_mpc') || 'W:\\MPC-portable\\mpc-hc64.exe';
    if(vlcInp) vlcInp.value = localStorage.getItem('mdb_portable_vlc') || 'W:\\vlc-portable\\vlc-portable.exe';

    var portType = localStorage.getItem('mdb_portable_mode') || 'mpc';
    if(ptToggle){
      ptToggle.querySelectorAll('.ttab').forEach(function(b){
        b.className = b.dataset.ptype===portType ? 'ttab on' : 'ttab';
        b.addEventListener('click', function(){
          portType = this.dataset.ptype;
          localStorage.setItem('mdb_portable_mode', portType);
          ptToggle.querySelectorAll('.ttab').forEach(function(t){t.className='ttab';});
          this.className='ttab on';
          if(stEl){stEl.textContent='✓ Portable: '+(portType==='vlc'?'VLC':'MPC-HC');stEl.className='sett-key-st ok';}
        });
      });
    }
    if(mpcSave) mpcSave.addEventListener('click', function(){
      var v = mpcInp.value.trim();
      if(v){localStorage.setItem('mdb_portable_mpc',v);if(typeof portableMpcPath!=='undefined')portableMpcPath=v;if(stEl){stEl.textContent='✓ MPC cesta uložená';stEl.className='sett-key-st ok';}}
    });
    if(vlcSave) vlcSave.addEventListener('click', function(){
      var v = vlcInp.value.trim();
      if(v){localStorage.setItem('mdb_portable_vlc',v);if(typeof portableVlcPath!=='undefined')portableVlcPath=v;if(stEl){stEl.textContent='✓ VLC cesta uložená';stEl.className='sett-key-st ok';}}
    });
    if(dlReg) dlReg.addEventListener('click', function(){
      if(typeof downloadPortableReg==='function') downloadPortableReg();
      else S.toast('portable-handler.js nie je načítaný');
    });
    if(dlBat) dlBat.addEventListener('click', function(){
      if(typeof downloadPortableBat==='function') downloadPortableBat();
      else S.toast('portable-handler.js nie je načítaný');
    });
  })();

  function syncSortPctLabel(){
    var o=document.getElementById('sortPctOpt');
    if(o) o.textContent='Podľa % '+S.RATING_LABELS[S.ratingSource];
  }
  syncSortPctLabel();
  document.querySelectorAll('#ratingSrcToggle .ttab').forEach(function(btn){
    btn.addEventListener('click',function(){
      S.ratingSource=this.dataset.src;
      localStorage.setItem('mdb_ratingsrc',S.ratingSource);
      document.querySelectorAll('#ratingSrcToggle .ttab').forEach(function(b){b.className='ttab';});
      this.className='ttab on';
      var stEl=document.getElementById('ratingSrcSt');
      if(stEl){stEl.textContent='✓ '+S.RATING_LABELS[S.ratingSource]+' — uložené';stEl.className='sett-key-st ok';}
      syncSortPctLabel();
      S.applyFilters();
      S.toast('Hodnotenia: '+S.RATING_LABELS[S.ratingSource]);
    });
  });
  document.querySelectorAll('#ratingSrcToggle .ttab').forEach(function(b){
    b.className=(b.dataset.src===S.ratingSource)?'ttab on':'ttab';
  });

  var _su=document.getElementById("settBtnPdfUpdate");if(_su)_su.addEventListener("click",S.impPdfUpdate);
  var _fu=document.getElementById("fileInpUpdate");if(_fu)_fu.addEventListener("change",S.handleFileUpdate);
  var ebZip = document.getElementById('emptyBtnZip');
  if (ebZip) ebZip.addEventListener('click', function(){document.getElementById('fileInp').click();});
  var ebPull = document.getElementById('emptyBtnPull');
  if (ebPull) ebPull.addEventListener('click', function(){ S.ghPull(); });

  S.autoCheckGitHub();
  // Path mode toggle + SMB settings
  document.querySelectorAll('#pathModeToggle .ttab').forEach(function(btn){
    btn.addEventListener('click', function(){
      S.pathMode = this.dataset.mode;
      localStorage.setItem(S.PATH_MODE_KEY, S.pathMode);
      document.querySelectorAll('#pathModeToggle .ttab').forEach(function(b){b.className='ttab';});
      this.className = 'ttab on';
      // Aktualizuj hint - jasné zobrazenie aktívneho stavu
var _modeLabel = S.pathMode === 'smb' ? 'Sieťová cesta (SMB) — aktívna' : 'Lokálna cesta — aktívna';
S.toast(_modeLabel);
      // Aktualizuj hint s ukážkou cesty
      var _hint = document.getElementById('pathModeHint');
      if (_hint) {
        _hint.textContent = S.pathMode === 'smb' ? 'Sieťová (SMB) — aktívna' : 'Lokálna cesta — aktívna';
      }
      S.updatePathPreview();
      // Aktualizuj detail panel ak je otvorený
      var _dpth = document.querySelector('.det-path-hint');
      // Aktualizuj play button label ak je detail otvorený
      if (S.curId) {
        var _pb = document.getElementById('playMovieBtn');
        if (_pb) {
          var _lbl = _pb.querySelector('.sett-btn-label');
          if (_lbl) {
            _lbl.textContent = 'Prehráť · ' + S.getPlayModeLabel();
          }
          var _mc = S.all.find(function(x){return x.id===S.curId;});
          if (_mc) _pb.onclick = function(){ S.playMovie(_mc.id); };
        }
      }
    });
  // Set initial active state for pathMode buttons based on localStorage
  document.querySelectorAll('#pathModeToggle .ttab').forEach(function(b){
    b.className = (b.dataset.mode === S.pathMode) ? 'ttab on' : 'ttab';
  });
  });
  var smbSaveBtn = document.getElementById('smbPathSave');
  if (smbSaveBtn) smbSaveBtn.addEventListener('click', function(){
    var val = document.getElementById('smbPathInp').value.trim();
    if (val) {
      if (val[val.length-1] !== '/') val += '/';
      S.smbBase = val;
      localStorage.setItem(S.SMB_KEY, val);
    }
    // Sync smbMap s aktuálnym localPathInp
    var localVal = document.getElementById('localPathInp').value.trim();
    if (localVal && val) {
      if (localVal[localVal.length-1] !== '\\' && localVal[localVal.length-1] !== '/') localVal += '\\';
      var newMap = {};
      newMap[localVal] = val;
      S.smbMap = newMap;
      localStorage.setItem(S.SMB_MAP_KEY, JSON.stringify(newMap));
    }
    var st = document.getElementById('smbPathSt');
    if (st) { st.textContent = '✓ SMB: ' + (val||S.smbBase); st.className = 'sett-key-st ok'; }
    S.updatePathPreview();
    S.toast('SMB základ uložený');
  });

  // SMB URL mode toggle (proto vs raw)
  (function(){
    var _smbModeWrap = document.getElementById('smbUrlModeToggle');
    var _smbModeTitle = document.getElementById('smbUrlModeTitle');
    var _smbModeHint = document.getElementById('smbUrlModeHint');
    function _showSmbMode(vis){
      var d = vis ? '' : 'none';
      if(_smbModeWrap) _smbModeWrap.style.display = vis ? 'flex' : 'none';
      if(_smbModeTitle) _smbModeTitle.style.display = d;
      if(_smbModeHint) _smbModeHint.style.display = d;
    }
    _showSmbMode(S.pathMode==='smb');
    if(_smbModeWrap){
      _smbModeWrap.querySelectorAll('.ttab').forEach(function(btn){
        btn.className = btn.dataset.smbmode===S.smbUrlMode ? 'ttab on' : 'ttab';
        btn.addEventListener('click', function(){
          S.smbUrlMode = this.dataset.smbmode;
          localStorage.setItem(S.SMB_URL_MODE_KEY, S.smbUrlMode);
          _smbModeWrap.querySelectorAll('.ttab').forEach(function(b){b.className='ttab';});
          this.className='ttab on';
          S.toast(S.smbUrlMode==='proto' ? 'SMB: s protokolom (vlc://smb://…)' : 'SMB: priame (smb://…)');
          var _pb3=document.getElementById('playMovieBtn');
          if(_pb3){var _l3=_pb3.querySelector('.sett-btn-label');if(_l3)_l3.textContent='Prehráť · '+S.getPlayModeLabel();}
          S.updatePathPreview();
        });
      });
    }
    // Show/hide on pathMode change
    var _origPathBtns = document.querySelectorAll('#pathModeToggle .ttab');
    _origPathBtns.forEach(function(btn){
      btn.addEventListener('click', function(){ _showSmbMode(S.pathMode==='smb'); });
    });
  })();

  // Samostatný listener pre localPathSave
  var localSaveBtn = document.getElementById('localPathSave');
  if (localSaveBtn) localSaveBtn.addEventListener('click', function(){
    var localVal = document.getElementById('localPathInp').value.trim();
    if (!localVal) { S.toast('Zadaj lokálny základ (napr. W:\\Movies\\)'); return; }
    if (localVal[localVal.length-1] !== '\\' && localVal[localVal.length-1] !== '/') localVal += '\\';
    // Aktualizuj smbMap: localVal → smbBase
    var newMap = {};
    newMap[localVal] = S.smbBase;
    S.smbMap = newMap;
    localStorage.setItem(S.SMB_MAP_KEY, JSON.stringify(newMap));
    var stL = document.getElementById('localPathSt');
    if (stL) { stL.textContent = '✓ Lokálna cesta: ' + localVal; stL.className = 'sett-key-st ok'; }
    var stS = document.getElementById('smbPathSt');
    if (stS && S.smbBase) { stS.textContent = '✓ SMB mapovanie: ' + localVal + '→ ' + S.smbBase; stS.className = 'sett-key-st ok'; }
    S.updatePathPreview();
    S.toast('Lokálny základ uložený');
  });

  var _thBtn=document.getElementById('testHandlerBtn');
  if(_thBtn) _thBtn.addEventListener('click',function(){
    var proto=S.playerProto||'mpc';
    var testUrl;
    var stEl=document.getElementById('testHandlerSt');
    if(S.pathMode==='smb'){
      var base=S.smbBase||'smb://DESKTOP-EGOG348/Movies/';
      if(base[base.length-1]!=='/')base+='/';
      var smbPath=base+'test-handler.mkv';
      if(S._isAndroid && (proto==='native' || S.smbUrlMode==='raw')){
        testUrl=smbPath;
      } else if(S._isAndroid){
        testUrl='vlc://'+smbPath;
      } else if(proto==='native' || S.smbUrlMode==='raw'){
        testUrl=smbPath;
      } else {
        var server=smbPath.replace(/^smb:\/\//,'');
        testUrl=proto+'://'+encodeURI(server);
      }
    } else {
      if(proto==='native'){
        testUrl=S._isAndroid?'file:///W/Movies/test-handler.mkv':'file:///W/Movies/test-handler.mkv';
      } else {
        testUrl=proto+'://W/Movies/test-handler.mkv';
      }
    }
    if(stEl){stEl.textContent='Posielam: '+testUrl;stEl.className='sett-key-st ok';}
    if (S.debugMode) console.log('[FilmDB] Test handler URL:',testUrl);
    window.location.href=testUrl;
    setTimeout(function(){
      if(stEl){stEl.innerHTML='Odoslané: <code>'+esc(testUrl)+'</code><br>Ak sa prehrávač neotvoril, handler nie je správne zaregistrovaný.';stEl.className='sett-key-st';}
    },2000);
  });

  S.adjustScrnBody();
  setTimeout(S.adjustScrnBody,100);
  S.initTheme();
  S.initColorPicker();
  S.updatePathPreview();
  
  document.getElementById("srchInp").addEventListener("input",function(){document.getElementById("srchClr").style.display=this.value?"block":"none";S.applyFilters();});
  document.getElementById("srchClr").addEventListener("click",function(){document.getElementById("srchInp").value="";this.style.display="none";S.applyFilters();});
  /* sortSel.change handled by initSortCycle */
  var _eviewTo=document.getElementById("viewTog");if(_eviewTo)_eviewTo.addEventListener("click",function(){
    var cur=S.prefs.view||'list';
    var ni=S.VIEW_MODES.indexOf(cur);
    S.settSetView(S.VIEW_MODES[(ni+1)%S.VIEW_MODES.length]);
  });
  var _ebtnSet=document.getElementById("btnSett");if(_ebtnSet)_ebtnSet.addEventListener("click",S.openSett);

  // Custom "Install app" button — hidden until the browser tells us install
  // is possible, then triggers the native prompt instead of a URL bar icon.
  var _btnInstall=document.getElementById("btnInstall");
  // Windows desktop (Electron): PWA install prompt is irrelevant — the app
  // is already installed. Keep the button hidden and skip the wiring.
  var _hideInstall=!!window.filmyNative;
  if(_hideInstall&&_btnInstall)_btnInstall.classList.add("hidden");
  var _deferredInstallPrompt=null;
  window.addEventListener("beforeinstallprompt",function(e){
    e.preventDefault();
    _deferredInstallPrompt=e;
    if(_btnInstall)_btnInstall.classList.remove("hidden");
  });
  if(_btnInstall)_btnInstall.addEventListener("click",function(){
    if(!_deferredInstallPrompt)return;
    _deferredInstallPrompt.prompt();
    _deferredInstallPrompt.userChoice.finally(function(){
      _deferredInstallPrompt=null;
      if(_btnInstall)_btnInstall.classList.add("hidden");
    });
  });
  window.addEventListener("appinstalled",function(){
    if(_btnInstall)_btnInstall.classList.add("hidden");
    _deferredInstallPrompt=null;
  });
  document.getElementById("btnStat").addEventListener("click",S.showStats);
  document.getElementById("btnFav").addEventListener("click",function(){
    S.favMode=!S.favMode;S.wlMode=false;
    this.className="hdr-act hdr-act-fav"+(S.favMode?" active":"");
    document.getElementById("btnWl").className="hdr-act hdr-act-wl";
    document.querySelectorAll(".chip").forEach(function(c){c.classList.remove("active");});
    if(!S.favMode){var ca=document.getElementById("chipAll");if(ca)ca.classList.add("active");}
    S.applyFilters();
  });
  document.getElementById("btnWl").addEventListener("click",function(){
    S.wlMode=!S.wlMode;S.favMode=false;
    this.className="hdr-act hdr-act-wl"+(S.wlMode?" active":"");
    document.getElementById("btnFav").className="hdr-act hdr-act-fav";
    document.querySelectorAll(".chip").forEach(function(c){c.classList.remove("active");});
    if(!S.wlMode){var ca=document.getElementById("chipAll");if(ca)ca.classList.add("active");}
    S.applyFilters();
  });
  document.getElementById("btnBack").addEventListener("click",S.closeDet);
  document.getElementById("btnStatCls").addEventListener("click",S.closeStat);
  document.getElementById("trClose").addEventListener("click",S.closeTr);
  document.getElementById("btnBatchStop").addEventListener("click",function(){S.liveRunning=false;document.getElementById("batchBar").classList.add("hidden");/* bar is in flow now */S.saveLiveCache();S.renderList(S.filt);S.toast("Prerusene.");});
  document.getElementById("fileInp").addEventListener("change",S.handleFile);
  /* old emptyPdfBtn removed */
  document.getElementById("settOverlay").addEventListener("click",S.closeSett);
  var _ettabLi=document.getElementById("ttabList");if(_ettabLi)_ettabLi.addEventListener("click",function(){S.settSetView("list");});
  var _ettabGr=document.getElementById("ttabGrid");if(_ettabGr)_ettabGr.addEventListener("click",function(){S.settSetView("grid");});
  document.getElementById("settSortSel").addEventListener("change",function(){S.settSetSort(this.value);});
  var _srt=document.getElementById('showRecentTog');
  if(_srt){
    _srt.checked = S.prefs.showRecent === true;
    _srt.addEventListener('change',function(){
      S.prefs.showRecent = this.checked;
      S.savePrefs();
      S.applyFilters();
      S.toast('Naposledy pridané: '+(this.checked?'zapnuté':'vypnuté'));
    });
  }
  var _etmdbSa=document.getElementById("tmdbSaveKey");if(_etmdbSa)_etmdbSa.addEventListener("click",function(){var k=document.getElementById("tmdbKeyInp").value.trim();S.tmdbKey=k;localStorage.setItem("tmdb_key",k);S.keyStatus("tmdbKeySt",k);S.toast(k?"TMDB k\u013E\u00FA\u010D ulo\u017Een\u00FD":"TMDB k\u013E\u00FA\u010D vymazan\u00FD");});
  document.getElementById("settBtnPdf").addEventListener("click",S.impPdf);
  var _eBatch=document.getElementById("settBtnBatch");if(_eBatch)_eBatch.addEventListener("click",S.settStartBatch);
  var _eStop=document.getElementById("settBtnStop");if(_eStop)_eStop.addEventListener("click",function(){S.liveRunning=false;this.classList.add("hidden");document.getElementById("batchBar").classList.add("hidden");S.saveLiveCache();S.renderList(S.filt);S.toast("Prerusene.");});
  document.getElementById('omdbSaveKey').addEventListener('click',function(){
    var k=document.getElementById('omdbKeyInp').value.trim();
    S.omdbKey=k;localStorage.setItem('omdb_key',k);
    var st=document.getElementById('omdbKeySt');
    if(st){st.textContent=k?'✓ OMDB kľúč uložený':'Kľúč vymazaný';st.className='sett-key-st'+(k?' ok':'');}
    S.toast(k?'OMDB kľúč uložený':'OMDB kľúč vymazaný');
  });
  document.getElementById('settBtnImdb').addEventListener('click',S.startImdbBatch);
  var _eCsfdBatch=document.getElementById('settBtnCsfd');if(_eCsfdBatch)_eCsfdBatch.addEventListener('click',S.startCsfdBatch);
  var _eExport=document.getElementById("settBtnExport");if(_eExport)_eExport.addEventListener("click",S.exportHtml);
  var _eExportJ=document.getElementById("settBtnExportJson");if(_eExportJ)_eExportJ.addEventListener("click",S.exportJson);
  var _eDupes=document.getElementById("settBtnDuplicates");if(_eDupes)_eDupes.addEventListener("click",S.findDuplicates);
  var _eClearLv=document.getElementById("settBtnClearLive");if(_eClearLv)_eClearLv.addEventListener("click",S.clearLiveData);
  var _eClearAll=document.getElementById("settBtnClearAll");if(_eClearAll)_eClearAll.addEventListener("click",S.clearAllData);
  var _eAdmin=document.getElementById("settBtnAdmin");if(_eAdmin)_eAdmin.addEventListener("click",S.openAdmin);

  // Admin tab: debug mode
  var _dmt=document.getElementById('debugModeTog');
  if(_dmt) _dmt.addEventListener('change',function(){S.setDebugMode(this.checked);});

  // Admin tab: manuálna oprava filmu
  var _afSel=document.getElementById('adminFixMovieSel');
  if(_afSel) _afSel.addEventListener('change',function(){S.adminFixLoadMovie(parseInt(this.value,10));});
  var _afSave=document.getElementById('adminFixSaveBtn');
  if(_afSave) _afSave.addEventListener('click',S.adminFixSave);
  var _afTmdb=document.getElementById('adminFixTmdbBtn');
  if(_afTmdb) _afTmdb.addEventListener('click',function(){
    var sel=document.getElementById('adminFixMovieSel');
    if(sel&&sel.value) S.openMatchPanel(parseInt(sel.value,10));
  });
  var _afCsfdFetch=document.getElementById('adminFixCsfdFetchBtn');
  if(_afCsfdFetch) _afCsfdFetch.addEventListener('click',S.adminFixCsfdFetch);

  // Admin tab: automatické párovanie ciest
  var _apBtn=document.getElementById('adminAutoPairBtn');
  var _apInp=document.getElementById('adminAutoPairInp');
  if(_apBtn&&_apInp){
    _apBtn.addEventListener('click',function(){_apInp.click();});
    _apInp.addEventListener('change',function(){
      if(this.files&&this.files.length) S.adminAutoPairScan(this.files);
      this.value='';
    });
  }
  var _apApply=document.getElementById('adminAutoPairApplyBtn');
  if(_apApply) _apApply.addEventListener('click',S.adminAutoPairApply);

  // Uložiť všetky nastavenia
  var _eSaveAll = document.getElementById('settBtnSaveAll');
  if (_eSaveAll) _eSaveAll.addEventListener('click', function() {
    // GitHub token
    var ghInp = document.getElementById('ghTokenInp');
    if (ghInp && ghInp.value.trim()) { S.ghToken = ghInp.value.trim(); localStorage.setItem(S.GH_KEY, S.ghToken); }
    // TMDB key
    var tmdbInp = document.getElementById('tmdbKeyInp');
    if (tmdbInp && tmdbInp.value.trim()) { S.tmdbKey = tmdbInp.value.trim(); localStorage.setItem('tmdb_key', S.tmdbKey); }
    // SMB base
    var smbInp = document.getElementById('smbPathInp');
    if (smbInp && smbInp.value.trim()) {
      var sv = smbInp.value.trim();
      if (sv[sv.length-1] !== '/') sv += '/';
      S.smbBase = sv; localStorage.setItem(S.SMB_KEY, sv);
    }
    // Local path
    var locInp = document.getElementById('localPathInp');
    if (locInp && locInp.value.trim()) {
      var lv = locInp.value.trim();
      if (lv[lv.length-1] !== '\\' && lv[lv.length-1] !== '/') lv += '\\';
      var nm = {}; nm[lv] = S.smbBase; S.smbMap = nm;
      localStorage.setItem(S.SMB_MAP_KEY, JSON.stringify(nm));
    }
    // Player proto is saved on click, no extra save needed here
    // Auto pull toggle
    var apTog = document.getElementById('autoPullTog');
    if (apTog) { localStorage.setItem(S.AUTO_PULL_KEY, apTog.checked ? '1' : '0'); }
    var matcherInp = document.getElementById('csfdMatcherUrlInp');
    if (matcherInp && matcherInp.value.trim()) {
      var mv = matcherInp.value.trim();
      if (mv.indexOf('http') !== 0) mv = 'https://' + mv;
      S.csfdMatcherUrl = mv;
      localStorage.setItem(S.CSFD_MATCHER_URL_KEY, mv);
    }
    // Status
    var st = document.getElementById('saveAllSt');
    if (st) { st.textContent = '✓ Nastavenia uložené'; st.className = 'sett-key-st ok'; setTimeout(function(){ st.textContent=''; }, 3000); }
    S.toast('Nastavenia uložené ✓');
  });
  var _eExcel=document.getElementById('settBtnExcel');
  if(_eExcel) _eExcel.addEventListener('click',function(){
    var bom='﻿';
    var rows=S.all.map(function(m){
      var tmdbId=m.tmdbId||(S.liveCache[m.id]&&S.liveCache[m.id].tmdbUrl?S.liveCache[m.id].tmdbUrl.match(/\/(\d+)/):null);
      if(tmdbId&&Array.isArray(tmdbId)) tmdbId=tmdbId[1];
      tmdbId=tmdbId||'';
      var link=m._tmdbUrl||(S.liveCache[m.id]&&S.liveCache[m.id].tmdbUrl)||'';
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
    S.toast('CSV exportované ('+S.all.length+' filmov)');
  });

  var _eCollage=document.getElementById('settBtnCollage');
  if(_eCollage) _eCollage.addEventListener('click',function(){S.closeSett();S.exportCollage();});

  var _eRepair=document.getElementById('settBtnRepair');
  if(_eRepair) _eRepair.addEventListener('click',function(){
    if(!S.tmdbKey){S.toast('Najprv nastav TMDB API kľúč');return;}
    var broken=S.all.filter(function(m){
      return !m.poster_thumb||m.poster_thumb.length<10||!m.description;
    });
    var stEl=document.getElementById('repairSt');
    if(!broken.length){
      if(stEl){stEl.textContent='Všetky filmy majú plagát aj popis.';stEl.className='sett-key-st ok';}
      S.toast('Žiadne poškodené filmy!');return;
    }
    if(stEl){stEl.textContent='Opravujem '+broken.length+' filmov...';stEl.className='sett-key-st';}
    var done=0,fixed=0;
    var failed=[];
    function repairNext(){
      if(done>=broken.length){
        S.saveAllData();S.renderList(S.filt);
        var msg='Hotovo! Opravených: '+fixed+' z '+broken.length;
        if(failed.length) msg+=' (nenájdené: '+failed.length+')';
        if(stEl){stEl.textContent=msg;stEl.className='sett-key-st'+(fixed>0?' ok':'');}
        S.toast('Oprava dokončená: '+fixed+'/'+broken.length);
        S.scheduleAutoPush('repair');
        return;
      }
      var m=broken[done];
      delete S.liveCache[m.id];
      S.doTMDBFetch(m,function(data){
        if(data){S.liveCache[m.id]=data;fixed++;}
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
    var val=(inp&&inp.value?inp.value:S.csfdMatcherUrl||S.DEFAULT_CSFD_MATCHER_URL).trim();
    if(val&&val.indexOf('http')!==0) val='https://'+val;
    S.csfdMatcherUrl=val||S.DEFAULT_CSFD_MATCHER_URL;
    localStorage.setItem(S.CSFD_MATCHER_URL_KEY,S.csfdMatcherUrl);
    var stEl=document.getElementById('csfdImportSt');
    if(stEl){stEl.textContent='✓ Matcher URL uložená';stEl.className='sett-key-st ok';}
    S.toast('URL matchera uložená');
  }

  function openCsfdMatcher(){
    saveCsfdMatcherUrl();
    window.open(S.csfdMatcherUrl,'_blank','noopener,noreferrer');
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

    if(links>0||ratings>0) S.saveAllData();
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

  /* parseCsvLine() imported from ./src/lib/parse.js */

  function buildCsfdMovieIndex(){
    var byTmdb={},byNum={};
    S.all.forEach(function(m){
      var tid=String(m.tmdbId||(S.liveCache[m.id]&&S.liveCache[m.id].tmdbId)||'').trim();
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

  /* parseCsfdPercent() imported from ./src/lib/parse.js */

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
        S.toast('Import: '+result.links+' linkov, '+result.ratings+' hodnotení');
        if(result.links>0||result.ratings>0){S.applyFilters();S.scheduleAutoPush('csfd-matcher-import');}
      }catch(err){
        if(stEl){stEl.textContent='Import zlyhal: '+(err&&err.message?err.message:'neznáma chyba');stEl.className='sett-key-st err';}
        S.toast('Import ČSFD zlyhal');
      }
    };
    reader.readAsText(file,'UTF-8');
    this.value='';
  });

  document.getElementById("adminClose").addEventListener("click",S.closeAdmin);
  document.getElementById("adminSearchBtn").addEventListener("click",S.adminSearch);
  document.getElementById("adminSearchInp").addEventListener("keydown",function(e){if(e.key==="Enter")S.adminSearch();});
  document.getElementById("adminAddBtn").addEventListener("click",S.adminAddMovie);
  document.getElementById("adminCancelBtn").addEventListener("click",S.adminClearPreview);

  document.getElementById("matchClose").addEventListener("click",S.closeMatchPanel);
  document.getElementById("matchSearchBtn").addEventListener("click",S.matchSearch);
  document.getElementById("matchSearchInp").addEventListener("keydown",function(e){if(e.key==="Enter")S.matchSearch();});
  document.getElementById("matchApplyBtn").addEventListener("click",S.matchApply);
  document.getElementById("matchCancelBtn").addEventListener("click",function(){document.getElementById('matchPreview').classList.remove('show');S.matchPendingData=null;});
  document.getElementById("matchOv").addEventListener("click",function(e){if(e.target===this)S.closeMatchPanel();});

  // GitHub sync
  S.initFp();
  S.initSortCycle();
  S.initKeyboard();
  S.initTv();
  document.getElementById('btnRnd').addEventListener('click', S.openRandomMovie);
  document.getElementById('btnWatched').addEventListener('click', S.cycleWatchedMode);
  S.initGhSync();
  window.addEventListener('offline',function(){S.toast('Offline — dáta sú z cache');});
  window.addEventListener('online',function(){S.toast('Online');});

  document.getElementById('ghTokenSave').addEventListener('click', function() {
    var t = document.getElementById('ghTokenInp').value.trim();
    S.ghToken = t;
      // Validate token against GitHub API
      var stEl = document.getElementById('ghTokenSt');
      if (stEl) { stEl.textContent = 'Overujem token...'; stEl.className = 'sett-key-st info'; }
      S.validateGhToken(t, function(ok, info) {
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
      S.toast('GitHub token uložený');
    } else {
      localStorage.removeItem('mdb_gh_token');
      S.ghToken = '';
      document.getElementById('ghTokenInp').placeholder = 'ghp_... Personal Access Token';
      var st = document.getElementById('ghTokenSt');
      if (st) { st.textContent = 'Token vymazaný'; st.className = 'sett-key-st err'; }
    }
  });
  document.getElementById('ghPushBtn').addEventListener('click', S.ghPush);
  document.getElementById('ghPullBtn').addEventListener('click', S.ghPull);
  var _apt = document.getElementById('autoPullTog');
  if (_apt) {
    _apt.checked = S.autoPull;
    _apt.addEventListener('change', function(){
      S.autoPull = this.checked;
      localStorage.setItem(S.AUTO_PULL_KEY, this.checked ? '1' : '0');
      S.toast(`Auto-načítanie z GitHubu: ${this.checked?'zapnuté':'vypnuté'}`);
    });
  }
  var tx=0;
  ["detSc","statSc"].forEach(function(id){
    var el=document.getElementById(id);
    el.addEventListener("touchstart",function(e){tx=e.touches[0].clientX;},{passive:true});
    el.addEventListener("touchend",function(e){if(e.changedTouches[0].clientX-tx>65){if(id==="detSc")S.closeDet();else S.closeStat();}},{passive:true});
  });
});

S.initKeyboard = function initKeyboard() {
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
        S.closeMatchPanel(); return;
      }
      if (!document.getElementById('trOv').classList.contains('hidden')) {
        S.closeTr(); return;
      }
      if (document.getElementById('fpPanel').classList.contains('open')) {
        S.closeFp(); return;
      }
      if (!document.getElementById('settOverlay').classList.contains('hidden')) {
        S.closeSett(); return;
      }
      var adminEl = document.getElementById('adminPanelSc');
      if (adminEl && adminEl.offsetParent !== null) {
        S.closeAdmin(); return;
      }
      if (!document.getElementById('statSc').classList.contains('hidden')) {
        S.closeStat(); return;
      }
      if (!document.getElementById('detSc').classList.contains('hidden')) {
        document.getElementById('btnBack').click(); return;
      }
      return;
    }

    // ← → navigate films in detail view (desktop keyboard only — on TV,
    // Left/Right move focus between the detail card's own buttons instead)
    if (!S._tvOn && !document.getElementById('detSc').classList.contains('hidden') && !inInput) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!S.curId || !S.filt.length) return;
        var idx = -1;
        for (var fi = 0; fi < S.filt.length; fi++) { if (S.filt[fi].id === S.curId) { idx = fi; break; } }
        if (idx < 0) return;
        var next = e.key === 'ArrowRight'
          ? S.filt[idx + 1] || S.filt[0]
          : S.filt[idx - 1] || S.filt[S.filt.length - 1];
        if (next) S.openDet(next.id);
      }
    }
  });
};

S._autoThemeMq.addEventListener('change', function() {
  if (localStorage.getItem(S.THEME_KEY) === 'auto') S.applyTheme('auto');
});

window.addEventListener('resize',S.adjustScrnBody);

window.addEventListener('load',S.adjustScrnBody);

try { S.smbMap = JSON.parse(localStorage.getItem(S.SMB_MAP_KEY) || '{}'); } catch(e) { S.smbMap = {}; }

if (!S.smbMap || typeof S.smbMap !== 'object' || !Object.keys(S.smbMap).length) S.smbMap = {"W:\\\\Movies\\\\":"smb://DESKTOP-EGOG348/Movies/"};

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden' && S.autoPushTimer) {
    clearTimeout(S.autoPushTimer); S.autoPushTimer = null;
    if (!S.ghPushInProgress && S.ghToken && S.all && S.all.length) S.ghPush();
  }
});

S.findDuplicates = function findDuplicates() {
  var groups = [], seen = new Set();
  for (var i = 0; i < S.all.length; i++) {
    if (seen.has(i)) continue;
    var group = [S.all[i]];
    var ti = (S.all[i].title || '').toLowerCase().trim();
    var yi = S.all[i].year || 0;
    var tidi = S.all[i].tmdb_id || S.all[i].id;
    for (var j = i + 1; j < S.all.length; j++) {
      if (seen.has(j)) continue;
      var tj = (S.all[j].title || '').toLowerCase().trim();
      var yj = S.all[j].year || 0;
      var tidj = S.all[j].tmdb_id || S.all[j].id;
      var dup = false;
      if (tidi && tidj && tidi === tidj && i !== j) dup = true;
      if (!dup && ti === tj && ti.length > 0) dup = true;
      if (!dup && yi === yj && yi > 0 && ti.length > 2 && tj.length > 2 && levenshtein(ti, tj, 2) <= 2) dup = true;
      if (dup) { group.push(S.all[j]); seen.add(j); }
    }
    if (group.length > 1) { groups.push(group); seen.add(i); }
  }
  return groups;
};

S.openDupPanel = function openDupPanel() {
  var groups = S.findDuplicates();
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
    S.all = S.all.filter(function(m) { return m.id !== id; });
    S.filt = S.filt.filter(function(m) { return m.id !== id; });
    S.favs.delete(id); S.wl.delete(id); S.watched.delete(id);
    S.safeSave(S.SK, JSON.stringify(S.all));
    S.safeSave(S.FK, JSON.stringify(Array.from(S.favs)));
    S.scheduleAutoPush('dup-delete');
    S.toast('Film odstraneny');
    S.openDupPanel();
    S.renderAll();
  });
};

document.addEventListener('DOMContentLoaded', function() {
  var dupBtn = document.getElementById('settBtnDuplicates');
  if (dupBtn) dupBtn.addEventListener('click', S.openDupPanel);
  var dupClose = document.getElementById('dupClose');
  if (dupClose) dupClose.addEventListener('click', function() { document.getElementById('dupOv').classList.add('hidden'); });
  var dupOv = document.getElementById('dupOv');
  if (dupOv) dupOv.addEventListener('click', function(e) { if (e.target === dupOv) dupOv.classList.add('hidden'); });
});

S.toggleBulkMode = function toggleBulkMode() {
  S.bulkMode = !S.bulkMode;
  S.bulkSel.clear();
  var ml = document.getElementById('mlist');
  var inl = document.getElementById('bulkInline');
  var btn = document.getElementById('btnBulk');
  if (S.bulkMode) {
    ml.classList.add('bulk-mode');
    inl.classList.remove('hidden');
    btn.classList.add('on');
  } else {
    ml.classList.remove('bulk-mode');
    inl.classList.add('hidden');
    btn.classList.remove('on');
    ml.querySelectorAll('.bulk-sel').forEach(function(c) { c.classList.remove('bulk-sel'); });
  }
  S.updateBulkCnt();
};

S.updateBulkCnt = function updateBulkCnt() {
  var el = document.getElementById('bulkCnt');
  if (el) el.textContent = S.bulkSel.size || '0';
};

S.bulkToggleCard = function bulkToggleCard(card) {
  var id = parseInt(card.dataset.id, 10);
  if (S.bulkSel.has(id)) { S.bulkSel.delete(id); card.classList.remove('bulk-sel'); }
  else { S.bulkSel.add(id); card.classList.add('bulk-sel'); }
  S.updateBulkCnt();
};

document.addEventListener('DOMContentLoaded', function() {
  var btnBulk = document.getElementById('btnBulk');
  if (btnBulk) btnBulk.addEventListener('click', S.toggleBulkMode);

  document.getElementById('mlist').addEventListener('click', function(e) {
    if (!S.bulkMode) return;
    var card = e.target.closest('[data-id]');
    if (!card) return;
    e.preventDefault(); e.stopPropagation();
    S.bulkToggleCard(card);
  }, true);

  var bulkSelAllBtn = document.getElementById('bulkSelAll');
  if (bulkSelAllBtn) bulkSelAllBtn.addEventListener('click', function() {
    var ml = document.getElementById('mlist');
    var cards = ml.querySelectorAll('[data-id]');
    var allSelected = S.bulkSel.size >= cards.length;
    cards.forEach(function(c) {
      var id = parseInt(c.dataset.id, 10);
      if (allSelected) { S.bulkSel.delete(id); c.classList.remove('bulk-sel'); }
      else { S.bulkSel.add(id); c.classList.add('bulk-sel'); }
    });
    S.updateBulkCnt();
  });

  var bulkFav = document.getElementById('bulkFav');
  if (bulkFav) bulkFav.addEventListener('click', function() {
    S.bulkSel.forEach(function(id) { S.favs.add(id); });
    S.safeSave(S.FK, JSON.stringify(Array.from(S.favs)));
    S.toast(S.bulkSel.size + ' filmov pridanych do oblubenych');
    S.scheduleAutoPush('bulk-fav');
  });

  var bulkWl = document.getElementById('bulkWl');
  if (bulkWl) bulkWl.addEventListener('click', function() {
    S.bulkSel.forEach(function(id) { S.wl.add(id); });
    S.safeSave(S.WK, JSON.stringify(Array.from(S.wl)));
    S.toast(S.bulkSel.size + ' filmov pridanych do watchlistu');
    S.scheduleAutoPush('bulk-wl');
  });

  var bulkWatched = document.getElementById('bulkWatched');
  if (bulkWatched) bulkWatched.addEventListener('click', function() {
    S.bulkSel.forEach(function(id) { S.watched.add(id); S.watchedDates[id] = new Date().toISOString().slice(0,10); });
    S.safeSave(S.VK, JSON.stringify(Array.from(S.watched)));
    S.safeSave(S.VDK, JSON.stringify(S.watchedDates));
    S.toast(S.bulkSel.size + ' filmov oznacenych ako videne');
    S.scheduleAutoPush('bulk-watched');
  });

  var bulkRm = document.getElementById('bulkRm');
  if (bulkRm) bulkRm.addEventListener('click', function() {
    if (!S.bulkSel.size) return;
    if (!confirm('Naozaj odstranit ' + S.bulkSel.size + ' filmov?')) return;
    S.all = S.all.filter(function(m) { return !S.bulkSel.has(m.id); });
    S.bulkSel.forEach(function(id) { S.favs.delete(id); S.wl.delete(id); S.watched.delete(id); });
    S.safeSave(S.SK, JSON.stringify(S.all));
    S.safeSave(S.FK, JSON.stringify(Array.from(S.favs)));
    S.toast(S.bulkSel.size + ' filmov odstranenych');
    S.toggleBulkMode();
    S.renderAll();
    S.scheduleAutoPush('bulk-rm');
  });
});

S.openMapPanel = function openMapPanel() {
  var counts = {};
  S.all.forEach(function(m) {
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
    var flag = S.COUNTRY_FLAGS[key] || '&#127988;';
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
    S.fpState.country = card.dataset.country;
    S.updateFpBadge();
    S.updateFpPills();
    S.applyFilters();
    S.toast('Filter: ' + card.dataset.country);
  });
};

document.addEventListener('DOMContentLoaded', function() {
  var btnMap = document.getElementById('btnMap');
  if (btnMap) btnMap.addEventListener('click', S.openMapPanel);
  var mapClose = document.getElementById('mapClose');
  if (mapClose) mapClose.addEventListener('click', function() { document.getElementById('mapOv').classList.add('hidden'); });
  var mapOv = document.getElementById('mapOv');
  if (mapOv) mapOv.addEventListener('click', function(e) { if (e.target === mapOv) mapOv.classList.add('hidden'); });
});

S.openTimeline = function openTimeline() {
  var byYear = {};
  S.all.forEach(function(m) {
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
      S.openDet(parseInt(poster.dataset.id, 10));
    }
  });
};

document.addEventListener('DOMContentLoaded', function() {
  var btnTl = document.getElementById('btnTimeline');
  if (btnTl) btnTl.addEventListener('click', S.openTimeline);
  var tlClose = document.getElementById('timelineClose');
  if (tlClose) tlClose.addEventListener('click', function() { document.getElementById('timelineOv').classList.add('hidden'); });
  var tlOv = document.getElementById('timelineOv');
  if (tlOv) tlOv.addEventListener('click', function(e) { if (e.target === tlOv) tlOv.classList.add('hidden'); });
});

S.openDecadePanel = function openDecadePanel() {
  var byDecade = {};
  S.all.forEach(function(m) {
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
      S.openDet(parseInt(card.dataset.id, 10));
    }
  });
};

document.addEventListener('DOMContentLoaded', function() {
  var btnDec = document.getElementById('btnDecade');
  if (btnDec) btnDec.addEventListener('click', S.openDecadePanel);
  var decClose = document.getElementById('decadeClose');
  if (decClose) decClose.addEventListener('click', function() { document.getElementById('decadeOv').classList.add('hidden'); });
  var decOv = document.getElementById('decadeOv');
  if (decOv) decOv.addEventListener('click', function(e) { if (e.target === decOv) decOv.classList.add('hidden'); });
});

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
    var key = S.tmdbKey;
    fetch('https://api.themoviedb.org/3/search/movie?api_key=' + key + '&query=' + encodeURIComponent(q) + '&language=sk-SK')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        status.textContent = '';
        if (!data.results || !data.results.length) { status.textContent = 'Nic nenajdene'; return; }
        var h = '';
        data.results.slice(0, 8).forEach(function(r) {
          var poster = r.poster_path ? 'https://image.tmdb.org/t/p/w92' + r.poster_path : '';
          var yr = (r.release_date || '').substring(0, 4);
          var exists = S.all.some(function(m) { return m.tmdb_id === r.id || m.id === r.id; });
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
    var key = S.tmdbKey;
    fetch('https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + key + '&language=sk-SK&append_to_response=credits,videos')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var maxNum = S.all.reduce(function(mx, m) { return Math.max(mx, m.num || 0); }, 0);
        var genres = (d.genres || []).map(function(g) { return g.name; });
        var dir = '';
        if (d.credits && d.credits.crew) {
          var dc = d.credits.crew.find(function(c) { return c.job === 'Director'; });
          if (dc) dir = dc.name;
        }
        var newId = maxNum + 1;
        var movie = {
          id: newId,
          tmdb_id: d.id,
          num: newId,
          title: d.title || '',
          year: parseInt((d.release_date || '').substring(0, 4)) || 0,
          director: dir,
          genres: genres,
          country: (d.production_countries || []).map(function(c) { return c.name; }).join(', '),
          duration: d.runtime || 0,
          poster_thumb: d.poster_path ? 'https://image.tmdb.org/t/p/w342' + d.poster_path : '',
          _tags: []
        };
        S.liveCache[movie.id] = {
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
          if (tr) S.liveCache[movie.id].trailer = tr.key;
        }
        S.all.push(movie);
        S.safeSave(S.SK, JSON.stringify(S.all));
        S.safeSave(S.LK, JSON.stringify(S.liveCache));
        S.buildFuse();
        S.renderAll();
        S.scheduleAutoPush('quick-add');
        addBtn.textContent = 'Pridany';
        S.toast(movie.title + ' pridany');
      })
      .catch(function() { addBtn.textContent = 'Chyba'; addBtn.disabled = false; });
  });
});

document.addEventListener('DOMContentLoaded', function() {
  var ml = document.getElementById('mlist');
  if (!ml) return;

  ml.addEventListener('dragstart', function(e) {
    if (S.bulkMode || S.posterWall) return;
    var card = e.target.closest('[data-id]');
    if (!card) return;
    S.dragSrcId = parseInt(card.dataset.id, 10);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(S.dragSrcId));
  });

  ml.addEventListener('dragover', function(e) {
    if (S.dragSrcId === null) return;
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
    if (!card || S.dragSrcId === null) { S.dragSrcId = null; return; }
    var targetId = parseInt(card.dataset.id, 10);
    if (S.dragSrcId === targetId) { S.dragSrcId = null; return; }
    var srcIdx = S.all.findIndex(function(m) { return m.id === S.dragSrcId; });
    var tgtIdx = S.all.findIndex(function(m) { return m.id === targetId; });
    if (srcIdx < 0 || tgtIdx < 0) { S.dragSrcId = null; return; }
    var item = S.all.splice(srcIdx, 1)[0];
    S.all.splice(tgtIdx, 0, item);
    S.all.forEach(function(m, i) { m.num = i + 1; });
    S.safeSave(S.SK, JSON.stringify(S.all));
    S.renderAll();
    S.scheduleAutoPush('drag-reorder');
    S.toast('Poradie zmenene');
    S.dragSrcId = null;
  });

  ml.addEventListener('dragend', function() {
    ml.querySelectorAll('.drag-over,.dragging').forEach(function(c) { c.classList.remove('drag-over', 'dragging'); });
    S.dragSrcId = null;
  });
});

(function patchCards() {
  var origAppend = S.appendCards;
  S.appendCards = function(list, ml) {
    origAppend(list, ml);
    if (!S.posterWall) {
      ml.querySelectorAll('[data-id]:not([draggable])').forEach(function(c) {
        c.setAttribute('draggable', 'true');
      });
    }
  };
})();

S.openSharePanel = function openSharePanel(movieId) {
  var m = S.all.find(function(x) { return x.id === movieId; });
  if (!m) return;
  var c = S.liveCache[m.id] || {};
  var tmdbUrl = m.tmdb_id ? 'https://www.themoviedb.org/movie/' + m.tmdb_id : '';
  var text = m.title + ' (' + (m.year || '?') + ')';
  if (m.director) text += '\nReziser: ' + m.director;
  if (m.genres && m.genres.length) text += '\nZanre: ' + m.genres.join(', ');
  var pct = S.getMoviePct(m);
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
};

document.addEventListener('DOMContentLoaded', function() {
  var shareBtn = document.getElementById('btnShare');
  if (shareBtn) shareBtn.addEventListener('click', function() {
    if (S.curId) S.openSharePanel(S.curId);
  });
  var shareClose = document.getElementById('shareClose');
  if (shareClose) shareClose.addEventListener('click', function() { document.getElementById('shareOv').classList.add('hidden'); });
  var shareOv = document.getElementById('shareOv');
  if (shareOv) shareOv.addEventListener('click', function(e) { if (e.target === shareOv) shareOv.classList.add('hidden'); });
});
