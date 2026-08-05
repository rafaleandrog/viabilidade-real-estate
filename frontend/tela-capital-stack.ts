import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$ } from './viab-format.js';
import {
  urbiVerso,
  buscarParametrosAvancado, buscarCronogramaAvancado,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  listarCapitalInstrumentos, criarCapitalInstrumento, atualizarCapitalInstrumento, removerCapitalInstrumento,
} from './viabilidade-api.js';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import {
  simularCapitalStackDoEstudo, moic, tirAnual, fundingEntradasSaidasMensal,
  receitaLiquidaComCorretagemMensal, type ResultadoCapitalStack, reordenarCamadas,
  camadasComOrdemAlterada,
} from './capital-stack-motor.js';
import './viab-num.js';

// Sub-aba "Viabilidade → Capital Stack" (epic #239, FIN-08/#277 + FIN-09/#278).
//
// Escopo desta entrega:
//  - Resumo superior: KPIs agregados (§9), calculados de verdade via
//    `simularCapitalStackDoEstudo` sobre o fluxo livre real do estudo.
//  - Lista de camadas com edição inline por tipo (§9 "Capital Stack" +
//    "Editor de camada", os 5 blocos como seções dentro do MESMO card, em
//    vez de um modal/wizard separado).
//  - Prévia de recálculo a cada tecla no editor (§9) — todo campo de `config`
//    recalcula a simulação sobre o DRAFT em memória, sem tocar a API; só
//    "Salvar camada" persiste (a garantia central do §9 continua intacta).
//  - Gráficos SVG (§9 "Visualizações") — comprometido×utilizado por camada e
//    aportes/liberações×pagamentos/distribuições mês a mês, sem lib externa
//    (mesmo padrão zero-dependência do resto do app).
//  - `receitaLiquidaMensal` já subtrai a corretagem (§6.2): lê a linha de
//    custo "Corretagem de vendas" (fonte oficial única, #227/#228) dentro de
//    `calc.linhasCusto` em vez de duplicar `corretagemMensal`.
//
// Nada aqui é usado pelo Preliminar. Camadas `rascunho`/`revisao_necessaria`/
// `encerrado` aparecem na lista mas NÃO entram no cálculo do resumo — só
// `ativo` tem efeito (§13.3), e a UI deixa isso visível no badge de status.

const TIPOS: { valor: string; rotulo: string }[] = [
  { valor: 'financiamento_producao', rotulo: 'Financiamento à produção' },
  { valor: 'capital_giro', rotulo: 'Capital de giro / dívida ponte' },
  { valor: 'preferred_equity', rotulo: 'Preferred Equity' },
  { valor: 'sponsor_equity', rotulo: 'Sponsor Equity' },
];
const STATUS: { valor: string; rotulo: string }[] = [
  { valor: 'rascunho', rotulo: 'Rascunho' },
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'encerrado', rotulo: 'Encerrado' },
  { valor: 'revisao_necessaria', rotulo: 'Revisão necessária' },
];
const POLITICAS: { valor: string; rotulo: string }[] = [
  { valor: 'cash_sweep', rotulo: 'Cash sweep' },
  { valor: 'bullet', rotulo: 'Bullet (no vencimento)' },
  { valor: 'price', rotulo: 'Parcelas (Price, com carência)' },
];
const MODOS_PE: { valor: string; rotulo: string }[] = [
  { valor: 'A', rotulo: 'A — Retorno preferencial fixo' },
  { valor: 'B', rotulo: 'B — % do residual no encerramento' },
  { valor: 'C', rotulo: 'C — % da receita líquida, pró-rata' },
  { valor: 'D', rotulo: 'D — % do lucro final, parcelado na entrega' },
];

const n = (v: any): number => Number(v) || 0;

@customElement('viab-capital-stack')
export class ViabCapitalStack extends LitElement {
  @property({ type: Object }) estudo: any = null;
  @property({ type: Boolean }) editavel = false;

  @state() private camadas: any[] = [];
  @state() private custos: any[] = [];
  @state() private resultado: ResultadoCapitalStack | null = null;
  @state() private resultadoDesalavancado = 0;
  @state() private carregando = true;
  @state() private draft: Record<number, any> = {};
  @state() private salvandoId: number | null = null;
  @state() private movendoId: number | null = null;   // #277: camada em reordenação
  @state() private criando = false;

