/* AUTO-SPLIT from app.js. Shared state/functions live on the S namespace. */
import { S } from './state.js';
import { esc, removeDiacritics, buildMovieFilename, levenshtein } from './lib/text.js';
import { parseEMDB } from './lib/parse.js';

S.fetchLiveData = function fetchLiveData(id){
  var m=S.all.find(function(x){return x.id===id;});if(!m||!S.tmdbKey)return;
  if(S.liveCache[id]){S.applyLive(id,S.liveCache[id]);return;}
  var ac=(typeof AbortController!=="undefined")?new AbortController():null;
  var timer=setTimeout(function(){if(ac)ac.abort();},10000);
  S.doTMDBFetch(m,function(data){clearTimeout(timer);if(data){S.liveCache[id]=data;S.saveLiveCache();}if(S.curId===id)S.applyLive(id,data);},ac?ac.signal:null);
};

S.applyLive = function applyLive(id,data){
  var rbox=document.getElementById("ratingBox");
  if(rbox){
    var mv=S.all.find(function(x){return x.id===id;});
    var p=mv?S.getMoviePct(mv):(data&&data.pct!=null?data.pct:null);
    var lbl=S.RATING_LABELS[S.ratingSource]||'TMDB';
    if(p!=null){
      var col=p>=70?"#00c853":p>=50?"#ffd600":"#e53935";
      rbox.outerHTML='<div class="rating-pill"><div class="rating-pill-lbl">'+lbl+'</div><div class="rating-pill-val" style="color:'+col+'">'+p+'%</div></div>';
    } else {
      rbox.outerHTML='<div class="rating-pill-na" id="ratingBox">N/A</div>';
    }
  }
  if(!data)return;
  if(data.posterUrl){
    var mv=S.all.find(function(x){return x.id===id;});
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
  var mv2=S.all.find(function(x){return x.id===id;});if(mv2&&data.ytKey)mv2._yt=data.ytKey;
};

S.doTMDBFetch = function doTMDBFetch(m,cb,signal){
  if(!S.tmdbKey){cb(null);return;}
  var opts=signal?{signal:signal}:{};
  var baseUrl="https://api.themoviedb.org/3/search/movie?api_key="+S.tmdbKey+"&query="+encodeURIComponent(m.title)+"&language=sk";
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
      return fetch("https://api.themoviedb.org/3/movie/"+tmdbId+"?api_key="+S.tmdbKey+"&append_to_response=videos,external_ids",opts)
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
};

S.settStartBatch = function settStartBatch(){
  if(!S.tmdbKey){S.keyStatus("tmdbKeySt",S.tmdbKey);return;}
  var queue=S.all.filter(function(m){return!S.liveCache[m.id];});
  if(!queue.length){S.toast("Všetky dáta už načítané!");return;}
  if(S.tmdbAbortCtrl) S.tmdbAbortCtrl.abort();
  S.tmdbAbortCtrl=(typeof AbortController!=="undefined")?new AbortController():null;
  var batchSignal=S.tmdbAbortCtrl?S.tmdbAbortCtrl.signal:null;
  S.closeSett();S.liveRunning=true;
  var total=queue.length,done=0;
  var bar=document.getElementById("batchBar");
  bar.classList.remove("hidden");
  /* bar is in flow now */
  document.getElementById("batchInfo").textContent="0/"+total;
  document.getElementById("batchFill").style.width="0%";

  var CONCURRENCY=5;
  function runBatch(){
    if(!S.liveRunning||!queue.length){
      if(!queue.length||!S.liveRunning){
        S.liveRunning=false;
        if(S.tmdbAbortCtrl){S.tmdbAbortCtrl.abort();S.tmdbAbortCtrl=null;}
        bar.classList.add("hidden");
        /* bar is in flow now */
        S.saveAllData();
        S.renderList(S.filt);
        S.toast("Načítané: "+done+"/"+total+" filmov!");
        S.scheduleAutoPush('tmdb-batch');
      }
      return;
    }
    var group=queue.splice(0,CONCURRENCY);
    var pending=group.length;
    group.forEach(function(m){
      S.doTMDBFetch(m,function(data){
        if(data) S.liveCache[m.id]=data;
        done++;
        document.getElementById("batchFill").style.width=Math.round(done/total*100)+"%";
        document.getElementById("batchInfo").textContent=done+"/"+total;
        if(done%50===0) S.saveAllData();
        pending--;
        if(pending===0){
          if(done%20<CONCURRENCY) S.renderList(S.filt);
          setTimeout(runBatch,300);
        }
      },batchSignal);
    });
  }
  runBatch();
};

S.startImdbBatch = function startImdbBatch(){
  if(!S.omdbKey){
    var st=document.getElementById('omdbKeySt');
    if(st){st.textContent='Najprv zadajte OMDB API kľúč';st.className='sett-key-st';}
    return;
  }
  var ready=[],needTmdb=[];
  S.all.forEach(function(m){
    if(m._pctImdb!=null) return;
    var c=S.liveCache[m.id];
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
  if(!ready.length&&!needTmdb.length){S.toast('Žiadne filmy na načítanie IMDB hodnotení');return;}
  var fill=document.getElementById('imdbPfill');
  var stEl=document.getElementById('imdbBatchSt');

  if(needTmdb.length&&S.tmdbKey){
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
      fetch('https://api.themoviedb.org/3/movie/'+it.tmdbId+'/external_ids?api_key='+S.tmdbKey)
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
        S.saveAllData();
        fill.style.width='100%';
        stEl.textContent='Hotovo: '+updated+' hodnotení načítaných'+(failed?' ('+failed+' chýb)':'');
        S.renderList(S.filt);
        S.scheduleAutoPush('imdb-batch');
        return;
      }
      var item=queue[idx++];
      fetch('/api/omdb?i='+item.imdbId+'&apikey='+S.omdbKey)
        .then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
        .catch(function(){
          return fetch('https://www.omdbapi.com/?i='+item.imdbId+'&apikey='+S.omdbKey)
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
          if(done%50===0) S.saveAllData();
          setTimeout(next,200);
        });
    }
    next();
  }
};

S.startCsfdBatch = function startCsfdBatch(){
  var queue=[];
  S.all.forEach(function(m){
    if(m._pctCsfd!=null) return;
    var url=m._csfdUrl;
    if(!url) return;
    queue.push({movie:m, url:url});
  });
  if(!queue.length){S.toast('Žiadne filmy s ČSFD linkom na načítanie');return;}
  var fill=document.getElementById('csfdPfill');
  var stEl=document.getElementById('csfdBatchSt');
  var total=queue.length,done=0,updated=0,failed=0;
  fill.style.width='0%';
  stEl.textContent='0 / '+total;

  var idx=0;
  function next(){
    if(idx>=queue.length){
      S.saveAllData();
      fill.style.width='100%';
      stEl.textContent='Hotovo: '+updated+' hodnotení načítaných'+(failed?' ('+failed+' chýb)':'');
      S.renderList(S.filt);
      S.scheduleAutoPush('csfd-batch');
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
        if(done%50===0) S.saveAllData();
        setTimeout(next,300);
      });
  }
  next();
};

