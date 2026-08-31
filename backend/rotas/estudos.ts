import { Router, type Request, type Response } from 'express';
import {
  resolverPermissaoEstudo,
  exigirMembro,
  exigirEditor,
  exigirAprovador,
  garantirMembro,
} from '../permissoes-estudo.js';
import {
  publicarEvento,
  inscreverMembroEstudo,
  payloadEstudoCriado,
  payloadStatusAlterado,
} from '../eventos-viabilidade.js';
import { gerarIdentificacao } from '../identificacao.js';
import { duplicarDadosAvancado } from './avancado.js';
import { CAMPOS as CAMPOS_PRODUTO } from './preliminar-produtos.js';

export const rotasEstudos: ReturnType<typeof Router> = Router();

const TIPOS = ['loteamento', 'incorporacao'];
const STATUS = ['rascunho', 'em_analise', 'aprovado', 'reprovado', 'arquivado'];

// Campos exclusivos do estudo Avançado (aba Financeiro + estrutura de capital).
// Num estudo Preliminar esses campos nunca são preenchidos e chegam como null no
// payload, disparando a validação numérica do shell. Filtrá-los no PATCH elimina
// o erro "Campo X deve ser um número" ao salvar Premissas de um Preliminar.
const CAMPOS_SOMENTE_AVANCADO = new Set([
  'taxa_desconto_aa', 'juros_tabela_aa_padrao',
  'estrutura_capital_proprio_pct', 'estrutura_financiamento_pct',
  'estrutura_investidores_pct', 'taxa_juros_valor_futuro_aa',
  'tarifas_bancarias_pct', 'taxa_adm_carteira_pct',
  'taxa_estruturacao_divida_pct', 'taxa_gerenciamento_obra_pct',
  'juros_financeiros_aa', 'juros_inicio_cobranca_mes',
  'indice_correcao', 'indice_correcao_taxa_aa',
  'regime_tributario', 'aliquota_pis_pct', 'aliquota_cofins_pct',
  'aliquota_csll_pct', 'aliquota_irpj_pct', 'aliquota_itbi_pct',
  'imposto_sobre_permuta_fisica',
  // #473: base da Corretagem de vendas quanto à permuta física — só existe
  // no motor do Avançado (`corretagemMensal`); o Preliminar não lê.
  'corretagem_sobre_permuta_fisica',
  'financiamento_obra_pct', 'financiamento_juros_aa',
  'financiamento_sistema_amortizacao', 'financiamento_prazo_meses',
  'financiamento_carencia_meses',
  'investidor_aporte_valor', 'investidor_retorno_tipo',
  'investidor_juros_aa', 'investidor_carencia_meses', 'investidor_parcelas',
  // #584: o DEFLATOR foi retirado do app — nenhum código lê mais este valor.
  // A entrada FICA nesta lista mesmo assim, e não é resíduo: ela não é um
  // leitor, é um FILTRO. `estudos.deflator_area_aberta_pct` continua sendo
  // coluna declarada e exclusiva do Avançado (caminho A da #584 mantém a
  // coluna inerte no `schema.json`), e `tela-premissas.ts` monta o PATCH a
  // partir do registro INTEIRO (`this.form = { ...this.estudo }`, `:477`,
  // reenviado em `:1313-1320`). Tirar a entrada faria o campo voltar a
  // alcançar o validador do shell num estudo Preliminar — o "Campo X deve ser
  // um número" que é a razão de ser desta lista, descrita no comentário do
  // topo. Se a coluna sair do schema pelo caminho canônico
  // (`dados.limparColuna`), esta linha sai junto, e só então.
  'deflator_area_aberta_pct',
]);

// Nunca via PATCH: identidade/estado/autor gerados, colunas de soft-delete
// geridas pelo framework (removido_em/removido_por_id — DADOS_CAMPO_RESERVADO se
// repassadas a req.dados.atualizar). tipo_empreendimento só em rascunho.
const CAMPOS_BLOQUEADOS_PATCH = new Set([
  'id', 'id_legivel', 'nome_exibicao', 'sequencia', 'status', 'autor_id',
  'criado_em', 'atualizado_em', 'removido_em', 'removido_por_id',
]);

