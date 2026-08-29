import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { STATUS_LABEL, TIPO_LABEL, NIVEL_LABEL, COR_STATUS, formatarData } from './viab-shared.js';
import { estiloPrimitivo, estiloConteudo } from './estilos.js';
import { fmtR$, fmtPct, fmtNum, fmtM2 } from './viab-format.js';
import { calcularProforma } from './proforma.js';
import { calcularFluxo, type FluxoConfig } from './fluxo-caixa-motor.js';
import { areaPrivativaTotalLinhas } from './fluxo-shared.js';
import { proformaAvancado } from './proforma-avancado.js';
import {
  urbiVerso, listarEstudos, criarEstudo, duplicarEstudo, removerEstudo, transicaoStatus,
  listarRegioesMercado,
  listarGlebasNucleo, listarLotesNucleo,
  listarReceitasAvancado, listarCustosAvancado, listarCurvas,
  buscarCronogramaAvancado, buscarParametrosAvancado,
} from './viabilidade-api.js';
import './viabilidade-config-benchmarks.js';
import './viabilidade-config-curvas.js';
import './viabilidade-config-mercado.js';

/**
 * As grandezas que a listagem mostra, prontas — as mesmas que a sub-aba Proforma
 * do estudo mostra, para a tabela nunca contar história diferente da tela.
 *
 * `areaPrivativa`, `areaConstruida` e `roiPct` entraram com o Painel de estudos.
 * As três saem da MESMA definição nos dois níveis, o que é o ponto: coluna que
 * compara Preliminar com Avançado precisa comparar a mesma conta.
 *   - `areaConstruida` = área privativa + área comum (`proforma.ts`, cascata de
 *     Incorporação). Loteamento não tem área comum: fica igual à privativa.
 *   - `roiPct` = resultado / (custo direto + indireto) × 100 — a fórmula do
 *     Preliminar, aplicada às séries do Avançado.
 */
export interface ResumoListagem {
  vgv: number;
  resultado: number;
  margemPct: number;
  areaPrivativa: number;
  areaConstruida: number;
  roiPct: number;
}

/**
 * #577: nível de análise para exibição na tabela de Estudos — sempre resolve,
 * inclusive para um estudo persistido ANTES desta coluna existir.
 * `nivel_analise` tem `padrao: "preliminar"` no schema.json (linha 14); uma
 * linha sem o campo lê "preliminar", que é o valor CORRETO (o mesmo default
 * que já rege `resumoListagem` acima ao escolher `calcularProforma` em vez de
 * `proformaAvancado`), não um fallback inventado por esta função. Pura e
 * exportada para o mesmo motivo de `resumoListagem`: testável sem montar o
 * componente Lit.
 */
export function nivelExibicao(l: any): 'preliminar' | 'avancado' {
  return l?.nivel_analise === 'avancado' ? 'avancado' : 'preliminar';
}

/**
 * #578: filtro da listagem de Estudos, SEM segmentação por autor. Até este PR
 * a tabela escondia estudo de outros membros da equipe atrás do chip "Meus
 * estudos" (o padrão ao abrir a aba); o pedido do autor foi literal — "Tirar
 * isso e deixar como estava antes, sempre mostra a tabela com os estudos
 * direto". `GET /estudos` (`backend/rotas/estudos.ts:263-282`) já resolve
 * QUEM enxerga cada linha por membership; o recorte por autor era uma
 * segunda peneira só do cliente, por cima disso — removê-la não expõe nada
 * que o backend não tivesse mandado, só para de esconder o que ele mandou.
 * A regra transversal da leva (Rodada 10, 2026-08-26) é que a mudança vale
 * para estudo JÁ PERSISTIDO: não há coluna nova nem migração aqui, então todo
 * estudo existente já sai visível assim que este filtro deixa de aplicar
 * `autor_id`. Pura e exportada pelo mesmo motivo de `resumoListagem`/
 * `nivelExibicao`: prova de mutação sem montar o componente Lit.
 */
export function linhasEstudosFiltradas(
  estudos: any[],
  filtros: { tipo?: string; status?: string },
  mostrarArquivados: boolean,
): any[] {
  return estudos.filter((e) =>
    (!filtros.tipo || e.tipo_empreendimento === filtros.tipo) &&
    (!filtros.status || e.status === filtros.status) &&
    // Arquivado é o estado "fora do radar": some da lista a menos que o botão
    // de arquivados esteja ligado. Filtrar por status "Arquivado" no seletor
    // continua funcionando — quem pediu explicitamente quer ver.
    (mostrarArquivados || filtros.status === 'arquivado' || e.status !== 'arquivado'));
}

/**
 * #406: um estudo Avançado não tem os campos fixos que `calcularProforma`
 * (motor do Preliminar) lê — por isso a listagem mostrava "—" em VGV,
 * Resultado e Margem para todo estudo Avançado, mesmo com os números prontos
 * na sub-aba Proforma. `calculosAvancado` é preenchido de forma assíncrona
 * (`_calcularUmAvancado`, cálculo pesado — várias chamadas de API + motor),
 * então esta função tem TRÊS desfechos possíveis para um estudo Avançado,
 * não dois:
 *
 *   - a chave está ausente do mapa → ainda não terminou de calcular;
 *   - a chave é `'indisponivel'` → calculou e deu erro, ou não há receita
 *     modelada (`vgv <= 0`, mesmo guard do Preliminar);
 *   - a chave tem o resultado → pronto para exibir.
 *
 * Pura e exportada para ter teste sem precisar montar o componente Lit —
 * mesmo padrão de `linhasFinanciaveisPadrao`/`instrumentoDeRegistro` em
 * `capital-stack-motor.ts`: a lógica de decisão fica testável, a tela só
 * consome o resultado.
 */
