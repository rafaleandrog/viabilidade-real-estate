import { Router, type Request, type Response } from 'express';
import { exigirMembro, exigirEditor, exigirAprovador } from '../permissoes-estudo.js';
// ⚠️ `CAMPOS_OPERACAO` mora em `./avancado.ts`, e a direção do import é essa de
// propósito: `duplicarDadosAvancado` (lá) precisa da mesma lista para copiar as
// operações (#609), e este arquivo JÁ importa daquele — declarar a constante
// aqui e importá-la de lá fecharia um CICLO de módulos por uma lista de strings.
import {
  ancorarLinhaCusto, ancorarLinhaCustoEmFase, lerCronograma, CAMPOS_OPERACAO,
} from './avancado.js';

// Rotas de Funding (#355, item 48 da Rodada 7) — CRUD de
// `avancado_funding_operacoes`, as OPERAÇÕES de captação do estudo Avançado.
//
// Substituem as rotas de `avancado_capital_instrumentos` (modelo de 4
// instrumentos com waterfall, descartado). O modelo novo tem 3 tipos:
//
//  · `financiamento_producao` — ÚNICO por estudo (regra do autor). Decisão de
//    2026-08-12: preserva o modelo de exposição mínima/catch-up
//    retroativo/cash sweep aprovado na #405 (planilha `Incorp Individual`) —
//    NÃO a matemática de calendário/Price da planilha
//    `fluxo_investidor_FORMULAS` (ver o cabeçalho de `../../frontend/
//    funding-motor.ts`). Por isso tem 4 campos próprios que `divida` não usa
//    (`exposicao_minima`, `percentual_financiavel`,
//    `amortizar_com_caixa_disponivel`, `custo_linha_ids`) e não usa os campos
//    de calendário (`inicio_mes`/`distribuir_aporte`/`aporte_meses`/
//    `periodo_amortizacao_meses`/`periodo_carencia_meses`) — a rota aceita
//    esses campos porque o shape da tabela é único para os 3 tipos, mas o
//    motor os ignora para este tipo;
//  · `divida`                 — calendário + Price com carência, quantas o
//    usuário quiser;
//  · `equity`                 — aporte + retorno, em dois modos
//    (`permuta_financeira` = % da receita líquida mês a mês;
//     `resultado_final`    = % do resultado, pago no repasse).
//
// Diferente do modelo antigo, aqui os campos são COLUNAS, não um `config` JSON
// solto — o shape é fixo e conhecido, então dá para validar campo a campo em
// vez de só checar "é um objeto". Também não há `status`: uma operação existe
// ou não existe, e toda operação existente conta no motor (o antigo
// `status='ativo'` era um estado a mais para o usuário errar).
//
// O mês do aporte segue o mesmo padrão de âncora das linhas de Custo (#249):
// `cronograma_evento` fixo ou `fase_ancora_id`, com `inicio_mes` DERIVADO no
// servidor; só `customizado` deixa o usuário escolher o mês. Não se aplica a
// `financiamento_producao`, cuja janela vem do Cronograma diretamente no
// motor (`marcosObra`), não de `inicio_mes`.

export const rotasFunding: ReturnType<typeof Router> = Router();

// #590: exportadas para o mesmo teste de igualdade exata contra `schema.json`
// que fechou a divergência de `UNIDADES_ORCAMENTO` em avancado.ts (item 4 do
// critério de aceite — varredura de vizinhos). As três já batiam com
// `avancado_funding_operacoes` no schema; a exportação é o que torna essa
// conferência automática em vez de manual.
export const TIPOS_OPERACAO = ['financiamento_producao', 'divida', 'equity'];
export const MODOS_RETORNO = ['permuta_financeira', 'resultado_final'];
export const EVENTOS_ANCORA = ['planejamento', 'pre_lancamento', 'lancamento', 'obra', 'pos_obra', 'customizado'];