/**
 * Decide o que um `PATCH /estudos/:id` grava, ou qual erro devolve.
 *
 * ⚠️ Extraída do handler pelo mesmo motivo de `gateTransicao` e
 * `montarCopiaEstudo`: enquanto morava inline, **nenhum teste a alcançava** —
 * nenhum arquivo de teste deste repositório sobe servidor. O guard mais
 * importante que ela carrega é o `NIVEL_IMUTAVEL`, e a #486 concluiu que
 * "não existe promoção Preliminar → Avançado" apoiada exatamente nele. Um
 * veredito que se apoia num guard sem teste é um veredito que envelhece calado.
 *
 * Devolve `{ dados }` quando o PATCH pode prosseguir, ou
 * `{ http, codigo, mensagem }` quando deve ser recusado.
 */
export function montarPatchEstudo(
  body: Record<string, any>,
  estudo: { nivel_analise?: string; status?: string },
): { dados: Record<string, any> } | { http: number; codigo: string; mensagem: string } {
  const dados: Record<string, any> = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (CAMPOS_BLOQUEADOS_PATCH.has(k)) continue;
    // Campos exclusivos do Avançado nunca chegam ao validador quando o estudo
    // é Preliminar (valores null disparariam "deve ser um número" no shell).
    if (estudo?.nivel_analise === 'preliminar' && CAMPOS_SOMENTE_AVANCADO.has(k)) continue;
    if (k === 'tipo_empreendimento' && estudo?.status !== 'rascunho') {
      return { http: 422, codigo: 'TIPO_TRAVADO', mensagem: 'tipo_empreendimento só pode mudar em Rascunho' };
    }
    // Nível de análise é imutável após a criação (Preliminar × Avançado definem
    // estruturas diferentes — trocar corromperia o estudo). Repetir o valor
    // atual é aceito e ignorado; qualquer outro valor é recusado.
    if (k === 'nivel_analise') {
      if (v !== estudo?.nivel_analise) {
        return { http: 422, codigo: 'NIVEL_IMUTAVEL', mensagem: 'nivel_analise não pode ser alterado após a criação do estudo' };
      }
      continue;
    }
    // #585: `juros_tabela_aa_padrao` deixou de ser um default de linhas novas e
    // passou a governar o cálculo de TODAS as linhas de receita do estudo. Uma
    // taxa negativa aqui não é um campo estranho numa tela — é o fluxo de caixa
    // inteiro invertido, e o motor não a rejeita (`taxaMensalDeAnual` só clampa
    // `aa <= -100`, para impedir `NaN`; `-5` produz uma mensal negativa
    // perfeitamente "válida").
    //
    // A tela barra em `erroJurosTabelaEstudo`, mas tela é feedback, não
    // fronteira: `PATCH /estudos/:id` é chamável direto, e qualquer tela futura
    // que reuse `atualizarEstudo` passa por aqui sem passar por lá.
    if (k === 'juros_tabela_aa_padrao' && v !== null && v !== undefined && v !== '') {
      const aa = Number(v);
      if (!Number.isFinite(aa) || aa < 0) {
        return {
          http: 400,
          codigo: 'TAXA_INVALIDA',
          mensagem: 'juros_tabela_aa_padrao deve ser um percentual ao ano maior ou igual a zero',
        };
      }
    }
    dados[k] = v;
  }
  if (Object.keys(dados).length === 0) {
    return { http: 400, codigo: 'NENHUM_CAMPO', mensagem: 'Nenhum campo para atualizar' };
  }
  return { dados };
}

// Campos que não são copiados na duplicação (gerados ou de junção do shell).
const CAMPOS_NAO_COPIAVEIS = new Set([
  'id', 'criado_em', 'atualizado_em', 'removido_em', 'removido_por_id',
  'id_legivel', 'nome_exibicao', 'sequencia', 'status',
  'autor_id', 'autor_nome', 'autor_avatar_url',
]);

// Monta o payload de campos copiáveis de um estudo para a duplicação.
// Além dos gerados/de junção (CAMPOS_NAO_COPIAVEIS), **omite valores nulos**: um
// Preliminar deixa os numéricos exclusivos do Avançado em `null`, e reenviá-los
// dispara "Campo X deve ser um número" no validador do shell (mesmo motivo do
// filtro CAMPOS_SOMENTE_AVANCADO no PATCH). Campo ausente na criação cai no
// default da coluna — idêntico ao POST /estudos, que só seta o que veio no body.
// `status`, `autor_id` e a identificação são atribuídos pelo chamador depois.
export function montarCopiaEstudo(orig: Record<string, any>): Record<string, any> {
  const copia: Record<string, any> = {};
  for (const [k, v] of Object.entries(orig)) {
    if (CAMPOS_NAO_COPIAVEIS.has(k)) continue;
    if (v === null || v === undefined) continue;
    copia[k] = v;
  }
  return copia;
}

