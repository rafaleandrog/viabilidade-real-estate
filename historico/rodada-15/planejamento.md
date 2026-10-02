# Rodada 15 — conferência EVI Urbitá: fila de PRs e orquestração em sessões filhas

> Plano aprovado pelo autor em modo de planejamento (2026-10-01), a partir do fechamento do
> registro da conferência de QA da EVI Urbitá (índice: issue #800). Fotografia datada: descreve a
> fila prevista e as decisões no momento da abertura; o estado corrente de cada PR está no
> `PROGRESSO.md`, no #800 e na tabela de rodadas do `CLAUDE.md`.
>
> **Encerrada em 2026-10-02.** As 14 issues da fila fecharam por 13 PRs mergeados; o placar, os
> desvios do plano (sessões 11 e 12 fundidas; ordem de merge alterada por decisão do autor) e o que
> ficou para o autor estão na seção de 2026-10-02 do `PROGRESSO.md` e na linha da Rodada 15 do
> `CLAUDE.md`. O resto deste arquivo é a fotografia da abertura e envelhece de propósito.

## Contexto

Dois estudos de Incorporação (14 Preliminar, 15 Avançado) foram montados na Pinguim com as
entradas da planilha `20260925_EVI_Urbit_.xlsx` e conferidos contra ela. Os motores estão certos
onde foram medidos (pontes de FC livre e de Resultado fecham em R$ 0,00; financiamento à produção
bate). O que sobrou virou **14 issues**: 7 defeitos de borda (#749, #789, #790, #791, #793, #801,
#802), 6 decisões (#792, #794, #795, #796, #797, #799) e 1 melhoria (#798) — mais a #726, decisão
antiga do mesmo motor, incorporada à fila. O #800 é o índice, com a ordem de trabalho, os achados
retirados e a cobertura pendente (Loteamento).

O que a rodada muda em relação às anteriores: **a execução é em sessões filhas** (Claude Code na
nuvem, uma por PR, Sonnet 5.5 ou Opus 5.5 conforme o risco), orquestradas por uma sessão que não
escreve código de produto — ela cria as filhas, acompanha os PRs, confere o estado antes de pedir
o merge e avança a fila. A revisão continua em duas camadas por PR: o App do Codex
(`@codex review`) e a fan-out da skill `revisar-pr-apps`, cujo motor é medido por smoke no começo de
cada sessão — nunca presumido: o motor que o ambiente da rodada permite está medido na seção de
riscos, abaixo.

## Decisões do autor (01/10/2026, registradas em comentário em cada issue)

| Issue | Decisão |
|---|---|
| #792 | (b) backend e invariantes alinhados ao motor: permutadas ⊆ alocadas |
| #794 | (a) manter a convenção do app; documentar a divergência da EVI de 25/09 |
| #795 | implementar itens 1 (base "receita recebida") e 3 (Projetos sobre construção); manter 2 e 4 |
| #796 | (a) categoria canônica "Manutenção pós-obra" |
| #797 | (a) manter e documentar as equivalências; KPI "exposição após funding" opcional |
| #798 | desenho aprovado: janela das chaves 1–12 meses (default 12) e "mês único" por grupo |
| #799 | (a) manter; documentar as duas linhas ausentes e a convenção de 1 unidade |
| #726 | (a) alargar o fator de `custo_obras` à decoração |
| PR #751 (fork) | refazer em PR próprio, junto da #789, citando-o |
| estudo 15 | fica como está; um gêmeo congelado (estado de 30/09) vira a referência; linha 78 apagada |
| Loteamento | criar Preliminar e Avançado e conferir pelas regras do app (sem planilha) |
| merge | **do autor**, PR a PR; a orquestradora pede, não mergeia |

## Fila de PRs

Um assunto por PR (R3). **Merge estritamente serial.** Até duas sessões **desenvolvem** em
paralelo, em arquivos de produto disjuntos — mas nenhum par de PRs é disjunto de verdade, porque
todo PR prepende uma seção no `PROGRESSO.md` (armadilha 10 do `CLAUDE.md`). A estratégia para
esse arquivo é declarada, não presumida: o `.gitattributes` tem `PROGRESSO.md merge=union`, e o
segundo PR de cada onda, depois do primeiro merge, **sempre** sincroniza com `origin/main` (merge
para dentro, commit "sincroniza com origin/main", sem citar issue — armadilha 6); isso move o head,
então CI e uma rodada de revisão repetem antes de ele ser mergeável — a fan-out das lentes
**calibrada pelo delta** pela tabela da §8 da skill (um merge da `main` não é "delta escopado aos
achados": a sessão anuncia o motivo da calibragem que escolher), e o `@codex review` **inteiro**,
que nunca decai; o commit de sincronização não é conserto de achado, é só o que move o head. E o `union` troca conflito
ruidoso por falha calada: depois de **toda** sincronização, quem sincronizou confere o
`PROGRESSO.md` pelas três medidas da armadilha 10 — seções da base + 1, zero títulos duplicados,
zero marcadores residuais — e a orquestradora repete a conferência antes de pedir o merge. É o preço do paralelismo de desenvolvimento, e ele é pago pelo segundo PR, nunca pelo
primeiro.

| # | Sessão | Issues | Escopo | Modelo | Depende de |
|---|---|---|---|---|---|
| 0 | esta | — | este plano, `CLAUDE.md`, `PROGRESSO.md` | — | — |
| 1 | `[viab - 1]` | #790 | `n(taxaDescontoAa) \|\| 12` → teste de ausência; conferir a tela de Financeiro — **entregue: PR 804, já na `main`** | Sonnet 5.5 | — |
| 5 | `[viab - 5]` | #793 | `coagirNumericosDeclarados` nas escritas de tipologias, custos, funding, cenários — **entregue: PR 805, mergeado em 01/10** | Sonnet 5.5 | — |
| 2 | `[viab - 2]` | #789 + #749 | `carteiraSaldoSafra` lê a parcela do mês da safra; `validarSafrasReceita` sem `break` que mascara; porta os dois consertos do #751 (`VENDA_BRUTA` pela série do motor; `CARTEIRA_RESSURGE` isenta `concentrado`) com caso `COMPONENTES_EVI` | Opus 5.5 | 1 (já na `main`) |
| 6 | `[viab - 6]` | #802 | semeadura idempotente: guarda no servidor (get-or-create nas obrigatórias) + single-flight e reconsulta na UI; sem índice único | Opus 5.5 | 5 (já na `main`) |
| 3 | `[viab - 3]` | #801 | `validarFunding`: equity sem retorno não excede receita negativa | Sonnet 5.5 | 2 |
| 4 | `[viab - 4]` | #791 | `validarFluxoPagamento` exige `sinalPct`/`defasagemMeses`/`descontoPct`; `Math.max(mesPagamento, safra)` nos chamadores de `pagamentosConcentrado`; inventário #464 antes | Opus 5.5 | 2, 6 |
| 7 | `[viab - 7]` | #792 | permuta física: `saldoTipologiaNoEstudo`, `validarProduto`, `validarPermutaFisica`; testes 2 e 4 ajustados a (b) | Opus 5.5 | 4 |
| 8 | `[viab - 8]` | #726 | fator de `custo_obras` alcança `decoracao`; identidade testada | Sonnet 5.5 | — |
| 9 | `[viab - 9]` | #796 | categoria "Manutenção pós-obra" no catálogo e bucket na Proforma | Sonnet 5.5 | — |
| 10 | `[viab - 10]` | #794 (a) + #797 (a) + #799 (a) | PR de documentação: `docs/avancado.md`, `docs/formulas.md`, `docs/preliminar.md`, nota no golden | Sonnet 5.5 | 2 |
| 11 | `[viab - 11]` | #795 item 3 | Projetos sobre o custo de construção (Avançado e Preliminar) | Opus 5.5 | 8 |
| 12 | `[viab - 12]` | #795 item 1 | unidade `pct_recebido`; `schema.json` (+ migração e bump se exigir) | Opus 5.5 | 11 |
| 13 | `[viab - 13]` | #798 | janela das chaves configurável e mês único por grupo | Opus 5.5 | 2, 4 |
| QA | `[viab - QA]` | #800 | ambiente `QA Apps`: gêmeo do estudo 15, limpeza da linha 78, reconferência do #789 após o PR 2, estudos de Loteamento, `conferir-estudo.ts` | Sonnet 5.5 | credencial de QA |

Ondas: **1** = PRs 1 e 5 (os dois já mergeados) · **2** = 2 e 6 · **3** = 3 e 4 · **4** = 7 e 8 · **5** = 9 e 10 · **6** = 11
e 13 · **7** = 12 (depende do 11). A sessão de QA corre em paralelo e só escreve na instância com
autorização na conversa.

## O que cada sessão filha recebe e devolve

Recebe um prompt autocontido: a issue (ou issues) com os critérios de aceite, o nome da branch,
as regras do `CLAUDE.md` que o CI cobra (branch de `origin/main` com `--unset-upstream`; push com
nome explícito; `validar-frontend.sh` sempre e `validar-backend.sh` se tocar backend, `schema.json`
ou migração; prova de fiação; guia em `docs/` no mesmo PR; `versao` só bumpa com migração; corpo
do PR em arquivo e `preflight-pr.mjs --titulo`; `Closes #N` em inglês só com todos os critérios
cumpridos; depois de sincronizar com a `main`, o `PROGRESSO.md` conferido pelas três medidas da
armadilha 10), a sequência de revisão (acionar `@codex review` antes de despachar a fan-out; rodadas
até zero bloqueantes; os dois canais do Codex lidos na mesma passada) e a proibição de mergear.

Devolve à orquestradora, por mensagem entre sessões, uma linha fixa: `head`, link do PR, placar
da última rodada, o que ficou aberto. A orquestradora confere, antes de pedir o merge ao autor: PR
mergeável, check runs posteriores ao último commit da `main`, `revisao/bloqueantes` verde, issue
com `Closes` só se os critérios estiverem cumpridos, e — num PR que sincronizou com a `main` — o
`PROGRESSO.md` do head pelas três medidas da armadilha 10 (seções da base + 1, zero títulos
duplicados, zero marcadores residuais). Depois do merge, confere que a issue fechou e
manda a próxima sincronizar.

## Fora da rodada, com motivo

- **#794 (b)**, alinhar o motor à EVI de 25/09: muda número publicado em todo estudo com repasse a
  juros; só entra se o autor confirmar que a planilha de 25/09 é a verdade.
- **Índice único em `avancado_linhas_custo`** (#802): quebraria as duplicatas legadas e a 2ª linha
  legítima de "Preço" com subcategoria (#444); a guarda fica no servidor e na UI.
- **#795 itens 2 e 4**: mantidos e documentados por decisão do autor. **#797 (b)** (acrescentar KPIs e
  séries) não foi adotada: fica a (a), manter e documentar.
- **Taxa de juros por grupo** (#585): decidida antes, fora da #798.

## Riscos declarados

- **Estudo 15 mudou depois da conferência** (01/10, pela tela). As medições das issues são do
  estado de 30/09; a referência passa a ser o gêmeo congelado, criado pela sessão de QA. Enquanto
  ele não existir, o PR 2 prova o conserto pelos testes e pelo caso `COMPONENTES_EVI`, não pela
  instância.
- **Sessão filha herda o modo de permissão da orquestradora.** Modo que pergunta trava a filha na
  primeira permissão, sem humano para responder — a orquestradora confere o modo antes de criar.
- **Duas sessões no mesmo arquivo** é a armadilha que a fila serial evita: a orquestradora só
  libera uma onda quando os arquivos de produto das duas são disjuntos, e nunca duas na mesma
  branch. O `PROGRESSO.md` é a exceção conhecida, tratada acima.
- **A revisão depende de dois motores externos, e os dois são medidos, não presumidos.** O App do
  Codex (`@codex review`) respondeu no PR de abertura desta rodada, mas as Rodadas 13 e 14
  registram cota esgotada no meio da fila; App mudo no teto de 15 min vira `bloqueantes=1`
  (`CLAUDE.md` § A revisão em si). A fan-out: no ambiente de nuvem em que a rodada abriu, o CLI do
  Codex está ausente e o `kimi` não alcança `api.moonshot.ai` (403 no CONNECT do proxy de saída —
  credencial e variáveis presentes e corretas; a política de rede do ambiente é que não libera o
  host). Enquanto isso valer, a fan-out roda no motor nativo, declarado como menos adversarial em
  cada relatório; liberado o host, as sessões voltam ao Kimi pelo smoke do preflight.
