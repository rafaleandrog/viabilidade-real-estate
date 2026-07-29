// Análise de Mercado — schemas, prompts e normalização da IA (#200).
//
// Módulo PURO: sem express, sem SDK, sem I/O. É onde mora a defesa contra o
// risco central da issue — "um preço inventado entra na viabilidade e vira
// decisão de investimento". Prompt é conselho; o que VINCULA é a normalização
// aqui, que descarta todo número sem procedência antes de ele chegar ao banco.
//
// Coberto por backend/mercado-ia.test.ts.

import { FATORES } from './apelo-comercial.js';

/**
 * Eixos de relevância da coleta e da análise — são os MESMOS 6 fatores do
 * Apelo Comercial, reusados de propósito: o app já definiu por quais
 * parâmetros uma região é avaliada (localização, infraestrutura, vetor de
 * crescimento, concorrência, demanda, segurança jurídica). Uma notícia sobre a
 * região só interessa se tocar um desses eixos; um segundo vocabulário de
 * relevância criaria duas definições concorrentes de "região boa".
 */
export const EIXOS_RELEVANCIA = FATORES.map((f) => ({ chave: f.chave, nome: f.nome }));

/** Confiança declarada pela IA para cada indicador. `sem_dado` é resposta válida. */
export const CONFIANCAS = ['alta', 'media', 'baixa', 'sem_dado'] as const;
export type Confianca = (typeof CONFIANCAS)[number];

const indicadorSchema = (descricao: string) => ({
  type: 'object',
  properties: {
    valor: { type: ['number', 'null'], description: `${descricao}. null quando não houver dado.` },
    origem: { type: 'string', description: 'Fonte concreta do número (publicação, índice, portal). Vazio se não houver.' },
    confianca: { type: 'string', enum: [...CONFIANCAS] },
    observacao: { type: 'string' },
  },
  required: ['valor', 'origem', 'confianca'],
});

/** Structured output da ANÁLISE de mercado de um estudo (#200). */
export const SCHEMA_ANALISE = {
  type: 'object',
  properties: {
    abrangencia: {
      type: 'string', enum: ['municipio', 'uf', 'nacional'],
      description: 'Nível geográfico REAL dos dados usados. Use o mais específico que você tiver de verdade.',
    },
    localidade: { type: 'string', description: 'Município/UF a que os números se referem.' },
    data_referencia: { type: 'string', description: 'Mês/ano de referência dos dados (ex.: 07/2026).' },

    preco_medio_m2: indicadorSchema('Preço médio de venda praticado, em R$/m² de área privativa'),
    custo_obra_m2: indicadorSchema('Custo de obra de mercado, em R$/m² de área privativa'),
    vso_pct: indicadorSchema('VSO — vendas sobre oferta, em % ao mês'),
    ipca_pct: indicadorSchema('IPCA acumulado 12 meses, em %'),
    selic_pct: indicadorSchema('Selic meta atual, em % a.a.'),
    incc_pct: indicadorSchema('INCC acumulado 12 meses, em %'),
    focus_ipca_pct: indicadorSchema('IPCA projetado pelo boletim Focus para o ano corrente, em %'),
    focus_selic_pct: indicadorSchema('Selic projetada pelo boletim Focus para o fim do ano corrente, em % a.a.'),

    riscos: {
      type: 'array',
      description: 'Sinais de risco para a viabilidade. Lista vazia é resposta válida.',
      items: {
        type: 'object',
        properties: {
          eixo: { type: 'string', enum: EIXOS_RELEVANCIA.map((e) => e.chave) },
          severidade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          titulo: { type: 'string' },
          descricao: { type: 'string' },
          origem: { type: 'string' },
        },
        required: ['eixo', 'severidade', 'titulo', 'descricao'],
      },
    },
    limitacoes: {
      type: 'string',
      description: 'O que NÃO foi possível apurar e por quê. Preencha sempre que algum indicador vier sem dado.',
    },
  },
  required: ['abrangencia', 'localidade', 'riscos', 'limitacoes'],
};

