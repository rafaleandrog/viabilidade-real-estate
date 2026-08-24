// Invariantes e relatório de reconciliação do Fluxo de Caixa (#240 / EVI-020
// + emenda Calliandra, 2026-08-01). Módulo puro de VALIDAÇÃO da saída do
// motor — não altera nenhum cálculo, só verifica se os resultados fecham.
// Sem DOM, coberto por testes unitários (fluxo-invariantes.test.ts).
//
// Duas camadas:
//  1. Invariantes do fluxo consolidado (`FluxoCalc`) em produção. A #283 liga
//     safras e juros ao cálculo real: `receitaBruta` deve ser exatamente a
//     venda líquida contratada mais os juros recebidos (#237).
//  2. Invariantes do motor de safras/componentes (#232-#237): já existe como
//     funções puras testadas (`fluxo-caixa-motor.ts`) mas ainda não é
//     consumido pela tela — a emenda da #240 pede exatamente as quatro
//     checagens abaixo, e o corpo original autoriza "começar
//     incrementalmente antes de todas [as dependências] fecharem".
//  3. Reconciliação da permuta física por tipologia (#269, sub-issue final
//     do epic #258): a quantidade permutada declarada nas linhas de custo
//     `Preço/Permuta física` (#266/#267) nunca pode exceder a quantidade
//     total da tipologia no catálogo — sem essa checagem, um estudo pode
//     "entregar" mais unidades do que produziu sem nenhum aviso.

import type { FluxoCalc, ComponentePagamento } from './fluxo-caixa-motor.js';
import {
  carteiraSaldoSafra, componentesEfetivosSafra, componentesPagamento,
  vendaLiquidaContratadaMensal,
} from './fluxo-caixa-motor.js';
import {
  absorcaoMensal, ePermutaFisica, fimJanelaAbsorcao, pctAbsorcaoEfetivo,
  type AbsorcaoMensal, type EventoCrono,
} from './fluxo-shared.js';
import type { FundingCalc } from './funding-motor.js';

export type Severidade = 'erro' | 'alerta';

/**
 * Uma divergência entre o valor ESPERADO (pela regra) e o ENCONTRADO (na
 * saída do motor). `linha`/`safra`/`mes` identificam onde, quando fizer
 * sentido — "as mensagens identificam linha e mês" (critério de aceite).
 */
export interface Divergencia {
  codigo: string;
  severidade: Severidade;
  linha?: string;
  safra?: number;
  mes?: number;
  esperado: number;
  encontrado: number;
  diferenca: number;
  mensagem: string;
}

/** #260/C7: valor monetário de fórmula tem 2 casas — 1 centavo de tolerância. */
export const TOLERANCIA_PADRAO = 0.01;

/**
 * Invariante de receita do fluxo consolidado: Receita Bruta = venda líquida
 * contratada + juros (#237/#283). Qualquer divergência é erro de implementação.
 */