S.openSett = function openSett(){
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
    var ac = JSON.parse(localStorage.getItem(S.ACCENT_KEY) || 'null');
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
  document.getElementById("tmdbKeyInp").value=S.tmdbKey;
  document.getElementById("tmdbKeyInp").type="password";
  S.keyStatus("tmdbKeySt",S.tmdbKey);
  var omdbInp=document.getElementById('omdbKeyInp');
  if(omdbInp){omdbInp.value=S.omdbKey;omdbInp.type='password';}
  var omdbSt=document.getElementById('omdbKeySt');
  if(omdbSt){omdbSt.textContent=S.omdbKey?'✓ OMDB kľúč uložený':'';omdbSt.className=S.omdbKey?'sett-key-st ok':'sett-key-st';}
  var imdbCount=S.all.filter(function(m){return m._pctImdb!=null;}).length;
  var imdbSt=document.getElementById('imdbBatchSt');
  if(imdbSt&&imdbCount)imdbSt.textContent=imdbCount+' filmov s IMDB hodnotením';
  var csfdCount=S.all.filter(function(m){return m._pctCsfd!=null;}).length;
  var csfdSt=document.getElementById('csfdBatchSt');
  if(csfdSt&&csfdCount)csfdSt.textContent=csfdCount+' filmov s ČSFD hodnotením';
  var matcherInp=document.getElementById('csfdMatcherUrlInp');
  if(matcherInp)matcherInp.value=S.csfdMatcherUrl;
  document.getElementById("ttabList").className="ttab"+(S.grid?"":" on");
  document.getElementById("ttabGrid").className="ttab"+(S.grid?" on":"");
  document.getElementById("settSortSel").value=S.prefs.sort||"num";
  var lc=Object.keys(S.liveCache).length;
  document.getElementById("settPfill").style.width=S.all.length?(lc/S.all.length*100)+"%":"0%";
  document.getElementById("settBatchSt").textContent=lc>0?lc+" z "+S.all.length+" filmov nacitanych":"";
  var _ig=document.getElementById("settInfoGrid");
  if(_ig)_ig.innerHTML=
    S.infoItem("Filmov",S.all.length)+S.infoItem("S plagatom",S.all.filter(function(m){return m.poster_thumb&&m.poster_thumb.length>10;}).length)+
    S.infoItem("Hodnotenia",lc)+S.infoItem("Oblubene",S.favs.size)+S.infoItem("Watchlist",S.wl.size)+S.infoItem("Videne",S.watched.size);
  var vt=document.getElementById("viewTog"); if(vt && vt.tagName==="SELECT") vt.value=S.grid?"grid":"list";
  document.querySelectorAll('#pathModeToggle .ttab').forEach(function(b){
    b.className = 'ttab' + (b.dataset.mode === S.pathMode ? ' on' : '');
  });
  var smbInp = document.getElementById('smbPathInp');
  if (smbInp) smbInp.value = S.smbBase;
  var localInp = document.getElementById('localPathInp');
  if (localInp) {
    var firstLocal = Object.keys(S.smbMap)[0] || 'W:\\Movies\\';
    localInp.value = firstLocal;
  }
  var smbSt = document.getElementById('smbPathSt');
  if (smbSt && S.smbBase) {
    var lk = Object.keys(S.smbMap)[0] || '';
    smbSt.textContent = '\u2713 ' + lk + ' \u2192 ' + S.smbBase;
    smbSt.className = 'sett-key-st ok';
  }
  // Sync autoPullTog
  const _apt=document.getElementById("autoPullTog"); if(_apt)_apt.checked=S.autoPull;
  // Sync rating source toggle
  document.querySelectorAll('#ratingSrcToggle .ttab').forEach(function(b){
    b.className=(b.dataset.src===S.ratingSource)?'ttab on':'ttab';
  });
  // Sync admin tab: debug mode + per-movie fix selector
  var _dmt=document.getElementById('debugModeTog');
  if(_dmt) _dmt.checked=S.debugMode;
  S.updateDebugInfo();
  S.adminFixPopulateSelect();
  document.getElementById("settOverlay").classList.remove("hidden");
  document.getElementById("settPanel").classList.remove("hidden");
};

