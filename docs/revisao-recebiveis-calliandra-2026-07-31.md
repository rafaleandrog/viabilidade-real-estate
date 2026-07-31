# Revisão de recebíveis por safras — referência Calliandra — 2026-07-31

**Sessão:** revisão documental dos recebíveis (documental e diagnóstica)
**Branch:** `claude/cashflow-formulas-rules-km5538` · **Commit-base:** `519bfbf`
**Escopo:** documentação. **Nenhuma linha de runtime, schema, migração ou teste foi alterada.**

---

## 1. Objetivo

Integrar as versões revisadas dos dois documentos EVI e registrar a conclusão que elas trazem sobre
o comportamento das receitas:

> **Cada mês de contratação cria uma safra própria.** O caixa mensal é a soma dos pagamentos
> imediatos das vendas do mês com as parcelas e liquidações de todas as safras anteriores ainda
> ativas.

A revisão **corrige uma premissa que estava escrita no repositório** e já havia sido copiada para o
corpo de uma issue aberta. Ver §8.

## 2. Fontes utilizadas

| Fonte | Papel | Estado |
|---|---|---|
| `inteligencia-evi-incorporacao.md` (versão revisada, fornecida pelo autor) | Significado econômico | Integrado em `docs/viabilidade/` |
| `padrao-incorporacao.md` (versão revisada, fornecida pelo autor) | Dinâmica funcional | Integrado em `docs/viabilidade/` |
| `20250820_EV_Calliandra_rg_1.xlsx` | EVI real — modelo de **prazo fixo por safra** | **Não versionado.** Conferido aba a aba nesta sessão |
| Segundo EVI de Calliandra (**até Obra + repasse**) | Origem dos valores do cenário G.2 | **Não fornecido nesta sessão.** Inputs reconstruídos e conferidos — ver §9.2 |
| `frontend/fluxo-caixa-motor.ts`, `frontend/fluxo-shared.ts` | Comportamento instalado | Lido, não alterado |

Os arquivos `.xlsx` **não foram adicionados ao repositório**. Ficam registrados aqui apenas o nome,
a aba, a coluna e os valores reconciliados.

## 3. Conclusão central sobre safras

A chave econômica mínima do recebível é:

```text
Grupo × alocação × mês da contratação × componente de pagamento
```

Não existe "uma curva de caixa aplicada ao VGV total". O motor-alvo precisa manter, por safra:
valor bruto, desconto, valor líquido, sinal, principal, taxa, primeiro vencimento, prazo ou marco,
parcela e saldo.

```text
receita_t
= pagamentos imediatos das vendas de t
+ Σ pagamentos das safras anteriores e atuais com vencimento em t
```

## 4. As três regras temporais e a diferença entre elas

| Regra | Prazo | Primeira parcela | Encerramento |
|---|---|---|---|
| **Prazo fixo** | `N` fixo, igual para toda safra | `s + 1` | `s + N` — varia com o mês da venda |
| **Até marco** | `N_s = M − s` — varia com o mês da venda | `s + 1` | `M` — igual para toda safra |
| **Concentrado em marco** | — | — | mês único do marco (repasse: 1º mês Após-chaves) |

Consequência prática: em **prazo fixo**, a venda tardia paga tanto quanto a antiga, só termina
depois. Em **até marco**, a venda tardia tem menos parcelas e **parcela maior**. São regras
distintas; tratar a tabela longa como um único modelo apaga essa diferença.

Se `N_s ≤ 0`, a configuração deve ser bloqueada ou convertida explicitamente em pagamento imediato
ou concentrado. O motor não pode criar prazo negativo.

## 5. Convenção do primeiro vencimento

```text
mês da contratação → somente pagamentos imediatos
                     (à vista, entrada, sinal, parcela no ato explícita)

mês seguinte       → primeira parcela recorrente
```

Uma parcela no próprio mês precisa ser **explícita**. O mês da contratação **não** é, por padrão,
um período de juros completo — a incidência de juros no mês da venda é parâmetro configurável, com
default falso.