export function validarFluxoCalc(r: FluxoCalc, tol: number = TOLERANCIA_PADRAO): Divergencia[] {
  const out: Divergencia[] = [];
  const liquidoEsperado = r.vendaBrutaContratada - r.descontoComercial;
  if (Math.abs(liquidoEsperado - r.vendaLiquidaContratada) > tol) {
    out.push({
      codigo: 'CONTRATACAO_NAO_RECONCILIA', severidade: 'erro',
      esperado: liquidoEsperado, encontrado: r.vendaLiquidaContratada,
      diferenca: r.vendaLiquidaContratada - liquidoEsperado,
      mensagem: 'Contratação líquida não bate com contratação bruta menos descontos.',
    });
  }
  const esperado = r.vendaLiquidaContratada + (r.jurosClientes ?? 0);
  const encontrado = r.receitaBruta;
  if (Math.abs(esperado - encontrado) > tol) {
    out.push({
      codigo: 'RECEITA_BRUTA_NAO_CONSERVA',
      severidade: 'erro',
      esperado, encontrado, diferenca: encontrado - esperado,
      mensagem: `Receita Bruta (${encontrado}) não bate com contratação líquida + juros (${esperado}).`,
    });
  }

  const bruto = r.receitaBrutaMensal ?? [];
  const totalMensal = bruto.reduce((s, v) => s + Number(v ?? 0), 0);
  if (Math.abs(totalMensal - r.receitaBruta) > tol) {
    out.push({
      codigo: 'RECEITA_TOTAL_NAO_RECONCILIA', severidade: 'erro',
      esperado: r.receitaBruta, encontrado: totalMensal, diferenca: totalMensal - r.receitaBruta,
      mensagem: 'Receita Bruta total não bate com a soma dos recebimentos mensais.',
    });
  }
  const principal = r.principalRecebidoMensal ?? [];
  const juros = r.jurosClientesMensal ?? [];
  for (let mes = 0; mes < bruto.length; mes++) {
    const esperadoMes = (principal[mes] ?? 0) + (juros[mes] ?? 0);
    if (Math.abs(esperadoMes - bruto[mes]) <= tol) continue;
    out.push({
      codigo: 'RECEITA_MENSAL_NAO_RECONCILIA', severidade: 'erro', mes,
      esperado: esperadoMes, encontrado: bruto[mes], diferenca: bruto[mes] - esperadoMes,
      mensagem: `Mês ${mes + 1}: Receita Bruta não bate com principal recebido + juros de clientes.`,
    });
    break;
  }

  const carteira = r.carteiraClientesMensal ?? [];
  for (let mes = 0; mes < carteira.length; mes++) {
    if ((carteira[mes] ?? 0) >= -tol) continue;
    out.push({
      codigo: 'CARTEIRA_NEGATIVA', severidade: 'erro', mes,
      esperado: 0, encontrado: carteira[mes], diferenca: carteira[mes],
      mensagem: `Mês ${mes + 1}: carteira de clientes ficou negativa.`,
    });
    break;
  }
  const saldoFinal = carteira[carteira.length - 1] ?? 0;
  if (Math.abs(saldoFinal) > tol) {
    out.push({
      codigo: 'CARTEIRA_FINAL_NAO_ZERA', severidade: 'erro', mes: Math.max(0, carteira.length - 1),
      esperado: 0, encontrado: saldoFinal, diferenca: saldoFinal,
      mensagem: `Carteira de clientes não zera no fim do horizonte — saldo ${saldoFinal}.`,
    });
  }

  const repasse = r.repasseMensal ?? [];
  const mesesComRepasse = repasse.map((v, mes) => ({ v, mes })).filter(({ v }) => v > tol);
  if (mesesComRepasse.length > 1) {
    out.push({
      codigo: 'REPASSE_EM_MULTIPLOS_MESES', severidade: 'erro', mes: mesesComRepasse[1].mes,
      esperado: 1, encontrado: mesesComRepasse.length, diferenca: mesesComRepasse.length - 1,
      mensagem: `Repasse ocorreu em ${mesesComRepasse.length} meses; deve liquidar a carteira uma única vez.`,
    });
  }
  for (let mes = 0; mes < repasse.length; mes++) {
    if ((repasse[mes] ?? 0) <= (bruto[mes] ?? 0) + tol) continue;
    out.push({
      codigo: 'REPASSE_SUPERA_RECEITA', severidade: 'erro', mes,
      esperado: bruto[mes] ?? 0, encontrado: repasse[mes], diferenca: repasse[mes] - (bruto[mes] ?? 0),
      mensagem: `Mês ${mes + 1}: repasse supera a Receita Bruta recebida no mês.`,
    });
    break;
  }
  return out;
}

/** Contratação bruta independente do total calculado: Σ quantidade × área ×
 * preço/m² × absorção efetiva de cada fase. */
export function validarContratacao(
  linhasReceita: any[],
  cronograma: EventoCrono[],
  prazo: number,
  vendaBrutaEncontrada: number,
  tol: number = TOLERANCIA_PADRAO,
): Divergencia[] {
  let esperado = 0;
  for (const linha of linhasReceita) {
    const vgv = (linha.tipologias ?? []).reduce((s: number, t: any) => s
      + Number(t.quantidade ?? 0) * Number(t.area_privativa_m2 ?? 0) * Number(t.preco_m2 ?? 0), 0);
    const abs = absorcaoMensal(linha.absorcao ?? { modo: 'linear' }, cronograma);
    if (!abs) continue;
    const pctNoHorizonte = abs.pcts.reduce((s, pct, i) => {
      const mes = abs.inicio + i;
      return s + (mes >= 0 && mes < prazo ? Number(pct ?? 0) : 0);
    }, 0);
    esperado += vgv * pctNoHorizonte / 100;
  }
  esperado = Math.round((esperado + Number.EPSILON) * 100) / 100;
  if (Math.abs(esperado - vendaBrutaEncontrada) <= tol) return [];
  return [{
    codigo: 'VENDA_BRUTA_NAO_RECONCILIA', severidade: 'erro',
    esperado, encontrado: vendaBrutaEncontrada, diferenca: vendaBrutaEncontrada - esperado,
    mensagem: 'Venda Bruta Contratada não bate com quantidade × área privativa × preço/m² × absorção.',
  }];
}

