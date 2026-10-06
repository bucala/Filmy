/* AUTO-SPLIT from app.js. Shared state/functions live on the S namespace. */
import { S } from './state.js';
import { hasTmdbMovie, moviesForStorage, nextMovieIdentity, parseStoredMovies } from './lib/library.js';

S.SYNC_PENDING_KEY = 'mdb_sync_pending';
S._syncRevision = '';
S._syncEpoch = 0;

S.getSyncRevision = function getSyncRevision(){
  try{return localStorage.getItem(S.SYNC_PENDING_KEY)||S._syncRevision;}
  catch(e){return S._syncRevision;}
};

S.needsRecoveredLibraryReview = function needsRecoveredLibraryReview(){
  return S.getSyncRevision().indexOf('review:')===0;
};

S.markSyncPending = function markSyncPending(options){
  var review=(options&&options.recovered)||S.needsRecoveredLibraryReview();
  S._syncEpoch++;
  S._syncRevision = (review?'review:':'') + Date.now() + '-' + S._syncEpoch + '-' + Math.random().toString(36).slice(2);
  try{localStorage.setItem(S.SYNC_PENDING_KEY,S._syncRevision);return true;}
  catch(e){return false;}
};

S.acknowledgeSync = function acknowledgeSync(revision){
  if(S.getSyncRevision()!==revision)return false;
  try{localStorage.removeItem(S.SYNC_PENDING_KEY);}catch(e){return false;}
  S._syncRevision='';
  return true;
};

S.loadMovies = function loadMovies(){
  var movies=[];
  try{
    movies=parseStoredMovies(localStorage.getItem(S.SK));
    if(movies.length){
      // Recover libraries hidden by the old clear-all sentinel, and protect
      // these recovered local records from the automatic startup pull.
      if(localStorage.getItem('mdb_empty')!=='1'||S.markSyncPending({recovered:true})){
        try{localStorage.removeItem('mdb_empty');}catch(e){}
      }
    }
  }catch(e){}
  return movies;
};

S.getMoviePct = function getMoviePct(m){
  if(S.ratingSource==='imdb'){return m._pctImdb!=null?m._pctImdb:null;}
  if(S.ratingSource==='csfd'){return m._pctCsfd!=null?m._pctCsfd:null;}
  var c=S.liveCache[m.id];return c&&c.pct!=null?c.pct:null;
};

S.validateLiveCache = function validateLiveCache(obj){
  if(!obj||typeof obj!=="object"||Array.isArray(obj))return{};
  var clean={};
  Object.keys(obj).forEach(function(k){
    var v=obj[k];
    if(v&&typeof v==="object"&&!Array.isArray(v)&&(v.pct!=null||v.ytKey||v.posterUrl))clean[k]=v;
  });
  return clean;
};

S.loadLiveCache = function loadLiveCache(){
  if(typeof PREBAKED_LIVE!=="undefined"&&Object.keys(PREBAKED_LIVE).length>0){
    S.liveCache=S.validateLiveCache(PREBAKED_LIVE);try{localStorage.setItem(S.LK,JSON.stringify(S.liveCache));}catch(e){}return;
  }
  try{var r=localStorage.getItem(S.LK);if(r)S.liveCache=S.validateLiveCache(JSON.parse(r));}catch(e){S.liveCache={};}
};

S.saveLiveCache = function saveLiveCache(){
  try{return S.safeSave(S.LK,JSON.stringify(S.liveCache));}catch(e){return false;}
};

S.saveMovies = function saveMovies(options){
  try{
    return S.safeSave(S.SK,JSON.stringify(moviesForStorage(S.all)),options);
  }catch(e){S.toast('Filmy sa nepodarilo uložiť.');return false;}
};

S.saveAllData = function saveAllData(){
  var moviesSaved=S.saveMovies();
  var liveSaved=S.saveLiveCache();
  return moviesSaved&&liveSaved;
};

S.safeSave = function safeSave(key,val,options){
  // Central invalidation also covers in-place edits, tags, import merges and
  // drag reordering. Ratings/collection saves do not discard the search cache.
  if(key===S.SK&&S.invalidateSearch)S.invalidateSearch();
  try{
    var changed=localStorage.getItem(key)!==val;
    // Write the small sync guard first. If it cannot be persisted, do not
    // pretend a new local record will survive the next automatic remote pull.
    if(changed&&!(options&&options.synced)&&[S.SK,S.FK,S.WK,S.VK,S.VDK].indexOf(key)>=0&&!S.markSyncPending()){
      throw new Error('Sync guard could not be saved');
    }
    localStorage.setItem(key,val);
    if(key===S.SK&&parseStoredMovies(val).length)try{localStorage.removeItem('mdb_empty');}catch(e){}
    return true;
  }
  catch(e){
    S.toast(e.name==='QuotaExceededError'?'Úložisko je plné — dáta sa neuložili.':'Dáta sa nepodarilo uložiť do prehliadača.');
    console.warn('localStorage save failed:',key,e);
    return false;
  }
};

S.insertMovie = function insertMovie(entry){
  if(!entry||!entry.movie)return null;
  var movie=Object.assign({},entry.movie,nextMovieIdentity(S.all));
  if(hasTmdbMovie(S.all,movie.tmdbId||movie.tmdb_id)){
    S.toast('Tento film už je v databáze.');
    return null;
  }
  S.all.push(movie);
  if(!S.saveMovies()){
    S.all.pop();
    return null;
  }
  S.liveCache[movie.id]=Object.assign({},entry.liveData);
  S.saveLiveCache();
  S.buildFuse();
  S.renderAll();
  S.scheduleAutoPush('add-movie');
  return movie;
};