/** Campos numéricos que não fazem sentido negativos. */
const CAMPOS_NAO_NEGATIVOS = [
  'valor', 'inicio_mes', 'aporte_meses', 'taxa_anual',
  'periodo_amortizacao_meses', 'periodo_carencia_meses', 'pct_retorno',
  'exposicao_minima', 'percentual_financiavel',
  'taxa_estruturacao_pct', 'taxa_administracao_mensal', 'outros_encargos_iniciais',
];

/** Campos percentuais que não fazem sentido acima de 100 (%). */
const CAMPOS_PERCENTUAL_0_100 = ['exposicao_minima', 'percentual_financiavel', 'pct_retorno', 'taxa_estruturacao_pct'];

/** Default de `modo_retorno` — o mesmo do banco (`schema.json`) e do motor. */
const MODO_RETORNO_PADRAO = 'permuta_financeira';

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

/** Carrega o estudo e garante nível avançado (422 NIVEL_INVALIDO se preliminar). */
async function estudoAvancado(req: Request, res: Response): Promise<any | null> {
  const estudoId = parseInt(req.params.id);
  if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return null; }
  const estudo = await req.dados!.buscar('estudos', estudoId);
  if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return null; }
  if (estudo.nivel_analise !== 'avancado') {
    erro(res, 422, 'NIVEL_INVALIDO', 'Este estudo é Preliminar — o Funding existe apenas no nível Avançado');
    return null;
  }
  return estudo;
}

async function exigirLeitura(req: Request, res: Response, estudo: any): Promise<boolean> {
  const perm = await exigirMembro(req, estudo.id);
  if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo'); return false; }
  return true;
}

async function exigirEscrita(req: Request, res: Response, estudo: any): Promise<boolean> {
  const travado = estudo.status === 'aprovado' || estudo.status === 'reprovado' || estudo.status === 'arquivado';
  const perm = travado ? await exigirAprovador(req, estudo.id) : await exigirEditor(req, estudo.id);
  if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para editar este estudo'); return false; }
  return true;
}

/**
 * Validação campo a campo (pura e testável, padrão `validarAbsorcao` em
 * avancado.ts): devolve a mensagem de erro ou `null`.
 *
 * `dados` pode ser parcial (é o mesmo validador do POST e do PATCH), então
 * cada regra só dispara quando o campo veio no corpo.
 */
export function validarCamposOperacao(dados: Record<string, any>): string | null {
  if (dados.tipo !== undefined && !TIPOS_OPERACAO.includes(dados.tipo)) {
    return `tipo deve ser um de: ${TIPOS_OPERACAO.join(', ')}`;
  }
  if (dados.modo_retorno !== undefined && !MODOS_RETORNO.includes(dados.modo_retorno)) {
    return `modo_retorno deve ser um de: ${MODOS_RETORNO.join(', ')}`;
  }
  if (dados.cronograma_evento !== undefined && !EVENTOS_ANCORA.includes(dados.cronograma_evento)) {
    return `cronograma_evento deve ser um de: ${EVENTOS_ANCORA.join(', ')}`;
  }
  for (const campo of CAMPOS_NAO_NEGATIVOS) {
    if (dados[campo] === undefined || dados[campo] === null) continue;
    const v = Number(dados[campo]);
    if (!Number.isFinite(v)) return `${campo} deve ser numérico`;
    if (v < 0) return `${campo} não pode ser negativo`;
  }
  for (const campo of CAMPOS_PERCENTUAL_0_100) {
    if (dados[campo] === undefined || dados[campo] === null) continue;
    if (Number(dados[campo]) > 100) return `${campo} não pode passar de 100`;
  }
  if (dados.custo_linha_ids !== undefined && dados.custo_linha_ids !== null) {
    const lista = dados.custo_linha_ids;
    if (!Array.isArray(lista) || !lista.every((v: any) => Number.isFinite(Number(v)))) {
      return 'custo_linha_ids deve ser uma lista de números';
    }
  }
  // A carência é PARTE do período de amortização (a planilha calcula o PMT
  // sobre `amortização − carência`): carência maior zeraria a parcela e a
  // operação nunca se pagaria. Barrado aqui em vez de virar divisão por zero
  // silenciosa no motor.
  const amort = dados.periodo_amortizacao_meses;
  const carencia = dados.periodo_carencia_meses;
  if (amort !== undefined && carencia !== undefined && Number(carencia) >= Number(amort) && Number(amort) > 0) {
    return 'periodo_carencia_meses deve ser menor que periodo_amortizacao_meses';
  }
  if (dados.aporte_meses !== undefined && Number(dados.aporte_meses) < 1) {
    return 'aporte_meses deve ser pelo menos 1';
  }
  return null;
}

