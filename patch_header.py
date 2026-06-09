import re, shutil, sys

F = 'index.html'
shutil.copy(F, F + '.bak')
with open(F, 'r', encoding='utf-8') as f:
    c = f.read()

ok = []

# ━━ PATCH 1: CSS — flex search + user-select ━━
CSS = """
<style>
/* ── Flex search bar ── */
.hdr-srch{position:relative;flex:1 1 120px;min-width:120px;max-width:420px;}
.hdr-srch input{width:100%;box-sizing:border-box;}
/* ── Disable text selection on UI chrome ── */
.hdr,.hdr *,.chip,.mcard,.lcard,.det-hdr,.sett-panel,.fp-panel{
  -webkit-user-select:none;user-select:none;}
input,textarea,.det-body,.det-desc,.det-cast{
  -webkit-user-select:text;user-select:text;}
/* ── Left icon group ── */
.hdr-left{display:flex;align-items:center;gap:2px;flex:0 0 auto;}
/* ── Separator ── */
.hdr-sep{width:1px;height:20px;background:var(--border);margin:0 4px;flex:0 0 auto;}
/* ── Right icon group ── */
.hdr-right{display:flex;align-items:center;gap:2px;flex:0 0 auto;}
.hdr-left button,.hdr-right button{
  flex:0 0 auto;display:flex;align-items:center;justify-content:center;
  width:34px;height:34px;border-radius:8px;border:none;
  background:transparent;color:var(--text2);cursor:pointer;}
.hdr-left button:hover,.hdr-right button:hover{background:var(--card2);color:var(--gold);}
.sort-pill{display:flex;align-items:center;gap:2px;}
.sort-pill select{display:none;}
.sort-pill button{width:28px;height:28px;border-radius:6px;}
</style>"""

if '<style>' not in c:
    c = c.replace('</head>', CSS + '\n</head>')
    ok.append('CSS vlozene')
else:
    ok.append('WARN: <style> uz existuje — pridaj CSS manualne')

# ━━ PATCH 2: Prehodit poradi ikon v hdr-row1 ━━
# Stary blok: hdr-controls + hdr-act -> novy: hdr-left | sep | hdr-right

OLD_CONTROLS = '''    <div class="hdr-controls">
      <div class="sort-pill">
        <select id="sortSel" style="display:none"></select>
        <button id="sortDir" title="Smer radenia"></button>
      </div>
      <button id="fpBtn" class="fp-btn" title="Pokročilý filter">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 5 10 13 10 21 14 19 14 13 21 5"/></svg>
        <span id="fpBadge" class="fp-badge"></span>
      </button>
      <button id="viewTog" title="Prepínať zobrazenie">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>
      </button>
    </div>
    <div class="hdr-act">
      <button id="btnFav" class="hdr-act-fav" title="Obľúbené">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <button id="btnWl" class="hdr-act-wl" title="Watchlist">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      </button>
      <button id="btnWatched" class="hdr-act-watch" title="Videné">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button id="btnRnd" title="Náhodný film">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="3" ry="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"/></svg>
      </button>
      <button id="btnStat" title="Štatistiky">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>
      </button>
      <button id="btnSett" title="Nastavenia">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>'''

NEW_GROUPS = '''    <!-- LAVA: Oblubene | Watchlist | Videne | Nahodny | Statistiky -->
    <div class="hdr-left">
      <button id="btnFav" class="hdr-act-fav" title="Obľúbené">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <button id="btnWl" class="hdr-act-wl" title="Watchlist">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      </button>
      <button id="btnWatched" class="hdr-act-watch" title="Videné">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <button id="btnRnd" title="Náhodný film">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="3" ry="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"/></svg>
      </button>
      <button id="btnStat" title="Štatistiky">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>
      </button>
    </div>
    <!-- ODDELOVAC -->
    <div class="hdr-sep"></div>
    <!-- PRAVA: Filter | Radenie | Zobrazenie | Nastavenia -->
    <div class="hdr-right">
      <button id="fpBtn" class="fp-btn" title="Pokročilý filter">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 5 10 13 10 21 14 19 14 13 21 5"/></svg>
        <span id="fpBadge" class="fp-badge"></span>
      </button>
      <div class="sort-pill">
        <select id="sortSel" style="display:none"></select>
        <button id="sortDir" title="Smer radenia"></button>
      </div>
      <button id="viewTog" title="Prepínať zobrazenie">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/></svg>
      </button>
      <button id="btnSett" title="Nastavenia">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
    </div>'''

if OLD_CONTROLS in c:
    c = c.replace(OLD_CONTROLS, NEW_GROUPS)
    ok.append('Poradie ikon opravene')
else:
    ok.append('WARN: hdr-controls/hdr-act blok nebol najdeny — skontroluj manualne')

# ━━ PATCH 3: Oprava import tlacidiel — pridaj listenery pred </body> ━━
LISTENERS = """
<script>
/* Import buttons wiring */
document.addEventListener('DOMContentLoaded', function(){
  var ez = document.getElementById('emptyBtnZip');
  var ep = document.getElementById('emptyBtnPull');
  if(ez) ez.addEventListener('click', function(){ var fi=document.getElementById('fileInp'); if(fi) fi.click(); });
  if(ep) ep.addEventListener('click', function(){
    if(typeof ghPull==='function') ghPull();
    else if(typeof loadFromGithub==='function') loadFromGithub();
    else { var pb=document.getElementById('ghPullBtn'); if(pb) pb.click(); }
  });
});
</script>"""

if 'emptyBtnZip' in c and '/* Import buttons wiring */' not in c:
    c = c.replace('</body>', LISTENERS + '\n</body>')
    ok.append('Import button listenery pridane')
else:
    ok.append('Import listenery uz existuju alebo emptyBtnZip nenajdeny')

with open(F, 'w', encoding='utf-8') as f:
    f.write(c)

print('\n'.join(['[OK] ' + x if not x.startswith('WARN') else '[!!] ' + x for x in ok]))
print('\nHotovo. Skontroluj zmeny: git diff index.html')
