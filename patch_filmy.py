import sys

with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

orig_len = len(h)

# Fix A: ttabList/ttabGrid init pri grid mode v loadPrefs
OLD_A = "vt.setAttribute('data-mode',grid?'grid':'list'); }}"
NEW_A = "vt.setAttribute('data-mode',grid?'grid':'list'); }\n    var tl=document.getElementById('ttabList'),tg=document.getElementById('ttabGrid');\n    if(tl)tl.className='ttab';\n    if(tg)tg.className='ttab on';}"
count_a = h.count(OLD_A)
h = h.replace(OLD_A, NEW_A, 1)

# Fix D1: pridat select do user-select:text
OLD_D1 = "input,textarea,.tmdb-inp{\n  -webkit-user-select:text!important;user-select:text!important}"
NEW_D1 = "input,textarea,.tmdb-inp,select{\n  -webkit-user-select:text!important;user-select:text!important}"
count_d1 = h.count(OLD_D1)
h = h.replace(OLD_D1, NEW_D1, 1)

# Fix D2: odstranit duplicitny .screen * blok
OLD_D2 = "/* \u2500\u2500 User select + scrollbar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */\n.screen *{-webkit-user-select:none;user-select:none;\n  -webkit-tap-highlight-color:transparent}\ninput,textarea,.tmdb-inp,select{\n  -webkit-user-select:text!important;user-select:text!important}"
NEW_D2 = "/* \u2500\u2500 User select + scrollbar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */"
count_d2 = h.count(OLD_D2)
h = h.replace(OLD_D2, NEW_D2, 1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(h)

print("Fix A (ttabList/ttabGrid):", count_a, "nahradeni")
print("Fix D1 (select)          :", count_d1, "nahradeni")
print("Fix D2 (dup .screen *)   :", count_d2, "nahradeni")
print("Velkost:", orig_len, "->", len(h), "bytes")