/**
 * Financiamento à produção é ÚNICO por estudo — exigência explícita do autor.
 * Devolve a operação conflitante, ou `null` quando pode criar/alterar.
 * `ignorarId` existe para o PATCH não conflitar consigo mesmo.
 */
export function conflitoFinanciamentoUnico<T extends Record<string, any>>(
  tipo: unknown,
  existentes: T[],
  ignorarId?: number,
): T | undefined {
  if (tipo !== 'financiamento_producao') return undefined;
  return existentes.find((o) => o.tipo === 'financiamento_producao'
    && (ignorarId === undefined || Number(o.id) !== ignorarId));
}

/**
 * Teto de `Σ pct_retorno` (#435) — a soma das participações de equity de um
 * estudo não pode passar de 100%. Devolve a mensagem de recusa, ou `null`
 * quando cabe. Puro e testável, no molde de `validarCamposOperacao` e de
 * `conflitoFinanciamentoUnico` (de onde vem o `ignorarId`).
 *
 * A regra está na spec vigente:
 * `docs/viabilidade/fluxo-investidor-formulas.md` §2, "Teto de Σ pct_retorno".
 * Ela NÃO vem da planilha `fluxo_investidor_FORMULAS`, que é fonte nula aqui
 * (tem uma operação só, `C25` é um número digitado sem soma nem validação); o
 * que a planilha dá é o denominador — `C18`/`C19` são grandezas únicas, e
 * distribuir mais de 100% delas é distribuir o que não existe.
 *
 * SÃO DUAS SOMAS INDEPENDENTES, uma por `modo_retorno`: `permuta_financeira`
 * incide sobre a Receita Líquida (`C18`) e `resultado_final` sobre o Resultado
 * Final (`C19`). Bases diferentes não competem, então 100% + 100% é válido.
 *
 * Três armadilhas, cada uma com caso de teste próprio:
 *  · `modo_retorno` tem DEFAULT (`permuta_financeira`) no banco e no motor —
 *    sem aplicá-lo aqui, uma linha gravada sem o campo escaparia das duas somas;
 *  · só `tipo === 'equity'` entra — a coluna existe para os 3 tipos, com
 *    default 0, e somar as outras contaria linha que não distribui receita;
 *  · `ignorarId` é o que faz o PATCH não contar a própria operação duas vezes.
 *    O chamador passa o estado FINAL (`{ ...atual, ...payload }`) em `novo`.
 *
 * Tolerância `> 100.01`, não `> 100` estrito: `pct_retorno` é percentual em
 * precisão plena, e `60 + 40.001` de ponto flutuante recusaria indevidamente.
 * Mesmo padrão de `erroFormularioAbsorcao` (`frontend/fluxo-shared.ts:349`) e
 * `erroFormularioPagamento` (`frontend/fluxo-pagamento-editor.ts:66`).
 */