/** Executa as invariantes de componentes nas safras efetivamente contratadas
 * de cada linha real do estudo e preserva linha/safra/mês no diagnóstico. */
export function validarSafrasReceita(
  linhasReceita: any[],
  cronograma: EventoCrono[],
  prazo: number,
  tol: number = TOLERANCIA_PADRAO,
): Divergencia[] {
  const out: Divergencia[] = [];
  const obra = cronograma.find((e) => e.evento === 'obra');
  const mesEntrega = obra ? Number(obra.inicio_mes) + Number(obra.duracao_meses) - 1 : 0;
  for (const linha of linhasReceita) {
    const componentes = componentesPagamento(linha.fluxo_pagamento, cronograma);
    const contratacoes = vendaLiquidaContratadaMensal(linha, cronograma, prazo);
    for (let safra = 0; safra < contratacoes.length; safra++) {
      if ((contratacoes[safra] ?? 0) <= tol) continue;
      const efetivos = componentesEfetivosSafra(componentes, safra, mesEntrega);
      const divergencias = validarComponentesSafra(efetivos, safra, contratacoes[safra], tol);
      for (const d of divergencias) out.push({
        ...d,
        linha: `${linha.nome || 'Receita'}${d.linha ? ` / ${d.linha}` : ''}`,
      });
      if (divergencias.length > 0) break;
    }
  }
  return out;
}

function quantidadesPermutadas(linhasCusto: any[]): Map<number, number> {
  const porTipologia = new Map<number, number>();
  for (const c of linhasCusto) {
    if (!ePermutaFisica(c) || c.permuta_tipologia_id == null) continue;
    const id = Number(c.permuta_tipologia_id);
    porTipologia.set(id, (porTipologia.get(id) ?? 0) + Number(c.permuta_quantidade ?? 0));
  }
  return porTipologia;
}

/**
 * #335: reverte a #179/#256 — a categoria de uma linha de Custos não trava
 * mais renomeação/remoção nem some do combo das outras linhas. Sem essa
 * trava, nada impede o usuário de criar uma 2ª linha com a mesma categoria
 * num grupo, e o motor de fluxo processa cada linha de custo
 * independentemente (`fluxo-caixa-motor.ts`), somando as duas — correto se
 * são custos genuinamente distintos, mas silenciosamente dobra o efeito se a
 * duplicata foi sem querer. Alerta (não erro): a duplicata pode ser
 * intencional. "Outro" fica de fora — é a categoria livre, feita para ter
 * várias linhas.
 */
export function validarCustosDuplicados(linhasCusto: any[]): Divergencia[] {
  const out: Divergencia[] = [];
  const contagem = new Map<string, { grupo: string; categoria: string; count: number }>();
  for (const c of linhasCusto) {
    const categoria = String(c?.categoria || '');
    if (!categoria || categoria === 'Outro') continue;
    const grupo = String(c?.grupo || '');
    const chave = `${grupo}::${categoria}`;
    const atual = contagem.get(chave);
    if (atual) atual.count++;
    else contagem.set(chave, { grupo, categoria, count: 1 });
  }
  for (const { grupo, categoria, count } of contagem.values()) {
    if (count <= 1) continue;
    out.push({
      codigo: 'CATEGORIA_CUSTO_DUPLICADA', severidade: 'alerta', linha: categoria,
      esperado: 1, encontrado: count, diferenca: count - 1,
      mensagem: `${categoria} (${grupo}): ${count} linhas com a mesma categoria no grupo — confirme se é intencional.`,
    });
  }
  return out;
}

