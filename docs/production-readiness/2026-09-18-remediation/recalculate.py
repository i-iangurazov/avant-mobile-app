from pathlib import Path
import csv,json,subprocess,runpy,copy
R=Path(__file__).resolve().parent; B=R.parent/'2026-09-18-340b960'
rows=list(csv.DictReader((B/'CRITERIA.csv').open()));fields=list(rows[0]);by={x['id']:x for x in rows}
def setrow(i,status,evidence,note=''):
 r=by[i];r['status']=status;r['evidence']=evidence;r['limitation']=note
reg='evidence/regression-suite.log';http='evidence/http-security.json';ui='evidence/ui-flows.json'
for i,e in {
 'UX-01':reg+'; evidence/screenshots/guest-password-reset.png','UX-02':ui,'UX-03':'evidence/gallery.json','UX-04':'evidence/gallery.json',
 'CORE-01':reg+'; '+http,'CORE-02':http,'CORE-03':reg+'; '+ui,'CORE-04':reg+'; '+http,'CORE-05':reg+'; '+http,'CORE-07':'evidence/loyalty-existing.log','CORE-08':'evidence/loyalty-existing.log','CORE-09':'evidence/gallery.json','CORE-10':ui,'CORE-11':ui,
 'LOY-02':'evidence/loyalty-existing.log','LOY-03':'evidence/loyalty-existing.log','LOY-04':'evidence/loyalty-existing.log','LOY-05':'evidence/loyalty-existing.log','LOY-06':reg+'; evidence/loyalty-existing.log','LOY-07':'evidence/loyalty-existing.log','LOY-08':'evidence/loyalty-existing.log','LOY-09':'evidence/loyalty-existing.log','LOY-10':'evidence/loyalty-existing.log','LOY-11':reg,'LOY-12':reg,'LOY-16':'evidence/loyalty-existing.log; '+reg,'LOY-17':reg+'; '+ui,
 'API-01':reg+'; '+http+'; '+ui,'API-02':reg+'; '+http,'API-03':'scripts/app-server.ts; evidence/real-api-readonly.json','API-04':'evidence/loyalty-existing.log','API-06':http+'; scripts/app-server.ts',
 'REL-01':'evidence/typecheck.log','REL-02':'evidence/lint.log','REL-03':'evidence/expo-export-final.log','REL-04':'evidence/expo-export-final.log','REL-05':'evidence/expo-export-final.log','REL-06':http,
 'SEC-01':reg+'; '+http,'SEC-02':reg+'; '+http,'SEC-03':reg+'; '+ui,'SEC-04':reg+'; '+ui,'SEC-06':reg,'SEC-07':http,'SEC-08':http+'; evidence/replica-rate-limit.json','SEC-09':'evidence/bundle-scan.json','SEC-10':'evidence/npm-audit-after.json; evidence/expo-export-final.log; scripts/build/patch-metro.cjs',
 'OPS-03':'evidence/database-recovery.json','A11Y-04':'evidence/contrast.json; evidence/gallery.json','A11Y-05':reg+'; evidence/gallery.json'
}.items():setrow(i,'PASS',e,'Проверено указанным локальным/API/web/статическим методом; native physical/staging проверки учитываются отдельными строками и не закрыты этим результатом.')
setrow('UX-01','PASS',reg+'; evidence/screenshots/guest-password-reset.png','Серверный reset с bound proof и отзывом сессий; реальная доставка SMS — EX-01 BLOCKED.')
setrow('SEC-04','PASS',reg+'; '+ui,'Реальные DELETE + web flow + запрет старой сессии на тестовом аккаунте. Retention, внешние копии и native deletion не утверждены; D06 остаётся BLOCKED.')
setrow('OPS-03','PASS','evidence/database-recovery.json','Локальная восстановленная копия 34 таблиц и additive migration baseline→new. Production backup/PITR/операторская репетиция остаются условием внедрения.')
for i in ('API-01','API-02'):by[i]['limitation']='Доверенный серверный inventory fixture, подмены/параллелизм/quote проверены. Реальный adapter/POS и mapping блокирует EX-02; production seed отсутствует.'
setrow('API-08','PASS','MAP_SOURCES.md; evidence/gallery.json','Сопоставление всех 6 firm ID и адресов по официальным страницам 2GIS исправлено. Утверждение владельцем телефонов/часов и native переходы ещё не получены; D09 не закрыт целиком.')
setrow('CORE-06','FAIL','evidence/real-api-readonly.json; ../2026-09-18-340b960/evidence/catalog-snapshot.json','Нет утверждённого наполнения ключевых SKU/категорий; локальный snapshot не исправляет REAL API.')
setrow('LOY-14','FAIL','evidence/screenshots/guest-legal-loyalty.png; drafts/POLICIES.md','Версионный reader/consent работает с явно тестовым документом; действующие утверждённые правила отсутствуют.')
setrow('SEC-05','FAIL','evidence/screenshots/guest-legal-privacy.png; drafts/POLICIES.md','Гостевые ссылки/reader реализованы; TEST fixture не является privacy policy для выпуска.')
setrow('UI-07','FAIL','evidence/screenshots/guest-maps.png','2GIS iframe popup всё ещё обрезается на узком viewport. Требуется поддерживаемая интеграция с ключом/координатами; native не проверен.')
setrow('UI-08','FAIL','evidence/gallery.json; evidence/real-api-readonly.json','Пустой блок уменьшен и fallback исправлен; утверждённые реальные фото/описания не предоставлены.')
# Keep all 147 IDs and weights for a like-for-like comparison. New applicability is reported separately.
for r in rows:
 if r['status'] in ['BLOCKED','NOT TESTED'] and r['id'] not in ['CORE-NA3']:
  if r['method']=='PHYSICAL DEVICE / standalone RELEASE':r['evidence']='NATIVE_OWNER_CHECK.md; evidence/android-devices.log; evidence/ios-toolchain.log';r['limitation']='Android engineering APK/AAB собраны; устройства не подключены. iOS Xcode/signing отсутствуют. Ни один требуемый physical-device сценарий не засчитан по web.'
 if r['status']=='PASS' and r['id'] not in ['API-05']:
  for e in r['evidence'].split('; '):
   if e.startswith('evidence/'):assert (R/e).exists(),e
