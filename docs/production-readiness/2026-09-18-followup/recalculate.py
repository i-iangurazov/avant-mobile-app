"""Preserve baseline IDs, weights and acceptance. Carry prior evidence with explicit provenance."""
from pathlib import Path
import csv,json,shutil,runpy,copy
R=Path(__file__).resolve().parent;P=R.parent/'2026-09-18-remediation';B=R.parent/'2026-09-18-340b960'
shutil.copyfile(B/'calculate.py',R/'calculate.py');shutil.copyfile(B/'domains.json',R/'domains.json')
def load(path):return list(csv.DictReader(path.open()))
def write(rows,path):
 with path.open('w',newline='')as f:w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def evidence_path(x):
 if x.startswith('../') or x=='CODE REVIEW':return x
 if (P/x.split(':')[0]).exists():return '../2026-09-18-remediation/'+x
 if (B/x.split(':')[0]).exists():return '../2026-09-18-340b960/'+x
 if (R.parents[2]/x.split(':')[0]).exists():return '../../../'+x
 raise AssertionError('Missing inherited evidence: '+x)
def update(rows):
 for r in rows:
  r['evidence']='; '.join(evidence_path(x) for x in r['evidence'].split('; '))
  if r['id']=='CORE-06':r.update(status='PASS',evidence='evidence/gateway-real-source.json; evidence/catalog-gateway.json; evidence/visual.json',limitation='Новый локальный gateway проверен на REAL GET всех 2365 товаров: категории и exact ID; 24 запроса, максимум 3 одновременно, 6.207 с. Shared Bazaar source read-only reviewed. Исправления не развёрнуты; качество наполнения D12 и inventory EX-02 остаются BLOCKED.')
  if r['id']=='UI-07':r.update(status='PASS',evidence='evidence/visual.json; evidence/screenshots/map-320.png; evidence/screenshots/map-390.png; evidence/screenshots/map-430.png; MAP_SOURCES.md',limitation='WEB: фактический метод после замены провайдера — Leaflet + реальные OSM tiles; координаты REAL 2GIS. Историческая метка method сохранена для сравнения, изменение средства проверки раскрыто. Bounds popup, controls, attribution, offline/retry проверены; native acceptance D10 не закрыт.')
  if r['id'] in ['REL-01','REL-02','REL-03','REL-04','REL-05']:
   r['evidence']='evidence/'+({'REL-01':'typecheck.log','REL-02':'lint.log'}.get(r['id'],'export-all.log'));r['limitation']='Повтор на source 9a7b421; export не является standalone native release.'
  if r['id']=='LOY-06':r['evidence']+='; evidence/reward-retry.json; evidence/reward-ui.json';r['limitation']='Дополнительно D23: потеря ответа, reload, 20 повторов, одна запись списания, смена аккаунта. Реальные правила и POS по-прежнему заблокированы отдельно.'
  if r['id']=='EX-02':r['limitation']='Исходники общего Bazaar обнаружены и прочитаны без изменений. Для доверенного inventory/hold adapter нужны утверждённые org/branch mapping, staging API/DB и контракт резервов/сверки POS. Read-only product API не является резервированием.'
 return rows
comparable=update(load(P/'CRITERIA_COMPARABLE.csv'));write(comparable,R/'CRITERIA_COMPARABLE.csv');write(comparable,R/'CRITERIA.csv');runpy.run_path(str(R/'calculate.py'));shutil.copyfile(R/'SCORES.json',R/'SCORES_COMPARABLE.json')
rows=update(load(P/'CRITERIA.csv'));write(rows,R/'CRITERIA.csv');runpy.run_path(str(R/'calculate.py'))
base=load(B/'CRITERIA.csv');by={r['id']:r for r in rows}
for r in base:
 for k in ['id','domain','platform','expected','method','weight','weight_reason']:assert by[r['id']][k]==r[k],(r['id'],k)
# A counterfactual mathematical ceiling, never reported as achieved readiness.
ceiling=copy.deepcopy(base)
for r in ceiling:
 if r['status']!='N/A':r['status']='BLOCKED' if r['method']=='PHYSICAL DEVICE / standalone RELEASE' else 'PASS'
write(ceiling,R/'CRITERIA.csv');runpy.run_path(str(R/'calculate.py'));ceil=json.loads((R/'SCORES.json').read_text());(R/'NO_DEVICE_CEILING.json').write_text(json.dumps({'physicalCriteria':sum(r['method']=='PHYSICAL DEVICE / standalone RELEASE' for r in base),'assumption':'All other applicable baseline criteria PASS, including unavailable approvals/services/signing. This is NOT achieved readiness.','scores':ceil},ensure_ascii=False,indent=2));write(rows,R/'CRITERIA.csv');runpy.run_path(str(R/'calculate.py'))
new=json.loads((R/'SCORES.json').read_text());old=json.loads((B/'SCORES.json').read_text());prev=json.loads((P/'SCORES.json').read_text());comp=json.loads((R/'SCORES_COMPARABLE.json').read_text())
lines=['# Сопоставление готовности / покрытия','', '147 исходных строк и веса сохранены. Основная оценка включает те же 151 строку, что предыдущий этап. Новых критериев в этом продолжении не добавлено. Изменение средства проверки WEB карты раскрыто в UI-07 и MAP_SOURCES.','', '|Платформа|Baseline 147|Предыдущие 151|Сейчас, сопоставимые 147|Сейчас 151|','|---|---:|---:|---:|---:|']
fmt=lambda v:f"{v['readiness']:.2f}% / {v['coverage']:.2f}%"
for platform in new:lines.append('|'+platform+'|'+ '|'.join(fmt(x[platform]) for x in [old,prev,comp,new])+'|')
for platform in new:
 lines+=['',f'## {platform}', '', '|Направление|Вес|Baseline R/C|Предыдущий R/C|Новый R/C|','|---|---:|---:|---:|---:|']
 for a,b,c in zip(old[platform]['directions'],prev[platform]['directions'],new[platform]['directions']):lines.append(f"|{c['name']}|{c['domain_weight']}|{fmt(a)}|{fmt(b)}|{fmt(c)}|")
lines+=['','Прирост: CORE-06 теперь PASS по настоящим данным через исправленный локальный gateway; UI-07 PASS в web после замены встраиваемой карты. Покрытие не растёт при FAIL→PASS. Повторы уже зелёных критериев не добавляют проценты. Все 58 PHYSICAL DEVICE критериев остаются BLOCKED.','',f"Даже контрфактический максимум без устройств по исходной матрице: {ceil['ALL']['readiness']:.2f}%. Это верхняя граница, а не выполненная работа. 80% при этих ограничениях недостижимы без изменения методики."]
(R/'COMPARISON.md').write_text('\n'.join(lines))