S.closeSett = function closeSett() {
  document.getElementById("settOverlay").classList.add("hidden");
  document.getElementById("settPanel").classList.add("hidden");
};

S.activateSettingsTab = function activateSettingsTab(tabKey){
  var key=tabKey||"appearance";
  document.querySelectorAll(".sett-tab").forEach(function(tab){
    var active=tab.dataset.tab===key;
    tab.classList.toggle("active",active);
    tab.setAttribute("aria-selected",active?"true":"false");
  });
  document.querySelectorAll(".sett-tab-panel").forEach(function(panel){
    panel.classList.toggle("active",panel.dataset.panel===key);
  });
};

S.infoItem = function infoItem(l, v) {
  return `<div class="sett-info-item"><div class="sett-info-lbl">${l}</div><div class="sett-info-val">${v}</div></div>`;
};

S.settSetView = function settSetView(v){
  S.grid = v === 'grid';
  S.posterWall = v === 'posterwall';
  var ml = document.getElementById('mlist');
  var vt = document.getElementById('viewTog');
  if (ml) ml.className = S.posterWall ? 'mlist posterwall' : S.grid ? 'mlist grid' : 'mlist';
  if (vt) {
    vt.innerHTML = S.VIEW_ICONS[v]||S.VIEW_ICONS.list;
    vt.title = S.VIEW_TITLES[v]||'';
  }
  var tl = document.getElementById('ttabList');
  var tg = document.getElementById('ttabGrid');
  if (tl) tl.className = 'ttab' + (v==='list' ? ' on' : '');
  if (tg) tg.className = 'ttab' + (v==='grid' ? ' on' : '');
  S.prefs.view = v; S.savePrefs(); S.renderList(S.filt);
};

S.settSetSort = function settSetSort(v){S.prefs.sort=v;S.savePrefs();document.getElementById("sortSel").value=v;S.syncSortPill();S.applyFilters();};

S.impPdf = function impPdf(){
  try{localStorage.removeItem("mdb_empty");}catch(e){}
  document.getElementById("fileInp").click();
};

S.handleFile = function handleFile(){
  var file=document.getElementById("fileInp").files[0];if(!file)return;
  document.getElementById("fileInp").value="";S.closeSett();
  S.showMod("Importujem databázu",file.name);S.setP(2,"Čítam súbor...");
  
  var isZip = file.name.toLowerCase().endsWith('.zip');
  
  if (isZip) {
    // ── ZIP import (EMDB HTML export) ──
    S.loadJSZip().then(function(){return file.arrayBuffer();}).then(function(ab) {
      return S.parseEMDBZip(ab, S.setP);
    }).then(function(mv) {
      if(!mv||!mv.length){S.hideMod();S.toast("Nenašli sa filmy.");return;}
      
      // Rescue posters from existing data for movies without ZIP cover
      var posterMap={};
      try{buildMovies().forEach(function(m){if(m.poster_thumb&&m.poster_thumb.length>10)posterMap[m.num]=m.poster_thumb;});}catch(e){}
      try{var saved=localStorage.getItem(S.SK);if(saved){JSON.parse(saved).forEach(function(m){if(m.poster_thumb&&m.poster_thumb.length>10)posterMap[m.num]=m.poster_thumb;});}}catch(e){}
      S.all.forEach(function(m){if(m.poster_thumb&&m.poster_thumb.length>10)posterMap[m.num]=m.poster_thumb;});
      mv.forEach(function(m){
        if((!m.poster_thumb||m.poster_thumb.length<10)&&posterMap[m.num]) m.poster_thumb=posterMap[m.num];
      });
      
      // Also rescue liveCache data (TMDB ratings, trailers)
      mv.forEach(function(m){
        var cached = S.liveCache[m.id];
        if (cached) {
          if (cached.ytKey && !m._yt) m._yt = cached.ytKey;
          if (cached.posterUrl && (!m.poster_thumb || m.poster_thumb.length < 10)) m.poster_thumb = cached.posterUrl;
        }
      });
      
      S.all = mv;
      S.buildFuse(); // rebuild Fuse index after GitHub pull
      // Save — strip base64 posters to save space (keep URL posters)
      try{
        var toSave=S.all.map(function(m){
          var c=Object.assign({},m);
          if(c.poster_thumb&&c.poster_thumb.indexOf("data:")===0) c.poster_thumb="";
          return c;
        });
        S.safeSave(S.SK,JSON.stringify(toSave));
      }catch(e){console.warn("Save error:",e);}
      
      S.setP(100,"Hotovo!");
      setTimeout(function(){
        S.hideMod();S.renderAll();
        S.toast("Importovaných "+mv.length+" filmov (#"+mv[0].num+"-#"+mv[mv.length-1].num+")");
        if(S.tmdbKey){S.toast("Automaticky spúšťam TMDB...");setTimeout(S.settStartBatch,1500);}
        // AUTO-SYNC: ak je GitHub token nastavený, automaticky pushneme dáta
        if(S.ghToken){
          setTimeout(function(){
            S.toast("🔄 Auto-sync do GitHubu...");
            S.ghPush();
          },2000);
        }
      },500);
    }).catch(function(e){S.hideMod();S.toast("Chyba: "+e.message);console.error(e);});
  } else {
    // ── Legacy PDF import ──
    S.loadPdfJs().then(function(){return file.arrayBuffer();})
      .then(function(ab){S.setP(10,"Načítavam PDF...");return pdfjsLib.getDocument({data:ab}).promise;})
      .then(function(pdf){
        var tot=pdf.numPages,txt="",chain=Promise.resolve();
        for(var i=1;i<=tot;i++){(function(n){chain=chain.then(function(){
          return pdf.getPage(n).then(function(p){return p.getTextContent();})
            .then(function(c){var pt="";c.items.forEach(function(s){pt+=s.str;if(s.hasEOL)pt+="\n";});if(pt&&pt[pt.length-1]!=="\n")pt+="\n";txt+=pt;S.setP(10+Math.round(n/tot*40),"Strana "+n+"/"+tot);});
        });})(i);}
        return chain.then(function(){return txt;});
      })
      .then(function(txt){
        S.setP(52,"Parsovanie...");var mv=parseEMDB(txt);
        if(!mv.length){S.hideMod();S.toast("Nenašli sa filmy v PDF.");return;}
        S.all=mv;
        S.buildFuse(); // rebuild Fuse index after PDF import
        S.safeSave(S.SK,JSON.stringify(S.all));
        S.setP(100,"Hotovo!");setTimeout(function(){S.hideMod();S.renderAll();S.toast("Importovaných "+mv.length+" filmov");if(S.tmdbKey){S.toast("Spúšťam TMDB...");setTimeout(S.settStartBatch,1500);}},500);
      }).catch(function(e){S.hideMod();S.toast("Chyba: "+e.message);console.error(e);});
  }
};

