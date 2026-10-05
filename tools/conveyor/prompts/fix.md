Доопрацюй PR #{{pr}} «{{title}}» ({{url}}), гілка `{{branch}}`.

Що треба виправити:
{{reasons}}

1. Перейди на гілку PR. Якщо це твій PR і ти вже на цій гілці, зроби `git pull`. Інакше: `git fetch origin {{branch}} && git checkout --detach FETCH_HEAD`, а пуш потім робиться як `git push origin HEAD:{{branch}}`.
2. Конфлікт із `main`: `git fetch origin main && git merge origin/main`. Розв'яжи конфлікти так, щоб збереглися зміни обох сторін.
3. Червоний CI: подивись `gh pr checks {{pr}}` і лог падіння `gh run view <id> --log-failed`.
4. Зауваження рев'ю: `gh pr view {{pr}} --comments`, останній коментар із `conveyor-review`. Виправ кожне зауваження, з яким згоден; з яким не згоден — поясни це коментарем у PR.
5. Перевір зміни за AGENTS.md (збірка, тести) і запуш у ту саму гілку `{{branch}}`. Коротко відпиши в PR (`gh pr comment {{pr}}`), що виправлено.
6. PR не мерджи: це зробить конвеєр після рев'ю. Коли запушив виправлення, заверши роботу.
