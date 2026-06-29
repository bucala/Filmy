/* AUTO-SPLIT from app.js. Shared state/functions live on the S namespace. */
import { S } from './state.js';

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

S.saveLiveCache = function saveLiveCache(){try{localStorage.setItem(S.LK,JSON.stringify(S.liveCache));}catch(e){}};

S.saveAllData = function saveAllData(){
  S.saveLiveCache();
  try{
    var toSave=S.all.map(function(m){
      var c=Object.assign({},m);
      if(c.poster_thumb&&c.poster_thumb.indexOf("data:")===0) c.poster_thumb="";
      return c;
    });
    S.safeSave(S.SK,JSON.stringify(toSave));
  }catch(e){}
};

S.safeSave = function safeSave(key,val){
  try{localStorage.setItem(key,val);}
  catch(e){if(e.name==='QuotaExceededError')S.toast('Úložisko je plné — niektoré dáta sa neuložili');console.warn('localStorage save failed:',key,e);}
};