/** Structured output da TRIAGEM diária de um item coletado (IA barata). */
export const SCHEMA_TRIAGEM = {
  type: 'object',
  properties: {
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['noticia', 'anuncio'] },
          titulo: { type: 'string' },
          resumo: { type: 'string', description: 'Uma a duas frases, factuais, sem opinião.' },
          url: { type: 'string' },
          fonte: { type: 'string' },
          publicado_em: { type: 'string' },
          eixo: { type: 'string', enum: EIXOS_RELEVANCIA.map((e) => e.chave) },
          relevancia: { type: 'number', description: '0 a 5. Descarte o item se for 0.' },
        },
        required: ['tipo', 'titulo', 'resumo', 'relevancia'],
      },
    },
  },
  required: ['itens'],
};

/** Instruções de sistema da análise — a regra anti-invenção vem primeiro. */
export function instrucoesSistemaAnalise(): string {
  return [
    'Você apoia uma análise de viabilidade imobiliária comparando um empreendimento com o mercado da região.',
    '',
    'REGRA ABSOLUTA — nunca invente número. Se você não tem um dado concreto para um indicador,',
    'devolva `valor: null` e `confianca: "sem_dado"`. Um preço inventado entra num estudo de',
    'viabilidade e vira decisão de investimento de milhões. "Não sei" é uma resposta correta e',
    'esperada; um número plausível porém inventado é uma falha grave.',
    '',
    'Para todo indicador com valor preenchido, informe em `origem` a fonte concreta (publicação,',
    'índice, portal, boletim) e a `confianca`. Sem origem concreta, o valor deve ser null.',
    '',
    'Use `observacao` para o INSIGHT daquele indicador — uma frase que ajude a interpretar o número',
    '(o que explica o patamar, o que mudou, o que observar). Ela é exibida ao lado do próprio',
    'indicador, então fale só dele; não repita ali a análise geral nem as limitações.',
    '',
    'Use em `abrangencia` o nível geográfico que você REALMENTE tem: se não houver série do',
    'município, responda `uf` ou `nacional` e diga isso em `limitacoes`. Não apresente um dado',
    'nacional como se fosse local.',
    '',
    `Avalie riscos pelos eixos já usados por este app: ${EIXOS_RELEVANCIA.map((e) => e.nome).join(', ')}.`,
    'Riscos devem ser específicos e verificáveis, não genéricos ("mercado pode oscilar" não é risco).',
  ].join('\n');
}

/** Instruções da triagem diária — roda no slot barato, então é curta e objetiva. */
export function instrucoesSistemaTriagem(): string {
  return [
    'Você tria conteúdo bruto sobre uma região para uma análise de mercado imobiliário.',
    'Para cada item recebido, produza título, resumo factual de 1–2 frases e classifique:',
    `- \`eixo\`: um de ${EIXOS_RELEVANCIA.map((e) => e.chave).join(', ')};`,
    '- `tipo`: `noticia` ou `anuncio` (anúncio de oferta de imóvel);',
    '- `relevancia`: 0 a 5 para uma decisão de viabilidade imobiliária naquela região.',
    '',
    'Não invente item, URL, fonte nem data: use apenas o que veio no conteúdo. Se o conteúdo não',
    'permitir preencher um campo, deixe-o vazio. Itens irrelevantes recebem relevancia 0.',
  ].join('\n');
}

/**
 * Termos de busca de uma região. Junta o nome/UF às palavras-chave que o
 * usuário cadastrou; sem palavras-chave, cai num conjunto derivado dos eixos de
 * avaliação — assim uma região recém-cadastrada já coleta algo útil.
 */
