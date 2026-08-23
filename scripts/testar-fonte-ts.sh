#!/bin/bash
# Bateria do lexer compartilhado `scripts/lib/fonte-ts.mjs`.
#
# Ele e o unico lugar onde os tres guards de UI decidem fronteira de comentario,
# string, template e `${…}`. Essa e a vantagem — um lugar para consertar — e o
# risco: um erro aqui erra nos tres de uma vez, e em silencio.
#
# Roda sem credencial, sem rede e sem SDK: so `node`.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
exec node --test --test-timeout=60000 scripts/lib/fonte-ts.test.mjs