/**
 * #429: conservação da absorção. A curva de uma linha de Receitas declara
 * `pctTotal`; o motor só computa o que cabe na janela derivada
 * (`periodoAbsorcao`). O resto era **descartado em silêncio** — sem `else`,
 * sem `console.warn`, sem erro —, e o estudo saía internamente consistente e
 * simplesmente menor que a realidade.
 *
 * 🔴 **Por que esta checagem não saiu da validação que já existia.**
 * `validarContratacao` (`pctNoHorizonte`) soma `abs.pcts`, a saída JÁ
 * TRUNCADA de `absorcaoMensal`: consome a saída de quem deveria fiscalizar,
 * então `VENDA_BRUTA_NAO_RECONCILIA` fecha certinho enquanto o percentual
 * evapora. O `somaPct` de `validarProduto` (abaixo) chega a comparar essa
 * soma com 100, mas só para SUPRIMIR `ESTOQUE_FINAL_NAO_ZERA`.
 *
 * ⚠️ E ler `pcts` não bastaria nem se alguém o relatasse: no modo
 * `personalizado`, `Σ pcts` é aritmeticamente igual a
 * `pctTotal − pctDescartado`, então a 1ª condição abaixo seria equivalente —
 * mas a 2ª (`pctDescartado > tol`) não é derivável de `pcts` de jeito nenhum.
 *
 * A mensagem segue o desenho do `VGV SOMADO` da EVI (`Perfil Vendas!B28`):
 * diz **quanto falta e o que o zeraria**, não só "não fecha".
 */
function divergenciasAbsorcao(
  linhasReceita: any[],
  cronograma: EventoCrono[],
  tol: number,
): Divergencia[] {
  const out: Divergencia[] = [];
  for (const linha of linhasReceita ?? []) {
    const abs = absorcaoMensal(linha?.absorcao ?? { modo: 'linear' }, cronograma);
    if (!abs) continue;
    const efetivo = pctAbsorcaoEfetivo(abs);
    // DUAS condições, e a segunda é a que torna esta checagem impossível de
    // derivar de `abs.pcts`: uma curva que declara 110% e perde 10 pp fora da
    // janela soma exatamente 100 em `pcts` — a leitura truncada diz "fechou"
    // enquanto 10 pp do que o usuário escreveu foram jogados fora. Só o dado
    // bruto separa "vendeu 100%" de "declarou 110% e computou 100%".
    const naoFecha = Math.abs(efetivo - 100) > tol;
    const houveDescarte = abs.pctDescartado > tol;
    if (!naoFecha && !houveDescarte) continue;
    // `esperado` é o que a curva prometia: 100 quando nada foi descartado, o
    // total declarado quando foi — assim `esperado − encontrado` é sempre a
    // perda de que a mensagem fala. Numa curva que declara 100 e perde 1,41
    // (o caso medido em Pinguim) os dois coincidem: esperado 100, encontrado
    // 98,59.
    const esperado = houveDescarte ? abs.pctTotal : 100;
    out.push({
      codigo: 'ABSORCAO_NAO_FECHA', severidade: 'erro',
      linha: String(linha?.nome || 'Receita'),
      ...(abs.mesesDescartados.length ? { mes: Math.min(...abs.mesesDescartados) } : {}),
      esperado, encontrado: efetivo, diferenca: efetivo - esperado,
      mensagem: mensagemAbsorcaoNaoFecha(abs, efetivo, tol),
    });
  }
  return out;
}

function mensagemAbsorcaoNaoFecha(abs: AbsorcaoMensal, efetivo: number, tol: number): string {
  const partes: string[] = [`Absorção efetiva soma ${efetivo.toFixed(2)}%`];
  if (abs.pctDescartado > tol) {
    // Meses são 0-based internamente e 1-based na tela (mesmo padrão de
    // `Mês ${mes + 1}` das outras mensagens deste módulo e do painel).
    const janela = fimJanelaAbsorcao(abs) + 1;
    const meses = [...new Set(abs.mesesDescartados)].sort((a, b) => a - b).map((m) => m + 1);
    const lista = meses.length <= 3 ? meses.join(', ') : `${meses.slice(0, 3).join(', ')}…`;
    const ponto = meses.length === 1 ? 'ponto' : 'pontos';
    partes.push(
      `${abs.pctDescartado.toFixed(2)} pp da curva (que declara ${abs.pctTotal.toFixed(2)}%) `
      + `caem fora da janela de vendas e NÃO são computados`
      + (meses.length ? ` — ${meses.length} ${ponto}, mês ${lista}; a janela vai até o mês ${janela}` : '')
      + '. Traga esses pontos para dentro da janela',
    );
  }
  if (Math.abs(efetivo - 100) > tol) {
    const falta = 100 - efetivo;
    partes.push(`${falta > 0 ? 'faltam' : 'sobram'} ${Math.abs(falta).toFixed(2)} pp para fechar 100%`);
  }
  return `${partes.join(': ')}.`;
}