S.exportHtml = function exportHtml(){
  if(!Object.keys(S.liveCache).length){S.toast("Najprv nacitaj data!");return;}
  S.toast("Generujem HTML...");
  setTimeout(function(){
    var html=document.documentElement.outerHTML;
    var tag="<scr"+"ipt>var PREBAKED_LIVE="+JSON.stringify(S.liveCache).replace(/<\/script/gi,"<\\/script")+";<"+"/scr"+"ipt>";
    html=html.replace("</head>",tag+"</head>");
    var blob=new Blob([html],{type:"text/html;charset=utf-8"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");a.href=url;
    a.download="MarcelovaFilmovaDatabaza_"+new Date().toISOString().slice(0,10)+".html";
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
    S.toast("HTML subor stahnuty!");
  },200);
};

S.clearLiveData = function clearLiveData(){
  if(!confirm("Vymazat vsetky nacitane hodnotenia a trailery?"))return;
  S.liveCache={};try{localStorage.removeItem(S.LK);}catch(e){}
  S.renderList(S.filt);S.openSett();S.toast("Nacitane data vymazane.");
};

S.clearAllData = function clearAllData(){
  if(!confirm('Vymazať VŠETKO?\n\nPOZOR: Ak vymažeš aj cache prehliadača, dáta sa obnovia z HTML súboru. Pre trvalé vymazanie použi GitHub Sync alebo exportuj prázdny HTML.'))return;
  try{
    S.safeSave(S.SK,JSON.stringify([]));
    localStorage.removeItem(S.FK);
    localStorage.removeItem(S.WK);
    localStorage.removeItem(S.VK);
    localStorage.removeItem(S.VDK);
    localStorage.removeItem(S.LK);
    localStorage.removeItem(S.PK);
    localStorage.setItem('mdb_empty','1');
  }catch(e){}
  S.liveCache={};S.favs=new Set();S.wl=new Set();S.watched=new Set();S.watchedDates={};
  S.genre='';S.fpState={yearFrom:0,yearTo:0,minRating:0,minRatingCsfd:0,country:'',genres:[]};
  S.favMode=false;S.wlMode=false;S.watchedMode=false;
  S.prefs={view:'list',sort:'num',sortDir:'desc',showRecent:false};
  S.all=[];S.filt=[];S.closeSett();
  S.fuseInst=null; // reset Fuse index on clear
  var ml=document.getElementById('mlist');if(ml)ml.style.display='none';
  var es=document.getElementById('emptySt');if(es)es.style.display='flex';
  var ls=document.getElementById('loadSt');if(ls)ls.style.display='none';
  S.buildChips();
  S.toast('Databáza vymazaná.');
  // Offer persistent solution after short delay
  setTimeout(function(){
    var msg=S.ghToken
      ?'Pre trvalé vymazanie (aj po cache clear) ulož prázdnu DB na GitHub. Uložiť teraz?'
      :'Pre trvalé vymazanie exportuj prázdny HTML a nahraj ho na server. Exportovať teraz?';
    if(confirm(msg)){S.ghToken?S.ghPush():S.exportHtml();}
  },500);
};

S.exportJson = function exportJson(){
  if(!S.all.length){S.toast('Žiadne filmy na export');return;}
  var data={
    version:S.APP_VERSION,
    exported:new Date().toISOString(),
    movies:S.all,
    favourites:Array.from(S.favs),
    watchlist:Array.from(S.wl),
    watched:Array.from(S.watched),
    watchedDates:S.watchedDates,
    liveCache:S.liveCache
  };
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;
  a.download='filmy_backup_'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(url);a.remove();},1000);
  S.toast('JSON záloha stiahnutá!');
};

S.openAdmin = function openAdmin() {
  S.closeSett();
  document.getElementById('adminPanelSc').style.display = 'block';
  document.getElementById('adminSearchInp').focus();
  S.adminSetStatus('');
  S.adminClearPreview();
  document.getElementById('adminResults').innerHTML = '';
};

S.closeAdmin = function closeAdmin() {
  document.getElementById('adminPanelSc').style.display = 'none';
  S.adminPending = null;
};

S.adminSetStatus = function adminSetStatus(msg, type) {
  var el = document.getElementById('adminStatus');
  el.textContent = msg;
  el.className = 'admin-status' + (type ? ' ' + type : '');
};

S.adminClearPreview = function adminClearPreview() {
  document.getElementById('adminPreview').classList.remove('show');
  S.adminPending = null;
};

