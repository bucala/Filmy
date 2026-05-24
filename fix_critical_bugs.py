import re,sys,json,base64,urllib.request,urllib.error
OWNER,REPO,BRANCH,PATH="bucala","Filmy","main","index.html"
if len(sys.argv)<2:print("Usage: python3 fix_critical_bugs.py YOUR_PAT");sys.exit(1)
TOKEN=sys.argv[1].strip()
API="https://api.github.com"
HDR={"Authorization":f"token {TOKEN}","Accept":"application/vnd.github.v3+json","User-Agent":"FilmyFix/1.0"}
def gh(method,url,data=None):
 body=json.dumps(data).encode() if data else None
 req=urllib.request.Request(url,data=body,headers=HDR,method=method)
 try:
  with urllib.request.urlopen(req) as r:return json.loads(r.read())
 except urllib.error.HTTPError as e:print(f"HTTP {e.code}: {e.read().decode()[:300]}");sys.exit(1)
print("Downloading index.html...")
info=gh("GET",f"{API}/repos/{OWNER}/{REPO}/contents/{PATH}?ref={BRANCH}")
current_sha=info["sha"]
with urllib.request.urlopen(info["download_url"]) as r:src=r.read().decode("utf-8")
print(f"Downloaded: {len(src):,} chars, SHA: {current_sha}")
orig=len(src)
for p in [r"[ \t]*var advTog = document\.getElementById\('advToggle'\);\n",r"[ \t]*var advBdy = document\.getElementById\('advBody'\);\n",r"[ \t]*if \(advTog\) advTog\.classList\.remove\('open'\);\n",r"[ \t]*if \(advBdy\) advBdy\.classList\.remove\('open'\);\n"]:
 src=re.sub(p,"",src)
src=re.sub(r"  // Advanced settings toggle\n  \n    var isOpening = !this\.classList\.contains\('open'\);\n    this\.classList\.toggle\('open'\);\n    var body = document\.getElementById\('advBody'\);\n    body\.classList\.toggle\('open'\);\n    // Scroll the settings panel so the adv section is visible\n    if \(isOpening\) \{\n      setTimeout\(function\(\) \{\n        body\.scrollIntoView\(\{behavior:'smooth', block:'nearest'\}\);\n      \}, 50\);\n    \}\n  \}\);\n","",src)
m=re.search(r"(</body>\n)</html\n([ \t]*// Sync path mode settings\n.*?)\n>$",src,re.DOTALL|re.MULTILINE)
if m:
 oc=m.group(2);src=re.sub(r"(</body>\n)</html\n.*?\n>$",m.group(1)+"</html>",src,flags=re.DOTALL|re.MULTILINE)
 a='  document.getElementById("settPanel").classList.remove("hidden");\n}'
 if a in src:src=src.replace(a,'  document.getElementById("settPanel").classList.remove("hidden");\n'+oc+"\n}",1)
for v in ["gold-dim","accent2","accent"]:src=re.sub(r"--"+re.escape(v)+r":[^;}\n]+;?\s*","",src)
print(f"Patched: {orig:,} -> {len(src):,} (-{orig-len(src):,})")
print("Pushing to GitHub...")
r=gh("PUT",f"{API}/repos/{OWNER}/{REPO}/contents/{PATH}",{"message":"fix: critical audit fixes #1-3 (advToggle handler, broken </html>, dead CSS vars)","content":base64.b64encode(src.encode()).decode(),"sha":current_sha,"branch":BRANCH})
print("DONE:",r["commit"]["html_url"])