export function resumoListagem(
  linha: any,
  calculosAvancado: Record<number, ResumoListagem | 'indisponivel'>,
): ResumoListagem | null | 'carregando' {
  if (linha.nivel_analise === 'avancado') {
    const calc = calculosAvancado[linha.id];
    if (calc === undefined) return 'carregando';
    if (calc === 'indisponivel') return null;
    return calc.vgv > 0 ? calc : null;
  }
  const p = calcularProforma(linha);
  return p.vgv > 0
    ? {
        vgv: p.vgv,
        resultado: p.resultado,
        // #571: `margemLiquidaPct` só é `null` quando `vgv <= 0` — o `? :`
        // acima já garante `p.vgv > 0` aqui, então o `?? 0` é só para o
        // typechecker (que não relaciona os dois campos); nunca dispara.
        margemPct: p.margemLiquidaPct ?? 0,
        areaPrivativa: p.areaPrivativa,
        // Loteamento não modela área comum: `areaConstruida` fica 0 no motor, e
        // exibir "0,00 m²" ao lado de uma área privativa real seria mentira. A
        // área construída de um loteamento É a privativa (os lotes).
        areaConstruida: p.areaConstruida > 0 ? p.areaConstruida : p.areaPrivativa,
        roiPct: p.roiPct,
      }
    : null;
}

@customElement('viab-tela-dashboard')
export class ViabTelaDashboard extends LitElement {
  // BUG7-16: 'curvas' — dupla exposição igual ao Benchmark (aba de topo aqui +
  // telas_config.curvas em Admin → Apps, inalterado).
  // #437: 'regioes' — dupla exposição igual a Benchmark e Curvas (aba de topo
  // aqui + telas_config.mercado_regioes em Admin → Apps, inalterado).
  @property({ type: String }) aba: 'estudos' | 'terrenos' | 'benchmark' | 'curvas' | 'regioes' = 'estudos';

  @state() private estudos: any[] = [];
  // #406: VGV/Resultado/Margem dos estudos Avançados, preenchidos sob demanda
  // (não bloqueia o primeiro render da tabela — as linhas Preliminar aparecem
  // na hora, as Avançadas mostram "…" até a própria linha resolver).
  @state() private calculosAvancado: Record<number, ResumoListagem | 'indisponivel'> = {};
  @state() private carregando = true;
  @state() private filtros: Record<string, string> = {};
  /** Arquivado sai da lista por padrão — é o estado "fora do radar". */
  @state() private mostrarArquivados = false;
  @state() private statusEmCurso: number | null = null;
  /** id → região de mercado, para a coluna Cidade. Uma chamada por página, não por linha. */
  @state() private regioes: Record<number, { nome: string; uf: string }> = {};
  @state() private mostrarForm = false;
  @state() private form: Record<string, any> = {};
  @state() private salvando = false;
  @state() private formErro = '';
  @state() private removerAlvo: any = null;
  @state() private terrenos: any[] = [];
  @state() private filtroTerreno = '';
  @state() private terrenosCarregando = false;
  @state() private terrenosDisponivel = true;
  @state() private terrenosMotivo = '';
  private terrenosCarregados = false;

  static styles = [estiloPrimitivo, estiloConteudo, css`
    .form-campos { display: flex; flex-direction: column; gap: 12px; }
    .form-acoes { display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
    .acoes-linha { display: inline-flex; gap: 6px; }
    .cel-nome { font-weight: 600; }
    .cel-criador { display: inline-flex; align-items: center; }
    /* #475: o token que estava aqui nunca existiu — nem em compartilhado/tokens.css
       nem em nenhum outro arquivo do monorepo. O fallback dele era, portanto, a cor
       EFETIVA, sempre: branco a 6%, calibrado para tema escuro, e invisível nos três
       temas claros que o shell tem desde 2026-08-19. O fallback agora é cinza médio,
       que sobrevive aos quatro temas; scripts/guard-tokens-css.mjs impede a volta. */
    .miniatura {
      width: 40px; height: 28px; border-radius: 6px; object-fit: cover; display: block;
      background: var(--cor-superficie-sutil, rgba(128,128,128,0.08));
    }
    .miniatura-vazia {
      width: 40px; height: 28px; border-radius: 6px; display: block;
      background: var(--cor-superficie-sutil, rgba(128,128,128,0.08));
    }
    .filtros-bar { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .filtros-bar urbi-select { min-width: 200px; }
    .nivel-campo label { display: block; font-size: var(--texto-rotulo, 0.75rem); color: var(--cor-texto-sec, rgba(255,255,255,0.5)); margin-bottom: 6px; }
    .nivel-badges { display: flex; gap: 6px; }
    .nivel-apoio { margin-top: 6px; font-size: var(--texto-rotulo, 0.75rem); color: var(--cor-texto-sec, rgba(255,255,255,0.5)); }
  `];