S.adminSearch = function adminSearch() {
  var q = document.getElementById('adminSearchInp').value.trim();
  if (!q) return;
  if (!S.tmdbKey) { S.adminSetStatus('Chýba TMDB API kľúč — nastav ho v Nastaveniach.', 'err'); return; }

  S.adminSetStatus('Hľadám...'); 
  document.getElementById('adminResults').innerHTML = '';
  S.adminClearPreview();

  var btn = document.getElementById('adminSearchBtn');
  btn.disabled = true;

  var isId = /^\d+$/.test(q);
  var url = isId
    ? 'https://api.themoviedb.org/3/movie/' + q + '?api_key=' + S.tmdbKey + '&language=sk&append_to_response=videos,external_ids,credits'
    : 'https://api.themoviedb.org/3/search/movie?api_key=' + S.tmdbKey + '&query=' + encodeURIComponent(q) + '&language=sk&page=1';

  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.disabled = false;
      if (isId) {
        if (data.success === false) { S.adminSetStatus('TMDB ID nenájdené.', 'err'); return; }
        S.adminShowResults([data]);
      } else {
        if (!data.results || !data.results.length) { S.adminSetStatus('Nič sa nenašlo.', 'err'); return; }
        S.adminShowResults(data.results.slice(0, 6));
      }
    })
    .catch(function() {
      btn.disabled = false;
      S.adminSetStatus('Chyba siete. Skontroluj API kľúč.', 'err');
    });
};

S.adminShowResults = function adminShowResults(results) {
  S.adminSetStatus(results.length + ' výsledk' + (results.length === 1 ? '' : results.length < 5 ? 'y' : 'ov'));
  var container = document.getElementById('adminResults');
  container.innerHTML = results.map(function(r, idx) {
    var poster = r.poster_path
      ? '<img class="admin-poster" src="https://image.tmdb.org/t/p/w92' + r.poster_path + '" alt="">'
      : '<div class="admin-poster-ph">🎬</div>';
    var year = (r.release_date || '').slice(0, 4) || '?';
    var rating = r.vote_average ? Math.round(r.vote_average * 10) + '%' : '–';
    var alreadyIn = S.all.some(function(m) { return m.tmdbId === r.id; });
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
      S.adminFetchFullAndPreview(container._results[parseInt(el.dataset.idx)].id);
    });
  });
};

S.adminFetchFullAndPreview = function adminFetchFullAndPreview(tmdbId) {
  S.adminSetStatus('Načítavam detaily...');
  fetch('https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + S.tmdbKey +
        '&language=sk&append_to_response=videos,external_ids,credits')
    .then(function(r) { return r.json(); })
    .then(function(d) {
      S.adminSetStatus('');
      S.adminBuildPreview(d);
    })
    .catch(function() { S.adminSetStatus('Chyba načítavania detailov.', 'err'); });
};

S.adminBuildPreview = function adminBuildPreview(d) {
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
  var nextNum = S.all.length ? Math.max.apply(null, S.all.map(function(m) { return m.num || 0; })) + 1 : 1;

  // Build the movie object that will be inserted
  S.adminPending = {
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
};

S.adminAddMovie = function adminAddMovie() {
  if (!S.adminPending) return;
  var m   = S.adminPending.movie;
  var ld  = S.adminPending.liveData;

  // Add to runtime array
  S.all.push(m);

  // Save live data (rating, trailer, links)
  S.liveCache[m.id] = ld;
  S.saveLiveCache();

  // Persist the movie list (strip posters to stay under localStorage limit)
  S.adminSaveAll();

  S.toast(`✅ "${m.title}" pridaný do databázy!`);
  S.buildFuse();   // rebuild search index
  S.renderAll();
  S.closeAdmin();
  if (S.ghToken && S.prefs.autoPush !== false) {
    setTimeout(function() { S.toast('☁ Ukladám na GitHub...'); S.ghPush(); }, 800);
  }
};

S.adminSaveAll = function adminSaveAll() {
  try {
    var toSave = S.all.map(function(m) {
      var copy = Object.assign({}, m);
      // Keep URL posters (TMDB), only strip base64 data URIs
      if (copy.poster_thumb && copy.poster_thumb.indexOf('data:') === 0) copy.poster_thumb = '';
      return copy;
    });
    S.safeSave(S.SK, JSON.stringify(toSave));
  } catch(e) {
    console.warn('[Admin] localStorage save failed:', e);
  }
};

S.openMatchPanel = function openMatchPanel(id){
  var m=S.all.find(function(x){return x.id===id;});if(!m)return;
  S.matchMovieId=id;
  S.matchPendingData=null;
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
};

S.closeMatchPanel = function closeMatchPanel(){
  var ov=document.getElementById('matchOv');
  ov.classList.add('hidden');
  ov.style.display='';
  S.matchMovieId=null;S.matchPendingData=null;
};

S.matchSearch = function matchSearch(){
  var q=document.getElementById('matchSearchInp').value.trim();
  if(!q)return;
  if(!S.tmdbKey){document.getElementById('matchStatus').textContent='Chýba TMDB API kľúč';return;}
  document.getElementById('matchStatus').textContent='Hľadám...';
  document.getElementById('matchResults').innerHTML='';
  document.getElementById('matchPreview').classList.remove('show');
  var btn=document.getElementById('matchSearchBtn');
  btn.disabled=true;
  var isId=/^\d+$/.test(q);
  var url=isId
    ?'https://api.themoviedb.org/3/movie/'+q+'?api_key='+S.tmdbKey+'&language=sk&append_to_response=videos,external_ids,credits'
    :'https://api.themoviedb.org/3/search/movie?api_key='+S.tmdbKey+'&query='+encodeURIComponent(q)+'&language=sk&page=1';
  fetch(url).then(function(r){return r.json();}).then(function(data){
    btn.disabled=false;
    if(isId){
      if(data.success===false){document.getElementById('matchStatus').textContent='TMDB ID nenájdené.';return;}
      S.matchShowResults([data]);
    } else {
      if(!data.results||!data.results.length){document.getElementById('matchStatus').textContent='Nič sa nenašlo.';return;}
      S.matchShowResults(data.results.slice(0,30));
    }
  }).catch(function(){btn.disabled=false;document.getElementById('matchStatus').textContent='Chyba siete.';});
};

S.matchShowResults = function matchShowResults(results){
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
      S.matchFetchFull(container._results[parseInt(el.dataset.idx)].id);
    });
  });
};

