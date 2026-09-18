# -*- coding: utf-8 -*-
from pathlib import Path
import json
R=Path(__file__).resolve().parent;P=R.parent/'2026-09-18-remediation'
items=json.loads((P/'CLOSURE.json').read_text())
for x in items:
 x['verification']=['../2026-09-18-remediation/'+e for e in x['verification']]
 if x['id']=='D10':
  x.update(status='IMPLEMENTED, NOT VERIFIED',
 change='Неприспосабливаемый 2GIS iframe заменён Leaflet/OSM с подтверждёнными координатами 6 фирм. Popup ограничен шириной, высота260–390, zoom снизу, атрибуция видна. Сохранены выбор филиала, карточка и внешний переход в 2GIS, timeout/retry.',
 verification=['evidence/visual.json','evidence/visual-second-branch.json','evidence/screenshots/map-320.png','evidence/screenshots/map-390.png','evidence/screenshots/map-430.png'],
 blocker='Web acceptance пройден, включая offline/retry. Native release, жесты/переходы на физическом Android/iPhone ещё не проверены. Нет устройств/Xcode; ключ 2GIS больше не является препятствием этой реализации.')
  x['commits']+=['a2178f3'];x['files']+=['src/components/maps/mapSource.ts','src/data/branchCoordinates.ts']
 if x['id']=='D12':
  x['change']+=' Исправлены реальные строковые/множественные категории, imageObjects, полный catalog gateway, exact-ID detail и secondary-category filtering.'
  x['verification']+=['evidence/catalog-complete-readonly.json','evidence/gateway-real-source.json','evidence/catalog-gateway.json','evidence/visual.json']
  x['blocker']='Полностью прочитаны2365 уникальных товаров: фото242, описание2, категория2, положительная цена12; все4 поля одновременно0. Не экстраполяция выборки. Общий Bazaar repo найден и изучен; данные не изменялись. Нужны утверждённый release ассортимент и модель цены, staging/org/branch mapping.'
  x['commits']+=['1291e02'];x['files']+=['scripts/server/catalog.ts','src/lib/bazaar/adapters.ts']
 if x['id']=='D09':x['verification']+=['evidence/branch-coordinates.json'];x['change']+=' Подтверждены координаты6 точек; адрес Баткена обновлён согласно текущей публичной карточке.';x['commits']+=['a2178f3']
items += [dict(id='D22',title='Недоступный товар ошибочно считался доступным',
 severity='P2',
 release_blocker=False,domain='CORE',classification='CONFIRMED CODE / regression',platform='Общий адаптер Android/iOS/web',
 preconditions='availabilityStatus=unavailable или stockQty=-1 вместе с inStock=true',
 steps='Передать ответ источника в adaptProduct.',
 expected='Явное отсутствие/неположительный остаток имеет приоритет; unavailable не совпадает с available.',
 actual='В исходном6c40f51 оба случая возвращали inStock=true.',
 cause='Substring includes(available) и проверка положительного флага раньше отрицательного остатка.',
 acceptance='Оба исходных и соседние negative-status сценарии возвращают false; положительные случаи каталога не ломаются.',
 status='FIXED & VERIFIED',
 change='Точное сравнение статусов; отрицательные сигналы проверяются первыми.',
 files=['src/lib/bazaar/adapters.ts','scripts/tests/catalog-gateway.ts'],
 verification=['evidence/D22-before.json','evidence/catalog-gateway.json','evidence/regression-suite.log'],
 commits=['1291e02'],
 blocker='',baseline='new followup'),
 dict(id='D23',title='Повтор обмена после потери ответа создавал новое списание бонусов',
 severity='P1',
 release_blocker=True,domain='LOY',classification='CONFIRMED LOCAL DB + WEB',platform='Общий клиент; runtime WEB + локальная PostgreSQL',
 preconditions='Доступны бонусы и награда; сервер создаёт заявку, ответ теряется.',
 steps='Обменять; потерять201; перезагрузить; повторить подтверждение.',
 expected='Одна операция и одна запись списания, тот же сохранённый ключ, восстановленный результат.',
 actual='Старый экран генерировал новый ключ на каждое подтверждение; воспроизведены2 заявки.',
 cause='Ключ Date.now/Math.random создавался в onPress без долговременного состояния.',
 acceptance='ПотеряACK/перезапуск/20параллельныхповторов:однаDBзаявка/ledger; подтверждённая квитанция сохраняется до явного действия; другой аккаунт её не видит; отсутствие награды после первого списания не блокирует восстановление.',
 status='FIXED & VERIFIED',
 change='Сохранённая account-scoped попытка, single-flight, повтор исходного ключа, серверный no-operation отказ, квитанция до явного подтверждения и очистка при удалении аккаунта. Ключ сохраняется при обычном выходе, чтобы возврат в тот же аккаунт не создал повтор; токен/телефон не хранятся в попытке.',
 files=['src/lib/rewards/rewardAttempt.ts','src/hooks/useProgram.ts','app/plumber/rewards.tsx','app/delete-account.tsx','scripts/server/loyalty.ts','scripts/tests/reward-attempt.ts','scripts/tests/reward-ui.mjs'],
 verification=['evidence/reward-retry.json','evidence/reward-ui.json','evidence/screenshots/reward-lost-ack.png','evidence/screenshots/reward-recovered.png'],
 commits=['615510d','9a7b421'],
 blocker='Native acceptance остаётся отдельными LOY-20/21/22 PHYSICAL критериями и не засчитан по web.',baseline='new followup')]
(R/'CLOSURE.json').write_text(json.dumps(items,ensure_ascii=False,indent=2))
lines=['# Полный реестр закрытия','', 'Все17 исходных ID и11 исходных blockers сохранены. D18–D21 перенесены с предыдущего этапа, D22–D23 добавлены здесь. Исходные actual/acceptance не переписаны для улучшения оценки.','', '|ID|Исходный blocker|Статус|Причина незакрытия|','|---|---|---|---|']
for x in items:lines.append(f"|{x['id']}|{'да' if x['release_blocker'] else 'нет'}|{x['status']}|{x.get('blocker','')}|")
for x in items:
 lines+=['',f"## {x['id']} — {x['title']}",'',f"**{x['status']}**",'',f"Исходное поведение: {x.get('actual','См. исходный реестр')}",'',f"Критерий: {x.get('acceptance','См. исходный реестр')}",'',f"Изменение: {x['change']}",'', 'Компоненты: '+', '.join('`'+f+'`' for f in x['files']), '', 'Коммиты: '+', '.join(x['commits']), '', 'Проверки: '+', '.join('['+e+']('+e+')' for e in x['verification'])]
(R/'CLOSURE.md').write_text('\n'.join(lines))
original=items[:17];summary={'original':{s:sum(x['status']==s for x in original) for s in ['FIXED & VERIFIED','IMPLEMENTED, NOT VERIFIED','BLOCKED','OPEN']},'originalBlockers':sum(x['release_blocker'] for x in original),'originalBlockersFixed':sum(x['release_blocker'] and x['status']=='FIXED & VERIFIED' for x in original),'newCount':len(items)-17,'newOpen':sum(x['status']!='FIXED & VERIFIED' for x in items[17:])}
(R/'COUNTS.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(summary)