if (R/'evidence/android-release-minimal.log').exists() and 'BUILD SUCCESSFUL' in (R/'evidence/android-release-minimal.log').read_text():
 setrow('PLAY-02','PASS','evidence/android-aab-manifest.xml','Фактический target36/min24 в инженерном AAB. Store подпись и установка остаются BLOCKED.')
 setrow('PLAY-09','PASS','evidence/android-permissions.txt; evidence/android-aab-manifest.xml','Минимальный итоговый manifest проверен. Runtime picker/camera/denial не проверены на устройстве; D16 IMPLEMENTED, NOT VERIFIED.')
setrow('OPS-01','BLOCKED','evidence/android-artifacts.json; NATIVE_OWNER_CHECK.md','Есть source commit и Android engineering release с hash. Воспроизводимый подписанный store release обеих платформ не подтверждён; IPA отсутствует.')
setrow('API-05','PASS','evidence/real-api-readonly.json','Публичный GET относится к неизвестному deployed SHA, не доказывает развёртывание исправлений.')
def write(path,data):
 with path.open('w',newline='')as f:w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(data)
for r in rows:
 r['evidence']='; '.join('../2026-09-18-340b960/'+part if part.startswith('evidence/') and not (R/part.split(':')[0]).exists() and (B/part.split(':')[0]).exists() else part for part in r['evidence'].split('; '))
write(R/'CRITERIA.csv',rows);runpy.run_path(str(R/'calculate.py'));comparable=json.loads((R/'SCORES.json').read_text());(R/'SCORES_COMPARABLE.json').write_text(json.dumps(comparable,ensure_ascii=False,indent=2));write(R/'CRITERIA_COMPARABLE.csv',rows)
# The previously N/A SMS criterion now applies. Do not hide new external gates in N/A.
setrow('CORE-NA3','PASS',reg,'Теперь применимо: серверные TTL/attempts/action/account binding/replay проверены с изолированным sender. Реальная SMS интеграция — отдельный EX-01.')
for i,d,w,expected,note in [
 ('EX-01','CORE',5,'Реальный SMS adapter проверен на staging для регистрации/входа/смены номера/reset/delete','Нет выбранного провайдера и sandbox/review phone доступа; никакого universal OTP.'),
 ('EX-02','API',5,'Trusted inventory adapter сверяет организацию/филиал/цены/остатки/holds с обслуживающей системой','Нет исходников/доступа staging общего Bazaar/POS; локальные предложения не загружаются в production.'),
 ('EX-03','SEC',3,'Media provider подтверждает decode/re-encode/EXIF cleanup/deletion и isolation','Есть безопасный контракт и тестовый adapter; реальный storage/decoder не подключён.'),
 ('EX-04','SEC',5,'После D01 проверен список production администраторов и утверждён план отзыва legacy sessions','Нужны read-only incident review владельцем и решение о внедрении auth v2; массовых отзывов не было.')]:
 rows.append(dict(id=i,domain=d,platform='SHARED',role='release owner',expected=expected,method='STAGING / OWNER EVIDENCE',weight=str(w),weight_reason='Новая применимость после исправлений; исходные веса направлений сохранены',status='BLOCKED',evidence='DEPLOYMENT.md; OWNER_ACTIONS.md',defect_ids='',limitation=note))
write(R/'CRITERIA.csv',rows);runpy.run_path(str(R/'calculate.py'))
(R/'SCOPE.md').write_text('# Методика и изменение охвата\n\nBaseline:147 строк,7 N/A. Все исходные ID, expected, weight и веса 12 направлений сохранены. Нативные физические проверки не заменены web/симуляцией. PASS означает только метод своей строки; отдельные release blockers остаются самостоятельными gates.\n\n`CRITERIA_COMPARABLE.csv` / `SCORES_COMPARABLE.json` дают сопоставимый результат на исходных 147 строках и исходной применимости. Основные CRITERIA/SCORES включают151 строку: CORE-NA3 стал применимым, добавлены4 BLOCKED внешних/incident gate. Сложные проверки не удалены. Новые defects D18–D21 не переименовывают D01–D17.\n\nФормулы и веса неизменны: readiness=PASS weight/all applicable weight; coverage=(PASS+FAIL) weight/all applicable weight. BLOCKED и NOT TESTED остаются в знаменателе. Результат направления взвешивается исходным domain weight; Android/iOS используют ту же фильтрацию SHARED+platform, что baseline. Округление только для отображения. UI остаётся0%: код и web-снимки не закрывают требуемые physical release критерии.\n\n`recalculate.py` заново строит обе оценки из неизменного baseline и проверяет наличие evidence файлов, `calculate.py` — неизменная копия исходного калькулятора. Содержание доказательств и границы PASS описаны в TEST_RUN и каждой строке.\n')