export function somaRetornoExcede<T extends Record<string, any>>(
  existentes: T[],
  novo: Record<string, any>,
  ignorarId?: number,
): string | null {
  if (novo?.tipo !== 'equity') return null;
  const modo = String(novo.modo_retorno ?? MODO_RETORNO_PADRAO);
  const pctNovo = Number(novo.pct_retorno ?? 0);
  if (!Number.isFinite(pctNovo)) return null; // já barrado por validarCamposOperacao

  const jaUsado = existentes
    .filter((o) => o?.tipo === 'equity'
      && String(o.modo_retorno ?? MODO_RETORNO_PADRAO) === modo
      && (ignorarId === undefined || Number(o.id) !== ignorarId))
    .reduce((acc, o) => acc + (Number(o.pct_retorno) || 0), 0);

  const total = jaUsado + pctNovo;
  if (total <= 100.01) return null;

  const base = modo === 'resultado_final' ? 'do Resultado Final' : 'da Receita Líquida';
  const sobra = Math.max(0, 100 - jaUsado);
  return `As operações de Equity em "${modo}" já distribuem ${jaUsado.toFixed(2)}% ${base}; `
    + `com esta passariam a ${total.toFixed(2)}%, e o total não pode superar 100%. `
    + `Sobra ${sobra.toFixed(2)}% — reduza esta operação ou as existentes antes de salvar.`;
}

/**
 * Resolve `inicio_mes` a partir da âncora, do mesmo jeito que as linhas de
 * Custo (#249): ancorada em evento fixo ou em fase → mês DERIVADO do
 * Cronograma; `customizado` → o mês que o usuário mandou. Roda para os 3
 * tipos — em `financiamento_producao` o resultado fica gravado mas não é lido
 * pelo motor (a janela vem do Cronograma diretamente, não deste campo).
 */
async function resolverInicio(
  req: Request, estudo: any, dados: Record<string, any>, atual?: Record<string, any>,
): Promise<string | null> {
  const faseId = dados.fase_ancora_id ?? atual?.fase_ancora_id;
  if (faseId) {
    const ancora = await ancorarLinhaCustoEmFase(req, estudo.id, Number(faseId));
    if (!ancora) return 'fase_ancora_id deve ser uma fase do Cronograma deste estudo';
    dados.cronograma_evento = 'customizado';
    dados.inicio_mes = ancora.inicio_mes;
    return null;
  }
  const evento = String(dados.cronograma_evento ?? atual?.cronograma_evento ?? 'customizado');
  if (evento !== 'customizado') {
    const ancora = ancorarLinhaCusto(evento, (await lerCronograma(req, estudo)).linhas);
    if (ancora) dados.inicio_mes = ancora.inicio_mes;
  }
  return null;
}

async function listarOperacoes(req: Request, estudoId: number) {
  return req.dados!.listar('avancado_funding_operacoes', {
    filtros: { estudo_id: estudoId }, ordenar: 'ordem', ordem: 'asc', por_pagina: 200,
  });
}