  private readonly _abas = [
    { id: 'estudos', label: 'Estudos', icone: 'fa-solid fa-chart-line' },
    { id: 'terrenos', label: 'Terrenos', icone: 'fa-solid fa-map-location-dot' },
    { id: 'benchmark', label: 'Benchmark', icone: 'fa-solid fa-gauge-high' },
    { id: 'curvas', label: 'Curvas', icone: 'fa-solid fa-wave-square' },
    // O mesmo ícone que a própria tela usa (`viabilidade-config-mercado.ts:96`),
    // e distinto do `fa-map-location-dot` de Terrenos: duas abas de topo com o
    // mesmo ícone é exatamente o tipo de coisa que faz não achar a página.
    { id: 'regioes', label: 'Regiões monitoradas', icone: 'fa-solid fa-location-dot' },
  ];

  connectedCallback() {
    super.connectedCallback();
    this._carregar();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('aba') && this.aba === 'estudos') this._carregar();
    if (changed.has('aba') && this.aba === 'terrenos' && !this.terrenosCarregados) this._carregarTerrenos();
  }

  private async _carregarTerrenos() {
    this.terrenosCarregando = true;
    this.terrenosDisponivel = true;
    this.terrenosMotivo = '';
    try {
      const [glebas, lotes] = await Promise.all([listarGlebasNucleo(), listarLotesNucleo()]);
      const g = (glebas?.dados ?? []).map((o: any) => ({ ...o, _tipo: 'gleba' }));
      const l = (lotes?.dados ?? []).map((o: any) => ({ ...o, _tipo: 'lote' }));
      this.terrenos = [...g, ...l];
      this.terrenosCarregados = true;
    } catch (e: any) {
      this.terrenosDisponivel = false;
      this.terrenosMotivo = e?.message || 'Indisponível';
    }
    this.terrenosCarregando = false;
  }

  private async _carregar() {
    this.carregando = true;
    this.calculosAvancado = {};
    try {
      const res = await listarEstudos({});
      this.estudos = res?.dados || [];
    } catch (e) {
      console.error('Erro ao listar estudos:', e);
    }
    this.carregando = false;
    this._calcularAvancados();
    this._carregarRegioes();
  }

  /**
   * Regiões de mercado, para a coluna Cidade. É GLOBAL (não por estudo), então
   * vem uma vez por página — mesmo raciocínio de `listarCurvas()` em
   * `_calcularAvancados`. Falha aqui não derruba a tabela: a coluna cai para a
   * `uf`, que é o que o estudo já carrega.
   */
  private async _carregarRegioes() {
    if (Object.keys(this.regioes).length > 0) return;
    try {
      const res = await listarRegioesMercado();
      const mapa: Record<number, { nome: string; uf: string }> = {};
      for (const r of res?.dados ?? []) mapa[Number(r.id)] = { nome: r.nome, uf: r.uf };
      this.regioes = mapa;
    } catch {
      // Silêncio de propósito: a coluna degrada para `uf` e a tabela segue.
    }
  }

  /**
   * #406: dispara o cálculo de VGV/Resultado/Margem de todo estudo Avançado
   * da página — em paralelo, sem bloquear `_carregar()`. `listarCurvas()` é
   * GLOBAL (não por estudo), então é buscada UMA vez aqui e compartilhada
   * entre todas as linhas, em vez de N vezes dentro de cada uma.
   */
  private async _calcularAvancados() {
    const avancados = this.estudos.filter((e) => e.nivel_analise === 'avancado');
    if (avancados.length === 0) return;
    const curvasRes = await listarCurvas().catch(() => null);
    const curvas = curvasRes?.erro ? [] : (curvasRes?.dados || []);
    await Promise.all(avancados.map((e) => this._calcularUmAvancado(e, curvas)));
  }

  /**
   * Reproduz exatamente o caminho da sub-aba Proforma (`tela-fluxo-ver.ts`
   * `_carregar`/`_recalcular`) — para que o número da listagem nunca divirja
   * do que o usuário vê ao abrir o estudo. Cada linha resolve de forma
   * independente: uma falha não derruba as demais.
   *
   * ⚠️ #426: a proforma é DESALAVANCADA, então este caminho não carrega mais
   * as operações de Funding — elas não movem nenhuma das quatro colunas (VGV,
   * Resultado, Margem, ROI). Efeito colateral: um request a menos por estudo
   * Avançado da página.
   */
  private async _calcularUmAvancado(estudo: any, curvas: any[]) {
    try {
      const [receitas, custos, crono, params] = await Promise.all([
        listarReceitasAvancado(estudo.id),
        listarCustosAvancado(estudo.id),
        buscarCronogramaAvancado(estudo.id),
        buscarParametrosAvancado(estudo.id),
      ]);
      const linhasReceita = receitas?.erro ? [] : (receitas.dados || []);
      const linhasCusto = custos?.erro ? [] : (custos.dados || []);
      const cronograma = crono?.erro ? [] : (crono.dados || []);
      const taxaDescontoAa = params?.erro ? 12 : Number(params.taxa_desconto_aa ?? 12);
      const config: FluxoConfig = {
        dataInicio: params?.erro ? null : (params.data_inicio_projeto ?? null),
        taxaDescontoAa,
        cronograma,
        linhasReceita,
        linhasCusto,
        curvas,
        areaTerreno: Number(estudo?.terreno_manual_area) || Number(estudo?.area_terreno_nucleo) || 0,
        ret: params?.erro ? undefined : { ativo: params.considerar_ret === true, pct: Number(params.ret_pct ?? 4) },
        // #473: default true preserva o comportamento histórico (VGV bruto).
        corretagemSobrePermutaFisica: estudo?.corretagem_sobre_permuta_fisica !== false,
        // #594 (achado P1 do App de revisão, rodada 2) — o deflator de preço da
        // área aberta (#462) FALTAVA aqui, e só aqui. `tela-fluxo-ver.ts` já o
        // passava, então num estudo com `deflator_area_aberta_pct` diferente de
        // zero e produto com área privativa aberta esta listagem calculava VGV,
        // Resultado, Margem e ROI sobre o preço CHEIO da área aberta, enquanto a
        // sub-aba Proforma do mesmo estudo calculava sobre o preço deflacionado.
        // Duas leituras do mesmo estudo, dois números — exatamente a classe de
        // defeito que a #443 registrou para VGV e Margem.
        //
        // ⚠️ CONSEQUÊNCIA DECLARADA: para esses estudos as quatro colunas mudam
        // de valor nesta listagem. Elas passam a coincidir com a tela do estudo,
        // que é o comportamento correto — mas não é uma mudança invisível.
        // Ausente ou 0 reproduz exatamente o número anterior, então o estudo sem
        // deflator não muda.
        deflatorAreaAbertaPct: Number(estudo?.deflator_area_aberta_pct) || 0,
      };
      const c = calcularFluxo(config);

      // #474: este arquivo NÃO é (mais) consumidor da cadeia dos Passos
      // 23–25 (fundingDoEstudo + fluxoAcumulado) — a #521/#529 (proforma do
      // Avançado desalavancada) tiraram daqui a chamada a `fundingDoEstudo`
      // que existia na vistoria de pré-PR da issue. `proformaAvancado` nem
      // recebe funding (#426). Os cinco consumidores reais estão listados em
      // `docs/viabilidade/fluxo-investidor-formulas.md` §9 — não adicione
      // este arquivo de volta à lista sem reintroduzir a chamada.
      const area = areaPrivativaTotalLinhas(linhasReceita);
      const p = proformaAvancado(c, area);
      // A área privativa já era calculada aqui e DESCARTADA — o mapa só guardava
      // VGV/Resultado/Margem. Agora ela sai junto, sem custo nenhum.
      //
      // Área construída: o Avançado não modela área comum nas suas séries, mas o
      // estudo tem o campo `area_comum_total` (é o mesmo que o Preliminar soma em
      // `proforma.ts`). Somar os dois mantém a coluna com UMA definição só nos
      // dois níveis; sem o campo preenchido, cai na privativa, como no Loteamento.
      const areaComum = Number(estudo?.area_comum_total) || 0;
      // #427 — a EVI fecha com TRÊS leituras (Resultado / +Perm. Financ. /
      // +Permutas — ver `proforma-avancado.ts`). O Painel só declara UMA: esta
      // continua sendo `p.resultado`/`p.margemPct`, a leitura "= Resultado"
      // (sem permutas) — igual ao que já vale para o Preliminar
      // (`p.margemLiquidaPct` em `resumoListagem` acima). Não muda de valor.
      this.calculosAvancado = {
        ...this.calculosAvancado,
        [estudo.id]: {
          vgv: p.vgv,
          resultado: p.resultado,
          // #604: `margemPct` virou `number | null` (indefinido com Receita
          // Bruta ≤ 0). O `?? 0` aqui é a MESMA convenção que o Preliminar já
          // usa em `resumoListagem` acima, e pelo mesmo motivo: `resumoListagem`
          // devolve `null` — some do Painel — quando `calc.vgv <= 0`, então
          // esta linha nunca chega à tela com a base inválida. **O Painel não
          // muda de comportamento com esta issue.** Trocá-lo por "—" é decisão
          // de desenho de uma tabela compacta, e vale igualmente para o
          // Preliminar: fica fora desta issue, de propósito.
          margemPct: p.margemPct ?? 0,
          areaPrivativa: p.areaPrivativa,
          areaConstruida: p.areaPrivativa + areaComum,
          roiPct: p.roiPct,
        },
      };
    } catch (e) {
      console.error(`Erro ao calcular VGV/Resultado/Margem do estudo ${estudo.id}:`, e);
      this.calculosAvancado = { ...this.calculosAvancado, [estudo.id]: 'indisponivel' };
    }
  }

  render() {
    return html`
      <urbi-shell-page dashboard titulo="Painel de estudos">
        ${this.aba === 'estudos'
          ? html`
              <urbi-botao
                slot="actions"
                variante=${this.mostrarArquivados ? 'secundario' : 'fantasma'}
                pequeno
                icone="fa-solid fa-box-archive"
                title=${this.mostrarArquivados ? 'Ocultar arquivados' : 'Mostrar arquivados'}
                @click=${() => { this.mostrarArquivados = !this.mostrarArquivados; }}
              ></urbi-botao>
              <urbi-botao
                slot="actions"
                variante="primario"
                pequeno
                icone="fa-solid fa-plus"
                @click=${this._abrirForm}
              >Criar estudo</urbi-botao>`
          : nothing}

        <urbi-abas
          expandir
          .abas=${this._abas}
          .ativa=${this.aba}
          @urbi:aba-selecionar=${(e: CustomEvent) => {
            const id = e.detail?.id;
            urbiVerso.navegarSub(
              id === 'terrenos' ? '/terrenos'
                : id === 'benchmark' ? '/benchmarks'
                : id === 'curvas' ? '/curvas'
                : id === 'regioes' ? '/regioes'
                : '/');
          }}
        >
          <urbi-hospedeiro slot="estudos">${this._renderEstudos()}</urbi-hospedeiro>
          <urbi-hospedeiro slot="terrenos">${this._renderTerrenos()}</urbi-hospedeiro>
          <urbi-hospedeiro slot="benchmark">
            <viabilidade-config-benchmarks
              .somenteLeitura=${urbiVerso.contexto()?.nivel !== 'admin'}
            ></viabilidade-config-benchmarks>
          </urbi-hospedeiro>
          <urbi-hospedeiro slot="curvas">
            <viabilidade-config-curvas></viabilidade-config-curvas>
          </urbi-hospedeiro>
          <urbi-hospedeiro slot="regioes">
            <viabilidade-config-mercado></viabilidade-config-mercado>
          </urbi-hospedeiro>
        </urbi-abas>
      </urbi-shell-page>

      ${this.mostrarForm ? this._renderForm() : nothing}
      ${this.removerAlvo ? this._renderConfirmRemover() : nothing}
    `;
  }

  /**
   * Cidade — o `schema.json` não tem a coluna. O mais próximo que o estudo já
   * carrega é a região de mercado (`mercado_regioes.nome`, que na prática é o
   * município) e a `uf`. Deriva daí em vez de inventar campo: a alternativa
   * seria migração de schema, que é mudança de outra natureza e merece PR
   * próprio. Sem nada dos dois, "—" honesto.
   */
  private _cidade(l: any): string {
    const regiao = this.regioes[Number(l.regiao_mercado_id)];
    if (regiao?.nome) return l.uf && regiao.uf !== l.uf ? `${regiao.nome} · ${l.uf}` : regiao.nome;
    return l.uf || '—';
  }

  /** Área do terreno: mesma escolha por origem que o motor faz (`proforma.ts`). */
  private _areaTerreno(l: any): number | null {
    const v = Number(l.terreno_manual_area) || Number(l.area_terreno_nucleo) || 0;
    return v > 0 ? v : null;
  }

  private _colunas() {
    // "…" enquanto a linha Avançada ainda está calculando (assíncrono, não
    // bloqueia o resto da tabela); "—" quando terminou e não há dado suficiente
    // — mesmo guard de sempre (`vgv > 0`), para os dois níveis.
    const numero = (fn: (p: ResumoListagem) => string): (l: unknown) => string =>
      (l) => {
        const r = resumoListagem(l, this.calculosAvancado);
        if (r === 'carregando') return '…';
        return r ? fn(r) : '—';
      };
    // #443 itens 2 e 6: "VGV" e "Margem" são colunas ÚNICAS que misturam DUAS
    // grandezas — o Preliminar lê `proforma.ts`, o Avançado lê
    // `proforma-avancado.ts`, e as fórmulas divergem (ver `resumoListagem`
    // acima). Uma coluna não pode ter dois rótulos, e colapsar as duas na
    // mesma grandeza moveria o número de um dos níveis — fora do escopo de
    // "sem unificar as definições" desta issue. Saída escolhida: rótulo
    // genérico + `title` (tooltip nativo) por LINHA, dizendo qual é qual.
    // Inventário completo em `frontend/rotulos-indicador.ts`.
    const numeroTitulo = (
      fn: (p: ResumoListagem) => string,
      titulo: (l: any) => string,
    ): ((l: any) => TemplateResult) => (l) => {
      const r = resumoListagem(l, this.calculosAvancado);
      if (r === 'carregando') return html`…`;
      if (!r) return html`—`;
      return html`<span title=${titulo(l)}>${fn(r)}</span>`;
    };
    return [
      {
        id: 'imagem', label: '', largura: '52px',
        render: (l: any) => l.imagem_principal_url
          ? html`<img class="miniatura" src=${l.imagem_principal_url} alt="" loading="lazy">`
          : html`<span class="miniatura-vazia" aria-hidden="true"></span>`,
      },
      {
        id: 'nome', label: 'Nome do estudo',
        render: (l: any) => html`<span class="cel-nome">${l.nome_exibicao || l.nome}</span>`,
      },
      {
        id: 'status', label: 'Status', alinhamento: 'centro',
        render: (l: any) => this._renderStatus(l),
      },
      {
        // #577: a tabela sabia o nível (usava para escolher a fórmula de VGV/
        // Margem, ver `numeroTitulo` abaixo) mas só mostrava via `title`
        // (tooltip), invisível sem passar o mouse. Coluna própria, legível
        // direto — badge igual ao padrão de `status` acima.
        id: 'nivel_analise', label: 'Nível', alinhamento: 'centro',
        render: (l: any) => {
          const n = nivelExibicao(l);
          return html`<urbi-badge cor=${n === 'avancado' ? 'info' : 'padrao'}>${NIVEL_LABEL[n]}</urbi-badge>`;
        },
      },
      {
        id: 'area_terreno', label: 'Área do terreno', alinhamento: 'direita',
        valor: (l: any) => { const a = this._areaTerreno(l); return a == null ? '—' : fmtM2(a); },
      },
      { id: 'area_privativa', label: 'Área privativa', alinhamento: 'direita',
        valor: numero((p) => (p.areaPrivativa > 0 ? fmtM2(p.areaPrivativa) : '—')) },
      { id: 'area_construida', label: 'Área total construída', alinhamento: 'direita',
        valor: numero((p) => (p.areaConstruida > 0 ? fmtM2(p.areaConstruida) : '—')) },
      {
        id: 'vgv', label: 'VGV', alinhamento: 'direita',
        render: numeroTitulo(
          (p) => fmtR$(p.vgv),
          (l) => l.nivel_analise === 'avancado'
            ? 'Receita Bruta — recebimento realizado no fluxo de caixa (Avançado)'
            : 'VGV nominal — soma dos preços das unidades (Preliminar)',
        ),
      },
      {
        id: 'margem', label: 'Margem', alinhamento: 'direita',
        render: numeroTitulo(
          (p) => fmtPct(p.margemPct),
          (l) => l.nivel_analise === 'avancado'
            ? 'Margem sobre Receita Bruta — "= Resultado", sem permutas (Avançado)'
            : 'Margem sobre VGV — resultado / VGV nominal (Preliminar)',
        ),
      },
      // ROI já é uma fórmula só nos dois níveis (resultado / investimentoTotal
      // — ver comentário de `ResumoListagem` acima), então não precisa de title.
      { id: 'roi', label: 'ROI', alinhamento: 'direita', valor: numero((p) => fmtPct(p.roiPct)) },
      {
        id: 'criador', label: 'Criador', alinhamento: 'centro',
        // `autor_nome`/`autor_avatar_url` já vinham na listagem (junção declarada
        // no schema) e nunca eram exibidos. Zero custo de backend.
        render: (l: any) => html`
          <span class="cel-criador" title=${l.autor_nome || ''}>
            <urbi-avatar tamanho="28" nome=${l.autor_nome || '?'} foto=${l.autor_avatar_url || ''}></urbi-avatar>
          </span>`,
      },
      { id: 'cidade', label: 'Cidade', valor: (l: any) => this._cidade(l) },
      {
        id: 'acoes', label: '',
        render: (l: any) => html`
          <div class="acoes-linha">
            <urbi-botao variante="fantasma" pequeno icone="fa-solid fa-copy"
              @click=${(ev: Event) => { ev.stopPropagation(); this._duplicar(l.id); }}
              title="Duplicar">Duplicar</urbi-botao>
            <urbi-botao variante="perigo" pequeno icone="fa-solid fa-trash"
              @click=${(ev: Event) => { ev.stopPropagation(); this.removerAlvo = l; }}
              title="Remover"></urbi-botao>
          </div>`,
      },
    ];
  }

  /**
   * Status na linha, editável — o chevron da referência visual.
   *
   * Quem decide se a transição vale é o BACKEND (`gateTransicao`, em
   * `backend/rotas/estudos.ts`), não esta tela: a regra depende do papel do
   * usuário no estudo e mora do outro lado. Replicar a tabela de transições aqui
   * criaria uma segunda fonte de verdade, que é a armadilha que a #281 arrasta
   * até hoje com as duas formatações de R$. Então oferecemos os status e
   * deixamos o 422 `TRANSICAO_INVALIDA` responder, virando notificação.
   *
   * Leitor não muda status de nada — para ele, badge simples.
   */
  private _renderStatus(l: any) {
    const cor = COR_STATUS[l.status] ?? 'padrao';
    const rotulo = STATUS_LABEL[l.status] || l.status;
    if (l._funcao === 'leitor') {
      return html`<urbi-badge cor=${cor}>${rotulo}</urbi-badge>`;
    }
    return html`
      <urbi-select
        .valor=${l.status}
        ?desabilitado=${this.statusEmCurso === l.id}
        .opcoes=${Object.entries(STATUS_LABEL).map(([valor, r]) => ({ valor, rotulo: r }))}
        @click=${(ev: Event) => ev.stopPropagation()}
        @urbi:select-change=${(ev: CustomEvent) => {
          ev.stopPropagation();
          this._mudarStatus(l, ev.detail?.valor);
        }}
      ></urbi-select>`;
  }

  private async _mudarStatus(l: any, novo: string) {
    if (!novo || novo === l.status) return;
    this.statusEmCurso = l.id;
    const anterior = l.status;
    try {
      await transicaoStatus(l.id, novo);
      this.estudos = this.estudos.map((e) => (e.id === l.id ? { ...e, status: novo } : e));
      urbiVerso.notificar(`Status de "${l.nome_exibicao || l.nome}" agora é ${STATUS_LABEL[novo] || novo}.`, 'sucesso');
    } catch (e: any) {
      // O backend recusou (transição inválida ou falta de alçada). A linha volta
      // ao que era — sem isso o select ficaria mostrando um estado que o servidor
      // não tem, que é pior que a recusa.
      this.estudos = this.estudos.map((x) => (x.id === l.id ? { ...x, status: anterior } : x));
      urbiVerso.notificar(e?.message || 'Não foi possível mudar o status desse estudo.', 'erro');
    }
    this.statusEmCurso = null;
  }

  private _linhasFiltradas() {
    return linhasEstudosFiltradas(this.estudos, this.filtros, this.mostrarArquivados);
  }

  private _renderEstudos(): TemplateResult {
    return html`
      <div class="filtros-bar">
        <urbi-select
          label="Tipo de empreendimento"
          .valor=${this.filtros.tipo ?? ''}
          .opcoes=${[
            { valor: '', rotulo: 'Todos os tipos' },
            { valor: 'loteamento', rotulo: 'Loteamento' },
            { valor: 'incorporacao', rotulo: 'Incorporação' },
          ]}
          @urbi:select-change=${(e: CustomEvent) => { this.filtros = { ...this.filtros, tipo: e.detail.valor }; }}
        ></urbi-select>
        <urbi-select
          label="Status"
          .valor=${this.filtros.status ?? ''}
          .opcoes=${[
            { valor: '', rotulo: 'Todos os status' },
            ...Object.entries(STATUS_LABEL).map(([valor, rotulo]) => ({ valor, rotulo })),
          ]}
          @urbi:select-change=${(e: CustomEvent) => { this.filtros = { ...this.filtros, status: e.detail.valor }; }}
        ></urbi-select>
      </div>
      <urbi-tabela
        expandir
        clicavel
        .colunas=${this._colunas()}
        .linhas=${this._linhasFiltradas()}
        ?carregando=${this.carregando}
        mensagem-vazio="Nenhum estudo ainda. Clique em “Criar estudo”."
        @urbi:tabela-click=${(e: CustomEvent) => {
          const l = e.detail?.linha; if (l?.id) urbiVerso.navegarSub(`/detalhe/${l.id}`);
        }}
      ></urbi-tabela>
    `;
  }

  private _renderTerrenos(): TemplateResult {
    if (this.terrenosCarregando) {
      return html`<urbi-loading mensagem="Carregando imóveis do Núcleo..."></urbi-loading>`;
    }
    if (!this.terrenosDisponivel) {
      return html`
        <urbi-card titulo="Terrenos (via Núcleo)">
          <urbi-banner variante="alerta">
            Integração com o Núcleo indisponível ou sem permissão de leitura (${this.terrenosMotivo}).
            Um administrador pode liberar em <strong>Admin → Apps → viabilidade → Núcleo</strong>.
            Enquanto isso, cadastre o terreno no estudo pelo modo <strong>“Inserir novo”</strong>.
          </urbi-banner>
        </urbi-card>
      `;
    }
    const colunas = [
      { id: 'tipo', label: 'Tipo', valor: (l: any) => (l._tipo === 'gleba' ? 'Gleba' : 'Lote') },
      { id: 'nome', label: 'Imóvel', valor: (l: any) => l.id_legivel || `#${l.id}` },
      { id: 'area', label: 'Área', alinhamento: 'direita', valor: (l: any) => `${fmtNum(Number(l.area) || 0)} m²` },
    ];
    const linhas = this.filtroTerreno
      ? this.terrenos.filter((t) => t._tipo === this.filtroTerreno)
      : this.terrenos;
    return html`
      <div class="filtros-bar">
        <urbi-select
          label="Tipo de terreno"
          .valor=${this.filtroTerreno}
          .opcoes=${[
            { valor: '', rotulo: 'Todos os terrenos' },
            { valor: 'gleba', rotulo: 'Glebas' },
            { valor: 'lote', rotulo: 'Lotes' },
          ]}
          @urbi:select-change=${(e: CustomEvent) => { this.filtroTerreno = e.detail.valor; }}
        ></urbi-select>
      </div>
      <urbi-tabela
        expandir
        .colunas=${colunas}
        .linhas=${linhas}
        mensagem-vazio="Nenhuma gleba ou lote cadastrado no Núcleo."
      ></urbi-tabela>
    `;
  }

  private _abrirForm = () => {
    this.form = {
      nome: '', tipo_empreendimento: 'loteamento', nivel_analise: 'preliminar',
      origem_terreno: 'manual', uf: '',
    };
    this.formErro = '';
    this.mostrarForm = true;
  };

  private _renderForm(): TemplateResult {
    return html`
      <urbi-modal title="Novo estudo" @urbi-modal:close=${() => this.mostrarForm = false}>
        <div class="form-campos">
          <urbi-input
            label="Nome do estudo"
            obrigatorio
            placeholder="Ex: Pátio Urbitá 1"
            .valor=${this.form.nome || ''}
            @urbi:input-change=${(e: CustomEvent) => this.form = { ...this.form, nome: e.detail.valor }}
          ></urbi-input>

          <urbi-select
            label="Tipo de empreendimento"
            .valor=${this.form.tipo_empreendimento}
            .opcoes=${[
              { valor: 'loteamento', rotulo: 'Loteamento' },
              { valor: 'incorporacao', rotulo: 'Incorporação' },
            ]}
            @urbi:select-change=${(e: CustomEvent) => this.form = { ...this.form, tipo_empreendimento: e.detail.valor }}
          ></urbi-select>

          <div class="nivel-campo">
            <label>Nível de análise</label>
            <div class="nivel-badges" role="group" aria-label="Nível de análise">
              <urbi-badge cor="info" interativo ?ativo=${this.form.nivel_analise !== 'avancado'}
                @click=${() => this.form = { ...this.form, nivel_analise: 'preliminar' }}
              >Preliminar</urbi-badge>
              <urbi-badge cor="info" interativo ?ativo=${this.form.nivel_analise === 'avancado'}
                @click=${() => this.form = { ...this.form, nivel_analise: 'avancado' }}
              >Avançado</urbi-badge>
            </div>
            <div class="nivel-apoio">
              ${this.form.nivel_analise === 'avancado'
                ? 'Fluxo de caixa mês a mês com TIR, VPL e payback.'
                : 'Proforma estática, sem dimensão temporal.'}
            </div>
          </div>

          <urbi-select
            label="Origem do terreno"
            .valor=${this.form.origem_terreno}
            .opcoes=${[
              { valor: 'manual', rotulo: 'Inserir novo (manual)' },
              { valor: 'nucleo', rotulo: 'Buscar terreno (Núcleo)' },
            ]}
            @urbi:select-change=${(e: CustomEvent) => this.form = { ...this.form, origem_terreno: e.detail.valor }}
          ></urbi-select>

          <urbi-input
            label="UF"
            placeholder="DF"
            .valor=${this.form.uf || ''}
            @urbi:input-change=${(e: CustomEvent) => this.form = { ...this.form, uf: String(e.detail.valor || '').toUpperCase().slice(0, 2) }}
          ></urbi-input>

          ${this.formErro ? html`<urbi-banner variante="erro">${this.formErro}</urbi-banner>` : nothing}

          <div class="form-acoes">
            <urbi-botao variante="fantasma" @click=${() => this.mostrarForm = false}>Cancelar</urbi-botao>
            <urbi-botao variante="primario" ?carregando=${this.salvando} @click=${this._salvar}>Criar estudo</urbi-botao>
          </div>
        </div>
      </urbi-modal>
    `;
  }

  private _renderConfirmRemover(): TemplateResult {
    const nome = this.removerAlvo.nome_exibicao || this.removerAlvo.nome;
    return html`
      <urbi-modal title="Remover estudo" maxWidth="420px" @urbi-modal:close=${() => this.removerAlvo = null}>
        <div class="form-campos">
          <p>Remover o estudo <strong>${nome}</strong>? Esta ação não pode ser desfeita.</p>
          <div class="form-acoes">
            <urbi-botao variante="fantasma" @click=${() => this.removerAlvo = null}>Cancelar</urbi-botao>
            <urbi-botao variante="perigo" @click=${this._confirmarRemover}>Remover</urbi-botao>
          </div>
        </div>
      </urbi-modal>
    `;
  }

  private _salvar = async () => {
    if (!this.form.nome?.trim()) { this.formErro = 'Informe o nome do estudo.'; return; }
    this.salvando = true;
    this.formErro = '';
    try {
      const res = await criarEstudo({
        nome: this.form.nome.trim(),
        tipo_empreendimento: this.form.tipo_empreendimento,
        nivel_analise: this.form.nivel_analise,
        origem_terreno: this.form.origem_terreno,
        uf: this.form.uf || null,
      });
      if (res?.erro) { this.formErro = res.mensagem || 'Erro ao criar estudo'; return; }
      this.mostrarForm = false;
      urbiVerso.notificar('Estudo criado (rascunho).', 'sucesso');
      if (res?.id) urbiVerso.navegarSub(`/detalhe/${res.id}`);
    } catch (e: any) {
      this.formErro = e?.message || 'Erro ao criar estudo';
    } finally {
      this.salvando = false;
    }
  };

  private async _duplicar(id: number) {
    try {
      const res = await duplicarEstudo(id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao duplicar', 'erro'); return; }
      urbiVerso.notificar('Estudo duplicado.', 'sucesso');
      if (res?.id) urbiVerso.navegarSub(`/detalhe/${res.id}`);
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao duplicar', 'erro');
    }
  }

  private _confirmarRemover = async () => {
    const estudo = this.removerAlvo;
    this.removerAlvo = null;
    if (!estudo) return;
    try {
      const res = await removerEstudo(estudo.id);
      if (res?.erro) { urbiVerso.notificar(res.mensagem || 'Erro ao remover', 'erro'); return; }
      urbiVerso.notificar('Estudo removido.', 'sucesso');
      this._carregar();
    } catch (e: any) {
      urbiVerso.notificar(e?.message || 'Erro ao remover', 'erro');
    }
  };
}