Essa convenção foi confirmada numericamente contra a planilha (§9.1), não presumida.

## 6. Identidade bruto − descontos + juros

```text
valor contratado líquido = valor bruto contratado − descontos comerciais
```

```text
Receita Bruta = valor contratado líquido acumulado + juros recebidos acumulados
Receita Bruta = valor bruto contratado − descontos + juros
```

O desconto comercial reduz a base **antes** da formação do recebível e **antes** dos juros.
Reconciliar Receita Bruta contra o valor bruto de tabela, sem descontar os abatimentos, produz uma
divergência que parece erro de juros.

## 7. Recorrência correta de carteira

Para componente com primeira parcela no mês seguinte:

```text
saldo_s,s = principal_s

juros_s,t = saldo_s,t-1 × taxa
saldo_s,t = saldo_s,t-1 + juros_s,t − pagamento_s,t
```

Cada safra zera no último vencimento; a última parcela pode absorver resíduo imaterial dentro da
tolerância. Nenhum saldo pode ser negativo e nenhum pode voltar a crescer depois do encerramento.

A carteira total é a **soma dos saldos por safra e componente** — nunca uma recorrência agregada
sobre um saldo único.

## 8. Limitações do arquivo Urbitá como referência

O fluxo de recebimentos de Urbitá **acumula corretamente** parcelas de safras anteriores; nessa
parte ele é referência válida de sobreposição.

As fórmulas de **carteira** do mesmo arquivo, porém, não representam saldo econômico real: a
carteira longa pode ficar negativa, a curta pode manter resíduo e voltar a crescer depois da última
parcela, e a total é contaminada por esses saldos.

**Não copiar fórmula de carteira do Urbitá.** A carteira precisa ser derivada da recorrência da §7.

## 9. Cenários dourados — reconciliação executada

### 9.1 Calliandra prazo fixo — bate exatamente

Fonte: `20250820_EV_Calliandra_rg_1.xlsx`, aba `Fluxo`, coluna `Receita Total (VGV)`.

| Mês | Documento | Planilha |
|---:|---:|---:|
| 1 | 878.539,92 | 878.539,92 |
| 2 | 914.119,61 | 914.119,61 |
| 3 | 949.699,31 | 949.699,31 |
| 4 | 985.279,01 | 985.279,01 |
| 13 | 355.796,98 | 355.796,98 |
| 38 | 344.737,04 | 344.737,04 |
| 49 | 245.197,58 | 245.197,58 |
| 122 | 220.677,83 | 220.677,83 |
| 132 | 18.389,82 | 18.389,82 |
| 133 | 0,00 | 0,00 |

A mecânica foi reproduzida **por construção**, não por cópia:

```text
taxa mensal = 1,15^(1/12) − 1 = 1,1714917% a.m.

à vista mês 1  = 20% × (1 − 5%) × 2.860.111,52 = 543.421,19
sinal curta    = 13,3% × 15% × 2.860.111,52    =  57.059,22
PMT curta (safra de pré-lançamento)
               = PMT(1,1714917%; 36; 13,3% × 85% × 2.860.111,52) = 11.059,94
PMT curta (safra de lançamento)
               = PMT(1,1714917%; 36; 13,3% × 85% × 2.145.083,64) =  8.294,95

mês 13 (curta) = 4 × 11.059,94 + 8 × 8.294,95 = 110.599,40 ✓
```

O degrau do mês 133 confirma o encerramento da última safra longa em `s + 120`, com `s = 12`.

**A convenção `s + 1` do documento é a da planilha.** O mês 2 contém sinal da safra 2 **mais** a
primeira parcela da safra 1 — não há parcela da safra 1 no mês 1.

### 9.2 Calliandra até Obra + repasse — inputs reconstruídos

O segundo arquivo não foi fornecido nesta sessão; os valores esperados não são reproduzíveis a
partir do `rg_1`. Os inputs faltantes foram reconstruídos por engenharia reversa a partir dos
próprios valores esperados e **fecham**:

