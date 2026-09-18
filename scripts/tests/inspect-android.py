"""Inspect engineering Android artifacts. Static checks do not establish runtime readiness."""
from pathlib import Path
import json,os,hashlib,subprocess,struct,zipfile,argparse
p=argparse.ArgumentParser();p.add_argument('--sdk',required=True);p.add_argument('--java',required=True);p.add_argument('--bundletool',required=True);p.add_argument('--source-commit',required=True);a=p.parse_args()
r=Path.cwd();e=r/'docs/production-readiness/2026-09-18-remediation/evidence';art=r/'artifacts/remediation-20260918/android';art.mkdir(parents=True,exist_ok=True)
for suffix,src in [('apk','android/app/build/outputs/apk/release/app-release.apk'),('aab','android/app/build/outputs/bundle/release/app-release.aab')]:
 dest=art/f'app-release.{suffix}'
 if dest.exists():dest.unlink()
 os.link(r/src,dest)
apk=art/'app-release.apk';aab=art/'app-release.aab';bt=Path(a.sdk)/'build-tools/36.0.0';env={**os.environ,'JAVA_HOME':str(Path(a.java).parent.parent)}
def run(args,name):
 x=subprocess.run([str(v) for v in args],env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,check=True);(e/name).write_text(x.stdout);return x.stdout
run([bt/'aapt','dump','badging',apk],'android-badging.txt');permissions=run([bt/'aapt','dump','permissions',apk],'android-permissions.txt')
run([bt/'apksigner','verify','--verbose','--print-certs',apk],'android-signature.txt');run([bt/'zipalign','-c','-P','16','-v','4',apk],'android-zipalign.txt')
manifest=run([a.java,'-jar',a.bundletool,'dump','manifest','--bundle='+str(aab)],'android-aab-manifest.xml');config=run([a.java,'-jar',a.bundletool,'dump','config','--bundle='+str(aab)],'android-aab-config.json')
assert 'targetSdkVersion="36"' in manifest;assert 'PAGE_ALIGNMENT_16K' in config
for blocked in ['READ_MEDIA_IMAGES','READ_MEDIA_VIDEO','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE','RECORD_AUDIO','SYSTEM_ALERT_WINDOW','WRITE_SETTINGS','USE_BIOMETRIC','USE_FINGERPRINT','VIBRATE']:assert blocked not in permissions,blocked
elf=[]
with zipfile.ZipFile(apk) as z:
 js=z.read('assets/index.android.bundle');assert b'https://staging.avantehnik.invalid' in js;assert b'https://api-production-2e6d.up.railway.app' not in js
 for name in z.namelist():
  if not(name.startswith('lib/') and name.endswith('.so')):continue
  data=z.read(name);assert data[:6]==b'\x7fELF\x02\x01';off=struct.unpack_from('<Q',data,32)[0];size,num=struct.unpack_from('<HH',data,54);align=[]
  for n in range(num):
   row=struct.unpack_from('<IIQQQQQQ',data,off+n*size)
   if row[0]==1:align.append(row[7])
  assert align and min(align)>=16384;elf.append({'path':name,'loadAlignments':align,'supports16KbAlignment':True})
assert len(elf)==17
binaries=[{'path':str(x.relative_to(r)),'bytes':x.stat().st_size,'sha256':hashlib.sha256(x.read_bytes()).hexdigest()} for x in [apk,aab]]
(e/'android-artifacts.json').write_text(json.dumps({'sourceCommit':a.source_commit,'build':'standalone Android release, arm64-v8a only','signing':'generated Android debug/test certificate; NOT store upload key','endpoint':'https://staging.avantehnik.invalid (inert; rebuild with approved staging URL for end-to-end acceptance)','installed':False,'physicalDeviceTested':False,'binaries':binaries,'elf':elf,'runtime16Kb':'BLOCKED: no emulator image/device; alignment is a static check only'},indent=2))
print('Verified Android artifact hashes, target36, minimal permissions, inert API and 17 ELF alignments.')
