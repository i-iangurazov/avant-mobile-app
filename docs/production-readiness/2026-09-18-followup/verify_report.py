from pathlib import Path
import csv,json,hashlib,gzip,subprocess
R=Path(__file__).resolve().parent;ROOT=R.parents[2];B=R.parent/'2026-09-18-340b960';P=R.parent/'2026-09-18-remediation'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assert (R/'calculate.py').read_bytes()==(B/'calculate.py').read_bytes()
assert (R/'domains.json').read_bytes()==(B/'domains.json').read_bytes()
for sha,folder in [('c88450a',B),('6c40f51',P)]:subprocess.run(['git','diff','--exit-code',sha,'--',str(folder)],cwd=ROOT,check=True,capture_output=True)
rows=list(csv.DictReader((R/'CRITERIA.csv').open()));assert len(rows)==151
base=list(csv.DictReader((B/'CRITERIA.csv').open()));by={r['id']:r for r in rows}
for r in base:
 for k in ['id','domain','platform','expected','method','weight','weight_reason']:assert by[r['id']][k]==r[k]
physical=[r for r in rows if r['method']=='PHYSICAL DEVICE / standalone RELEASE'];assert len(physical)==58;assert all(r['status']=='BLOCKED' for r in physical)
for r in rows:
 for e in r['evidence'].split('; '):
  if e and e!='CODE REVIEW':assert (R/e.split(':')[0]).exists(),(r['id'],e)
closure=json.loads((R/'CLOSURE.json').read_text());assert [x['id'] for x in closure]==[f'D{i:02}' for i in range(1,24)]
for x in closure:
 assert x['status'] in ['FIXED & VERIFIED','IMPLEMENTED, NOT VERIFIED','BLOCKED','OPEN']
 for e in x['verification']:assert (R/e).exists(),(x['id'],e)
original=closure[:17];assert sum(x['release_blocker'] for x in original)==11;assert sum(x['status']=='FIXED & VERIFIED' for x in original)==8
manifest=json.loads((R/'evidence/source-manifest.json').read_text())
for p,h in manifest['files'].items():assert digest(ROOT/p)==h,p
capture=gzip.decompress((R/'evidence/catalog-capture.json.gz').read_bytes());summary=json.loads((R/'evidence/catalog-complete-readonly.json').read_text());assert hashlib.sha256(capture).hexdigest()==summary['captureSha256'];data=json.loads(capture);assert len({p['id'] for p in data['items']})==2365
flags=json.loads((R/'evidence/catalog-field-coverage.json').read_text())
for key,summarykey in [('image','withImage'),('description','withDescription'),('category','withCategory'),('positivePriceKgs','positivePriceKgs')]:assert sum(p[key] for p in flags)==summary[summarykey],key
assert sum(all(p[k] for k in ['image','description','category','positivePriceKgs'])for p in flags)==summary['allFour']
visual=json.loads((R/'evidence/visual.json').read_text());assert len(visual['checks'])==9 and not visual['errors']
second=json.loads((R/'evidence/visual-second-branch.json').read_text());assert len(second['checks'])==1 and second['checks'][0]['loaded'] and not second['errors']
reward=json.loads((R/'evidence/reward-ui.json').read_text());assert len(reward['checks'])==6 and reward['lost'] and reward['serverOperations']==1
assert json.loads((R/'evidence/reward-retry.json').read_text())['status']=='PASS'
for f in ['typecheck.log','lint.log']:assert 'error TS' not in (R/'evidence'/f).read_text();assert '✖' not in (R/'evidence'/f).read_text()
assert 'Exported:' in (R/'evidence/export-all.log').read_text()
oldbuild=json.loads((P/'evidence/android-artifacts.json').read_text())
for b in oldbuild['binaries']:assert digest(ROOT/b['path'])==b['sha256']
files={str(p.relative_to(R)):digest(p)for p in (R/'evidence').rglob('*')if p.is_file()}
(R/'evidence-manifest.json').write_text(json.dumps(files,indent=2))
print(json.dumps(dict(status='PASS',baselineUnchanged=True,previousReportUnchanged=True,sourceFiles=len(manifest['files']),criteria=len(rows),physicalBlocked=len(physical),originalDefects=17,allDefects=len(closure),evidenceFiles=len(files),priorBinaryHashesVerified=True)))