```text
base contratada total = R$ 28.547.740,29
distribuição          = uniforme, R$ 2.378.978,36 por mês, meses 1 a 12
componentes           = 15% entrada · 15% parcelas (s+1 até 24) · 70% repasse (mês 25)
taxa                  = zero
```

| Conferência | Cálculo | Resultado | Documento |
|---|---|---:|---:|
| Mês 1 | `15% × 2.378.978,36` | 356.846,75 | 356.846,75 |
| Meses 13–24 | `15% × 2.378.978,36 × Σ 1/(24−s)` | 254.937 | 254.936,38 |
| Mês 25 | `70% × 28.547.740,29` | 19.983.418,20 | 19.983.418,20 |

A progressão dos meses 2 e 3 confirma o prazo decrescente: a diferença mês 1 → 2 é `p·V/23` e a
diferença mês 2 → 3 é `p·V/22`, na razão exata 23/22. Isso prova `N_s = 24 − s` e primeira parcela
em `s + 1`.

**A curva de absorção deste cenário é diferente da do G.1** — uniforme em 12 meses, contra
40% em 4 meses + 60% em 8. Os dois cenários não compartilham base nem curva.

### 9.3 Por que os inputs entraram nos documentos

Sem base contratada e curva de absorção, os valores esperados dos dois cenários são **números sem
premissa** — a fixture de EVI-001 / #220, que é o portão da Rodada 5 inteira, não seria
construível. Os inputs verificados acima foram acrescentados ao Anexo G do padrão funcional e à §11
da inteligência EVI.

### 9.4 A quarta modalidade do cenário G.1

A linha agregada `Vendas Contratadas` **inclui** a `Venda Casas`, que corresponde a **1 de 53
lotes** (1 ÷ 53 = 1,8868%) e tem regra própria: **240 parcelas com 30% de sinal**. Essa regra existe
nas premissas do estudo, mas **não foi levada para as colunas de receita do fluxo**.

Portanto as três modalidades representadas somam **98,1132%**, não 100%. A fixture precisa isolar a
base das três ou modelar a quarta regra — **não force um fechamento artificial**.

### 9.5 Origem das referências

Calliandra é um **loteamento**. O que se importa é a mecânica econômica dos recebíveis — safra,
sinal, primeiro vencimento, PMT, marco e liquidação concentrada —, que independe do tipo de
empreendimento. Produto, tipologia, custo e estrutura de obra **não** são importados. A fixture de
Incorporação reproduz a mecânica com tipologias e Grupos próprios.

## 10. Mapa de impacto nas issues #220–#241

Nenhuma issue foi aberta, fechada, editada ou comentada nesta sessão. As emendas propostas estão em
`docs/issues-evi-propostas-2026-07-31.md`, seção **Emendas pendentes de aprovação**.

| Issue | Natureza da emenda |
|---|---|
| **#220 / EVI-001** | Dois cenários dourados, com os inputs da §9. A base das três modalidades não fecha 100% |
| **#227 / EVI-008** | Acrescentar valor bruto, desconto comercial, valor líquido e base única de corretagem |
| **#229 / EVI-009** | Taxonomia com oito grandezas, incluindo descontos, principal e juros |
| **#230 / EVI-010** | Contrato por **componentes** (imediato, prazo fixo, até marco, concentrado), não por rótulos rígidos |
| **#231 / EVI-011** | Horizonte derivado de **todos** os componentes e **todas** as safras |
| **#232 / EVI-012** | Generalizar para prazo fixo por safra — curta de 36 e longa de 120 |
| **#233 / EVI-013** | **Correção de premissa.** Primeira parcela em `s + 1`, `N_s = M − s`, erro quando `N_s ≤ 0` |
| **#234 / EVI-014** | Repasse como pagamento concentrado, taxa zero ou positiva, convenção de juros explícita |
| **#236 / EVI-016** | Saldos por safra e componente, sem recorrência agregada |
| **#237 / EVI-017** | `Receita Bruta = líquido + juros` e `= bruto − descontos + juros` |
| **#240 / EVI-020** | Invariantes por safra e primeira divergência por linha, safra e mês |
| **#241 / EVI-021** | Linhas de bruto, desconto, líquido, componentes, principal, juros e carteira |