function erro(res: Response, http: number, codigo: string, mensagem: string) {
  res.status(http).json({ erro: true, codigo, mensagem });
}

// Anexa `imagem_principal_url` (URL assinada da capa) a cada estudo da lista, para
// o thumbnail da tabela de estudos (S7 · #90). `estudo_documentos` é `restrito` →
// o download direto por sessão dá 403; a URL vem de req.arquivos.url (token
// assinado). Uma query só para todas as capas; mutação in-place. Arquivo
// ausente/expirado ou helper indisponível → url null (a lista segue funcionando).
async function anexarImagemPrincipal(req: Request, estudos: any[]): Promise<void> {
  for (const e of estudos) e.imagem_principal_url = null;
  if (estudos.length === 0 || !req.arquivos) return;
  const ids = new Set(estudos.map((e) => Number(e.id)));
  const docs = await req.dados!.listar('estudo_documentos', {
    filtros: { categoria: 'imagem_principal' }, ordenar: 'ordem', ordem: 'asc', por_pagina: 500,
  });
  // Primeira imagem principal (menor ordem) de cada estudo da lista.
  const arquivoPorEstudo = new Map<number, number>();
  for (const d of docs.dados) {
    const eid = Number(d.estudo_id);
    if (ids.has(eid) && !arquivoPorEstudo.has(eid) && d.documento != null) {
      arquivoPorEstudo.set(eid, Number(d.documento));
    }
  }
  for (const e of estudos) {
    const arqId = arquivoPorEstudo.get(Number(e.id));
    if (arqId == null) continue;
    try { e.imagem_principal_url = await req.arquivos!.url(arqId, 3600); }
    catch { /* arquivo removido/expirado → sem thumbnail */ }
  }
}

/**
 * Agrupa produtos do catálogo Preliminar (`preliminar_produtos`) por
 * `estudo_id`, mantendo só os estudos pedidos. Parte PURA de
 * `anexarProdutos`, separada para ter teste — o resto é I/O.
 */
export function agruparProdutosPorEstudo(
  produtos: any[],
  estudoIds: Set<number>,
): Map<number, any[]> {
  const porEstudo = new Map<number, any[]>();
  for (const p of produtos ?? []) {
    const eid = Number(p?.estudo_id);
    if (!estudoIds.has(eid)) continue;
    if (!porEstudo.has(eid)) porEstudo.set(eid, []);
    porEstudo.get(eid)!.push(p);
  }
  return porEstudo;
}

/**
 * #609 — as linhas de uma estrutura FILHA de estudo, prontas para `criar` no
 * estudo novo. Parte PURA da duplicação: escolhe os campos que viajam e
 * reaponta `estudo_id`, sem I/O.
 *
 * `campos` é sempre uma lista EXPLÍCITA, e não "tudo menos o id": uma coluna
 * nova entra na cópia só quando alguém a declara aqui, e é isso que impede um
 * `criado_em`/`id` de viajar junto e o `criar` recusar. Campo ausente na linha
 * de origem é OMITIDO (não vira `null`), para cair no `padrao` da coluna —
 * mesma regra de `montarCopiaEstudo`.
 */
export function montarCopiasFilhas(
  linhas: any[],
  novoEstudoId: number,
  campos: string[],
): Record<string, any>[] {
  return (linhas ?? []).map((linha) => {
    const copia: Record<string, any> = { estudo_id: novoEstudoId };
    for (const campo of campos) {
      const v = linha?.[campo];
      if (v === undefined) continue;
      copia[campo] = v;
    }
    return copia;
  });
}