/** Produto/estoque: alocação + permuta nunca excede o catálogo e a baixa
 * mensal pela absorção não produz estoque negativo. Premissas abaixo de 100%
 * podem deixar saldo e não são erro; quando todo o estoque está comprometido
 * e a absorção fecha 100%, o saldo terminal obrigatoriamente zera.
 *
 * #429: emite também `ABSORCAO_NAO_FECHA`, uma vez por LINHA de Receitas —
 * `divergenciasAbsorcao` roda fora do laço do catálogo de propósito, senão a
 * mesma curva viraria uma divergência por tipologia alocada, e uma linha cuja
 * tipologia não está no catálogo nunca seria checada. */
export function validarProduto(
  linhasReceita: any[],
  linhasCusto: any[],
  tipologiasCatalogo: any[],
  cronograma: EventoCrono[],
  prazo: number,
  tol: number = TOLERANCIA_PADRAO,
): Divergencia[] {
  const out: Divergencia[] = [...divergenciasAbsorcao(linhasReceita, cronograma, tol)];
  const permutas = quantidadesPermutadas(linhasCusto);

  for (const tip of tipologiasCatalogo) {
    const id = Number(tip.id);
    const nome = String(tip.nome || `tipologia ${id}`);
    const total = Number(tip.quantidade ?? 0);
    const alocacoes = linhasReceita.flatMap((linha) =>
      (linha.tipologias ?? [])
        .filter((a: any) => Number(a.tipologia_id) === id)
        .map((a: any) => ({ linha, quantidade: Number(a.quantidade ?? 0) })));
    const alocado = alocacoes.reduce((s, a) => s + a.quantidade, 0);
    const permutado = permutas.get(id) ?? 0;
    const comprometido = alocado + permutado;
    if (comprometido > total + tol) {
      out.push({
        codigo: 'PRODUTO_EXCEDE_ESTOQUE', severidade: 'erro', linha: nome,
        esperado: total, encontrado: comprometido, diferenca: comprometido - total,
        mensagem: `${nome}: alocações (${alocado}) + permuta física (${permutado}) excedem o estoque (${total}).`,
      });
    }
    // #340: o inverso de PRODUTO_EXCEDE_ESTOQUE — sobra estoque nem alocado
    // nem permutado. Alerta (não erro): pode ser produto ainda em
    // planejamento de vendas, não uma inconsistência de dado.
    if (total - comprometido > tol) {
      out.push({
        codigo: 'PRODUTO_SUBALOCADO', severidade: 'alerta', linha: nome,
        esperado: total, encontrado: comprometido, diferenca: total - comprometido,
        mensagem: `${nome}: ${total - comprometido} unidade(s) ainda não alocadas em grupos de Receitas nem permutadas.`,
      });
    }

    const vendas = new Array<number>(Math.max(0, prazo)).fill(0);
    let absorcaoCompleta = alocacoes.length > 0;
    for (const a of alocacoes) {
      const abs = absorcaoMensal(a.linha.absorcao ?? { modo: 'linear' }, cronograma);
      if (!abs) { absorcaoCompleta = false; continue; }
      // Este `somaPct` lê `abs.pcts` DE PROPÓSITO: aqui a pergunta é se o que
      // o motor efetivamente baixa do estoque chega a 100% — se não chega, o
      // saldo terminal não tem obrigação de zerar. Quem denuncia o descarte é
      // `divergenciasAbsorcao` (#429), que lê o dado bruto da curva.
      const somaPct = abs.pcts.reduce((s, pct) => s + Number(pct || 0), 0);
      if (Math.abs(somaPct - 100) > tol) absorcaoCompleta = false;
      for (let i = 0; i < abs.pcts.length; i++) {
        const mes = abs.inicio + i;
        if (mes >= 0 && mes < vendas.length) vendas[mes] += a.quantidade * abs.pcts[i] / 100;
      }
    }
    let estoque = total - permutado;
    for (let mes = 0; mes < vendas.length; mes++) {
      estoque -= vendas[mes];
      if (estoque >= -tol) continue;
      out.push({
        codigo: 'ESTOQUE_MENSAL_NEGATIVO', severidade: 'erro', linha: nome, mes,
        esperado: 0, encontrado: estoque, diferenca: estoque,
        mensagem: `${nome}, mês ${mes + 1}: estoque ficou negativo (${estoque}).`,
      });
      break;
    }
    if (absorcaoCompleta && Math.abs(comprometido - total) <= tol && Math.abs(estoque) > tol) {
      out.push({
        codigo: 'ESTOQUE_FINAL_NAO_ZERA', severidade: 'erro', linha: nome, mes: Math.max(0, prazo - 1),
        esperado: 0, encontrado: estoque, diferenca: estoque,
        mensagem: `${nome}: absorção de 100% não zerou o estoque ao fim do horizonte.`,
      });
    }
  }
  return out;
}