S.matchFetchFull = function matchFetchFull(tmdbId){
  document.getElementById('matchStatus').textContent='Načítavam detaily...';
  fetch('https://api.themoviedb.org/3/movie/'+tmdbId+'?api_key='+S.tmdbKey+'&language=sk&append_to_response=videos,external_ids,credits')
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

      S.matchPendingData={
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
};

S.matchApply = function matchApply(){
  if(!S.matchPendingData||!S.matchMovieId)return;
  var m=S.all.find(function(x){return x.id===S.matchMovieId;});if(!m)return;
  var d=S.matchPendingData;
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
  S.liveCache[m.id]=d.liveData;
  S.saveLiveCache();
  S.adminSaveAll();
  S.toast('✓ Film "'+m.title+'" spárovaný s TMDB #'+d.tmdbId);
  S.closeMatchPanel();
  S.openDet(m.id);
  S.renderAll();
  S.scheduleAutoPush('match');
};

S.impPdfUpdate = function impPdfUpdate(){
  try{localStorage.removeItem("mdb_empty");}catch(e){}
  document.getElementById("fileInpUpdate").click();
};

S.handleFileUpdate = function handleFileUpdate(){
  var file=document.getElementById("fileInpUpdate").files[0];if(!file)return;
  document.getElementById("fileInpUpdate").value="";S.closeSett();
  S.showMod("Aktualizujem dáta","Porovnávam s existujúcou databázou...");S.setP(2,"Čítam súbor...");
  
  var isZip = file.name.toLowerCase().endsWith('.zip');
  var parsePromise;
  
  if (isZip) {
    parsePromise = S.loadJSZip().then(function(){return file.arrayBuffer();}).then(function(ab){ return S.parseEMDBZip(ab, S.setP); });
  } else {
    // Legacy PDF
    parsePromise = S.loadPdfJs().then(function(){return file.arrayBuffer();}).then(function(ab){
      S.setP(10,"PDF...");return pdfjsLib.getDocument({data:ab}).promise;
    }).then(function(pdf){
      var tot=pdf.numPages,txt="",chain=Promise.resolve();
      for(var i=1;i<=tot;i++){(function(n){chain=chain.then(function(){
        return pdf.getPage(n).then(function(p){return p.getTextContent();}).then(function(c){
          var pt="";c.items.forEach(function(s){pt+=s.str;if(s.hasEOL)pt+="\n";});if(pt&&pt[pt.length-1]!=="\n")pt+="\n";txt+=pt;S.setP(10+Math.round(n/tot*45),"Strana "+n+"/"+tot);
        });
      });})(i);}
      return chain.then(function(){return parseEMDB(txt);});
    });
  }
  
  parsePromise.then(function(newMovies){
    if(!newMovies||!newMovies.length){S.hideMod();S.toast("Nenašli sa filmy.");return;}
    S.setP(90,"Porovnávam...");
    var existMap={};
    S.all.forEach(function(m){existMap[m.num]=m;});
    var added=0,updated=0,unchanged=0;
    var mergeFields=["title","year","duration","director","genres","country","cast","description","_localPath","_yt","_tmdbUrl","_imdbUrl","_csfdUrl","_pctImdb","_pctCsfd","tmdbId","_tags"];
    newMovies.forEach(function(nm){
      var existing=existMap[nm.num];
      if(!existing){
        nm.id=nm.num;S.all.push(nm);existMap[nm.num]=nm;added++;
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
    S.all.sort(function(a,b){return(a.num||0)-(b.num||0);});
    S.filt=S.all.slice();
    var toSave=S.all.map(function(m){var c=Object.assign({},m);if(c.poster_thumb&&c.poster_thumb.indexOf("data:")===0)c.poster_thumb="";return c;});S.safeSave(S.SK,JSON.stringify(toSave));
    S.applyFilters();S.setP(100,"Hotovo!");
    setTimeout(function(){S.hideMod();S.toast("✓ +"+added+" nových, "+updated+" upravených, "+unchanged+" bez zmeny");},600);
  }).catch(function(err){S.hideMod();S.toast("Chyba: "+err.message);console.error(err);});
};

S.parseEMDBZip = function parseEMDBZip(zipData, progressCb) {
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
};

S.exportCollage = function exportCollage(){
  var src=S.filt.length?S.filt:S.all;
  var movies=src.filter(function(m){return m.poster_thumb&&m.poster_thumb.length>10;});
  if(!movies.length){S.toast('Žiadne filmy s plagátmi');return;}
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
          S.toast('Koláž exportovaná ('+movies.length+' filmov)');
        },'image/png');
      }
    };
    img.onerror=function(){loaded++;if(loaded>=movies.length)img.onload();};
    img.src=m.poster_thumb;
  });
};

/* ═══════════════ Admin: debug mode ═══════════════ */
S.setDebugMode = function setDebugMode(on){
  S.debugMode=!!on;
  try{localStorage.setItem(S.DEBUG_MODE_KEY,S.debugMode?'1':'0');}catch(e){}
  S.updateDebugInfo();
};

