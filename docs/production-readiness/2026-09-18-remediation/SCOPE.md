# Методика и изменение охвата

Baseline:147 строк,7 N/A. Все исходные ID, expected, weight и веса 12 направлений сохранены. Нативные физические проверки не заменены web/симуляцией. PASS означает только метод своей строки; отдельные release blockers остаются самостоятельными gates.

`CRITERIA_COMPARABLE.csv` / `SCORES_COMPARABLE.json` дают сопоставимый результат на исходных 147 строках и исходной применимости. Основные CRITERIA/SCORES включают151 строку: CORE-NA3 стал применимым, добавлены4 BLOCKED внешних/incident gate. Сложные проверки не удалены. Новые defects D18–D21 не переименовывают D01–D17.

Формулы и веса неизменны: readiness=PASS weight/all applicable weight; coverage=(PASS+FAIL) weight/all applicable weight. BLOCKED и NOT TESTED остаются в знаменателе. Результат направления взвешивается исходным domain weight; Android/iOS используют ту же фильтрацию SHARED+platform, что baseline. Округление только для отображения. UI остаётся0%: код и web-снимки не закрывают требуемые physical release критерии.

`recalculate.py` заново строит обе оценки из неизменного baseline и проверяет наличие evidence файлов, `calculate.py` — неизменная копия исходного калькулятора. Содержание доказательств и границы PASS описаны в TEST_RUN и каждой строке.