/**
 * Funding (#355): dívida (`divida`/`financiamento_producao`) não pode ficar
 * negativa nem sobreviver ao horizonte; o fluxo alavancado fecha com fluxo
 * livre + entradas − saídas de TODAS as operações. Equity não tem saldo (é
 * aporte + retorno, sem dívida) — suas séries `saldo` são zeradas por
 * construção e por isso ficam de fora da 1ª checagem.
 *
 * Substitui `validarCapitalStack` (#239, modelo de 4 instrumentos com
 * waterfall): sem waterfall nem prioridades no modelo novo, não há mais
 * "lacuna de funding" a reportar — cada operação roda independente, sem
 * competir por caixa nem checar se ele é suficiente (equity/dívida) ou com
 * gate próprio de caixa (financiamento_producao, dentro do motor).
 *
 * É justamente essa independência que exige a 3ª checagem (**decisão D14** da
 * #355): como `divida` e `equity` pagam sem olhar o caixa — o PMT é capado só
 * pelo saldo devedor, e o retorno do equity é % da receita, haja caixa ou não
 * —, o fluxo alavancado pode mergulhar abaixo de zero sem que nada acuse. O
 * modelo antigo não tinha esse buraco porque o waterfall capava pelo caixa.
 * Segue a planilha (não bloqueia o cálculo) e torna o risco VISÍVEL: severidade
 * `alerta`, mesmo padrão da D5/#335 em `validarCustosDuplicados`.
 */
export function validarFunding(
  calc: FundingCalc,
  fluxoLivreMensal: number[],
  tol: number = TOLERANCIA_PADRAO,
): Divergencia[] {
  const out: Divergencia[] = [];
  for (const s of calc.operacoes) {
    if (s.saldo.every((v) => v === 0)) continue; // equity: sem dívida, nada a checar
    const nome = s.operacao.nome || s.operacao.tipo;
    const negativo = s.saldo.findIndex((v) => v < -tol);
    if (negativo >= 0) out.push({
      codigo: 'DIVIDA_NEGATIVA', severidade: 'erro', linha: nome, mes: negativo,
      esperado: 0, encontrado: s.saldo[negativo], diferenca: s.saldo[negativo],
      mensagem: `${nome}, mês ${negativo + 1}: saldo da dívida ficou negativo.`,
    });
    const final = s.saldo[s.saldo.length - 1] ?? 0;
    if (Math.abs(final) > tol) out.push({
      codigo: 'DIVIDA_FINAL_NAO_ZERA', severidade: 'erro', linha: nome, mes: Math.max(0, s.saldo.length - 1),
      esperado: 0, encontrado: final, diferenca: final,
      mensagem: `${nome}: dívida termina o horizonte com saldo ${final}.`,
    });
  }

  const nf = calc.noFluxo;
  for (let t = 0; t < nf.fluxoMensal.length; t++) {
    const esperado = Number(fluxoLivreMensal[t] ?? 0) + Number(nf.entradas[t] ?? 0) - Number(nf.saidas[t] ?? 0);
    const encontrado = Number(nf.fluxoMensal[t] ?? 0);
    if (Math.abs(esperado - encontrado) <= tol) continue;
    out.push({
      codigo: 'FLUXO_FUNDING_NAO_RECONCILIA', severidade: 'erro', mes: t,
      esperado, encontrado, diferenca: encontrado - esperado,
      mensagem: `Mês ${t + 1}: fluxo alavancado não reconcilia com fluxo livre e funding.`,
    });
    break;
  }

  // D14: caixa acumulado do projeto DEPOIS do funding. Um só item por estudo —
  // o mês em que mergulha basta para investigar, e um estudo com 40 meses
  // negativos geraria 40 linhas idênticas na Reconciliação.
  const mergulho = nf.fluxoAcumulado.findIndex((v) => Number(v) < -tol);
  if (mergulho >= 0) out.push({
    codigo: 'CAIXA_ACUMULADO_NEGATIVO_APOS_FUNDING', severidade: 'alerta', mes: mergulho,
    esperado: 0,
    encontrado: Number(nf.fluxoAcumulado[mergulho]),
    diferenca: Number(nf.fluxoAcumulado[mergulho]),
    mensagem: `Mês ${mergulho + 1}: o caixa acumulado fica negativo depois do funding `
      + '— as operações pagam sem checar o caixa do projeto.',
  });

  return out;
}