S.updateDebugInfo = function updateDebugInfo(){
  var box=document.getElementById('debugInfoBox');
  if(!box)return;
  if(!S.debugMode){box.classList.add('hidden');return;}
  box.classList.remove('hidden');
  var localBase=Object.keys(S.smbMap||{})[0]||'–';
  var lines=[
    'TV mód: '+(S._tvOn?'áno':'nie'),
    'Režim ciest: '+S.pathMode,
    'Prehrávač: '+S.playerProto,
    'Lokálny základ: '+localBase,
    'SMB základ: '+(S.smbBase||'–'),
    'Filmov: '+S.all.length,
    'User-Agent: '+navigator.userAgent
  ];
  box.textContent=lines.join('\n');
};

/* ═══════════════ Admin: manuálna oprava filmu (cesta / IMDB / ČSFD) ═══════════════ */
S.adminFixPopulateSelect = function adminFixPopulateSelect(){
  var sel=document.getElementById('adminFixMovieSel');
  if(!sel)return;
  var prev=sel.value;
  var sorted=S.all.slice().sort(function(a,b){return (a.title||'').localeCompare(b.title||'');});
  sel.innerHTML=sorted.map(function(m){
    return '<option value="'+m.id+'">'+esc(m.title)+' ('+(m.year||'?')+')</option>';
  }).join('');
  if(prev&&sorted.some(function(m){return String(m.id)===prev;})) sel.value=prev;
  if(sel.value) S.adminFixLoadMovie(parseInt(sel.value,10));
};

S.adminFixLoadMovie = function adminFixLoadMovie(id){
  var m=S.all.find(function(x){return x.id===id;});
  if(!m)return;
  var pathInp=document.getElementById('adminFixPathInp');
  var imdbInp=document.getElementById('adminFixImdbInp');
  var csfdInp=document.getElementById('adminFixCsfdInp');
  var csfdPctInp=document.getElementById('adminFixCsfdPctInp');
  if(pathInp) pathInp.value=m._localPath||'';
  if(imdbInp){var c=S.liveCache[id];imdbInp.value=(c&&c.imdbUrl)||'';}
  if(csfdInp) csfdInp.value=m._csfdUrl||'';
  if(csfdPctInp) csfdPctInp.value=m._pctCsfd!=null?m._pctCsfd:'';
  var st=document.getElementById('adminFixSt');
  if(st){st.textContent='';st.className='sett-key-st';}
  var cst=document.getElementById('adminFixCsfdSt');
  if(cst){cst.textContent='';cst.className='sett-key-st';}
};

S.adminFixSave = function adminFixSave(){
  var sel=document.getElementById('adminFixMovieSel');
  if(!sel||!sel.value)return;
  var id=parseInt(sel.value,10);
  var m=S.all.find(function(x){return x.id===id;});
  if(!m)return;
  var pathInp=document.getElementById('adminFixPathInp');
  var imdbInp=document.getElementById('adminFixImdbInp');
  var csfdInp=document.getElementById('adminFixCsfdInp');
  var csfdPctInp=document.getElementById('adminFixCsfdPctInp');
  if(pathInp) m._localPath=pathInp.value.trim();
  if(csfdInp){var cv=csfdInp.value.trim();if(cv)m._csfdUrl=cv;else delete m._csfdUrl;}
  if(csfdPctInp){
    var pv=csfdPctInp.value.trim();
    if(pv===''){delete m._pctCsfd;}
    else{var pct=Math.max(0,Math.min(100,parseInt(pv,10)));if(!isNaN(pct))m._pctCsfd=pct;}
  }
  if(imdbInp){
    var iv=imdbInp.value.trim();
    if(!S.liveCache[id]) S.liveCache[id]={};
    if(iv) S.liveCache[id].imdbUrl=iv; else delete S.liveCache[id].imdbUrl;
    S.saveLiveCache();
  }
  S.saveAllData();
  S.scheduleAutoPush('admin-fix');
  if(S.curId===id) S.openDet(id);
  S.renderAll();
  var st=document.getElementById('adminFixSt');
  if(st){st.textContent='✓ Uložené';st.className='sett-key-st ok';}
  S.toast('Zmeny uložené');
};

/* Auto-fill the ČSFD % field by scraping the rating off the ČSFD URL above it. */
S.adminFixCsfdFetch = function adminFixCsfdFetch(){
  var urlInp=document.getElementById('adminFixCsfdInp');
  var pctInp=document.getElementById('adminFixCsfdPctInp');
  var cst=document.getElementById('adminFixCsfdSt');
  var url=urlInp?urlInp.value.trim():'';
  if(!url){if(cst){cst.textContent='Najprv zadaj ČSFD URL vyššie.';cst.className='sett-key-st err';}return;}
  if(cst){cst.textContent='Načítavam z ČSFD...';cst.className='sett-key-st';}
  fetch('/api/csfd?url='+encodeURIComponent(url))
    .then(function(r){return r.json();})
    .then(function(d){
      if(d&&d.rating!=null){
        if(pctInp)pctInp.value=d.rating;
        if(cst){cst.textContent='✓ Načítané: '+d.rating+'%';cst.className='sett-key-st ok';}
      } else {
        if(cst){cst.textContent='Hodnotenie sa na stránke nenašlo.';cst.className='sett-key-st err';}
      }
    })
    .catch(function(){
      if(cst){cst.textContent='Chyba načítania stránky.';cst.className='sett-key-st err';}
    });
};