export function termosBusca(regiao: { nome?: string; uf?: string; palavras_chave?: string | null }): string[] {
  const nome = String(regiao?.nome ?? '').trim();
  if (!nome) return [];
  const uf = String(regiao?.uf ?? '').trim();
  const local = uf ? `${nome} ${uf}` : nome;
  const chaves = String(regiao?.palavras_chave ?? '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const base = chaves.length > 0
    ? chaves
    : ['imóveis à venda', 'lançamento imobiliário', 'obras e infraestrutura', 'mercado imobiliário'];
  return base.map((t) => `${local} ${t}`);
}

// `Number(null)`, `Number('')` e `Number([])` são todos 0 — e 0 é finito. Sem
// a guarda explícita, um indicador com `valor: null` viraria "R$ 0,00/m²" na
// tela, que é exatamente o número inventado que esta camada existe para barrar.
const num = (v: any): number | null => {
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

export interface IndicadorNormalizado {
  valor: number | null;
  origem: string;
  confianca: Confianca;
  observacao?: string;
}

/**
 * Aplica a regra anti-invenção sobre um indicador devolvido pela IA.
 *
 * Descarta o valor (vira `null` / `sem_dado`) quando:
 *  · não é número finito;
 *  · vem sem `origem` — número sem procedência não pode aparecer na tela;
 *  · vem com `confianca: 'sem_dado'` mas com valor preenchido (contradição);
 *  · é negativo — nenhum destes indicadores admite valor negativo.
 *
 * Esta é a trava REAL: o prompt pede, mas é aqui que se garante.
 */
export function normalizarIndicador(bruto: any): IndicadorNormalizado {
  const semDado: IndicadorNormalizado = { valor: null, origem: '', confianca: 'sem_dado' };
  if (!bruto || typeof bruto !== 'object') return semDado;
  const valor = num(bruto.valor);
  const origem = String(bruto.origem ?? '').trim();
  const confiancaBruta = String(bruto.confianca ?? '').trim() as Confianca;
  const confianca: Confianca = (CONFIANCAS as readonly string[]).includes(confiancaBruta)
    ? confiancaBruta : 'sem_dado';
  if (valor === null || valor < 0) return semDado;
  if (!origem) return semDado;
  if (confianca === 'sem_dado') return semDado;
  const out: IndicadorNormalizado = { valor, origem, confianca };
  const obs = String(bruto.observacao ?? '').trim();
  if (obs) out.observacao = obs;
  return out;
}

export const CAMPOS_INDICADOR = [
  'preco_medio_m2', 'custo_obra_m2', 'vso_pct',
  'ipca_pct', 'selic_pct', 'incc_pct', 'focus_ipca_pct', 'focus_selic_pct',
] as const;

export interface AnaliseNormalizada {
  abrangencia: 'municipio' | 'uf' | 'nacional';
  localidade: string;
  data_referencia: string;
  indicadores: Record<string, IndicadorNormalizado>;
  riscos: { eixo: string; severidade: string; titulo: string; descricao: string; origem?: string }[];
  limitacoes: string;
}

/** Normaliza a resposta inteira da IA antes de persistir. */
export function normalizarAnalise(bruto: any): AnaliseNormalizada {
  const abrangenciaBruta = String(bruto?.abrangencia ?? '').trim();
  const abrangencia = (['municipio', 'uf', 'nacional'].includes(abrangenciaBruta)
    ? abrangenciaBruta : 'nacional') as AnaliseNormalizada['abrangencia'];

  const indicadores: Record<string, IndicadorNormalizado> = {};
  for (const campo of CAMPOS_INDICADOR) indicadores[campo] = normalizarIndicador(bruto?.[campo]);

  const eixosValidos = EIXOS_RELEVANCIA.map((e) => e.chave);
  const riscos = (Array.isArray(bruto?.riscos) ? bruto.riscos : [])
    .map((r: any) => ({
      eixo: eixosValidos.includes(String(r?.eixo)) ? String(r.eixo) : 'localizacao',
      severidade: ['alta', 'media', 'baixa'].includes(String(r?.severidade)) ? String(r.severidade) : 'baixa',
      titulo: String(r?.titulo ?? '').trim(),
      descricao: String(r?.descricao ?? '').trim(),
      origem: String(r?.origem ?? '').trim() || undefined,
    }))
    // Risco sem título nem descrição não diz nada ao usuário — não ocupa espaço na tela.
    .filter((r: any) => r.titulo || r.descricao);

  return {
    abrangencia,
    localidade: String(bruto?.localidade ?? '').trim(),
    data_referencia: String(bruto?.data_referencia ?? '').trim(),
    indicadores,
    riscos,
    limitacoes: String(bruto?.limitacoes ?? '').trim(),
  };
}

/** Normaliza um item da triagem diária. Devolve `null` se for descartável. */
export function normalizarItemColeta(bruto: any): {
  tipo: 'noticia' | 'anuncio'; titulo: string; resumo: string;
  url: string; fonte: string; publicado_em: string; relevancia: number;
} | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const titulo = String(bruto.titulo ?? '').trim();
  if (!titulo) return null;
  const relevancia = Math.max(0, Math.min(5, Math.round(num(bruto.relevancia) ?? 0)));
  if (relevancia <= 0) return null; // a própria IA marcou como irrelevante
  const url = String(bruto.url ?? '').trim();
  // Só http/https — evita javascript:/data: chegarem a um href na tela.
  const urlSegura = /^https?:\/\//i.test(url) ? url : '';
  return {
    tipo: bruto.tipo === 'anuncio' ? 'anuncio' : 'noticia',
    titulo,
    resumo: String(bruto.resumo ?? '').trim(),
    url: urlSegura,
    fonte: String(bruto.fonte ?? '').trim(),
    publicado_em: String(bruto.publicado_em ?? '').trim(),
    relevancia,
  };
}

/**
 * Monta o contexto textual da análise de um estudo. Recebe já pronto o que o
 * estudo sabe (localidade, tipologias, preço praticado, absorção) e o que a
 * coleta diária juntou sobre a região — é isso que diferencia esta análise de
 * uma pergunta genérica a um modelo.
 */
export function montarContextoAnalise(entrada: {
  localidade: string;
  tipoEmpreendimento: string;
  areaPrivativaTotal: number;
  unidades: number;
  precoMedioM2Projeto: number | null;
  custoObraM2Projeto: number | null;
  vsoProjetoPct: number | null;
  coletas: { titulo: string; resumo: string; fonte?: string; publicado_em?: string; tipo?: string }[];
}): string {
  const l: string[] = [];
  l.push('EMPREENDIMENTO EM ESTUDO');
  l.push(`- Localidade: ${entrada.localidade || 'não informada'}`);
  l.push(`- Tipo: ${entrada.tipoEmpreendimento || 'não informado'}`);
  if (entrada.unidades > 0) l.push(`- Unidades: ${entrada.unidades}`);
  if (entrada.areaPrivativaTotal > 0) l.push(`- Área privativa total: ${entrada.areaPrivativaTotal.toFixed(2)} m²`);
  if (entrada.precoMedioM2Projeto !== null) l.push(`- Preço praticado no projeto: R$ ${entrada.precoMedioM2Projeto.toFixed(2)}/m²`);
  if (entrada.custoObraM2Projeto !== null) l.push(`- Custo de obra do projeto: R$ ${entrada.custoObraM2Projeto.toFixed(2)}/m²`);
  if (entrada.vsoProjetoPct !== null) l.push(`- Velocidade de vendas premissada: ${entrada.vsoProjetoPct.toFixed(1)}% ao mês`);

  l.push('');
  if (entrada.coletas.length === 0) {
    l.push('CONTEÚDO COLETADO SOBRE A REGIÃO: nenhum.');
    l.push('Não há coleta recente para esta região. Não preencha indicadores por suposição.');
  } else {
    l.push(`CONTEÚDO COLETADO SOBRE A REGIÃO (${entrada.coletas.length} itens):`);
    for (const c of entrada.coletas) {
      const meta = [c.fonte, c.publicado_em].filter(Boolean).join(', ');
      l.push(`- [${c.tipo ?? 'noticia'}] ${c.titulo}${meta ? ` (${meta})` : ''}: ${c.resumo}`);
    }
  }
  l.push('');
  l.push('Compare o projeto com o mercado desta localidade e aponte sinais de risco.');
  l.push('Indicador sem dado concreto: valor null e confianca "sem_dado".');
  return l.join('\n');
}