// GET /estudos/:id/avancado/funding
rotasFunding.get('/estudos/:id/avancado/funding', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirLeitura(req, res, estudo))) return;
    res.json(await listarOperacoes(req, estudo.id));
  } catch (e: any) {
    console.error('Erro em GET /avancado/funding:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// POST /estudos/:id/avancado/funding
rotasFunding.post('/estudos/:id/avancado/funding', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const dados: Record<string, any> = { estudo_id: estudo.id, ordem: 0, valor: 0 };
    for (const campo of CAMPOS_OPERACAO) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (!dados.tipo) { erro(res, 400, 'TIPO_OBRIGATORIO', 'tipo é obrigatório'); return; }
    if (!dados.nome) { erro(res, 400, 'NOME_OBRIGATORIO', 'nome é obrigatório'); return; }

    const erroValidacao = validarCamposOperacao(dados);
    if (erroValidacao) { erro(res, 400, 'CAMPO_INVALIDO', erroValidacao); return; }

    const { dados: existentes } = await listarOperacoes(req, estudo.id);
    if (conflitoFinanciamentoUnico(dados.tipo, existentes)) {
      erro(res, 422, 'FINANCIAMENTO_DUPLICADO',
        'Já existe um Financiamento à produção neste estudo — só pode haver um. Use Dívida para operações adicionais.');
      return;
    }

    const erroSoma = somaRetornoExcede(existentes, dados);
    if (erroSoma) { erro(res, 422, 'RETORNO_EXCEDE_RECEITA', erroSoma); return; }

    const erroAncora = await resolverInicio(req, estudo, dados);
    if (erroAncora) { erro(res, 400, 'FASE_ANCORA_INVALIDA', erroAncora); return; }

    const criada = await req.dados!.criar('avancado_funding_operacoes', dados);
    res.status(201).json(criada);
  } catch (e: any) {
    console.error('Erro em POST /avancado/funding:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// PATCH /estudos/:id/avancado/funding/:oid
rotasFunding.patch('/estudos/:id/avancado/funding/:oid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;

    const oid = parseInt(req.params.oid);
    if (isNaN(oid)) { erro(res, 400, 'ID_INVALIDO', 'ID da operação inválido'); return; }
    const operacao = await req.dados!.buscar('avancado_funding_operacoes', oid);
    if (!operacao || Number(operacao.estudo_id) !== estudo.id) {
      erro(res, 404, 'OPERACAO_NAO_ENCONTRADA', 'Operação não encontrada neste estudo');
      return;
    }

    const dados: Record<string, any> = {};
    for (const campo of CAMPOS_OPERACAO) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }
    if (Object.keys(dados).length === 0) { erro(res, 400, 'NENHUM_CAMPO', 'Nenhum campo para atualizar'); return; }

    // Validação sobre o estado FINAL (atual + patch): senão um PATCH que manda
    // só a carência escaparia da regra carência < amortização.
    const erroValidacao = validarCamposOperacao({ ...operacao, ...dados });
    if (erroValidacao) { erro(res, 400, 'CAMPO_INVALIDO', erroValidacao); return; }

    const { dados: existentes } = await listarOperacoes(req, estudo.id);
    if (conflitoFinanciamentoUnico(dados.tipo, existentes, oid)) {
      erro(res, 422, 'FINANCIAMENTO_DUPLICADO',
        'Já existe um Financiamento à produção neste estudo — só pode haver um.');
      return;
    }

    // Estado FINAL (atual + patch), pelo mesmo motivo de `validarCamposOperacao`
    // acima: um PATCH que manda só o `nome` computaria `pct_retorno = 0` e
    // aprovaria qualquer coisa. `oid` faz a operação não se contar duas vezes.
    const erroSoma = somaRetornoExcede(existentes, { ...operacao, ...dados }, oid);
    if (erroSoma) { erro(res, 422, 'RETORNO_EXCEDE_RECEITA', erroSoma); return; }

    const erroAncora = await resolverInicio(req, estudo, dados, operacao);
    if (erroAncora) { erro(res, 400, 'FASE_ANCORA_INVALIDA', erroAncora); return; }

    const atualizado = await req.dados!.atualizar('avancado_funding_operacoes', oid, dados);
    res.json(atualizado);
  } catch (e: any) {
    console.error('Erro em PATCH /avancado/funding/:oid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// DELETE /estudos/:id/avancado/funding/:oid
rotasFunding.delete('/estudos/:id/avancado/funding/:oid', async (req: Request, res: Response) => {
  try {
    const estudo = await estudoAvancado(req, res);
    if (!estudo) return;
    if (!(await exigirEscrita(req, res, estudo))) return;
    const oid = parseInt(req.params.oid);
    if (isNaN(oid)) { erro(res, 400, 'ID_INVALIDO', 'ID da operação inválido'); return; }
    const operacao = await req.dados!.buscar('avancado_funding_operacoes', oid);
    if (!operacao || Number(operacao.estudo_id) !== estudo.id) {
      erro(res, 404, 'OPERACAO_NAO_ENCONTRADA', 'Operação não encontrada neste estudo');
      return;
    }
    await req.dados!.deletar('avancado_funding_operacoes', oid);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /avancado/funding/:oid:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});