  private carregado = false;
  // Cache do que `_carregar` já buscou/calculou, para a prévia por tecla
  // recalcular sem refazer chamadas de API a cada dígito digitado.
  private fluxoLivre1based: number[] = [];
  private receitaLiquida1based: number[] = [];

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .resumo urbi-kpi { width: 100%; }
    .camadas { display: flex; flex-direction: column; gap: 14px; }
    .camada-cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .camada-cab .espaco { flex: 1; }
    .secao { margin-top: 12px; }
    .secao h4 {
      margin: 0 0 6px; font-size: var(--texto-rotulo, 0.75rem); text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--cor-texto-sec, rgba(255,255,255,0.5));
    }
    .grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px; }
    .grid > * { width: 190px; max-width: 100%; box-sizing: border-box; }
    .grid > .p2 { width: 260px; }
    .sel-campo { display: flex; flex-direction: column; gap: 4px; width: 190px; }
    .sel-rotulo { font-size: 0.75rem; text-transform: uppercase; color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 700; }
    .linha-lista { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
    .form-acoes { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    .custo-lista { display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow: auto; }
    .add-topo { margin-bottom: 16px; }
    table.resultados { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-variant-numeric: tabular-nums; }
    table.resultados th, table.resultados td { padding: 6px 8px; font-size: 0.8125rem; border-bottom: 1px solid var(--cor-borda-sutil, rgba(255,255,255,0.06)); text-align: left; }
    table.resultados th { color: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-weight: 600; text-align: left; }
    table.resultados td.num, table.resultados th.num { text-align: right; }
    .graficos { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
    .grafico-card { flex: 1; min-width: 280px; }
    svg.grafico { width: 100%; height: auto; overflow: visible; font-variant-numeric: tabular-nums; }
    .barra-comprometido { fill: var(--cor-texto-sec, rgba(255,255,255,0.25)); }
    .barra-utilizado { fill: var(--cor-info, #4a90d9); }
    .rotulo-barra { fill: var(--cor-texto, #fff); font-size: 10px; }
    .rotulo-camada { fill: var(--cor-texto-sec, rgba(255,255,255,0.7)); font-size: 10px; }
    .linha-entradas { stroke: var(--cor-sucesso, #13a98d); fill: none; stroke-width: 2; }
    .linha-saidas { stroke: var(--cor-erro, #d45a3a); fill: none; stroke-width: 2; }
    .eixo-mes { fill: var(--cor-texto-sec, rgba(255,255,255,0.5)); font-size: 9px; }
    .grafico-legenda { display: flex; gap: 14px; font-size: 0.72rem; margin-top: 6px; color: var(--cor-texto-sec, rgba(255,255,255,0.7)); }
    .grafico-legenda .ponto { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 4px; }
  `];

  updated() {
    if (this.estudo?.id && !this.carregado) { this.carregado = true; this._carregar(); }
  }

  private async _carregar() {
    this.carregando = true;
    try {
      const [camadas, custos, receitas, curvas, crono, params] = await Promise.all([
        listarCapitalInstrumentos(this.estudo.id),
        listarCustosAvancado(this.estudo.id),
        listarReceitasAvancado(this.estudo.id),
        listarCurvas(),
        buscarCronogramaAvancado(this.estudo.id),
        buscarParametrosAvancado(this.estudo.id),
      ]);
      this.camadas = camadas?.erro ? [] : (camadas.dados || []);
      this.custos = custos?.erro ? [] : (custos.dados || []);

      const config: FluxoConfig = {
        dataInicio: params?.erro ? null : (params.data_inicio_projeto ?? null),
        taxaDescontoAa: params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12),
        cronograma: crono?.erro ? [] : (crono.dados || []),
        linhasReceita: receitas?.erro ? [] : (receitas.dados || []),
        linhasCusto: this.custos,
        curvas: curvas?.erro ? [] : (curvas.dados || []),
        areaTerreno: Number(this.estudo?.terreno_manual_area) || Number(this.estudo?.area_terreno_nucleo) || 0,
      };
      const calc = calcularFluxo(config);
      this.resultadoDesalavancado = calc.fluxoAcumulado[calc.fluxoAcumulado.length - 1] || 0;

      const receitaLiquidaComCorretagem = receitaLiquidaComCorretagemMensal(calc.receitaMensal, calc.linhasCusto, this.custos);

      // Motor é 1-based (índice 0 ignorado); calcularFluxo é 0-based.
      this.fluxoLivre1based = [0, ...calc.fluxoMensal];
      this.receitaLiquida1based = [0, ...receitaLiquidaComCorretagem];
      this.linhasCustoCalc = calc.linhasCusto;
      this._recalcular();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao carregar o Capital Stack', 'erro');
    }
    this.carregando = false;
  }

  private linhasCustoCalc: { id: any; mensal: number[] }[] = [];

  /**
   * §9: toda alteração no editor recalcula a PRÉVIA sem salvar. Sobrepõe o
   * draft de cada camada em edição por cima do dado persistido (`this.camadas`)
   * antes de simular — nada é enviado à API aqui, só `_salvar` persiste.
   */
  private _recalcular() {
    const camadasComDraft = this.camadas.map((c) => (c.id in this.draft ? this.draft[c.id] : c));
    this.resultado = simularCapitalStackDoEstudo(
      this.fluxoLivre1based, this.receitaLiquida1based, camadasComDraft, this.linhasCustoCalc, 0,
    );
  }

  private _draftDe(c: any): any {
    if (!(c.id in this.draft)) this.draft = { ...this.draft, [c.id]: { ...c, config: { ...(c.config ?? {}) } } };
    return this.draft[c.id];
  }

  private _setCampo(c: any, campo: string, valor: any) {
    const d = this._draftDe(c);
    this.draft = { ...this.draft, [c.id]: { ...d, [campo]: valor } };
    this._recalcular();
  }

  private _setConfig(c: any, campo: string, valor: any) {
    const d = this._draftDe(c);
    this.draft = { ...this.draft, [c.id]: { ...d, config: { ...d.config, [campo]: valor } } };
    this._recalcular();
  }

  private _toggleCustoElegivel(c: any, custoId: number, marcado: boolean) {
    const d = this._draftDe(c);
    const atuais: number[] = Array.isArray(d.config?.custoLinhaIds) ? d.config.custoLinhaIds : [];
    const novos = marcado ? [...new Set([...atuais, custoId])] : atuais.filter((id) => id !== custoId);
    this._setConfig(c, 'custoLinhaIds', novos);
  }

  private _addLinhaLista(c: any, campoConfig: string) {
    const d = this._draftDe(c);
    const lista = Array.isArray(d.config?.[campoConfig]) ? d.config[campoConfig] : [];
    this._setConfig(c, campoConfig, [...lista, { mes: 1, valor: 0 }]);
  }
  private _setLinhaLista(c: any, campoConfig: string, i: number, campo: 'mes' | 'valor', valor: number) {
    const d = this._draftDe(c);
    const lista = (d.config?.[campoConfig] ?? []).map((x: any, j: number) => (j === i ? { ...x, [campo]: valor } : x));
    this._setConfig(c, campoConfig, lista);
  }
  private _delLinhaLista(c: any, campoConfig: string, i: number) {
    const d = this._draftDe(c);
    const lista = (d.config?.[campoConfig] ?? []).filter((_: any, j: number) => j !== i);
    this._setConfig(c, campoConfig, lista);
  }

  private async _adicionar(tipo: string) {
    this.criando = true;
    try {
      const res = await criarCapitalInstrumento(this.estudo.id, {
        tipo, nome: TIPOS.find((t) => t.valor === tipo)?.rotulo || 'Nova camada', ordem: this.camadas.length,
      });
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao criar camada', 'erro'); return; }
      this.camadas = [...this.camadas, res];
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao criar camada', 'erro');
    } finally {
      this.criando = false;
    }
  }

  private async _salvar(c: any) {
    const d = this.draft[c.id];
    if (!d) return;
    this.salvandoId = c.id;
    try {
      const dados = {
        nome: d.nome, status: d.status, prioridade_funding: n(d.prioridade_funding),
        prioridade_pagamento: n(d.prioridade_pagamento), compromisso: n(d.compromisso), config: d.config,
      };
      const res = await atualizarCapitalInstrumento(this.estudo.id, c.id, dados);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao salvar camada', 'erro'); return; }
      this.camadas = this.camadas.map((x) => (x.id === c.id ? res : x));
      const { [c.id]: _removida, ...resto } = this.draft;
      this.draft = resto;
      urbiVerso.notificar('Camada salva.', 'sucesso');
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao salvar camada', 'erro');
    } finally {
      this.salvandoId = null;
    }
  }

  private async _remover(c: any) {
    try {
      const res = await removerCapitalInstrumento(this.estudo.id, c.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover camada', 'erro'); return; }
      this.camadas = this.camadas.filter((x) => x.id !== c.id);
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover camada', 'erro');
    }
  }

  /**
   * #277: reordenar camadas. `ordem` já era campo aceito pelo backend
   * (`CAMPOS_INSTRUMENTO`) e é a coluna pela qual a listagem ordena
   * (`capital-stack.ts:76`) — mas só era escrita na CRIAÇÃO, então a ordem da
   * pilha ficava congelada no momento em que cada camada nasceu. Capacidade de
   * API sem controle na tela.
   *
   * Troca a camada com a vizinha e persiste TODAS as ordens alteradas pela
   * normalização. Isso inclui posições além das duas vizinhas quando a lista
   * legada tem `ordem` repetida ou buracos — comum nas camadas criadas pela
   * migração 019, todas inicialmente com o mesmo valor.
   *
   * Não mexe em `prioridade_funding` nem em `prioridade_pagamento`: são eixos
   * independentes (§5 e §6.1), e o motor decide por eles, não pela ordem de
   * exibição. Reordenar é organização visual da pilha.
   */
  private async _mover(c: any, direcao: -1 | 1) {
    const i = this.camadas.findIndex((x) => x.id === c.id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= this.camadas.length) return;
    const lista = reordenarCamadas(this.camadas, c.id, direcao);
    const alteradas = camadasComOrdemAlterada(this.camadas, lista);
    const ordensAnteriores = new Map(this.camadas.map((camada) => [camada.id, Number(camada.ordem)]));
    const persistidas: any[] = [];
    this.movendoId = c.id;
    try {
      for (const alvo of alteradas) {
        const res = await atualizarCapitalInstrumento(this.estudo.id, alvo.id, { ordem: alvo.ordem });
        if (res?.erro) throw new Error(res.mensagem || 'Erro ao reordenar');
        persistidas.push(alvo);
      }
      this.camadas = lista;
    } catch (e: any) {
      // A API atual não oferece atualização em lote. Compensa as gravações já
      // feitas para não deixar uma reordenação parcial quando uma PATCH falha.
      let compensacaoFalhou = false;
      for (const alvo of [...persistidas].reverse()) {
        try {
          const res = await atualizarCapitalInstrumento(this.estudo.id, alvo.id, {
            ordem: ordensAnteriores.get(alvo.id),
          });
          if (res?.erro) compensacaoFalhou = true;
        } catch {
          compensacaoFalhou = true;
        }
      }
      const sufixo = compensacaoFalhou ? ' A ordem será recarregada; confira antes de tentar novamente.' : '';
      urbiVerso.notificar((e?.message || 'Erro ao reordenar') + sufixo, 'erro');
    } finally {
      this.movendoId = null;
      this._carregar();
    }
  }

  private _renderResumo(): TemplateResult {
    const r = this.resultado;
    const compromissoTotal = this.camadas.reduce((s, c) => s + n(c.compromisso), 0);
    const dividaMaxima = r ? Math.max(0, ...Object.values(r.saldoDividaPorInstrumento).flatMap((s) => s)) : 0;
    const equityAportado = r
      ? Object.values(r.aportePorInstrumentoPE).flatMap((s) => s).reduce((a, b) => a + b, 0)
        + r.aporteSponsorMensal.reduce((a, b) => a + b, 0)
      : 0;
    const custoFinanceiro = r
      ? Object.values(r.jurosPorInstrumento).flatMap((s) => s).reduce((a, b) => a + b, 0)
        + Object.values(r.remuneracaoPagaPE).flatMap((s) => s).reduce((a, b) => a + b, 0)
      : 0;
    const resultadoAposCustoFinanceiro = this.resultadoDesalavancado - custoFinanceiro;
    return html`
      <div class="resumo">
        <urbi-kpi rotulo="Capital comprometido" .valor=${fmtR$(compromissoTotal)}></urbi-kpi>
        <urbi-kpi rotulo="Dívida máxima" .valor=${fmtR$(dividaMaxima)}></urbi-kpi>
        <urbi-kpi rotulo="Equity aportado" .valor=${fmtR$(equityAportado)}></urbi-kpi>
        <urbi-kpi rotulo="Lacuna de funding (máx.)" .valor=${fmtR$(r?.lacunaFundingMaxima ?? 0)}
          variante=${(r?.lacunaFundingMaxima ?? 0) > 0 ? 'erro' : 'sucesso'}></urbi-kpi>
        <urbi-kpi rotulo="Resultado desalavancado" .valor=${fmtR$(this.resultadoDesalavancado)}></urbi-kpi>
        <urbi-kpi rotulo="Resultado após custo financeiro" .valor=${fmtR$(resultadoAposCustoFinanceiro)}
          variante=${resultadoAposCustoFinanceiro >= 0 ? 'sucesso' : 'erro'}></urbi-kpi>
      </div>
      ${(r?.lacunaFundingMaxima ?? 0) > 0 ? html`
        <urbi-banner variante="alerta">
          Lacuna de funding de ${fmtR$(r!.lacunaFundingMaxima)} em algum mês — nenhuma camada ativa cobre
          toda a necessidade de caixa do projeto.
        </urbi-banner>` : nothing}
      <!-- #277 / §17: o app simula CONTRATOS PRIVADOS e não valida a legalidade
           da captação. Aviso permanente e não fechável: captação oferecida ao
           público ou com característica de contrato de investimento coletivo
           pode ter obrigações regulatórias, e a estrutura simulada precisa de
           revisão jurídica antes de virar oferta real. -->
      <urbi-banner variante="info">
        Esta é uma <strong>simulação de contratos privados</strong>. O app não valida a legalidade da
        captação nem substitui assessoria jurídica, tributária ou regulatória — e uma captação
        oferecida ao público, ou com característica de contrato de investimento coletivo, pode ter
        obrigações regulatórias próprias. Antes de usar esta estrutura numa oferta real, submeta-a
        aos responsáveis jurídicos e financeiros.
      </urbi-banner>
    `;
  }

  /**
   * §9 "lista ordenável de camadas" + §10 "resultado por instrumento" —
   * resumo tabular por camada, com o resultado real da simulação (§8.2/8.3)
   * quando a camada está ATIVA. Camadas rascunho/revisão/encerrada mostram
   * "—" nas colunas de resultado (não têm efeito no motor, §13.3).
   */
  private _renderResultadosPorCamada(): TemplateResult {
    if (this.camadas.length === 0) return html`${nothing}`;
    const r = this.resultado;
    return html`
      <table class="resultados">
        <thead>
          <tr>
            <th>Nome</th><th>Tipo</th><th>Status</th>
            <th class="num">Compromisso</th><th class="num">Liberado/aportado</th>
            <th class="num">Saldo final</th><th class="num">MOIC</th><th class="num">TIR (a.a.)</th>
          </tr>
        </thead>
        <tbody>
          ${this.camadas.map((c) => {
            const ativa = c.status === 'ativo';
            const ehDivida = c.tipo === 'financiamento_producao' || c.tipo === 'capital_giro';
            const ehPE = c.tipo === 'preferred_equity';
            const ehSponsor = c.tipo === 'sponsor_equity';
            const liberado = ativa && r && ehDivida
              ? (r.liberacaoPorInstrumento[c.nome] ?? []).reduce((a, b) => a + b, 0)
              : ativa && r && ehPE
                ? (r.aportePorInstrumentoPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
                : ativa && r && ehSponsor
                  ? (r.aportePorInstrumentoSponsor[c.nome] ?? []).reduce((a, b) => a + b, 0)
                  : null;
            const saldoFinal = ativa && r && ehDivida
              ? (r.saldoDividaPorInstrumento[c.nome] ?? [])[(r.saldoDividaPorInstrumento[c.nome] ?? []).length - 1]
              : ativa && r && ehPE
                ? r.capitalNaoDevolvidoFinalPE[c.nome]
                : null;
            const distribuicoesPE = ativa && r && ehPE
              ? (r.devolucaoPrincipalPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
                + (r.remuneracaoPagaPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
                + (r.participacaoResidualPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
                + (r.participacaoReceitaPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
                + (r.participacaoLucroPE[c.nome] ?? []).reduce((a, b) => a + b, 0)
              : 0;
            const moicPE = ativa && r && ehPE
              ? moic((r.aportePorInstrumentoPE[c.nome] ?? []).reduce((a, b) => a + b, 0), distribuicoesPE)
              : null;
            const tir = ativa && r ? tirAnual(this._fluxoInvestidor(c, r)) : null;
            return html`
              <tr>
                <td>${c.nome}</td>
                <td>${TIPOS.find((t) => t.valor === c.tipo)?.rotulo || c.tipo}</td>
                <td>${STATUS.find((s) => s.valor === c.status)?.rotulo || c.status}</td>
                <td class="num">${fmtR$(n(c.compromisso))}</td>
                <td class="num">${liberado === null ? '—' : fmtR$(liberado)}</td>
                <td class="num">${saldoFinal === null || saldoFinal === undefined ? '—' : fmtR$(saldoFinal)}</td>
                <td class="num">${moicPE === null ? '—' : moicPE.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + 'x'}</td>
                <td class="num">${tir === null ? '—' : (tir * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'}</td>
              </tr>`;
          })}
        </tbody>
      </table>
    `;
  }

  /**
   * §8.3: fluxo de caixa do investidor/credor DESSA camada, mês a mês —
   * aporte/liberação negativo (sai do bolso dele), recebimento positivo. É
   * o insumo do `tirAnual` — cada tipo lê os campos que já existem no
   * resultado, sem recalcular nada que o motor não tenha feito.
   */
  private _fluxoInvestidor(c: any, r: ResultadoCapitalStack): number[] {
    const tam = r.caixaProjetoMensal.length;
    const fluxo = new Array<number>(tam).fill(0);
    if (c.tipo === 'financiamento_producao' || c.tipo === 'capital_giro') {
      const liberado = r.liberacaoPorInstrumento[c.nome] ?? [];
      const pago = r.amortizacaoPorInstrumento[c.nome] ?? [];
      for (let t = 0; t < tam; t++) fluxo[t] = (pago[t] ?? 0) - (liberado[t] ?? 0);
    } else if (c.tipo === 'preferred_equity') {
      const aportado = r.aportePorInstrumentoPE[c.nome] ?? [];
      const devolvido = r.devolucaoPrincipalPE[c.nome] ?? [];
      const remun = r.remuneracaoPagaPE[c.nome] ?? [];
      const receita = r.participacaoReceitaPE[c.nome] ?? [];
      const residual = r.participacaoResidualPE[c.nome] ?? [];
      const lucro = r.participacaoLucroPE[c.nome] ?? [];
      for (let t = 0; t < tam; t++) {
        fluxo[t] = (devolvido[t] ?? 0) + (remun[t] ?? 0) + (receita[t] ?? 0) + (residual[t] ?? 0) + (lucro[t] ?? 0) - (aportado[t] ?? 0);
      }
    } else if (c.tipo === 'sponsor_equity') {
      const aportado = r.aportePorInstrumentoSponsor[c.nome] ?? [];
      const distribuido = r.distribuicaoPorInstrumentoSponsor[c.nome] ?? [];
      for (let t = 0; t < tam; t++) fluxo[t] = (distribuido[t] ?? 0) - (aportado[t] ?? 0);
    }
    return fluxo;
  }

  /** Liberado/aportado por camada — mesma leitura de `_renderResultadosPorCamada`, + sponsor (só usado pelo gráfico). */
  private _liberadoOuAportado(c: any): number {
    const r = this.resultado;
    if (!r || c.status !== 'ativo') return 0;
    if (c.tipo === 'financiamento_producao' || c.tipo === 'capital_giro') {
      return (r.liberacaoPorInstrumento[c.nome] ?? []).reduce((a, b) => a + b, 0);
    }
    if (c.tipo === 'preferred_equity') {
      return (r.aportePorInstrumentoPE[c.nome] ?? []).reduce((a, b) => a + b, 0);
    }
    if (c.tipo === 'sponsor_equity') {
      // Por instrumento — com 2+ Sponsor Equity ativos, `aporteSponsorMensal`
      // é o AGREGADO de todos; usar direto aqui contaria o mesmo valor em
      // cada camada.
      return (r.aportePorInstrumentoSponsor[c.nome] ?? []).reduce((a, b) => a + b, 0);
    }
    return 0;
  }

  /** Lê `compromisso` do draft em edição, sem criar entrada nova (`_draftDe` criaria e afetaria "Salvar camada"). */
  private _compromissoAtual(c: any): number {
    const d = this.draft[c.id];
    return n(d ? d.compromisso : c.compromisso);
  }

  /**
   * §9 "Visualizações" — gráfico de Capital Stack comprometido × utilizado,
   * uma barra dupla por camada. SVG puro (sem lib externa, mesmo padrão do
   * resto do app) — recalcula a cada tecla porque lê `this.resultado`
   * (já a prévia via `_recalcular`) e `_compromissoAtual` (o draft em edição).
   */
  private _renderGraficoComprometidoUtilizado(): TemplateResult {
    if (this.camadas.length === 0) return html`${nothing}`;
    const linhas = this.camadas.map((c) => ({
      nome: c.nome, comprometido: this._compromissoAtual(c), utilizado: this._liberadoOuAportado(c),
    }));
    const max = Math.max(1, ...linhas.flatMap((l) => [l.comprometido, l.utilizado]));
    const altLinha = 34;
    const alturaTotal = linhas.length * altLinha;
    const larguraBarraMax = 260; // eixo X fixo em unidades de viewBox; escala visual via viewBox + width:100%
    return html`
      <div class="grafico-card">
        <h4>Capital comprometido × utilizado, por camada</h4>
        <svg class="grafico" viewBox="0 0 400 ${alturaTotal}" preserveAspectRatio="xMinYMin meet">
          ${linhas.map((l, i) => {
            const y = i * altLinha;
            const wComprometido = (l.comprometido / max) * larguraBarraMax;
            const wUtilizado = (l.utilizado / max) * larguraBarraMax;
            return html`
              <text x="0" y=${y + 10} class="rotulo-camada">${l.nome}</text>
              <rect x="0" y=${y + 14} width=${wComprometido} height="7" class="barra-comprometido"></rect>
              <rect x="0" y=${y + 22} width=${wUtilizado} height="7" class="barra-utilizado"></rect>
              <text x=${wComprometido + 4} y=${y + 20} class="rotulo-barra">${fmtR$(l.comprometido)}</text>
              <text x=${wUtilizado + 4} y=${y + 28} class="rotulo-barra">${fmtR$(l.utilizado)}</text>
            `;
          })}
        </svg>
        <div class="grafico-legenda">
          <span><i class="ponto" style="background:var(--cor-texto-sec, rgba(255,255,255,0.25))"></i>Comprometido</span>
          <span><i class="ponto" style="background:var(--cor-info, #4a90d9)"></i>Utilizado (liberado/aportado)</span>
        </div>
      </div>
    `;
  }

  /**
   * §9 "Visualizações" — gráfico mensal de aportes/liberações (entradas de
   * funding) × pagamentos/distribuições (saídas de funding), via a mesma
   * agregação `fundingEntradasSaidasMensal` que a tabela/exportação (item 2)
   * vai consumir — nunca soma as linhas de novo aqui.
   */
  private _renderGraficoMensal(): TemplateResult {
    const r = this.resultado;
    if (!r || r.caixaProjetoMensal.length <= 1) return html`${nothing}`;
    const { entradas, saidas } = fundingEntradasSaidasMensal(r);
    const meses = entradas.length - 1;
    const max = Math.max(1, ...entradas.slice(1), ...saidas.slice(1));
    const largura = 400, altura = 140, margemBaixo = 16;
    const x = (t: number) => (meses <= 1 ? 0 : ((t - 1) / (meses - 1)) * largura);
    const y = (v: number) => altura - margemBaixo - (v / max) * (altura - margemBaixo);
    const pontos = (serie: number[]) => serie.slice(1).map((v, i) => `${x(i + 1)},${y(v)}`).join(' ');
    return html`
      <div class="grafico-card">
        <h4>Funding mensal — entradas × saídas</h4>
        <svg class="grafico" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="xMinYMin meet">
          <polyline points=${pontos(entradas)} class="linha-entradas"></polyline>
          <polyline points=${pontos(saidas)} class="linha-saidas"></polyline>
          <text x="0" y=${altura} class="eixo-mes">mês 1</text>
          <text x=${largura} y=${altura} text-anchor="end" class="eixo-mes">mês ${meses}</text>
        </svg>
        <div class="grafico-legenda">
          <span><i class="ponto" style="background:var(--cor-sucesso, #13a98d)"></i>Entradas (liberações/aportes)</span>
          <span><i class="ponto" style="background:var(--cor-erro, #d45a3a)"></i>Saídas (juros/amortização/retorno)</span>
        </div>
      </div>
    `;
  }

  private _renderCamposDivida(c: any, d: any, dis: boolean): TemplateResult {
    const ehFinanciamento = c.tipo === 'financiamento_producao';
    return html`
      <div class="secao">
        <h4>Remuneração e amortização</h4>
        <div class="grid">
          ${this._numConfig(c, d, 'taxaAnual', 'Taxa', '% a.a.', dis)}
          <div class="sel-campo">
            <span class="sel-rotulo">Amortização</span>
            <urbi-select ?desabilitado=${dis} .valor=${d.config?.politicaAmortizacao || 'cash_sweep'} .opcoes=${POLITICAS}
              @urbi:select-change=${(e: CustomEvent) => this._setConfig(c, 'politicaAmortizacao', e.detail.valor)}></urbi-select>
          </div>
          ${d.config?.politicaAmortizacao === 'bullet'
            ? this._numConfig(c, d, 'vencimentoMes', 'Vencimento', 'mês', dis)
            : nothing}
          ${d.config?.politicaAmortizacao === 'price' ? html`
            ${this._numConfig(c, d, 'carenciaMeses', 'Carência', 'mês', dis)}
            ${this._numConfig(c, d, 'prazoMeses', 'Prazo total (inclui carência)', 'mês', dis)}
          ` : nothing}
          ${ehFinanciamento ? this._numConfig(c, d, 'percentualFinanciavel', '% financiável do custo elegível', '%', dis) : nothing}
        </div>
      </div>
      ${ehFinanciamento ? html`
        <div class="secao">
          <h4>Custos elegíveis (linhas de custo do estudo)</h4>
          <div class="custo-lista">
            ${this.custos.map((custo) => html`
              <urbi-checkbox
                label=${`${custo.categoria || 'Custo'} — ${fmtR$(n(custo.orcamento_valor))}`}
                ?desabilitado=${dis}
                ?marcado=${(d.config?.custoLinhaIds ?? []).includes(custo.id)}
                @urbi:checkbox-change=${(e: CustomEvent) => this._toggleCustoElegivel(c, custo.id, e.detail.marcado)}
              ></urbi-checkbox>`)}
          </div>
        </div>` : nothing}
      <div class="secao">
        <h4>Liberação programada (mês, valor)</h4>
        ${(d.config?.liberacaoProgramada ?? []).map((l: any, i: number) => html`
          <div class="linha-lista">
            <viab-num casas-decimais="0" sufixo="º mês" ?desabilitado=${dis} .valor=${l.mes}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'liberacaoProgramada', i, 'mes', e.detail.valor ?? 1)}></viab-num>
            <viab-num casas-decimais="2" sufixo="R$" ?desabilitado=${dis} .valor=${l.valor}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'liberacaoProgramada', i, 'valor', e.detail.valor ?? 0)}></viab-num>
            ${!dis ? html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => this._delLinhaLista(c, 'liberacaoProgramada', i)}></urbi-botao>` : nothing}
          </div>`)}
        ${!dis ? html`<urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
          @click=${() => this._addLinhaLista(c, 'liberacaoProgramada')}>Adicionar liberação</urbi-botao>` : nothing}
      </div>
    `;
  }

  private _renderCamposPreferredEquity(c: any, d: any, dis: boolean): TemplateResult {
    const modo = d.config?.modo || 'A';
    return html`
      <div class="secao">
        <h4>Remuneração</h4>
        <div class="grid">
          <div class="sel-campo">
            <span class="sel-rotulo">Modo</span>
            <urbi-select ?desabilitado=${dis} .valor=${modo} .opcoes=${MODOS_PE}
              @urbi:select-change=${(e: CustomEvent) => this._setConfig(c, 'modo', e.detail.valor)}></urbi-select>
          </div>
          ${modo === 'A' ? html`
            ${this._numConfig(c, d, 'taxaAnual', 'Retorno preferencial', '% a.a.', dis)}
            <div class="sel-campo">
              <span class="sel-rotulo">Capitalização</span>
              <urbi-select ?desabilitado=${dis} .valor=${d.config?.capitalizacao || 'simples'}
                .opcoes=${[{ valor: 'simples', rotulo: 'Simples' }, { valor: 'composta', rotulo: 'Composta' }]}
                @urbi:select-change=${(e: CustomEvent) => this._setConfig(c, 'capitalizacao', e.detail.valor)}></urbi-select>
            </div>` : nothing}
          ${modo === 'B' ? html`
            ${this._numConfig(c, d, 'percentualResidualEvento', '% do residual', '%', dis)}
            ${this._numConfig(c, d, 'mesEvento', 'Mês do evento', 'mês', dis)}` : nothing}
          ${modo === 'C' ? this._numConfig(c, d, 'percentualReceitaLiquida', '% da receita líquida', '%', dis) : nothing}
          ${modo === 'D' ? html`
            ${this._numConfig(c, d, 'percentualLucro', '% do lucro final do projeto', '%', dis)}
            ${this._numConfig(c, d, 'mesEntregaLucro', 'Mês de entrega (1º pagamento no mês seguinte)', 'mês', dis)}
            ${this._numConfig(c, d, 'parcelasLucro', 'Nº de parcelas (mensais, iguais)', 'mês', dis)}
          ` : nothing}
        </div>
      </div>
      <div class="secao">
        <h4>Aportes (mês, valor)</h4>
        ${(d.config?.aportes ?? []).map((a: any, i: number) => html`
          <div class="linha-lista">
            <viab-num casas-decimais="0" sufixo="º mês" ?desabilitado=${dis} .valor=${a.mes}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'aportes', i, 'mes', e.detail.valor ?? 1)}></viab-num>
            <viab-num casas-decimais="2" sufixo="R$" ?desabilitado=${dis} .valor=${a.valor}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'aportes', i, 'valor', e.detail.valor ?? 0)}></viab-num>
            ${!dis ? html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => this._delLinhaLista(c, 'aportes', i)}></urbi-botao>` : nothing}
          </div>`)}
        ${!dis ? html`<urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
          @click=${() => this._addLinhaLista(c, 'aportes')}>Adicionar aporte</urbi-botao>` : nothing}
      </div>
    `;
  }

  private _renderCamposSponsor(c: any, d: any, dis: boolean): TemplateResult {
    return html`
      <div class="secao">
        <h4>Cobertura e remuneração</h4>
        <div class="grid">
          <urbi-checkbox label="Cobre lacuna de funding automaticamente" ?desabilitado=${dis}
            ?marcado=${Boolean(d.config?.cobreLacunaAutomatica)}
            @urbi:checkbox-change=${(e: CustomEvent) => this._setConfig(c, 'cobreLacunaAutomatica', e.detail.marcado)}></urbi-checkbox>
          ${this._numConfig(c, d, 'percentualReceitaLiquida', '% da receita líquida (vazio = residual do waterfall)', '%', dis)}
        </div>
      </div>
      <div class="secao">
        <h4>Aportes programados (mês, valor)</h4>
        ${(d.config?.aportesProgramados ?? []).map((a: any, i: number) => html`
          <div class="linha-lista">
            <viab-num casas-decimais="0" sufixo="º mês" ?desabilitado=${dis} .valor=${a.mes}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'aportesProgramados', i, 'mes', e.detail.valor ?? 1)}></viab-num>
            <viab-num casas-decimais="2" sufixo="R$" ?desabilitado=${dis} .valor=${a.valor}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setLinhaLista(c, 'aportesProgramados', i, 'valor', e.detail.valor ?? 0)}></viab-num>
            ${!dis ? html`<urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${() => this._delLinhaLista(c, 'aportesProgramados', i)}></urbi-botao>` : nothing}
          </div>`)}
        ${!dis ? html`<urbi-botao variante="secundario" pequeno icone="fa-solid fa-plus"
          @click=${() => this._addLinhaLista(c, 'aportesProgramados')}>Adicionar aporte</urbi-botao>` : nothing}
      </div>
    `;
  }

  /** Campo numérico ligado a `config`, com valor guardado como % (÷100 na leitura pelo motor). */
  private _numConfig(c: any, d: any, campo: string, label: string, sufixo: string, dis: boolean): TemplateResult {
    return html`<viab-num label=${label} sufixo=${sufixo} casas-decimais="2" ?desabilitado=${dis}
      .valor=${d.config?.[campo] !== undefined ? Number(d.config[campo]) * (sufixo === '%' || sufixo === '% a.a.' ? 100 : 1) : null}
      @urbi:input-numero-change=${(e: CustomEvent) => {
        const bruto = e.detail.valor ?? 0;
        const salvar = (sufixo === '%' || sufixo === '% a.a.') ? bruto / 100 : bruto;
        this._setConfig(c, campo, salvar);
      }}
    ></viab-num>`;
  }

  private _renderCamada(c: any): TemplateResult {
    const dis = !this.editavel;
    const d = this._draftDe(c);
    const temAlteracao = c.id in this.draft;
    const foraDeUso = c.status !== 'ativo';
    return html`
      <urbi-card>
        <div class="camada-cab">
          <urbi-input ?desabilitado=${dis} .valor=${d.nome || ''}
            @urbi:input-change=${(e: CustomEvent) => this._setCampo(c, 'nome', e.detail.valor)}></urbi-input>
          <urbi-badge cor=${foraDeUso ? 'alerta' : 'sucesso'}>${STATUS.find((s) => s.valor === c.status)?.rotulo || c.status}</urbi-badge>
          <span class="espaco"></span>
          ${!dis ? html`
            <urbi-botao variante="secundario" pequeno icone="fa-solid fa-arrow-up"
              title="Mover para cima"
              ?desabilitado=${this.camadas[0]?.id === c.id || this.movendoId !== null}
              @click=${() => this._mover(c, -1)}></urbi-botao>
            <urbi-botao variante="secundario" pequeno icone="fa-solid fa-arrow-down"
              title="Mover para baixo"
              ?desabilitado=${this.camadas[this.camadas.length - 1]?.id === c.id || this.movendoId !== null}
              @click=${() => this._mover(c, 1)}></urbi-botao>
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash" @click=${() => this._remover(c)}></urbi-botao>` : nothing}
        </div>
        <div class="secao">
          <h4>Detalhes gerais</h4>
          <div class="grid">
            <span class="sec">${TIPOS.find((t) => t.valor === c.tipo)?.rotulo || c.tipo}</span>
            <div class="sel-campo">
              <span class="sel-rotulo">Status</span>
              <urbi-select ?desabilitado=${dis} .valor=${d.status || 'rascunho'} .opcoes=${STATUS}
                @urbi:select-change=${(e: CustomEvent) => this._setCampo(c, 'status', e.detail.valor)}></urbi-select>
            </div>
            <viab-num label="Compromisso" sufixo="R$" casas-decimais="2" ?desabilitado=${dis} .valor=${n(d.compromisso)}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setCampo(c, 'compromisso', e.detail.valor ?? 0)}></viab-num>
            <viab-num label="Prioridade de funding" sufixo="" casas-decimais="0" ?desabilitado=${dis} .valor=${n(d.prioridade_funding)}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setCampo(c, 'prioridade_funding', e.detail.valor ?? 0)}></viab-num>
            <viab-num label="Prioridade de pagamento" sufixo="" casas-decimais="0" ?desabilitado=${dis} .valor=${n(d.prioridade_pagamento)}
              @urbi:input-numero-change=${(e: CustomEvent) => this._setCampo(c, 'prioridade_pagamento', e.detail.valor ?? 0)}></viab-num>
          </div>
        </div>
        ${c.tipo === 'financiamento_producao' || c.tipo === 'capital_giro' ? this._renderCamposDivida(c, d, dis) : nothing}
        ${c.tipo === 'preferred_equity' ? this._renderCamposPreferredEquity(c, d, dis) : nothing}
        ${c.tipo === 'sponsor_equity' ? this._renderCamposSponsor(c, d, dis) : nothing}
        ${!dis ? html`
          <div class="form-acoes">
            <urbi-botao variante="primario" ?desabilitado=${!temAlteracao} ?carregando=${this.salvandoId === c.id}
              @click=${() => this._salvar(c)}>Salvar camada</urbi-botao>
          </div>` : nothing}
      </urbi-card>
    `;
  }

  render(): TemplateResult {
    if (this.estudo?.nivel_analise !== 'avancado') return html`${nothing}`;
    if (this.carregando) return html`<p class="sec">Carregando…</p>`;
    return html`
      ${this._renderResumo()}
      ${this._renderResultadosPorCamada()}
      <div class="graficos">
        ${this._renderGraficoComprometidoUtilizado()}
        ${this._renderGraficoMensal()}
      </div>
      <div class="camadas">
        ${this.camadas.map((c) => this._renderCamada(c))}
      </div>
      ${this.editavel ? html`
        <div class="add-topo" style="margin-top:16px">
          <span class="sel-rotulo">Adicionar camada</span>
          <div class="grid" style="margin-top:6px">
            ${TIPOS.map((t) => html`
              <urbi-botao variante="secundario" pequeno ?carregando=${this.criando}
                @click=${() => this._adicionar(t.valor)}>${t.rotulo}</urbi-botao>`)}
          </div>
        </div>` : nothing}
    `;
  }
}
