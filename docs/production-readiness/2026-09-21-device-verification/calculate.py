"""Recalculate audit scores from CRITERIA.csv; stdlib only. No product writes."""
from pathlib import Path
import argparse,csv,json
ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--criteria',default='CRITERIA.csv')
parser.add_argument('--json',default='SCORES.json')
parser.add_argument('--markdown',default='CALCULATION.md')
args=parser.parse_args()
rows=list(csv.DictReader((ROOT/args.criteria).open()))
domains=json.loads((ROOT/'domains.json').read_text())
assert len({r['id'] for r in rows})==len(rows)
assert all(r['status'] in ['PASS','FAIL','BLOCKED','NOT TESTED','N/A'] for r in rows)
assert all(int(r['weight']) in [1,3,5] for r in rows)
assert all(r['limitation'] for r in rows if r['status']=='N/A')
result={}
for platform in ['ALL','ANDROID','IOS']:
 selected=[r for r in rows if platform=='ALL' or r['platform'] in ['SHARED',platform]]
 table=[]
 for did,weight,name in domains:
  domainrows=[r for r in selected if r['domain']==did]
  if not domainrows:continue
  counts={s:sum(r['status']==s for r in domainrows) for s in ['PASS','FAIL','BLOCKED','NOT TESTED','N/A']}
  weights={s:sum(int(r['weight']) for r in domainrows if r['status']==s) for s in counts}
  denominator=sum(v for k,v in weights.items() if k!='N/A')
  if not denominator:continue
  table.append(dict(domain=did,name=name,domain_weight=weight,counts=counts,weights=weights,denominator=denominator,readiness=100*weights['PASS']/denominator,coverage=100*(weights['PASS']+weights['FAIL'])/denominator))
 totalweight=sum(x['domain_weight'] for x in table)
 result[platform]=dict(direction_weight_denominator=totalweight,readiness=sum(x['domain_weight']*x['readiness'] for x in table)/totalweight,coverage=sum(x['domain_weight']*x['coverage'] for x in table)/totalweight,directions=table)
(ROOT/args.json).write_text(json.dumps(result,ensure_ascii=False,indent=2))
lines=['# Расчёт процентов','',f'Критериев: {len(rows)}. N/A исключены только по причинам в CRITERIA.csv.','', 'R_d = 100 × W_PASS / (W_PASS + W_FAIL + W_BLOCKED + W_NOT_TESTED).', '', 'C_d = 100 × (W_PASS + W_FAIL) / тот же знаменатель.', '', 'R_platform = Σ(direction_weight × R_d) / Σ(применимых direction_weight). Аналогично coverage. Округление только при отображении; общий итог рассчитан из неокруглённых дробей.', '']
for p,s in result.items():
 lines.extend([f'## {p}', '', f"Готовность **{s['readiness']:.0f}%**, покрытие **{s['coverage']:.0f}%**. Σвесов направлений={s['direction_weight_denominator']}.", '', '|Направление|Вес|PASS вес|FAIL вес|BLOCKED вес|NOT TESTED вес|N/A вес|Знаменатель|Готовность|Покрытие|', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|'])
 for x in s['directions']:
  w=x['weights'];lines.append(f"|{x['name']}|{x['domain_weight']}|{w['PASS']}|{w['FAIL']}|{w['BLOCKED']}|{w['NOT TESTED']}|{w['N/A']}|{x['denominator']}|{x['readiness']:.0f}%|{x['coverage']:.0f}%|")
 lines.append('')
(ROOT/args.markdown).write_text('\n'.join(lines))
print(json.dumps({k:{'readiness':round(v['readiness']),'coverage':round(v['coverage'])} for k,v in result.items()}))