// #609 — as estruturas filhas de `estudos` que a duplicação copia por simples
// remapeamento de `estudo_id`, com os campos que viajam em cada uma.
//
// ⚠️ NÃO estão aqui, e cada ausência é uma decisão:
//   · `estudo_imoveis` e as tabelas do Avançado — copiadas logo abaixo /  em
//     `duplicarDadosAvancado`, porque precisam de remapeamento de ids, não de
//     um `estudo_id` novo e mais nada;
//   · `estudo_documentos` e `apelo_comercial_documentos` — colunas do tipo
//     `arquivo`. Copiar a linha copiando o MESMO id de arquivo deixa dois
//     registros apontando para o mesmo binário do shell, e o ciclo de vida
//     desse binário é do shell, não desta app: apagar uma das duas cópias pode
//     levar o arquivo da outra junto. Duplicar o binário de verdade exige um
//     verbo do SDK que esta sessão NÃO consegue conferir (o pacote é privado e
//     dá 401 aqui). Fica para decisão do autor, com o obstáculo declarado;
//   · `estudo_membros` — é ACL, não dado do estudo. Copiar a lista concederia
//     acesso a terceiros a um estudo que eles não sabem que existe, e dispara
//     notificação. O criador da cópia já entra como editor logo abaixo
//     (`garantirMembro`). Também é decisão do autor;
//   · `avancado_linhas_receita` e `avancado_capital_instrumentos` — tabelas de
//     modelos APAGADOS (nenhum `req.dados` no repositório as toca). Copiá-las
//     seria propagar dado morto.
export const FILHAS_SIMPLES: { tabela: string; campos: string[]; porPagina: number }[] = [
  // O catálogo de Produtos é a ÚNICA fonte de VGV desde a #563: sem ele a
  // cópia nasce em ESTADO VAZIO carregando todas as premissas do original —
  // o P1 que abriu esta issue.
  { tabela: 'preliminar_produtos', campos: CAMPOS_PRODUTO, porPagina: 500 },
  // Análise de mercado e apelo comercial: uma linha por estudo, toda ela dado
  // do estudo (premissas de mercado coletadas e os scores/laudo).
  {
    tabela: 'analise_mercado', porPagina: 5,
    campos: [
      'abrangencia', 'localidade', 'preco_medio_m2', 'custo_obra_m2', 'vso_pct',
      'ipca_pct', 'selic_pct', 'incc_pct', 'focus_ipca_pct', 'focus_selic_pct',
      'riscos', 'resultado', 'origem', 'data_referencia', 'gerado_em', 'modelo',
    ],
  },
  {
    tabela: 'apelo_comercial', porPagina: 5,
    campos: [
      'resultado', 'score_localizacao', 'score_infraestrutura', 'score_vetor_crescimento',
      'score_concorrencia', 'score_demanda', 'score_seguranca_juridica', 'score_geral',
    ],
  },
];

/**
 * Anexa `produtos` (catálogo do Preliminar, #315) a cada estudo da lista.
 *
 * Por que existe: o catálogo é a ÚNICA fonte do VGV em `calcularProforma`
 * (`frontend/proforma.ts`, `catalogoEfetivo`) — sem `e.produtos` no payload
 * TODO estudo do Preliminar calcularia `vgv = 0`, e a listagem mostraria "—"
 * em VGV, Resultado e Margem, enquanto a aba Premissas — que passa `produtos`
 * explicitamente (frontend/tela-premissas.ts) — mostraria os valores certos.
 *
 * São INPUTS persistidos, não valores derivados: devolver isto não move
 * cálculo para o backend (docs/viabilidade/formulas.md continua valendo).
 *
 * Uma query só para toda a página, mutação in-place — mesmo padrão de
 * `anexarImagemPrincipal`. Estudo sem produto fica com lista vazia, que é o
 * estado vazio: sem receita modelada, e a listagem mostra "—" com razão.
 */
async function anexarProdutos(req: Request, estudos: any[]): Promise<void> {
  for (const e of estudos) e.produtos = [];
  if (estudos.length === 0) return;
  const ids = new Set(estudos.map((e) => Number(e.id)));
  // `por_pagina` alto de propósito: a lista de estudos vai a 200 e cada um
  // pode ter dezenas de produtos, então o teto de 500 do helper de imagem
  // truncaria silenciosamente — e um truncamento aqui volta a produzir
  // exatamente o "—" que este helper existe para eliminar.
  const r = await req.dados!.listar('preliminar_produtos', { por_pagina: 100000 });
  const porEstudo = agruparProdutosPorEstudo(r.dados, ids);
  for (const e of estudos) e.produtos = porEstudo.get(Number(e.id)) ?? [];
}