**A #233 é o caso grave.** Seu corpo atual afirma, no critério de aceite, que *"a 1ª parcela ocorre
no mês da venda"* — exatamente a premissa que esta revisão derruba. Implementá-la com o corpo atual
produz a regra errada com aparência de aderência ao documento.

**Ordens não negociáveis permanecem:** #220/#221 antes de qualquer M2 · #231 antes de #232/#233 ·
#228 antes de #237, #238 e #239. O total continua **22 issues**, todas abertas, **nenhuma
implementada**.

## 11. Emendas que a spec precisaria receber

`docs/spec/estudo-de-viabilidade-spec.md` **não foi alterada** nesta sessão. Ela é fonte normativa e
exige aprovação própria. As emendas que precisaria receber, quando o autor aprovar:

1. **Componentes de pagamento** — substituir a descrição por rótulo comercial (à vista / curta /
   longa) pelo contrato de quatro regras econômicas, com os campos mínimos: participação, sinal,
   prazo ou marco, defasagem do primeiro vencimento, periodicidade, taxa, juros no mês da
   contratação e regra de fechamento.
2. **Primeiro vencimento** — declarar `s + 1` como padrão normativo e a parcela no ato como exceção
   explícita.
3. **Contratação em três séries** — valor bruto, desconto comercial e valor líquido, abertas por
   mês, Grupo e tipologia.
4. **Receita Bruta** — definir como soma dos recebimentos, com a identidade da §6 como invariante de
   fechamento.
5. **Safra e carteira** — introduzir a safra como unidade financeira elementar e a recorrência da
   §7 como regra de saldo.
6. **Horizonte** — derivar de todos os vencimentos, proibindo o empilhamento de excedente no último
   mês.

## 12. Itens que permanecem fora de escopo

Fora do escopo **desta sessão**: qualquer alteração de runtime, schema, migração, teste, interface,
rota, manifesto ou `versao`; abrir, fechar, editar ou comentar issues no GitHub; alterar a
`docs/spec/estudo-de-viabilidade-spec.md`; alterar a contagem da Rodada 5.

Fora do backlog **por decisão do autor** (inalterado): redesenho do cadastro de permuta física,
unidade individual por apartamento, colunas fixas por Grupo/tipologia, datas próprias de Grupo,
renomeação interna de `avancado_fases`/`fase_id`, normalização automática de absorção e pagamento em
tabelas, antecipação de repasse, vendas "nas chaves", inadimplência, distratos, securitização e
curvas de absorção por tipologia.

## 13. Declaração

Nenhuma linha de runtime foi alterada. `frontend/`, `backend/`, `schema.json`, `migracoes/` e
`manifesto.json` estão intactos. Não há migração nesta sessão e a `versao` do manifesto **não** foi
bumpada — a regra da plataforma é que `z` só sobe quando há migração nova.

As decisões do autor registradas no Anexo F do padrão funcional continuam vigentes. A mudança de
entendimento sobre #190/#191 **não autoriza alteração direta**: ela exige atualização do corpo da
issue, fixture dourada, inventário de impacto em estudos existentes, implementação isolada e
comparação de resultados antes e depois.

## Veja também

- `docs/rodada-5-evi-2026-07-31.md` — matriz de aderência, com a §2.1 *Revisão de recebíveis por safras — Calliandra*
- `docs/issues-evi-propostas-2026-07-31.md` — corpos das issues e as *Emendas pendentes de aprovação*
- `docs/viabilidade/padrao-incorporacao.md` — Anexo G, cenários dourados com os inputs
- `docs/viabilidade/inteligencia-evi-incorporacao.md` — §11, cenários de referência
