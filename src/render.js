/* AUTO-SPLIT from app.js. Shared state/functions live on the S namespace. */
import { S } from './state.js';
import { esc, tmdbSrcset } from './lib/text.js';

function prefersReducedMotion(){
  return typeof window!=='undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

S.fpActiveCount = function fpActiveCount(){var n=0;if(S.fpState.yearFrom>0)n++;if(S.fpState.yearTo>0)n++;if(S.fpState.minRating>0)n++;if(S.fpState.minRatingCsfd>0)n++;if(S.fpState.country)n++;if(S.fpState.genres.length>0)n++;if(S.fpState.tag)n++;return n;};

S.renderAll = function renderAll(){
  S.buildChips();
  // Fuse index is rebuilt only when data changes.
  S.applyFilters();
};

S.buildChips = function buildChips(){
  var gc={};
  S.all.forEach(function(m){(m.genres||[]).forEach(function(g){gc[g]=(gc[g]||0)+1;});});
  var sorted=Object.entries(gc).sort(function(a,b){return b[1]-a[1];});
  var bar=document.getElementById("fbar");
  if(!bar)return; // null-guard: fbar hidden in UI but must exist in DOM
  bar.innerHTML="";
  var ca=document.createElement("div");ca.className="chip"+((!S.genre&&!S.favMode)?" active":"");
  ca.id="chipAll";ca.textContent="Vsetky";
  ca.addEventListener("click",function(){S.setGenre("",ca);});bar.appendChild(ca);
  sorted.forEach(function(e){
    var g=e[0],cnt=e[1];var ch=document.createElement("div");
    ch.className="chip"+(S.genre===g?" active":"");ch.textContent=g+" ("+cnt+")";
    ch.addEventListener("click",function(){S.setGenre(g,ch);});bar.appendChild(ch);
  });
};

S.setGenre = function setGenre(g,el){
  S.genre=g;S.favMode=false;
  // Sync fbar click → fpState: single-genre shortcut
  S.fpState.genres = g ? [g] : [];
  S.updateFpBadge();
  S.updateFpPills();
  document.getElementById("btnFav").className="hdr-act hdr-act-fav";
  document.querySelectorAll(".chip").forEach(function(c){c.classList.remove("active");});
  if(el)el.classList.add("active");S.applyFilters();
};

S.buildFuse = function buildFuse(){
  S.fuseInst=new Fuse(S.all,S.FUSE_OPTS);
};

/* Builds one horizontal-scroll poster row (reuses the detail screen's
   "similar films" card markup: data-id makes each card a TV D-pad stop
   for free, via tv.js's [data-id] rule). */
S.buildHomeRow = function buildHomeRow(title,movies,rowId){
  const cards=movies.map(m=>{
    const poster=m.poster_thumb&&m.poster_thumb.length>10
      ?`<img class="sim-poster" src="${m.poster_thumb}" srcset="${tmdbSrcset(m.poster_thumb)}" sizes="76px" alt="" loading="lazy">`
      :'<div class="sim-poster-ph">🎬</div>';
    return `<div class="sim-card" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.title)}">${poster}<div class="sim-title">${esc(m.title)}</div></div>`;
  }).join("");
  return `<div class="sec">${esc(title)}</div><div class="similar-row" id="${rowId}">${cards}</div>`;
};

/* "Continue watching" (watchlist minus already-watched) and "Recently
   added" (highest movie numbers) rows, shown only on the default,
   unfiltered browsing view — see applyFilters(). */
S.buildHomeRows = function buildHomeRows(){
  const el=document.getElementById("homeRows");
  if(!el)return;
  const continuing=S.all.filter(m=>S.wl.has(m.id)&&!S.watched.has(m.id)).slice(0,12);
  let html="";
  if(continuing.length)html+=S.buildHomeRow("POKRAČOVAŤ V SLEDOVANÍ",continuing,"homeContinueRow");
  if(S.prefs.showRecent){
    const recent=S.all.slice().sort((a,b)=>(b.num||0)-(a.num||0)).slice(0,12);
    if(recent.length)html+=S.buildHomeRow("NAPOSLEDY PRIDANÉ",recent,"homeRecentRow");
  }
  el.innerHTML=html;
  el.style.display=html?"block":"none";
  el.querySelectorAll(".sim-card").forEach(c=>{
    c.onclick=function(){S.openDet(parseInt(c.dataset.id,10));};
  });
};

S.applyFilters = function applyFilters(){
  const raw=(document.getElementById("srchInp")||{}).value||"";
  const q=raw.trim();
  const badge=document.getElementById("srchModeBadge");
  S.fuseHighlights={};

  const pool=S.all.filter(m=>{
    if(S.favMode&&!S.favs.has(m.id))return false;
    if(S.wlMode&&!S.wl.has(m.id))return false;
    if(S.watchedMode&&!S.watched.has(m.id))return false;
    if(S.fpState.genres.length>0){
      if(!S.fpState.genres.some(g=>(m.genres||[]).includes(g)))return false;
    }
    if(S.fpState.yearFrom>0&&(m.year||0)<S.fpState.yearFrom)return false;
    if(S.fpState.yearTo>0&&(m.year||0)>S.fpState.yearTo)return false;
    if(S.fpState.minRating>0){
      const pct=S.getMoviePct(m);
      if(pct===null||pct<S.fpState.minRating)return false;
    }
    if(S.fpState.minRatingCsfd>0){
      if(m._pctCsfd==null||m._pctCsfd<S.fpState.minRatingCsfd)return false;
    }
    if(S.fpState.country){
      if(!(m.country||"").toLowerCase().includes(S.fpState.country.toLowerCase()))return false;
    }
    if(S.fpState.tag){
      if(!(m._tags||[]).some(function(t){return t.toLowerCase().includes(S.fpState.tag.toLowerCase());}))return false;
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
      exactMatches.forEach(m=>{S.fuseHighlights[m.id]=S.buildExactHighlights(m,ql);});
    } else {
      if(!S.fuseInst)S.buildFuse();
      var noFilters=!S.favMode&&!S.wlMode&&!S.watchedMode&&S.fpActiveCount()===0;
      var searchInst=noFilters?S.fuseInst:new Fuse(pool,S.FUSE_OPTS);
      const results=searchInst.search(q);
      list=results.map(r=>r.item);
      if(badge){badge.className="srch-mode-badge fuzzy";badge.textContent="FUZZY ~";}
      results.forEach(r=>{S.fuseHighlights[r.item.id]=S.parseFuseMatches(r.matches);});
    }
  }

  S.sortList(list);
  S.filt=list;
  S.renderList(list);
  const fpN=S.fpActiveCount();
  const modeActive=q||S.favMode||S.wlMode||S.watchedMode||fpN>0;
  const hr=document.getElementById("homeRows");
  if(hr){if(modeActive){hr.style.display="none";}else{S.buildHomeRows();}}
  let label=modeActive?`${list.length} z ${S.all.length} filmov`:`${S.all.length} filmov`;
  if(S.wlMode&&!q&&!fpN)label=`Watchlist: ${list.length} filmov`;
  if(S.favMode&&!q&&!fpN)label=`Obľúbené: ${list.length} filmov`;
  if(S.watchedMode&&!q&&!fpN)label=`Videné: ${list.length} filmov`;
  const rc=document.getElementById("resCnt"); if(rc)rc.textContent=label;
};

S.buildExactHighlights = function buildExactHighlights(m,ql){
  var out={};
  ["title","director"].forEach(function(f){
    var val=(m[f]||"").toLowerCase();
    var idx=val.indexOf(ql);
    if(idx>=0)out[f]=[{start:idx,end:idx+ql.length}];
  });
  return out;
};

S.parseFuseMatches = function parseFuseMatches(matches){
  if(!matches)return{};
  var out={};
  matches.forEach(function(m){
    if(m.indices&&m.indices.length){
      out[m.key]=m.indices.map(function(pair){return{start:pair[0],end:pair[1]+1};});
    }
  });
  return out;
};

S.applyHL = function applyHL(text,ranges){
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
};

S.hlField = function hlField(m,field){
  var val=m[field]||"";
  var hl=S.fuseHighlights[m.id];
  var ranges=hl&&hl[field]?hl[field]:null;
  return S.applyHL(val,ranges);
};

S.sortList = function sortList(list){
  var s=S.prefs.sort||"num";
  var asc=(S.prefs.sortDir||"desc")==="asc";

  if(s==="pct"){
    var rated=[],unrated=[];
    list.forEach(function(m){
      var p=S.getMoviePct(m);
      if(p!=null)rated.push(m);
      else unrated.push(m);
    });
    rated.sort(function(a,b){
      var pa=S.getMoviePct(a);
      var pb=S.getMoviePct(b);
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
};

S.renderList = function renderList(list){
  var ml=document.getElementById("mlist"),em=document.getElementById("emptySt"),nr=document.getElementById("noRes");
  if(!ml)return; // guard: DOM not ready
  if(!S.all.length){
    if(em)em.style.display="flex"; ml.style.display="none"; if(nr)nr.style.display="none";
    return;
  }
  if(em)em.style.display="none";
  if(!list.length){
    ml.style.display="none"; if(nr)nr.style.display="flex";
    var q=(document.getElementById("srchInp")||{}).value||"";
    var nrt=document.getElementById("noResTxt");
    if(nrt)nrt.textContent=q?"Nic pre \""+q+"\"":S.favMode?"Ziadne oblubene":"Ziadne filmy v zanri";
    return;
  }
  nr.style.display="none";ml.style.display=""; ml.className = S.posterWall ? "mlist posterwall" : (S.grid ? "mlist grid" : "mlist");
  S.curPage=0;ml.innerHTML="";
  // FIX2b: Event delegation — one listener replaces per-card listeners (1750+ → 1)
  if(ml._delegated) ml.removeEventListener("click",ml._delegated);
  ml._delegated=function(e){
    var pb=e.target.closest(".cpost-play");
    if(pb){e.preventDefault();e.stopPropagation();var pid=parseInt(pb.closest("[data-id]").dataset.id,10);S.playMovie(pid);return;}
    var fb=e.target.closest(".cfav,.lfav");
    if(fb){e.stopPropagation();var cid=parseInt(fb.closest("[data-id]").dataset.id,10);S.togFav(cid,fb);return;}
    var card=e.target.closest("[data-id]");
    if(card){S.openDet(parseInt(card.dataset.id,10));}
  };
  ml.addEventListener("click",ml._delegated);
  S.appendCards(list,ml);

  // Scroll listener na mlist (overflow-y:auto) nie na scrnBody (overflow:hidden)
  if(ml._scrollHandler) ml.removeEventListener("scroll",ml._scrollHandler);
  ml._scrollHandler=function(){
    if(ml.scrollTop+ml.clientHeight>=ml.scrollHeight-300){S.curPage++;S.appendCards(list,ml);}
  };
  ml.addEventListener("scroll",ml._scrollHandler);
};

S.appendCards = function appendCards(list,ml){
  var start=S.curPage*S.PAGE_SIZE,end=Math.min(start+S.PAGE_SIZE,list.length);
  if(start>=list.length)return;
  var frag=document.createDocumentFragment();
  for(var i=start;i<end;i++){
    var w=document.createElement("div");w.innerHTML=S.cardHTML(list[i]);
    frag.appendChild(w.firstChild);
  }
  ml.appendChild(frag);
};

S.pctBadge = function pctBadge(cached,m){
  var p=m?S.getMoviePct(m):(cached&&cached.pct!=null?cached.pct:null);
  if(p==null)return "";
  var cls=p>=70?"pct-g":p>=50?"pct-a":"pct-b";
  var lbl=S.RATING_LABELS[S.ratingSource]||'TMDB';
  return '<div class="pct-badge '+cls+'"><div class="pct-badge-lbl">'+lbl+'</div><div class="pct-badge-val">'+p+'%</div></div>';
};

S.cardHTML = function cardHTML(m){
  const fav=S.favs.has(m.id), cached=S.liveCache[m.id];
  const genres=(m.genres||[]).slice(0,2).map(g=>`<span class="gtag">${esc(g)}</span>`).join("");
  const ym=[m.year||"",m.duration].filter(Boolean).join(" · ");
  const badge=S.pctBadge(cached,m);
  const titleH=S.hlField(m,"title");
  const dirH=m.director?S.hlField(m,"director"):"";
  const favBtn=`<button class="cfav" aria-label="${fav?'Odstrániť z obľúbených':'Pridať do obľúbených'}">${fav?S.STAR_ON:S.STAR_OFF}</button>`;
  if(S.posterWall){
    const hp=m.poster_thumb&&m.poster_thumb.length>10;
    return `<div class="pwcard" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.title||'')} (${m.year||''})" title="${esc(m.title||'')} (${m.year||''})">${hp?`<img class="pw-poster" src="${m.poster_thumb}" srcset="${tmdbSrcset(m.poster_thumb)}" sizes="(max-width:520px) 33vw, (max-width:1000px) 140px, 160px" alt="${esc(m.title||'')}" loading="lazy">`:`<div class="pw-ph">${esc((m.title||'').substring(0,20))}</div>`}</div>`;
  }
  if(S.grid){
    const hp=m.poster_thumb&&m.poster_thumb.length>10;
    const post=hp
      ?`<div class="cpost-wrap"><img class="cpost" src="${m.poster_thumb}" srcset="${tmdbSrcset(m.poster_thumb)}" sizes="128px" alt="${esc(m.title||'')}" loading="lazy"><a class="cpost-play" href="#" title="Prehráť" aria-label="Prehráť ${esc(m.title||'')}"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg></a></div>`
      :`<div class="cpost-ph"><div class="cpost-n">#${m.num}</div>${S.FILM_ICO}</div>`;
    return `<div class="mcard" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.title||'')} (${m.year||''})">${post}<div class="cbody"><div class="cmain"><div class="ctitle">${titleH}</div><div class="cmeta">${esc(ym)}</div>${m.director?`<div class="cdir">${dirH}</div>`:""}<div class="cgenres">${genres}</div></div><div class="cbot">${badge}${favBtn}</div></div></div>`;
  }
  const lfavBtn=`<button class="lfav" aria-label="${fav?'Odstrániť z obľúbených':'Pridať do obľúbených'}">${fav?S.STAR_ON:S.STAR_OFF}</button>`;
  return `<div class="mcard lcard" data-id="${m.id}" tabindex="0" role="button" aria-label="${esc(m.title||'')} (${m.year||''})"><div class="lnum">${m.num}</div><div class="lbody"><div class="ltitle">${titleH}</div><div class="lmeta">${esc(ym)}</div></div><div class="lright">${genres}${badge}</div>${lfavBtn}</div>`;
};

S.togFav = function togFav(id,btn){
  if(S.favs.has(id))S.favs.delete(id);else S.favs.add(id);
  S.safeSave(S.FK,JSON.stringify(Array.from(S.favs)));
  S.scheduleAutoPush('togFav');
  if(btn)btn.innerHTML=S.favs.has(id)?S.STAR_ON:S.STAR_OFF;
  var db=document.getElementById("dfavBtn");if(db&&S.curId===id)S.updFavBtn(db,id);
  if(S.favMode)S.applyFilters();
};

S.togWl = function togWl(id,btn){
  if(S.wl.has(id))S.wl.delete(id);else S.wl.add(id);
  S.safeSave(S.WK,JSON.stringify(Array.from(S.wl)));
  S.scheduleAutoPush('togWl');
  if(btn)btn.innerHTML=S.wl.has(id)?S.EYE_ON:S.EYE_OFF;
  var db=document.getElementById("dwlBtn");if(db&&S.curId===id)S.updWlBtn(db,id);
  if(S.wlMode)S.applyFilters();
};

S.updWlBtn = function updWlBtn(btn,id){var w=S.wl.has(id);btn.innerHTML=(w?S.EYE_ON:S.EYE_OFF)+(w?' Odstrániť z Watchlist':' Watchlist');btn.className="btn-fav"+(w?" on":"");};

S.updFavBtn = function updFavBtn(btn,id){var f=S.favs.has(id);btn.innerHTML=f?"&#11088; Odstranit":"&#9734; Oblubene";btn.className="btn-fav"+(f?" on":"");};

S.openDet = function openDet(id){
  const m=S.all.find(x=>x.id===id); if(!m)return;
  S.curId=id;
  const cached=S.liveCache[id];
  document.getElementById("detTitle").textContent=m.title;
  document.getElementById("detYr").textContent=[m.year||"",m.duration,m.country].filter(Boolean).join(" - ");
  const hp=m.poster_thumb&&m.poster_thumb.length>10;
  var backdropSrc=(cached&&cached.backdropUrl)||null;
  var heroSrc=backdropSrc||m.poster_thumb;
  ["detBlur","detCover"].forEach(eid=>{
    const el=document.getElementById(eid);
    if(!el)return;
    el.style.display=hp?"block":"none"; if(hp)el.src=heroSrc;
  });
  if(backdropSrc){
    var coverEl=document.getElementById("detCover");
    if(coverEl){coverEl.src=backdropSrc;coverEl.style.display="block";}
    var blurEl=document.getElementById("detBlur");
    if(blurEl)blurEl.style.display="none";
  }
  const ins=document.getElementById("detInset"); ins.style.display=hp?"block":"none";
  if(hp){
    const insImg=document.getElementById("detInsetImg");
    insImg.src=m.poster_thumb;
    insImg.srcset=tmdbSrcset(m.poster_thumb);
    insImg.sizes="100px";
  }
  document.getElementById("detBg").style.display=hp?"none":"block";

  const fav=S.favs.has(id);
  const genres=(m.genres||[]).map(g=>`<span class="dg-tag">${esc(g)}</span>`).join("");
  const items=[];
  if(m.director)items.push(["Režíser",'<a class="det-person-link" data-person="'+esc(m.director)+'" tabindex="0" role="button">'+esc(m.director)+'</a>']);
  items.push(["Rok",esc(String(m.year||"–"))],["Dĺžka",esc(String(m.duration||"–"))],["Krajina",esc(String(m.country||"–"))],["#",esc(String(m.num))]);
  const tmdbUrl=(cached&&cached.tmdbUrl)||`https://www.themoviedb.org/search?query=${encodeURIComponent(m.title)}`;
  const imdbUrl=(cached&&cached.imdbUrl)||null;
  const csfdUrl=m._csfdUrl||null;

  // Rating pill
  let ratingHtml;
  var detPct=S.getMoviePct(m);
  var detLbl=S.RATING_LABELS[S.ratingSource]||'TMDB';
  if(!cached&&S.ratingSource==='tmdb'){
    ratingHtml=`<div class="rating-pill-na" id="ratingBox">${S.tmdbKey?"Načítavam…":"–"}</div>`;
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
      <button class="btn-wl${S.wl.has(id)?" on":""}" id="dwlBtn" aria-label="Watchlist"></button>
      <button class="btn-watched${S.watched.has(id)?" on":""}" id="dwatchedBtn" aria-label="Videné"></button>
      ${S.watchedDates[id]?`<span class="watched-date">Videné: ${S.watchedDates[id]}</span>`:""}
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
      <a class="btn-tmdb" id="btnTmdb" href="${esc(tmdbUrl)}" target="_blank" rel="noopener noreferrer">TMDB</a>
      ${imdbUrl?`<a class="btn-imdb" id="btnImdb" href="${esc(imdbUrl)}" target="_blank" rel="noopener noreferrer">★ IMDB</a>`:
               '<a class="btn-imdb" id="btnImdb" href="#" target="_blank" rel="noopener noreferrer" style="display:none">★ IMDB</a>'}
      ${csfdUrl?`<a class="btn-csfd" id="btnCsfd" href="${esc(csfdUrl)}" target="_blank" rel="noopener noreferrer">ČSFD</a>`:
               '<a class="btn-csfd" id="btnCsfd" href="#" target="_blank" rel="noopener noreferrer" style="display:none">ČSFD</a>'}
      <a class="btn-jw" href="https://www.justwatch.com/sk/vyh%C4%BEad%C3%A1va%C5%A5?q=${encodeURIComponent(m.title)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg> Kde pozerať</a>
      <button class="btn-match" id="btnMatch" title="Ručné TMDB párovanie">&#x2699; Párovanie</button>
    </div>
    ${m.description&&m.description.trim()?`<div class="sec">Popis</div><div class="det-desc">${esc(m.description)}</div>`:""}
    <div class="sec">Detaily</div>
    <div class="det-grid">${items.map(it=>`<div class="det-item"><div class="det-item-l">${it[0]}</div><div class="det-item-v">${it[1]}</div></div>`).join("")}</div>
    ${m.cast&&m.cast.trim()?`<div class="sec">Obsadenie</div><div class="det-cast">${m.cast.split(',').map(function(a){var n=a.trim();return n?'<a class="det-person-link" data-person="'+esc(n)+'" tabindex="0" role="button">'+esc(n)+'</a>':'';}).filter(Boolean).join(', ')}</div>`:""}
    <div class="sec">Tagy</div>
    <div class="det-tags" id="detTags">
      ${(m._tags||[]).map(function(t){return '<span class="det-tag">'+esc(t)+'<button class="det-tag-x" data-tag="'+esc(t)+'">&times;</button></span>';}).join('')}
      <span class="det-tag-add" id="detTagAdd" tabindex="0" role="button">+ pridať</span>
    </div>
    ${S.buildSimilarHtml(m)}`;

  document.getElementById("detBody").innerHTML=html;
  document.getElementById("dfavBtn").onclick=function(){S.togFav(id,null);S.updFavBtn(document.getElementById("dfavBtn"),id);};
  document.getElementById("dwlBtn").onclick=function(){S.togWl(id,null);S.updWlBtn(document.getElementById("dwlBtn"),id);};
  S.updFavBtn(document.getElementById("dfavBtn"),id);
  S.updWlBtn(document.getElementById("dwlBtn"),id);
  S.updWatchedBtn(document.getElementById("dwatchedBtn"),id);
  document.getElementById("dwatchedBtn").onclick=function(){S.togWatched(id,null);S.updWatchedBtn(document.getElementById("dwatchedBtn"),id);};
  document.querySelectorAll(".sim-card").forEach(c=>{c.onclick=function(){S.openDet(parseInt(c.dataset.sid));};});
  const playBtn=document.getElementById("playMovieBtn");
  if(playBtn){
    playBtn.querySelector('.sett-btn-label').textContent = 'Prehráť · ' + S.getPlayModeLabel();
    playBtn.onclick=function(){
      var _m=S.all.find(function(x){return x.id===id;})||m;
      S.playMovie(_m.id);
    };
  }
  document.getElementById("btnPlayCopy").onclick=function(){S.copyMoviePath(id);};
  document.getElementById("btnTr").onclick=function(){S.openTrailer(id);};
  document.getElementById("btnMatch").onclick=function(){S.openMatchPanel(id);};
  document.querySelectorAll(".det-person-link").forEach(function(el){
    el.onclick=function(e){e.preventDefault();S.closeDet();var inp=document.getElementById("srchInp");if(inp){inp.value=el.dataset.person;inp.dispatchEvent(new Event("input"));}};
  });
  var tagAdd=document.getElementById("detTagAdd");
  if(tagAdd) tagAdd.onclick=function(){
    var tag=prompt("Nový tag:");
    if(!tag||!tag.trim())return;
    tag=tag.trim();
    if(!m._tags)m._tags=[];
    if(m._tags.indexOf(tag)<0){m._tags.push(tag);S.saveAllData();S.scheduleAutoPush('tag');S.openDet(id);}
  };
  document.querySelectorAll(".det-tag-x").forEach(function(btn){
    btn.onclick=function(e){
      e.stopPropagation();
      var tag=btn.dataset.tag;
      if(m._tags){m._tags=m._tags.filter(function(t){return t!==tag;});if(!m._tags.length)delete m._tags;S.saveAllData();S.scheduleAutoPush('tag');S.openDet(id);}
    };
  });
  document.getElementById("mainSc").classList.add("hidden");
  var detEl=document.getElementById("detSc");
  var wasHidden=detEl.classList.contains("hidden");
  if(wasHidden && !prefersReducedMotion()){
    // Start from the offscreen/faded state, then release it a couple of
    // frames later so the browser actually paints the start state first —
    // otherwise the enter transition gets skipped straight to its end value.
    detEl.classList.add("det-anim-init");
    detEl.classList.remove("hidden");
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ detEl.classList.remove("det-anim-init"); });
    });
  } else {
    // Already open (e.g. similar-film click, tag edit refresh) — just swap
    // content in place, no re-entrance animation.
    detEl.classList.remove("hidden");
  }
  document.getElementById("detBody").scrollTop=0;
  if(!cached)S.fetchLiveData(id);
};

S.closeDet = function closeDet(){
  var detEl=document.getElementById("detSc");
  var mainEl=document.getElementById("mainSc");
  if(detEl.classList.contains("hidden")){ mainEl.classList.remove("hidden"); return; }
  if(prefersReducedMotion()){
    detEl.classList.add("hidden");
    mainEl.classList.remove("hidden");
    return;
  }
  var done=false;
  function finish(){
    if(done)return; done=true;
    detEl.classList.add("hidden");
    detEl.classList.remove("det-anim-init");
    mainEl.classList.remove("hidden");
  }
  detEl.addEventListener("transitionend",finish,{once:true});
  setTimeout(finish,260);
  detEl.classList.add("det-anim-init");
};

S.openTrailer = function openTrailer(id){
  var m=S.all.find(function(x){return x.id===id;});if(!m)return;
  var cached=S.liveCache[id];
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
};

S.closeTr = function closeTr(){
  var fr=document.getElementById("trFrame");
  var ov=document.getElementById("trOv");
  fr.src="";
  ov.classList.add("hidden");
  ov.style.display="";
};

S.destroyCharts = function destroyCharts() {
  Object.keys(S.chartInstances).forEach(function(k) {
    try { S.chartInstances[k].destroy(); } catch(e) {}
  });
  S.chartInstances = {};
};

S.buildChart = function buildChart(id, config) {
  var canvas = document.getElementById(id);
  if (!canvas) return;
  S.destroySingleChart(id);
  S.chartInstances[id] = new Chart(canvas.getContext('2d'), config);
};

S.destroySingleChart = function destroySingleChart(id) {
  if (S.chartInstances[id]) { try { S.chartInstances[id].destroy(); } catch(e) {} delete S.chartInstances[id]; }
};

S.sc = function sc(icon,label,value,sub){
  return `<div class="scard"><div class="sic">${icon}</div><div><div class="slbl">${label}</div><div class="sval">${value}</div>${sub?`<div class="ssub">${sub}</div>`:""}</div></div>`;
};

S.showStats = function showStats(){
  if(!S.all.length){S.toast('Žiadne filmy');return;}
  S.destroyCharts();

  const withYear=S.all.filter(m=>m.year>0);
  const years=withYear.map(m=>m.year);
  const minYear=years.length?Math.min(...years):"–";
  const maxYear=years.length?Math.max(...years):"–";

  // Genre counts (top 10)
  const genreCounts={};
  S.all.forEach(m=>(m.genres||[]).forEach(g=>{genreCounts[g]=(genreCounts[g]||0)+1;}));
  const topGenres=Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);

  // Decade counts
  const decadeCounts={};
  withYear.forEach(m=>{const d=Math.floor(m.year/10)*10;decadeCounts[d]=(decadeCounts[d]||0)+1;});
  const decades=Object.entries(decadeCounts).sort((a,b)=>a[0]-b[0]);

  // Watch time estimate
  const totalWithDur=S.all.filter(m=>m.duration);
  const totalMins=totalWithDur.reduce((acc,m)=>acc+(parseInt((m.duration||"").replace(/\D/g,""))||0),0)
    +(S.all.length-totalWithDur.length)*105;
  const hours=Math.round(totalMins/60);

  const withLive=Object.keys(S.liveCache).length;
  const withPoster=S.all.filter(m=>m.poster_thumb&&m.poster_thumb.length>10).length;

  // Average rating (uses selected source)
  const ratedMovies=S.all.filter(function(m){return S.getMoviePct(m)!=null;});
  const avgRating=ratedMovies.length?Math.round(ratedMovies.reduce(function(a,m){return a+S.getMoviePct(m);},0)/ratedMovies.length):null;
  const rated=ratedMovies;

  // Top directors (top 8)
  const dirCounts={};
  S.all.forEach(m=>{if(m.director)(m.director).split(/,\s*/).forEach(d=>{d=d.trim();if(d)dirCounts[d]=(dirCounts[d]||0)+1;});});
  const topDirs=Object.entries(dirCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // Monthly watch activity (last 12 months)
  const monthCounts={};
  Object.values(S.watchedDates).forEach(d=>{if(d){var mo=d.slice(0,7);monthCounts[mo]=(monthCounts[mo]||0)+1;}});
  const months=Object.entries(monthCounts).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12);

  const statHtml=
    S.sc("🎬","FILMOV CELKOM",S.all.length,"")+
    S.sc("🕐","HODÍN SLEDOVANIA",hours,"(odhad)")+
    S.sc("🖼","S PLAGÁTOM",withPoster,"filmov")+
    S.sc("📊","TMDB DÁTA",withLive,"filmov s hodnotením")+
    (avgRating!=null?S.sc("⭐","PRIEMERNÉ HODNOTENIE",avgRating+'%',rated.length+' hodnotených'):"")+
    S.sc("❤️","OBĽÚBENÉ",S.favs.size,"")+
    S.sc("👁","WATCHLIST",S.wl.size,"")+
    S.sc("✓","VIDENÉ",S.watched.size,"")+
    S.sc("📅","ROKY",`${minYear}–${maxYear}`,"");

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

  S.loadChartJs().then(function(){
  if(topGenres.length){
    S.buildChart("chartGenres",{
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
    S.buildChart("chartDecades",{
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
    S.buildChart("chartMonthly",{
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
  }).catch(function(e){S.toast("Chart.js: "+e.message);});
};

S.closeStat = function closeStat() {
  S.destroyCharts();
  document.getElementById('statSc').classList.add('hidden');
  document.getElementById('mainSc').classList.remove('hidden');
};

S.openFp = function openFp() {
  S.closeSett();
  var panel   = document.getElementById('fpPanel');
  var overlay = document.getElementById('fpOverlay');

  // ── Populate country dropdown ────────────────────────────────
  var countries = {};
  S.all.forEach(function(m) {
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
    if (e[0] === S.fpState.country) opt.selected = true;
    cSel.appendChild(opt);
  });

  // ── Populate genre checkboxes ─────────────────────────────────
  var gc = {};
  S.all.forEach(function(m) { (m.genres||[]).forEach(function(g) { gc[g]=(gc[g]||0)+1; }); });
  var gSorted = Object.entries(gc).sort(function(a,b) { return b[1]-a[1]; });
  var gBox = document.getElementById('fpGenreChips');
  gBox.innerHTML = '';
  gSorted.forEach(function(e) {
    var g   = e[0];
    var cnt = e[1];
    var ch  = document.createElement('div');
    ch.className = 'fp-genre-chip' + (S.fpState.genres.indexOf(g) >= 0 ? ' on' : '');
    ch.textContent = g + ' (' + cnt + ')';
    ch.dataset.genre = g;
    ch.addEventListener('click', function() {
      var idx = S.fpState.genres.indexOf(g);
      if (idx >= 0) S.fpState.genres.splice(idx, 1);
      else          S.fpState.genres.push(g);
      ch.classList.toggle('on', S.fpState.genres.indexOf(g) >= 0);
    });
    gBox.appendChild(ch);
  });

  // ── Restore slider / year / tag values ──────────────────────────────
  document.getElementById('fpYearFrom').value    = S.fpState.yearFrom || '';
  document.getElementById('fpYearTo').value      = S.fpState.yearTo   || '';
  document.getElementById('fpRatingSlider').value = S.fpState.minRating;
  document.getElementById('fpRatingVal').textContent = S.fpState.minRating + '%';
  document.getElementById('fpCsfdSlider').value = S.fpState.minRatingCsfd;
  document.getElementById('fpCsfdVal').textContent = S.fpState.minRatingCsfd + '%';
  var tagInp=document.getElementById('fpTag');if(tagInp)tagInp.value=S.fpState.tag||'';

  overlay.classList.add('open');
  panel.classList.add('open');
  document.body.style.overflow = 'hidden';
};

S.closeFp = function closeFp() {
  document.getElementById('fpPanel').classList.remove('open');
  document.getElementById('fpOverlay').classList.remove('open');
  document.body.style.overflow = '';
};

S.applyFp = function applyFp() {
  S.fpState.yearFrom  = parseInt(document.getElementById('fpYearFrom').value)  || 0;
  S.fpState.yearTo    = parseInt(document.getElementById('fpYearTo').value)    || 0;
  S.fpState.minRating = parseInt(document.getElementById('fpRatingSlider').value) || 0;
  S.fpState.minRatingCsfd = parseInt(document.getElementById('fpCsfdSlider').value) || 0;
  S.fpState.country   = document.getElementById('fpCountry').value;
  S.fpState.tag       = (document.getElementById('fpTag')||{}).value||'';
  // genres already updated live via chip clicks

  // Sync fbar: if exactly one genre is selected in panel, reflect it in fbar
  if (S.fpState.genres.length === 1) {
    S.genre = S.fpState.genres[0];
  } else {
    S.genre = '';  // fbar shows "Všetky" when 0 or 2+ genres selected
  }
  S.buildChips();  // re-render fbar to show active state

  S.closeFp();
  S.updateFpBadge();
  S.updateFpPills();
  S.applyFilters();
};

S.resetFp = function resetFp() {
  S.fpState = { yearFrom:0, yearTo:0, minRating:0, minRatingCsfd:0, country:'', genres:[], tag:'' };
  S.genre   = '';
  document.getElementById('fpYearFrom').value     = '';
  document.getElementById('fpYearTo').value       = '';
  document.getElementById('fpRatingSlider').value = 0;
  document.getElementById('fpRatingVal').textContent = '0%';
  document.getElementById('fpCsfdSlider').value   = 0;
  document.getElementById('fpCsfdVal').textContent = '0%';
  document.getElementById('fpCountry').value      = '';
  var tagInp=document.getElementById('fpTag');if(tagInp)tagInp.value='';
  document.querySelectorAll('.fp-genre-chip').forEach(function(c) { c.classList.remove('on'); });
  S.buildChips();
  S.closeFp();
  S.updateFpBadge();
  S.updateFpPills();
  S.applyFilters();
};

S.updateFpBadge = function updateFpBadge() {
  var cnt   = S.fpActiveCount();
  var badge = document.getElementById('fpBadge');
  var btn   = document.getElementById('fpBtn');
  badge.textContent = cnt;
  badge.className   = 'fp-badge' + (cnt ? ' show' : '');
  btn.className     = 'ctrl-btn fp-btn' + (cnt ? ' active' : '');
};

S.updateFpPills = function updateFpPills() {
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

  if (S.fpState.yearFrom > 0 || S.fpState.yearTo > 0) {
    var yr = (S.fpState.yearFrom || '…') + '–' + (S.fpState.yearTo || '…');
    pill('📅 ' + yr, function() { S.fpState.yearFrom=0; S.fpState.yearTo=0; S.updateFpBadge(); S.updateFpPills(); S.applyFilters(); });
  }
  if (S.fpState.minRating > 0) {
    pill('⭐ min ' + S.fpState.minRating + '%', function() { S.fpState.minRating=0; S.updateFpBadge(); S.updateFpPills(); S.applyFilters(); });
  }
  if (S.fpState.minRatingCsfd > 0) {
    pill('ČSFD min ' + S.fpState.minRatingCsfd + '%', function() { S.fpState.minRatingCsfd=0; S.updateFpBadge(); S.updateFpPills(); S.applyFilters(); });
  }
  if (S.fpState.country) {
    pill('🌍 ' + S.fpState.country, function() { S.fpState.country=''; S.updateFpBadge(); S.updateFpPills(); S.applyFilters(); });
  }
  S.fpState.genres.forEach(function(g) {
    pill('🎬 ' + g, function() {
      var i = S.fpState.genres.indexOf(g);
      if (i >= 0) S.fpState.genres.splice(i,1);
      if (S.genre === g) S.genre = '';
      S.buildChips();
      S.updateFpBadge();
      S.updateFpPills();
      S.applyFilters();
    });
  });
  // pills live inside the header — re-measure so the list doesn't hide under it
  S.adjustScrnBody();
};

S.initFp = function initFp() {
  document.getElementById('fpBtn').addEventListener('click', S.openFp);
  document.getElementById('fpClose').addEventListener('click', S.closeFp);
  document.getElementById('fpOverlay').addEventListener('click', S.closeFp);
  document.getElementById('fpApply').addEventListener('click', S.applyFp);
  document.getElementById('fpReset').addEventListener('click', S.resetFp);
  document.getElementById('fpRatingSlider').addEventListener('input', function() {
    document.getElementById('fpRatingVal').textContent = this.value + '%';
  });
  document.getElementById('fpCsfdSlider').addEventListener('input', function() {
    document.getElementById('fpCsfdVal').textContent = this.value + '%';
  });
};

S.openRandomMovie = function openRandomMovie() {
  if (!S.filt || !S.filt.length) { S.toast('Ziadne filmy na vyber.'); return; }
  var pick = S.filt[Math.floor(Math.random() * S.filt.length)];
  S.openDet(pick.id);
};

S.togWatched = function togWatched(id, btn) {
  if (S.watched.has(id)) {
    S.watched.delete(id);
    delete S.watchedDates[id];
  } else {
    S.watched.add(id);
    S.watchedDates[id] = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }
  try { localStorage.setItem(S.VK,  JSON.stringify(Array.from(S.watched))); }    catch(e) {}
  try { localStorage.setItem(S.VDK, JSON.stringify(S.watchedDates)); }           catch(e) {}
  S.scheduleAutoPush('togWatched');
  if (btn) S.updWatchedBtn(btn, id);
  // Update detail view badge if open
  var db = document.getElementById('dwatchedBtn');
  if (db && S.curId === id) S.updWatchedBtn(db, id);
  if (S.watchedMode) S.applyFilters();
};

S.updWatchedBtn = function updWatchedBtn(btn, id) {
  var seen = S.watched.has(id);
  btn.innerHTML = seen ? '✓ Videne' : '– Nevidene';
  btn.className = 'btn-fav' + (seen ? ' on' : '');
};

S.cycleWatchedMode = function cycleWatchedMode() {
  S.watchedMode = !S.watchedMode;
  // Deactivate other collection filters
  if (S.watchedMode) { S.favMode = false; S.wlMode = false;
    document.getElementById("btnFav").className="hdr-act hdr-act-fav";
    document.getElementById("btnWl").className="hdr-act hdr-act-wl";
  }
  var btn = document.getElementById('btnWatched');
  btn.className = 'hdr-act hdr-act-watch' + (S.watchedMode ? ' active' : '');
  btn.title     = S.watchedMode ? 'Videne — klikni pre Vsetky' : 'Zobrazit videne filmy';
  S.applyFilters();
};

S.getSimilarFilms = function getSimilarFilms(movie, n) {
  n = n || 4;
  var scored = S.all
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
};

S.buildSimilarHtml = function buildSimilarHtml(movie){
  const similar=S.getSimilarFilms(movie,6);
  if(!similar.length)return "";
  const cards=similar.map(m=>{
    const poster=m.poster_thumb&&m.poster_thumb.length>10
      ?`<img class="sim-poster" src="${m.poster_thumb}" srcset="${tmdbSrcset(m.poster_thumb)}" sizes="76px" alt="" loading="lazy">`
      :'<div class="sim-poster-ph">🎬</div>';
    return `<div class="sim-card" data-sid="${m.id}" tabindex="0" role="button" aria-label="${esc(m.title)}">${poster}<div class="sim-title">${esc(m.title)}</div></div>`;
  }).join("");
  return `<div class="sec">PODOBNÉ FILMY</div><div class="similar-row" id="simRow">${cards}</div>`;
};
