# -*- coding: utf-8 -*-
"""Verify closure, original weights and evidence without modifying baseline."""
from pathlib import Path
import csv,json,hashlib,re,subprocess,collections
r=Path(__file__).resolve().parents[3];p=Path(__file__).resolve().parent;b=p.parent/'2026-09-18-340b960'
old=json.loads((b/'DEFECTS.json').read_text());closed=json.loads((p/'CLOSURE.json').read_text());assert len(old)==17 and len(closed)==21
for source,item in zip(old,closed):
 for key in ['id','actual','acceptance','release_blocker']:assert source[key]==item[key],key
assert sum(x['release_blocker'] for x in closed[:17])==11
for x in closed:
 assert x['status'] in ['FIXED & VERIFIED','IMPLEMENTED, NOT VERIFIED','BLOCKED','OPEN']
 for f in x['files']:assert (r/f).is_file(),f
 for f in x['verification']:assert(p/f).is_file(),f
oldrows={x['id']:x for x in csv.DictReader((b/'CRITERIA.csv').open())};rows={x['id']:x for x in csv.DictReader((p/'CRITERIA.csv').open())};assert len(oldrows)==147 and len(rows)==151
for i,x in oldrows.items():
 for key in ['weight','domain','platform','expected','method']:assert rows[i][key]==x[key],(i,key)
assert (p/'calculate.py').read_bytes()==(b/'calculate.py').read_bytes();assert(p/'domains.json').read_bytes()==(b/'domains.json').read_bytes()
for f in p.glob('*.md'):
 for raw in re.findall(r'\]\(([^)]+)\)',f.read_text()):
  link=raw.strip('<>')
  if '://' in link or link.startswith('#'):continue
  assert(f.parent/link.split('#')[0]).exists(),(f.name,link)
for name,expected in json.loads((p/'baseline-hashes.json').read_text()).items():assert hashlib.sha256((r/name).read_bytes()).hexdigest()==expected,name
artifact=json.loads((p/'evidence/android-artifacts.json').read_text())
for x in artifact['binaries']:assert hashlib.sha256((r/x['path']).read_bytes()).hexdigest()==x['sha256']
source_roots=['app','src','scripts/server','scripts/db','app.json','package.json','package-lock.json','babel.config.js','metro.config.js','tsconfig.json','tsconfig.server.json']
diff=subprocess.check_output(['git','diff','5b8ea84','--',*source_roots],cwd=r,text=True);assert not diff,'Product source changed after last build'
files=subprocess.check_output(['git','ls-files','--',*source_roots],cwd=r,text=True).splitlines();manifest={f:hashlib.sha256((r/f).read_bytes()).hexdigest() for f in files}
(p/'evidence/current-source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
result={'status':'PASS','originalDefects':len(old),'originalBlockers':11,'originalCriteria':147,'currentCriteria':151,'originalWeightsMethodsExpectedPreserved':True,'sourceMatchesBuiltCommit':'5b8ea84','sourceFiles':len(manifest),'artifactHashes':'verified','closureStates':dict(collections.Counter(x['status'] for x in closed))}
(p/'evidence/report-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