/**
 * Invariantes do motor de safras/componentes (#232-#237), para os
 * componentes de UMA safra (emenda da #240):
 *
 *  1. soma dos componentes = valor contratado líquido da safra — as
 *     `participacaoPct` de todos os componentes devem somar 100%;
 *  2. saldo de cada componente zera no último vencimento (`carteiraSaldoSafra`);
 *  3. nenhuma carteira volta a crescer depois de decair (defeito do Urbitá).
 *
 * Reporta a PRIMEIRA divergência de cada tipo por componente — não precisa
 * listar todos os meses depois do primeiro erro para localizar a causa.
 */
export function validarComponentesSafra(
  componentes: ComponentePagamento[],
  safra: number,
  valorContratado: number,
  tol: number = TOLERANCIA_PADRAO,
): Divergencia[] {
  const out: Divergencia[] = [];

  const somaPct = componentes.reduce((s, c) => s + c.participacaoPct, 0);
  if (Math.abs(somaPct - 100) > tol) {
    out.push({
      codigo: 'SOMA_COMPONENTES_DIVERGE', severidade: 'erro', safra,
      esperado: 100, encontrado: somaPct, diferenca: somaPct - 100,
      mensagem: `Safra ${safra}: participações somam ${somaPct}%, esperado 100% — a soma dos ` +
        'componentes precisa fechar o valor contratado líquido da safra.',
    });
  }

  for (const c of componentes) {
    if (c.tipo === 'imediato') continue; // paga e encerra no mesmo mês, sem carteira
    const linha = c.rotulo ?? c.tipo;
    let saldos: ReturnType<typeof carteiraSaldoSafra>;
    try {
      saldos = carteiraSaldoSafra(c, safra, valorContratado);
    } catch (e: any) {
      out.push({
        codigo: 'COMPONENTE_INVALIDO', severidade: 'erro', linha, safra,
        esperado: 0, encontrado: NaN, diferenca: NaN,
        mensagem: `Safra ${safra}, ${linha}: ${e?.message ?? 'erro ao calcular a carteira'}.`,
      });
      continue;
    }
    if (saldos.length === 0) continue;

    const ultimo = saldos[saldos.length - 1];
    if (Math.abs(ultimo.saldo) > tol) {
      out.push({
        codigo: 'CARTEIRA_NAO_ZERA', severidade: 'erro', linha, safra, mes: ultimo.mes,
        esperado: 0, encontrado: ultimo.saldo, diferenca: ultimo.saldo,
        mensagem: `Safra ${safra}, ${linha}: saldo não zera no último vencimento ` +
          `(mês ${ultimo.mes}) — sobrou ${ultimo.saldo}.`,
      });
    }

    for (let i = 1; i < saldos.length; i++) {
      if (saldos[i].saldo > saldos[i - 1].saldo + tol) {
        out.push({
          codigo: 'CARTEIRA_RESSURGE', severidade: 'erro', linha, safra, mes: saldos[i].mes,
          esperado: saldos[i - 1].saldo, encontrado: saldos[i].saldo,
          diferenca: saldos[i].saldo - saldos[i - 1].saldo,
          mensagem: `Safra ${safra}, ${linha}: carteira cresceu no mês ${saldos[i].mes} ` +
            `(${saldos[i - 1].saldo} → ${saldos[i].saldo}) — defeito do tipo Urbitá, não deveria ocorrer.`,
        });
        break; // 1ª divergência já localiza a causa para este componente
      }
    }
  }

  return out;
}

/**
 * #269: reconciliação da permuta física — soma, por tipologia do catálogo,
 * a `permuta_quantidade` declarada em todas as linhas de custo
 * `Preço/Permuta física` (#266/#267) do estudo e compara com a `quantidade`
 * total daquela tipologia. Exceder o estoque é ERRO (não premissa agressiva):
 * não existe unidade física para entregar além do que o catálogo produz.
 *
 * `linhasCusto`/`tipologiasCatalogo` são os arrays crus do estudo (mesmo
 * shape de `avancado_linhas_custo`/`avancado_tipologias`), não o `FluxoCalc`
 * — a permuta física não passa pelo fluxo consolidado (#268: é dedução de
 * estoque, não de caixa).
 */