// ---------------------------------------------------------------
// POST /estudos — criar (auto-adiciona o criador como editor)
// ---------------------------------------------------------------
rotasEstudos.post('/estudos', async (req: Request, res: Response) => {
  try {
    const podeCriar = req.contexto?.nivelApp === 'escrita' || req.contexto?.nivelApp === 'admin';
    if (!podeCriar) {
      erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para criar estudos');
      return;
    }

    const { nome, tipo_empreendimento, uf, nivel_analise, origem_terreno } = req.body;
    if (!nome || typeof nome !== 'string' || !nome.trim()) {
      erro(res, 400, 'CAMPOS_OBRIGATORIOS', 'O campo "nome" é obrigatório');
      return;
    }
    if (!TIPOS.includes(tipo_empreendimento)) {
      erro(res, 400, 'TIPO_INVALIDO', 'tipo_empreendimento deve ser "loteamento" ou "incorporacao"');
      return;
    }
    if (origem_terreno !== undefined && origem_terreno !== 'nucleo' && origem_terreno !== 'manual') {
      erro(res, 400, 'ORIGEM_INVALIDA', 'origem_terreno deve ser "nucleo" ou "manual"');
      return;
    }

    const ident = await gerarIdentificacao(req, { nome: nome.trim(), tipo_empreendimento, uf });
    const dados: Record<string, any> = {
      nome: nome.trim(),
      tipo_empreendimento,
      uf: uf ?? null,
      nivel_analise: nivel_analise === 'avancado' ? 'avancado' : 'preliminar',
      status: 'rascunho',
      origem_terreno: origem_terreno ?? 'manual',
      autor_id: req.contexto!.usuario.id,
      ...ident,
    };
    // Campos opcionais de terreno manual, se vierem já na criação.
    for (const campo of ['terreno_manual_nome', 'terreno_manual_area', 'notas']) {
      if (req.body[campo] !== undefined) dados[campo] = req.body[campo];
    }

    const estudo = await req.dados!.criar('estudos', dados);

    // Criador vira editor do estudo.
    const funcao = await garantirMembro(req, estudo.id, req.contexto!.usuario.id, 'editor');
    if (funcao) await inscreverMembroEstudo(req, estudo.id, req.contexto!.usuario.id, funcao);

    await publicarEvento(req, 'estudo_criado', payloadEstudoCriado(estudo, req.contexto!.usuario.nome));
    res.status(201).json(estudo);
  } catch (e: any) {
    console.error('Erro em POST /estudos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// GET /estudos — listar filtrado por membership
// ---------------------------------------------------------------
rotasEstudos.get('/estudos', async (req: Request, res: Response) => {
  try {
    const userId = req.contexto!.usuario.id;
    const { tipo_empreendimento, status } = req.query as Record<string, string>;

    let estudos: any[];
    if (req.contexto?.nivelApp === 'admin') {
      // Admin de app enxerga todos os estudos.
      const filtros: Record<string, any> = {};
      if (tipo_empreendimento) filtros.tipo_empreendimento = tipo_empreendimento;
      if (status) filtros.status = status;
      const r = await req.dados!.listar('estudos', {
        filtros, ordenar: 'criado_em', ordem: 'desc', por_pagina: 200,
      });
      estudos = r.dados.map((e) => ({ ...e, _funcao: 'aprovador' }));
    } else {
      // Demais: apenas estudos onde é membro.
      const mem = await req.dados!.listar('estudo_membros', {
        filtros: { usuario_id: userId }, por_pagina: 500,
      });
      const funcaoPorEstudo = new Map<number, string>();
      for (const m of mem.dados) funcaoPorEstudo.set(Number(m.estudo_id), String(m.funcao));

      estudos = [];
      for (const [estudoId, funcao] of funcaoPorEstudo) {
        const est = await req.dados!.buscar('estudos', estudoId);
        if (!est) continue; // removido ou inexistente
        // Leitor não vê estudos em Rascunho ou Arquivado.
        if (funcao === 'leitor' && (est.status === 'rascunho' || est.status === 'arquivado')) continue;
        if (tipo_empreendimento && est.tipo_empreendimento !== tipo_empreendimento) continue;
        if (status && est.status !== status) continue;
        estudos.push({ ...est, _funcao: funcao });
      }
      estudos.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    }

    await anexarImagemPrincipal(req, estudos);
    await anexarProdutos(req, estudos);
    res.json({ dados: estudos, total: estudos.length });
  } catch (e: any) {
    console.error('Erro em GET /estudos:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// GET /estudos/:id — detalhe (membro)
// ---------------------------------------------------------------
rotasEstudos.get('/estudos/:id', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    const perm = await exigirMembro(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo'); return; }
    // Leitor não acessa Rascunho/Arquivado.
    if (perm.ehLeitor && (estudo.status === 'rascunho' || estudo.status === 'arquivado')) {
      erro(res, 403, 'SEM_PERMISSAO', 'Sem acesso a este estudo neste status');
      return;
    }

    const [membros, imoveis] = await Promise.all([
      req.dados!.listar('estudo_membros', { filtros: { estudo_id: estudoId }, por_pagina: 100 }),
      req.dados!.listar('estudo_imoveis', { filtros: { estudo_id: estudoId }, por_pagina: 100 }),
    ]);

    const podeAprovar = perm.ehAprovador || perm.ehAdminApp;
    const podeEditar = perm.ehEditor || podeAprovar;
    res.json({
      ...estudo,
      membros: membros.dados,
      imoveis: imoveis.dados,
      _permissao: {
        funcao: perm.funcao,
        ehMembro: perm.ehMembro,
        podeEditar,
        podeAprovar,
        podeSubmeter: podeEditar && estudo.status === 'rascunho',
        podeEditarImoveis: podeEditar && estudo.status === 'rascunho',
      },
    });
  } catch (e: any) {
    console.error('Erro em GET /estudos/:id:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// PATCH /estudos/:id — editar premissas
// ---------------------------------------------------------------
rotasEstudos.patch('/estudos/:id', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    const perm = await resolverPermissaoEstudo(req, estudoId);
    const podeAprovar = perm.ehAprovador || perm.ehAdminApp;
    const podeEditor = perm.ehEditor || podeAprovar;

    // Aprovado/Reprovado/Arquivado: só aprovador edita. Demais status: editor+.
    const travado = estudo.status === 'aprovado' || estudo.status === 'reprovado' || estudo.status === 'arquivado';
    if (travado ? !podeAprovar : !podeEditor) {
      erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para editar este estudo');
      return;
    }

    const decisao = montarPatchEstudo(req.body, estudo);
    if ('codigo' in decisao) { erro(res, decisao.http, decisao.codigo, decisao.mensagem); return; }
    const dados = decisao.dados;

    const atualizado = await req.dados!.atualizar('estudos', estudoId, dados);
    res.json(atualizado);
  } catch (e: any) {
    console.error('Erro em PATCH /estudos/:id:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// DELETE /estudos/:id — remover (soft delete)
// ---------------------------------------------------------------
rotasEstudos.delete('/estudos/:id', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para remover este estudo'); return; }

    const removido = await req.dados!.remover('estudos', estudoId, req.contexto!.usuario.id);
    if (!removido) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em DELETE /estudos/:id:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// POST /estudos/:id/duplicar
// ---------------------------------------------------------------
rotasEstudos.post('/estudos/:id/duplicar', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const perm = await exigirEditor(req, estudoId);
    if (!perm) { erro(res, 403, 'SEM_PERMISSAO', 'Sem permissão para duplicar este estudo'); return; }

    const orig = await req.dados!.buscar('estudos', estudoId);
    if (!orig) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    const copia = montarCopiaEstudo(orig);
    const ident = await gerarIdentificacao(req, {
      nome: orig.nome, tipo_empreendimento: orig.tipo_empreendimento, uf: orig.uf,
    });
    copia.status = 'rascunho';
    copia.autor_id = req.contexto!.usuario.id;
    Object.assign(copia, ident);

    const novo = await req.dados!.criar('estudos', copia);

    // Sem transação no req.dados: se qualquer estrutura filha falhar, o clone
    // ficaria parcial (estudo sem imóveis/Avançado, ou sem o criador como
    // editor — inacessível). Compensa-se removendo o estudo recém-criado.
    try {
      // Copiar imóveis vinculados.
      const imoveis = await req.dados!.listar('estudo_imoveis', { filtros: { estudo_id: estudoId }, por_pagina: 100 });
      for (const im of imoveis.dados) {
        await req.dados!.criar('estudo_imoveis', {
          estudo_id: novo.id,
          imovel_nucleo_id: im.imovel_nucleo_id,
          tipo_imovel: im.tipo_imovel,
        });
      }

      // #609 — as estruturas filhas de remapeamento simples (catálogo de
      // Produtos, análise de mercado, apelo comercial). Ver `FILHAS_SIMPLES`
      // para a lista, os campos de cada uma e o que ficou de fora, com o
      // motivo. Dentro do try/catch de propósito: falhar aqui remove o estudo
      // recém-criado, em vez de deixar um clone pela metade.
      for (const { tabela, campos, porPagina } of FILHAS_SIMPLES) {
        const linhas = await req.dados!.listar(tabela, {
          filtros: { estudo_id: estudoId }, por_pagina: porPagina,
        });
        for (const copiaFilha of montarCopiasFilhas(linhas.dados, Number(novo.id), campos)) {
          await req.dados!.criar(tabela, copiaFilha);
        }
      }

      // Estudo Avançado: cronograma, tipologias, fases + alocações, custos,
      // cenários e (desde a #609) as operações de funding.
      if (novo.nivel_analise === 'avancado') {
        await duplicarDadosAvancado(req, estudoId, Number(novo.id));
      }

      const funcao = await garantirMembro(req, novo.id, req.contexto!.usuario.id, 'editor');
      if (funcao) await inscreverMembroEstudo(req, novo.id, req.contexto!.usuario.id, funcao);
    } catch (falha) {
      try { await req.dados!.remover('estudos', Number(novo.id), req.contexto!.usuario.id); }
      catch { /* best-effort: não mascarar o erro original com o da limpeza */ }
      throw falha;
    }

    await publicarEvento(req, 'estudo_criado', payloadEstudoCriado(novo, req.contexto!.usuario.nome));
    res.status(201).json(novo);
  } catch (e: any) {
    console.error('Erro em POST /estudos/:id/duplicar:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});

// ---------------------------------------------------------------
// POST /estudos/:id/status — transição validada
// ---------------------------------------------------------------
// Retorna o gate necessário ('editor' | 'aprovador') ou null se transição inválida.
export function gateTransicao(de: string, para: string): 'editor' | 'aprovador' | null {
  if (de === para) return null;
  if (de === 'rascunho' && para === 'em_analise') return 'editor';
  if (de === 'em_analise' && (para === 'aprovado' || para === 'reprovado' || para === 'rascunho')) return 'aprovador';
  if (de === 'arquivado' && para === 'rascunho') return 'aprovador'; // reabrir
  if (para === 'arquivado' && de !== 'aprovado' && de !== 'arquivado') return 'aprovador';
  return null;
}

rotasEstudos.post('/estudos/:id/status', async (req: Request, res: Response) => {
  try {
    const estudoId = parseInt(req.params.id);
    if (isNaN(estudoId)) { erro(res, 400, 'ID_INVALIDO', 'ID deve ser um número'); return; }

    const novoStatus = req.body.status;
    if (!STATUS.includes(novoStatus)) {
      erro(res, 400, 'STATUS_INVALIDO', `status deve ser um de: ${STATUS.join(', ')}`);
      return;
    }

    const estudo = await req.dados!.buscar('estudos', estudoId);
    if (!estudo) { erro(res, 404, 'ESTUDO_NAO_ENCONTRADO', 'Estudo não encontrado'); return; }

    const statusAnterior = String(estudo.status);
    const gate = gateTransicao(statusAnterior, novoStatus);
    if (!gate) {
      erro(res, 422, 'TRANSICAO_INVALIDA', `Transição de "${statusAnterior}" para "${novoStatus}" não é permitida`);
      return;
    }

    const perm = gate === 'aprovador'
      ? await exigirAprovador(req, estudoId)
      : await exigirEditor(req, estudoId);
    if (!perm) {
      const quem = gate === 'aprovador' ? 'aprovadores' : 'editores';
      erro(res, 403, 'SEM_PERMISSAO', `Apenas ${quem} podem fazer esta transição`);
      return;
    }

    const atualizado = await req.dados!.atualizar('estudos', estudoId, { status: novoStatus });
    await publicarEvento(
      req,
      'estudo_status_alterado',
      payloadStatusAlterado(atualizado ?? estudo, statusAnterior, novoStatus, req.contexto!.usuario.nome),
    );
    res.json(atualizado ?? { ...estudo, status: novoStatus });
  } catch (e: any) {
    console.error('Erro em POST /estudos/:id/status:', e);
    erro(res, 500, 'ERRO_INTERNO', e.message);
  }
});