/* ═══════════════ Admin: automatické párovanie ciest v priečinku ═══════════════ */
function normName(s){
  return removeDiacritics(String(s||'')).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function renderAutoPairResults(results,fileCount){
  var box=document.getElementById('adminAutoPairResults');
  var applyBtn=document.getElementById('adminAutoPairApplyBtn');
  var st=document.getElementById('adminAutoPairSt');
  if(!box)return;
  var withMatch=results.filter(function(r){return r.file;});
  if(st) st.textContent=fileCount+' súborov v priečinku · '+withMatch.length+' návrhov, '+(results.length-withMatch.length)+' nenájdených';
  if(!results.length){
    box.innerHTML='<div class="sett-btn-hint">Všetky filmy už majú správne priradenú cestu.</div>';
    if(applyBtn) applyBtn.classList.add('hidden');
    return;
  }
  box.innerHTML=results.map(function(r,idx){
    if(!r.file){
      return '<div class="sett-row" style="align-items:flex-start;opacity:.6">'+
        '<span style="flex:1;font-size:11px"><b>'+esc(r.movie.title)+'</b> ('+(r.movie.year||'?')+')<br>'+
        '<span style="color:#e06060">&rarr; súbor nenájdený</span></span></div>';
    }
    var label=r.type==='exact'?'presná zhoda':'približná zhoda';
    return '<label class="sett-row" style="align-items:flex-start;cursor:pointer">'+
      '<input type="checkbox" class="autopair-chk" data-idx="'+idx+'" checked style="margin-top:3px">'+
      '<span style="flex:1;font-size:11px">'+
        '<b>'+esc(r.movie.title)+'</b> ('+(r.movie.year||'?')+')<br>'+
        '<span style="color:var(--text3)">&rarr; '+esc(r.file.name)+' <i>('+label+')</i></span>'+
      '</span></label>';
  }).join('');
  if(applyBtn) applyBtn.classList.remove('hidden');
}

S.adminAutoPairScan = function adminAutoPairScan(fileList){
  var files=[];
  for(var i=0;i<fileList.length;i++){
    var f=fileList[i];
    if(/\.(mkv|mp4|avi|mov|m4v|wmv|ts)$/i.test(f.name)) files.push(f);
  }
  var usedIdx={};
  var results=[];
  var unresolved=[];

  S.all.forEach(function(m){
    var currentName=(m._localPath?m._localPath.replace(/^.*[\\/]/,''):buildMovieFilename(m)).toLowerCase();
    for(var i=0;i<files.length;i++){
      if(usedIdx[i]) continue;
      if(files[i].name.toLowerCase()===currentName){usedIdx[i]=true;return;} // already correctly paired
    }
    var expected=buildMovieFilename(m).toLowerCase();
    if(expected!==currentName){
      for(var j=0;j<files.length;j++){
        if(usedIdx[j]) continue;
        if(files[j].name.toLowerCase()===expected){
          usedIdx[j]=true;results.push({movie:m,file:files[j],type:'exact'});return;
        }
      }
    }
    unresolved.push(m);
  });

  unresolved.forEach(function(m){
    var mTitle=normName(m.title);
    var mYear=String(m.year||'');
    var bestI=-1,bestScore=Infinity;
    for(var i=0;i<files.length;i++){
      if(usedIdx[i]) continue;
      var base=files[i].name.replace(/\.[^.]+$/,'');
      var fYear=(base.match(/\b(19|20)\d{2}\b/)||[])[0]||'';
      var fName=normName(base.replace(/\b(19|20)\d{2}\b/,''));
      if(mYear&&fYear&&mYear!==fYear) continue;
      // Release-style names ("Title.2020.1080p.BluRay...") contain the full
      // normalized title plus extra tags — a plain edit-distance check would
      // reject these purely due to length, so a substring hit always wins.
      var contains=mTitle.length>2&&fName.length>2&&(fName.indexOf(mTitle)!==-1||mTitle.indexOf(fName)!==-1);
      var dist=levenshtein(mTitle,fName,12);
      var thresh=Math.max(3,Math.round(Math.max(mTitle.length,fName.length)*0.3));
      if(!contains&&dist>thresh) continue;
      var score=contains?0:dist;
      if(score<bestScore){bestScore=score;bestI=i;}
    }
    if(bestI>=0){usedIdx[bestI]=true;results.push({movie:m,file:files[bestI],type:'fuzzy'});}
    else results.push({movie:m,file:null,type:'none'});
  });

  S._autoPairResults=results;
  renderAutoPairResults(results,files.length);
};

S.adminAutoPairApply = function adminAutoPairApply(){
  var results=S._autoPairResults||[];
  if(!results.length)return;
  var boxes=document.querySelectorAll('.autopair-chk');
  var localBase=Object.keys(S.smbMap||{})[0]||'W:\\Movies\\';
  localBase=localBase.replace(/\//g,'\\');
  if(localBase[localBase.length-1]!=='\\') localBase+='\\';
  var applied=0;
  boxes.forEach(function(chk){
    if(!chk.checked) return;
    var idx=parseInt(chk.dataset.idx,10);
    var r=results[idx];
    if(!r||!r.file) return;
    r.movie._localPath=localBase+r.file.name;
    applied++;
  });
  if(applied){
    S.saveAllData();
    S.scheduleAutoPush('auto-pair');
    S.renderList(S.filt);
  }
  S.toast('Spárovaných '+applied+' filmov');
  var box=document.getElementById('adminAutoPairResults');
  if(box) box.innerHTML='';
  var applyBtn=document.getElementById('adminAutoPairApplyBtn');
  if(applyBtn) applyBtn.classList.add('hidden');
  var st=document.getElementById('adminAutoPairSt');
  if(st) st.textContent='Uložené: '+applied+' filmov';
  S._autoPairResults=null;
};