export function validarPermutaFisica(
  linhasCusto: any[],
  tipologiasCatalogo: any[],
  tol: number = TOLERANCIA_PADRAO,
): Divergencia[] {
  const permutadaPorTipologia = quantidadesPermutadas(linhasCusto);

  const out: Divergencia[] = [];
  for (const [id, quantidadePermutada] of permutadaPorTipologia) {
    const tip = tipologiasCatalogo.find((t) => Number(t.id) === id);
    const quantidadeTotal = Number(tip?.quantidade ?? 0);
    if (quantidadePermutada - quantidadeTotal > tol) {
      const nome = tip?.nome || `tipologia ${id}`;
      out.push({
        codigo: 'PERMUTA_FISICA_EXCEDE_ESTOQUE', severidade: 'erro', linha: nome,
        esperado: quantidadeTotal, encontrado: quantidadePermutada,
        diferenca: quantidadePermutada - quantidadeTotal,
        mensagem: `${nome}: ${quantidadePermutada} unidades permutadas excedem as ` +
          `${quantidadeTotal} do catálogo — não existe estoque para entregar.`,
      });
    }
  }
  return out;
}

/** Uma linha de reconciliação de permuta física, por tipologia. */
export interface PermutaFisicaTipologia {
  tipologiaId: number;
  nome: string;
  quantidadeTotal: number;
  quantidadePermutada: number;
  areaPermutada: number;
}

/**
 * #269: área e quantidade permutada por tipologia — a mesma leitura de
 * `linhasCusto` que `validarPermutaFisica` usa, só que para exibição em vez
 * de validação. Única fonte para tela e exportação (CSV/PDF); nenhum dos
 * dois calcula isso de novo. Tipologias sem permuta física não aparecem.
 */
export function permutaFisicaPorTipologia(
  linhasCusto: any[],
  tipologiasCatalogo: any[],
): PermutaFisicaTipologia[] {
  const permutadaPorTipologia = quantidadesPermutadas(linhasCusto);
  const out: PermutaFisicaTipologia[] = [];
  for (const [id, quantidadePermutada] of permutadaPorTipologia) {
    if (quantidadePermutada <= 0) continue;
    const tip = tipologiasCatalogo.find((t) => Number(t.id) === id);
    out.push({
      tipologiaId: id,
      nome: tip?.nome || `tipologia ${id}`,
      quantidadeTotal: Number(tip?.quantidade ?? 0),
      quantidadePermutada,
      areaPermutada: quantidadePermutada * Number(tip?.area_privativa_m2 ?? 0),
    });
  }
  return out;
}

/** Uma linha de "unidades não alocadas", por tipologia. */
export interface UnidadeNaoAlocada {
  tipologiaId: number;
  nome: string;
  quantidadeTotal: number;
  naoAlocado: number;
}

/**
 * #340: unidades do catálogo ainda não alocadas em nenhum grupo de Receitas
 * nem reservadas para permuta física — o banner de aviso em Tipologias
 * (`tela-empreendimento-tipologias.ts`) e o alerta `PRODUTO_SUBALOCADO` de
 * `validarProduto` usam a mesma conta: `total − alocado − permutado`.
 * Tipologias totalmente alocadas/permutadas não aparecem.
 */
export function unidadesNaoAlocadasPorTipologia(
  linhasReceita: any[],
  linhasCusto: any[],
  tipologiasCatalogo: any[],
  tol: number = TOLERANCIA_PADRAO,
): UnidadeNaoAlocada[] {
  const permutas = quantidadesPermutadas(linhasCusto);
  const out: UnidadeNaoAlocada[] = [];
  for (const tip of tipologiasCatalogo) {
    const id = Number(tip.id);
    const total = Number(tip.quantidade ?? 0);
    const alocado = linhasReceita.reduce((s, linha) =>
      s + (linha.tipologias ?? [])
        .filter((a: any) => Number(a.tipologia_id) === id)
        .reduce((s2: number, a: any) => s2 + Number(a.quantidade ?? 0), 0), 0);
    const permutado = permutas.get(id) ?? 0;
    const naoAlocado = total - alocado - permutado;
    if (naoAlocado > tol) {
      out.push({ tipologiaId: id, nome: tip?.nome || `tipologia ${id}`, quantidadeTotal: total, naoAlocado });
    }
  }
  return out;
}
