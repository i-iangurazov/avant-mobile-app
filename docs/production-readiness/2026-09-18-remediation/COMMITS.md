# Коммиты изолированной ветки

Ветка `fix/production-readiness-20260918`. Первый snapshot c88450a сохраняет чужую незакоммиченную работу и baseline; не считать его исправлением. Финальная документация будет отдельным коммитом после этой проверенной последовательности. Продуктовая сборка5b8ea84; последующие test/docs изменения не меняют bundle.

- `c88450a` chore: preserve audited working tree before remediation
- `ae18b5e` fix(auth): require bound phone proofs and database-backed sessions
- `e5d6644` fix(orders): validate server offers and recover idempotent checkout
- `d969620` fix(loyalty): paginate the ledger and serialize balance mutations
- `207877c` feat(account): add verified deletion and versioned document consent
- `8f9d7d7` fix(security): audit administrator grants and bind deletion consent
- `f118336` fix(client): serialize cart updates and sort complete catalog pages
- `05eea73` fix(ui): unify selectors and correct map links and readable states
- `1640709` build: harden release configuration and pin verified dependencies
- `ce3107f` fix(android): remove unused biometric and vibration permissions
- `a135f73` fix: complete account erasure and reject ambiguous tokens
- `5b8ea84` fix(ui): complete Russian quantity and experience labels
- `0d8e474` test: verify auth orders deletion and release recovery end to end
