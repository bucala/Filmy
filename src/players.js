/* AUTO-SPLIT from app.js. Shared state/functions live on the S namespace. */
import { S } from './state.js';
import { localPathToSmb as localPathToSmbPure, getMoviePath as getMoviePathPure, smbToUnc as smbToUncPure } from './lib/paths.js';

S.localPathToSmb = function localPathToSmb(localPath) {
  return localPathToSmbPure(localPath, S.smbMap, S.smbBase);
};

S.getMoviePath = function getMoviePath(m) {
  return getMoviePathPure(m, { pathMode: S.pathMode, smbMap: S.smbMap, smbBase: S.smbBase });
};

S.getPlayModeLabel = function getPlayModeLabel() {
  if (S.pathMode === 'smb' && S.smbUrlMode === 'raw') return 'Priame SMB';
  if (S._isMobile) return S.pathMode === 'smb' ? 'VLC·SMB' : 'VLC';
  if (S.playerProto === 'native') return 'Natívny';
  if (S.playerProto === 'portable') return 'Portable';
  return S.playerProto.toUpperCase();
};

S.updatePathPreview = function updatePathPreview(){
  var el=document.getElementById('playPathPreview');
  if(!el)return;
  var sample='2026 - Tom Clancys Jack Ryan.mkv';
  var proto=S.playerProto||'mpc';
  if(S.pathMode==='smb'){
    var base=S.smbBase||'smb://DESKTOP-EGOG348/Movies/';
    if(base[base.length-1]!=='/')base+='/';
    var smbPath=base+sample;
    var server=smbPath.replace(/^smb:\/\//,'');
    var protoUrl;
    if(proto==='native'){
      protoUrl=smbPath;
    } else if(S.smbUrlMode==='raw'){
      protoUrl=smbPath;
    } else if(S._isAndroid){
      protoUrl='vlc://'+smbPath;
    } else {
      protoUrl=proto+'://'+encodeURI(server);
    }
    var uncPath='\\\\'+server.replace(/\//g,'\\');
    var modeLabel=S.smbUrlMode==='raw'?'Priame SMB (OS vyberie prehrávač)':proto==='native'?'Natívny':'Protokol '+proto.toUpperCase();
    el.innerHTML='<b style="color:#81c784">Aktívna cesta:</b> '+smbPath.replace(/</g,'&lt;')+'<br>'+
      '<b style="color:#81c784">URL:</b> <code>'+protoUrl.replace(/</g,'&lt;')+'</code><br>'+
      '<b style="color:#81c784">Režim:</b> '+modeLabel+
      (S._isAndroid?'':' · <b style="color:#81c784">UNC:</b> '+uncPath.replace(/</g,'&lt;'));
  } else {
    var localBase='W:\\Movies\\';
    for(var k in S.smbMap){localBase=k;break;}
    localBase=localBase.replace(/\//g,'\\');
    if(localBase[localBase.length-1]!=='\\') localBase+='\\';
    var localPath=localBase+sample;
    var fwdPath=localPath.replace(/\\/g,'/');
    var driveStripped=fwdPath.replace(/^([A-Za-z]):/,'$1');
    var protoUrl;
    if(proto==='native'){
      protoUrl='file:///'+encodeURI(fwdPath);
    } else {
      protoUrl=proto+'://'+encodeURI(driveStripped);
    }
    el.innerHTML='<b style="color:#81c784">Aktívna cesta:</b> '+localPath.replace(/</g,'&lt;')+'<br>'+
      '<b style="color:#81c784">Protokol:</b> <code>'+protoUrl.replace(/</g,'&lt;')+'</code><br>'+
      '<b style="color:#81c784">Handler otvorí:</b> '+localPath.replace(/</g,'&lt;');
  }
};

S.playMovie = function playMovie(id){
  var m=S.all.find(function(x){return x.id===id;});
  if(!m)return;
  var path=S.getMoviePath(m);
  if(S.debugMode) console.log('[Filmy debug] playMovie',{id:m.id,title:m.title,localPath:m._localPath||null,resolvedPath:path,pathMode:S.pathMode,playerProto:S.playerProto,isAndroid:S._isAndroid});
  if(!path){S.toast('Cesta k súboru nie je nastavená.');return;}

  if(S._isAndroid){
    if(S.pathMode==='smb'){
      if(S.playerProto==='native' || S.smbUrlMode==='raw'){
        window.location.href=path;
      } else {
        window.location.href='vlc://'+path;
      }
    } else {
      if(S.playerProto==='native'){
        window.location.href='file:///'+path.replace(/\\/g,'/');
      } else {
        window.location.href='vlc://'+path;
      }
    }
    S.toast('Spúšťam prehrávač...');
    return;
  }

  // Windows desktop (Electron) — launch the installed player directly via
  // the native bridge instead of relying on registered mpc:///vlc://
  // protocol handlers. VLC gets smb:// as-is, MPC gets a UNC path (both
  // conversions happen in the main process). Clipboard keeps the UNC path.
  if (window.filmyNative && typeof window.filmyNative.launchPlayer === 'function'
      && (S.playerProto === 'mpc' || S.playerProto === 'vlc')) {
    S.copyToClip(smbToUncPure(path));
    window.filmyNative.launchPlayer({ player: S.playerProto, path: path })
      .then(function (res) {
        if (res && res.ok) {
          S.toast('Spúšťam ' + (res.label || S.playerProto.toUpperCase()) + '...');
        } else {
          S.toast((res && res.error) || 'Prehrávač sa nepodarilo spustiť.');
        }
      })
      .catch(function () { S.toast('Chyba natívneho mosta.'); });
    return;
  }

  // PC — clipboard gets Windows backslash path, protocol gets forward-slash path
  var clipPath=smbToUncPure(path);
  S.copyToClip(clipPath);

  // Native mode — open via file:// protocol (OS default player)
  if(S.playerProto==='native'){
    if(S.pathMode==='smb'){
      window.location.href=path;
    } else {
      window.location.href='file:///'+path.replace(/\\/g,'/');
    }
    setTimeout(function(){
      S.toast('Cesta skopírovaná. Otváram v predvolenom prehrávači...');
    },800);
    return;
  }

  // Portable mode — use portable-handler.js
  if(S.playerProto==='portable' && typeof launchPortable==='function'){
    var portMode = localStorage.getItem('mdb_portable_mode') || 'mpc';
    launchPortable(clipPath, portMode);
    setTimeout(function(){
      S.toast('Cesta skopírovaná. Portable prehrávač sa pokúša spustiť...');
    },800);
    return;
  }

  // MPC / VLC protocol handler
  var proto=S.playerProto||'mpc';
  var launchUrl;
  if(S.pathMode==='smb' && S.smbUrlMode==='raw'){
    launchUrl=path;
  } else {
    var protoPath=path.replace(/\\/g,'/');
    if(S.pathMode==='smb'){
      if(protoPath.indexOf('smb://')==0) protoPath=protoPath.substring(6);
    } else {
      protoPath=protoPath.replace(/^([A-Za-z]):/,'$1');
    }
    launchUrl=proto+'://'+encodeURI(protoPath);
  }
  window.location.href=launchUrl;

  var label=S.smbUrlMode==='raw'?'SMB':proto.toUpperCase();
  setTimeout(function(){
    S.toast('Cesta skopírovaná. Ak sa '+label+' neotvoril, skontroluj registráciu '+proto+':// handlera.');
  },800);
};

S.copyToClip = function copyToClip(text){
  if(navigator.clipboard){
    navigator.clipboard.writeText(text).catch(function(){});
  } else {
    var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
  }
};

S.copyMoviePath = function copyMoviePath(id) {
  
  var m = S.all.find(function(x) { return x.id === id; });
  if (!m) return;
  var path = S.getMoviePath(m);
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(path).then(function() {
      S.toast('Cesta skopírovaná (' + (S.pathMode==='smb'?'Sieťová':'Lokálna') + '): ' + path);
    });
  } else {
    // Fallback
    prompt('Cesta k súboru:', path);
  }
};
