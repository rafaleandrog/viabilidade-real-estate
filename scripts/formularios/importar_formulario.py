#!/usr/bin/env python3
"""Cria um estudo na instância a partir de um formulário simplificado preenchido, e confere o resultado.

    python3 -I scripts/formularios/importar_formulario.py <formulario.xlsx> [--nome-estudo "qa-..."]
                                                         [--executar] [--relatorio saida.json]

Sem --executar valida a planilha e mostra o plano (nada é escrito). Com --executar, nesta ordem:

    1. VALIDA a planilha (fail-closed: erro de preenchimento para aqui, antes de escrever qualquer coisa);
    2. CRIA o estudo pelas rotas do app (URBIVERSO_QA_URL + URBIVERSO_QA_TOKEN_PCPAL; o token nunca é impresso);
    3. LEVA o pagamento ao contrato canônico (`aplicar-pagamento-canonico.ts`) — necessário enquanto a instância
       rodar um backend anterior à normalização na API; depois dela é inofensivo;
    4. RELÊ o que foi gravado e compara com o que a planilha pediu;
    5. RODA o motor do repositório sobre o estudo (`conferir-estudo.ts`) e separa o que é defeito do estudo do que
       é achado conhecido do próprio app.

Sai com código 0 só se não houver erro de validação, divergência na releitura nem erro de invariante do app.

O que é lido da planilha: coluna A (rótulo), B (valor), C (unidade), D (chave técnica) e o FORMATO da célula B
(célula formatada em % guarda fração: 0,04 vira 4 na API). Nada vem do gerador. A chave técnica é a única fonte
de decisão: `estudos.<coluna>`, `parametros.<c>`, `cronograma.<evento>.<campo>`, `<coluna>_modo = <modo> → <coluna>_valor`
e `<lista>[n].<campo>` (`funding.divida[2].taxa_anual`). Chave sem tratamento vai para a lista de IGNORADOS, nunca some calada.

Requisitos: python3, openpyxl, e — para os passos 3 e 5 — node com as dependências do repositório (`pnpm install`).
"""
import json
import os
import re
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parents[2]
CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt') if Path('/root/.ccr/ca-bundle.crt').exists() else ssl.create_default_context()

ALT = re.compile(r'^(\w+) = (\w+) → (\w+)')
LISTA = re.compile(r'^([a-z_.]+)\[(\d+)\]\.([a-z0-9_]+)$')
MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

# chaves que o importador conhece e NÃO envia, com o motivo (aparecem no relatório quando preenchidas)
NAO_ENVIADAS = {
    'estudos.regiao_mercado_id': 'região de mercado exige o id da região cadastrada; escolha pela tela',
    'apelo_comercial_documentos.tipo_dado': 'apelo comercial é documento anexado; envie pela tela',
    'apelo_comercial_documentos.texto_adicional': 'apelo comercial é documento anexado; envie pela tela',
    'estudo_documentos': 'a imagem principal é upload; envie pela tela',
}

UNIDADES_POR_CATEGORIA = {
    ('terreno', 'Preço'): ['rs', 'rs_m2_terreno'], ('terreno', 'Registro'): ['rs', 'rs_m2_priv'], ('terreno', 'Outro'): ['rs', 'pct_vgv'],
    ('obra', 'Construção'): ['rs', 'rs_m2_priv'], ('obra', 'Outorga'): ['rs', 'pct_vgv'], ('obra', 'Decoração'): ['rs', 'rs_m2_priv'],
    ('obra', 'Gestão da obra'): ['rs', 'pct_obra'], ('obra', 'Contingência'): ['rs', 'pct_vgv'], ('obra', 'Outro'): ['rs', 'pct_vgv'],
    ('diretos', 'Marketing & Publicidade'): ['rs', 'pct_vgv', 'pct_recebido'], ('diretos', 'Corretagem de vendas'): ['pct_vgv'],
    ('diretos', 'Projetos'): ['rs', 'rs_m2_priv', 'pct_constr'], ('diretos', 'Licenças e Aprovações'): ['rs', 'rs_m2_priv'],
    ('diretos', 'Manutenção pós-obra'): ['rs', 'pct_vgv', 'pct_recebido'], ('diretos', 'Outro'): ['rs', 'pct_vgv', 'pct_recebido'],
    ('indireto', 'Marketing global'): ['rs', 'pct_vgv', 'pct_recebido'], ('indireto', 'Stand de vendas'): ['rs', 'pct_vgv'],
    ('indireto', 'Gestão'): ['rs', 'pct_vgv', 'pct_recebido'], ('indireto', 'Outro'): ['rs', 'pct_vgv', 'pct_recebido'],
    ('financeiro', 'Juros de financiamento'): ['rs', 'pct_vgv'], ('financeiro', 'Taxas bancárias'): ['rs', 'pct_vgv'],
    ('financeiro', 'Estruturação de dívida'): ['rs', 'pct_vgv'], ('financeiro', 'Investidores'): ['rs', 'pct_vgv'],
    ('financeiro', 'Outro'): ['rs', 'pct_vgv'],
}
EVENTOS = ['planejamento', 'pre_lancamento', 'lancamento', 'obra', 'pos_obra']

# achados do próprio app, já registrados — não reprovam o estudo, mas aparecem
CONHECIDOS = [
    (re.compile(r'VGV Σ (tipologias|alocações)'), '#835 (conferir-estudo ignora área aberta)'),
    (re.compile(r'Σ legado entrada\+parcelas'), '#827 (repasse derivado)'),
    (re.compile(r'CAMADAS_DIVERGEM_PERMUTA_FISICA'), '#832 (camada Premissas inexistente no Avançado)'),
    (re.compile(r'RECEITA_BRUTA_NAO_CONSERVA'), '#824 (resíduo de centavos)'),
    (re.compile(r'pós-chaves .*GRAVADO vs DERIVADO'), '#840 (default de absorção)'),
]


# ═════════════════════════ leitura ═════════════════════════
class Entrada:
    __slots__ = ('rotulo', 'valor', 'chave', 'pct')

    def __init__(self, rotulo, valor, chave, pct):
        self.rotulo, self.valor, self.chave, self.pct = rotulo, valor, chave, pct


def ler(caminho):
    ws = openpyxl.load_workbook(caminho)['Formulário']
    entradas = []
    for row in ws.iter_rows(min_row=4):
        a, b, d = row[0], row[1], row[3]
        if a.value is None:
            continue
        if str(a.value).startswith('REFERÊNCIA CALCULADA'):
            break
        if d.value is None:
            continue
        v = b.value
        if v is None or v == '':
            continue
        pct = '%' in (b.number_format or '')
        if isinstance(v, (int, float)) and not isinstance(v, bool) and pct:
            v = round(v * 100, 8)
        elif v in ('Sim', 'Não'):
            v = v == 'Sim'
        elif hasattr(v, 'strftime'):
            v = f'{MESES[v.month - 1]}/{v.year}'
        entradas.append(Entrada(str(a.value), v, str(d.value), pct))
    return entradas


class Modelo:
    def __init__(self):
        self.estudo, self.param, self.crono = {}, {}, {}
        self.listas = defaultdict(lambda: defaultdict(dict))
        self.alternativas = defaultdict(list)      # coluna_modo -> [rótulo, ...]
        self.nao_enviadas = []                     # (rótulo, motivo)
        self.ignoradas = []                        # (rótulo, chave)
        self.rotulos = {}                          # chave -> rótulo, para mensagens

    def __getitem__(self, lista):
        return self.listas[lista]


def montar(entradas):
    m = Modelo()
    for e in entradas:
        m.rotulos[e.chave] = e.rotulo
        k = e.chave
        a = ALT.match(k)
        if a:
            modo_col, modo, valor_col = a.groups()
            m.estudo[modo_col] = modo
            m.estudo[valor_col] = e.valor
            m.alternativas[modo_col].append(e.rotulo)
        elif re.fullmatch(r'estudos\.\w+', k):
            m.estudo[k.split('.', 1)[1]] = e.valor
        elif k.startswith('parametros.'):
            m.param[k.split('.', 1)[1]] = e.valor
        elif re.fullmatch(r'cronograma\.\w+\.\w+', k):
            _, ev, campo = k.split('.')
            m.crono.setdefault(ev, {})[campo] = e.valor
        elif LISTA.match(k):
            lista, n, campo = LISTA.match(k).groups()
            m.listas[lista][int(n)][campo] = e.valor
        elif k.startswith('funding.financiamento_producao.'):
            m.listas['funding.financiamento_producao'][1][k.rsplit('.', 1)[1]] = e.valor
        elif k in NAO_ENVIADAS or k.split(' ')[0] in NAO_ENVIADAS:
            m.nao_enviadas.append((e.rotulo, NAO_ENVIADAS.get(k) or NAO_ENVIADAS[k.split(' ')[0]]))
        elif k.startswith('estudo_imoveis.'):
            m.nao_enviadas.append((e.rotulo, 'vínculo com imóvel do Núcleo não é suportado; use origem = manual'))
        else:
            m.ignoradas.append((e.rotulo, k))
    return m


# ═════════════════════════ validação (fail-closed) ═════════════════════════
def validar(m):
    erros, avisos = [], []
    E, A = erros.append, avisos.append
    e = m.estudo
    for obrig in ('nome', 'tipo_empreendimento', 'nivel_analise'):
        if not e.get(obrig):
            E(f'campo obrigatório ausente: {obrig}')
    if not (isinstance(e.get('terreno_manual_area'), (int, float)) and e['terreno_manual_area'] > 0):
        E('Área do terreno é obrigatória e deve ser > 0')
    if e.get('origem_terreno') == 'nucleo':
        E('origem = nucleo não é suportada pelo importador; use manual')
    for rot, mot in m.nao_enviadas:
        if rot and mot.startswith('vínculo'):
            E(f'"{rot}": {mot}')
        else:
            A(f'não enviado — "{rot}": {mot}')
    # uma só unidade por campo
    for modo_col, rotulos in m.alternativas.items():
        if len(rotulos) > 1:
            E(f'mais de uma unidade preenchida para o mesmo campo ({modo_col}): ' + ' | '.join(rotulos))
    nivel = e.get('nivel_analise')
    if nivel == 'preliminar':
        prods = m['preliminar_produtos']
        if not prods:
            E('Preliminar sem nenhum produto (o catálogo é a única fonte do VGV)')
        soma = 0.0
        for n, p in sorted(prods.items()):
            falta = [c for c in ('nome', 'tipo', 'pct_alv', 'unidades', 'preco_venda_m2') if p.get(c) in (None, '')]
            if falta:
                E(f'Produto {n}: falta {", ".join(falta)}')
            soma += float(p.get('pct_alv') or 0)
        if prods and abs(soma - 100) > 0.01:
            E(f'Σ % da base dos produtos = {soma:.4f}, deve ser 100')
        return erros, avisos
    return _validar_avancado(m, erros, avisos)


def _validar_avancado(m, erros, avisos):
    E, A = erros.append, avisos.append
    e, p = m.estudo, m.param
    lote = e.get('tipo_empreendimento') == 'loteamento'
    for c in ('data_inicio_projeto', 'tem_pre_lancamento'):
        if p.get(c) is None:
            E(f'campo obrigatório ausente: parametros.{c}')
    for ev, campos in (('planejamento', ('inicio_mes', 'duracao_meses')), ('lancamento', ('duracao_meses',)),
                       ('obra', ('inicio_mes', 'duracao_meses')), ('pos_obra', ('duracao_meses',))):
        for c in campos:
            if m.crono.get(ev, {}).get(c) is None:
                E(f'cronograma.{ev}.{c} ausente')
    tem_pre = p.get('tem_pre_lancamento') is True
    if tem_pre and m.crono.get('pre_lancamento', {}).get('duracao_meses') is None:
        E('tem Pré-lançamento = Sim, mas a duração do Pré-lançamento está em branco')
    if not tem_pre and m.crono.get('pre_lancamento', {}).get('duracao_meses') is not None:
        A('duração do Pré-lançamento preenchida com "tem Pré-lançamento = Não": será ignorada')

    tips = {t['nome']: t for t in m['tipologias'].values() if t.get('nome')}
    if not tips:
        E('nenhuma tipologia/lote informado')
    for n, t in sorted(m['tipologias'].items()):
        if t.get('nome') and (not t.get('quantidade') or not t.get('area_privativa_m2')):
            E(f'{"Lote" if lote else "Tipologia"} {n}: falta área privativa ou unidades')
    grupos = {g['nome']: g for g in m['grupos'].values() if g.get('nome')}
    if not grupos:
        E('nenhum grupo de venda informado')
    if len(grupos) != sum(1 for g in m['grupos'].values() if g.get('nome')):
        E('nomes de grupo de venda repetidos')
    for n, g in sorted(m['grupos'].items()):
        if not g.get('nome'):
            continue
        soma = sum(float(g.get(c) or 0) for c in ('pre_lancamento_pct', 'lancamento_pct', 'obra_pct'))
        if soma > 100.01:
            E(f'Grupo "{g["nome"]}": absorção pré+lançamento+obra = {soma:.2f}% (> 100)')
        if not tem_pre and g.get('pre_lancamento_pct'):
            E(f'Grupo "{g["nome"]}": absorção de pré-lançamento sem pré-lançamento')
    por_grupo = defaultdict(float)
    parcelamentos = defaultdict(int)
    for n, q in sorted(m['pagamento'].items()):
        if q.get('grupo') is None and q.get('linha') is None:
            continue
        if q.get('grupo') not in grupos:
            E(f'Condição {n}: grupo "{q.get("grupo")}" não existe na seção de grupos')
            continue
        if q.get('linha') not in ('Entrada', 'Parcelamento'):
            E(f'Condição {n}: Linha deve ser Entrada ou Parcelamento')
        if q.get('pct') in (None, 0):
            E(f'Condição {n}: falta o % do total')
        por_grupo[q['grupo']] += float(q.get('pct') or 0)
        if q.get('linha') == 'Parcelamento':
            parcelamentos[q['grupo']] += 1
            if not q.get('ao_longo_obra') and not q.get('parcelas'):
                E(f'Condição {n}: Parcelamento fora da obra precisa do nº de parcelas')
    for gnome, soma in por_grupo.items():
        if soma > 100.01:
            E(f'Grupo "{gnome}": Σ % do pagamento = {soma:.2f} (> 100)')
        if parcelamentos[gnome] > 4:
            E(f'Grupo "{gnome}": mais de 4 linhas de Parcelamento')
    alocado = defaultdict(int)
    for n, a in sorted(m['alocacoes'].items()):
        if a.get('grupo') is None and a.get('tipologia') is None:
            continue
        if a.get('grupo') not in grupos:
            E(f'Alocação {n}: grupo "{a.get("grupo")}" não existe')
        if a.get('tipologia') not in tips:
            E(f'Alocação {n}: {"lote" if lote else "tipologia"} "{a.get("tipologia")}" não existe')
            continue
        alocado[a['tipologia']] += int(a.get('unidades') or 0)
        if not a.get('unidades') or not a.get('preco_m2'):
            E(f'Alocação {n}: falta unidades ou preço')
    for nome, t in tips.items():
        if alocado[nome] > int(t.get('quantidade') or 0):
            E(f'"{nome}": alocado {alocado[nome]} > catálogo {t.get("quantidade")}')
        elif alocado[nome] < int(t.get('quantidade') or 0):
            A(f'"{nome}": há {int(t["quantidade"]) - alocado[nome]} unidade(s) sem alocar')
    for n, q in sorted(m['permuta_fisica'].items()):
        if q.get('tipologia') is None and q.get('unidades') is None:
            continue
        if q.get('tipologia') not in tips:
            E(f'Permuta física {n}: "{q.get("tipologia")}" não existe')
        elif int(q.get('unidades') or 0) > alocado[q['tipologia']]:
            E(f'Permuta física {n}: {q.get("unidades")} unidades > alocado ({alocado[q["tipologia"]]})')
    # custos
    obrig = {('terreno', 'Preço'), ('obra', 'Construção'), ('diretos', 'Corretagem de vendas')}
    vistas = set()
    for n, c in sorted(m['custos'].items()):
        if c.get('grupo') is None and c.get('categoria') is None:
            continue
        chave = (c.get('grupo'), c.get('categoria'))
        vistas.add(chave)
        un = c.get('unidade')
        if chave not in UNIDADES_POR_CATEGORIA:
            E(f'Custo {n}: categoria "{c.get("categoria")}" inválida no grupo "{c.get("grupo")}"')
            continue
        if un not in UNIDADES_POR_CATEGORIA[chave]:
            E(f'Custo {n}: unidade "{un}" não aceita em {chave[0]}/{chave[1]} (aceitas: {", ".join(UNIDADES_POR_CATEGORIA[chave])})')
            continue
        if c.get('valor_rs') is not None and c.get('valor_pct') is not None:
            E(f'Custo {n}: preencha só uma linha de valor')
        campo = 'valor_pct' if str(un).startswith('pct') else 'valor_rs'
        if c.get(campo) is None:
            E(f'Custo {n}: falta o valor ({campo}) para a unidade {un}')
        if c.get('cronograma') == 'customizado' and (c.get('inicio_mes') is None or not c.get('duracao_meses')):
            E(f'Custo {n}: cronograma customizado exige início e duração')
    for o in obrig - vistas:
        E(f'custo obrigatório ausente: {o[0]}/{o[1]}')
    fases = {f['nome'] for f in m['fases'].values() if f.get('nome')}
    for n, c in sorted(m['custos'].items()):
        cr = str(c.get('cronograma') or '')
        if cr.startswith('fase:') and cr[5:].strip() not in fases:
            E(f'Custo {n}: fase "{cr[5:].strip()}" não existe nas fases customizadas')
    for n, q in sorted(m['permuta_financeira'].items()):
        un = q.get('unidade')
        if un is None:
            continue
        campo = 'valor_pct' if un == 'pct_vgv' else 'valor_rs'
        if q.get(campo) is None:
            E(f'Permuta financeira {n}: falta o valor ({campo})')
    # funding
    for d in ('funding.divida', 'funding.equity'):
        for n, o in sorted(m[d].items()):
            if o.get('nome') and not o.get('valor'):
                E(f'{d} {n}: falta o valor')
    return erros, avisos


# ═════════════════════════ HTTP ═════════════════════════
class Api:
    def __init__(self, executar):
        self.executar = executar
        self.log = []

    def chamar(self, metodo, caminho, corpo=None):
        if not self.executar:
            self.log.append((metodo, caminho, 'plano', ''))
            return 0, {'id': 0}
        url = os.environ['URBIVERSO_QA_URL'].rstrip('/') + '/api/viabilidade' + caminho
        dados = json.dumps(corpo).encode() if corpo is not None else None
        req = urllib.request.Request(url, data=dados, method=metodo, headers={
            'Authorization': 'Bearer ' + os.environ['URBIVERSO_QA_TOKEN_PCPAL'], 'Content-Type': 'application/json'})
        try:
            r = urllib.request.urlopen(req, context=CTX, timeout=60)
            status, txt = r.status, r.read().decode()
        except urllib.error.HTTPError as ex:
            status, txt = ex.code, ex.read().decode()
        try:
            js = json.loads(txt) if txt else {}
        except ValueError:
            js = {'_texto': txt[:300]}
        self.log.append((metodo, caminho, status, json.dumps(js, ensure_ascii=False)[:240] if status >= 400 else ''))
        return status, js

    def get(self, caminho):
        return self.chamar('GET', caminho)[1]

    def lista(self, caminho):
        js = self.get(caminho)
        return js if isinstance(js, list) else js.get('dados', [])

    def falhas(self):
        return [(m, c, s, r) for m, c, s, r in self.log if isinstance(s, int) and s >= 400]


# ═════════════════════════ escrita ═════════════════════════
def ordenados(d):
    return [(n, v) for n, v in sorted(d.items()) if any(x is not None for x in v.values())]


def criar_estudo(api, m):
    e = dict(m.estudo)
    corpo = {k: e.pop(k) for k in ('nome', 'tipo_empreendimento', 'nivel_analise', 'origem_terreno', 'uf',
                                   'terreno_manual_nome', 'terreno_manual_area', 'notas') if k in e}
    corpo.setdefault('origem_terreno', 'manual')
    st, r = api.chamar('POST', '/estudos', corpo)
    if st not in (0, 201):
        return None
    eid = r['id']
    if e:
        api.chamar('PATCH', f'/estudos/{eid}', e)
    return eid


def escrever_preliminar(api, m, eid):
    for n, p in ordenados(m['preliminar_produtos']):
        api.chamar('POST', f'/estudos/{eid}/preliminar/produtos', {
            'nome': p.get('nome'), 'tipo': p.get('tipo'), 'pct_alv': p.get('pct_alv'), 'unidades': p.get('unidades'),
            'preco_venda_m2': p.get('preco_venda_m2'), 'ordem': n - 1})


def escrever_avancado(api, m, eid):
    base = f'/estudos/{eid}/avancado'
    tem_pre = m.param.get('tem_pre_lancamento') is True
    api.chamar('PATCH', f'{base}/parametros', {k.replace('_aa', '_aa'): v for k, v in m.param.items()})
    eventos = {}
    for ev in EVENTOS:
        d = {c: v for c, v in m.crono.get(ev, {}).items() if v is not None}
        # inícios de Pré-lançamento, Lançamento e Pós-obras são travados no fim do evento anterior (o app recalcula)
        if ev in ('pre_lancamento', 'lancamento', 'pos_obra'):
            d.pop('inicio_mes', None)
        if ev == 'pre_lancamento' and not tem_pre:
            continue
        if d:
            eventos[ev] = d
    api.chamar('PATCH', f'{base}/cronograma', {'eventos': eventos})

    fase_id = {}
    for n, f in ordenados(m['fases']):
        if not f.get('nome'):
            continue
        _, r = api.chamar('POST', f'{base}/fases', {'tipo': 'cronograma', 'nome': f['nome'], 'inicio_mes': f.get('inicio_mes', 0),
                                                    'duracao_meses': f.get('duracao_meses', 1), 'ordem': n - 1})
        fase_id[f['nome']] = r.get('id')
    tip_id = {}
    lote = m.estudo.get('tipo_empreendimento') == 'loteamento'
    for n, t in ordenados(m['tipologias']):
        if not t.get('nome'):
            continue
        corpo = {'nome': t['nome'], 'tipo_unidade': 'lote' if lote else t.get('tipo_unidade', 'apartamento'),
                 'area_privativa_m2': t.get('area_privativa_m2'), 'area_privativa_aberta_m2': t.get('area_privativa_aberta_m2', 0),
                 'quantidade': t.get('quantidade', 0), 'preco_m2': t.get('preco_m2'), 'ordem': n - 1}
        if not lote:
            corpo['dormitorios'] = t.get('dormitorios')
            corpo['vagas'] = t.get('vagas')
        _, r = api.chamar('POST', f'{base}/tipologias', corpo)
        tip_id[t['nome']] = r.get('id')

    grupo_id = {}
    for n, g in ordenados(m['grupos']):
        if not g.get('nome'):
            continue
        _, r = api.chamar('POST', f'{base}/fases', {'tipo': 'receita', 'nome': g['nome'], 'ordem': n - 1})
        fid = grupo_id[g['nome']] = r.get('id')
        pre, lanc, obra = (float(g.get(c) or 0) for c in ('pre_lancamento_pct', 'lancamento_pct', 'obra_pct'))
        blocos = ([{'evento': 'pre_lancamento', 'pct': pre}] if tem_pre else []) + [
            {'evento': 'lancamento', 'pct': lanc}, {'evento': 'obra', 'pct': obra},
            {'evento': 'pos_obra', 'pct': round(100 - pre - lanc - obra, 6)}]      # pós-chaves já DERIVADO
        absorcao = {'modo': 'distribuido', 'correcao_estoque': bool(g.get('correcao_estoque', False)),
                    'pos_chaves_meses': int(g.get('pos_chaves_meses') or 12), 'blocos': blocos}
        entradas, parcelas = [], []
        for _, q in ordenados(m['pagamento']):
            if q.get('grupo') != g['nome']:
                continue
            if q.get('linha') == 'Entrada':
                entradas.append({'pct': q.get('pct', 0), 'parcelas': q.get('parcelas', 1), 'descontoPct': q.get('desconto_pct', 0)})
            else:
                parcelas.append({'periodicidade': 'mensal', 'parcelas': q.get('parcelas', 0), 'ao_longo_obra': bool(q.get('ao_longo_obra', False)),
                                 'juros': True, 'pct': q.get('pct', 0), 'sinalPct': q.get('sinal_pct', 0)})
        fluxo = {'entrada': entradas, 'parcelas': parcelas, 'repasse': {'apos_entrega_meses': 1},
                 'residuoAteMarco': g.get('residuo_sem_prazo', 'imediato')}
        api.chamar('PATCH', f'{base}/fases/{fid}', {'absorcao': absorcao, 'fluxo_pagamento': fluxo})
    for n, a in ordenados(m['alocacoes']):
        if a.get('grupo') is None:
            continue
        api.chamar('POST', f'{base}/fases/{grupo_id.get(a["grupo"])}/alocacoes',
                   {'tipologia_id': tip_id.get(a.get('tipologia')), 'unidades': a.get('unidades', 0), 'preco_m2': a.get('preco_m2')})

    curvas = {c['nome']: c['id'] for c in api.lista('/avancado/curvas')} if api.executar else {}
    custo_id = {}

    def comum(c):
        d = {}
        dist = c.get('distribuicao')
        if dist in curvas:
            d.update(curva_id=curvas[dist], distribuicao_modo='fixo')
        elif dist in ('unit_delivery', 'sales_revenue'):
            d['distribuicao_modo'] = dist
        elif dist:
            d['distribuicao_modo'] = 'fixo'
            if dist != 'Linear' and api.executar:
                api.log.append(('AVISO', f'distribuição "{dist}" não existe no catálogo de curvas; gravada como Linear', 'aviso', ''))
        cr = c.get('cronograma')
        if cr and str(cr).startswith('fase:'):
            d['fase_ancora_id'] = fase_id.get(str(cr)[5:].strip())
        elif cr:
            d['cronograma_evento'] = cr
            if cr == 'customizado':
                d.update(inicio_mes=c.get('inicio_mes', 0), duracao_meses=c.get('duracao_meses', 1))
        return d

    for n, c in ordenados(m['custos']):
        if c.get('categoria') is None:
            continue
        un = c['unidade']
        valor = c.get('valor_pct') if str(un).startswith('pct') else c.get('valor_rs')
        corpo = {'grupo': c['grupo'], 'categoria': c['categoria'], 'subcategoria': c.get('subcategoria'),
                 'orcamento_unidade': un, 'orcamento_valor': valor, 'ordem': n, **comum(c)}
        _, r = api.chamar('POST', f'{base}/custos', corpo)
        custo_id[(c['categoria'], c.get('subcategoria'))] = r.get('id')
        custo_id.setdefault((c['categoria'], None), r.get('id'))
    for n, q in ordenados(m['permuta_fisica']):
        if q.get('unidades') is None:
            continue
        api.chamar('POST', f'{base}/custos', {'grupo': 'terreno', 'categoria': 'Preço', 'subcategoria': 'Permuta física',
                   'permuta_tipologia_id': tip_id.get(q.get('tipologia')), 'permuta_quantidade': q['unidades'],
                   'distribuicao_modo': 'unit_delivery', 'ordem': 100 + n})
    for n, q in ordenados(m['permuta_financeira']):
        if q.get('unidade') is None:
            continue
        valor = q.get('valor_pct') if q['unidade'] == 'pct_vgv' else q.get('valor_rs')
        api.chamar('POST', f'{base}/custos', {
            'grupo': 'terreno', 'categoria': 'Preço', 'subcategoria': 'Permuta financeira', 'orcamento_unidade': q['unidade'],
            'orcamento_valor': valor, 'distribuicao_modo': 'sales_revenue', 'ordem': 110 + n,
            'permuta_financeira_deduzir_imposto': bool(q.get('deduzir_imposto', False)),
            'permuta_financeira_deduzir_corretagem': bool(q.get('deduzir_corretagem', False))})

    def anc(o):
        a = o.get('aporte')
        if a and str(a).startswith('fase:'):
            return {'fase_ancora_id': fase_id.get(str(a)[5:].strip())}
        return {'cronograma_evento': a} if a else {}

    for n, o in ordenados(m['funding.financiamento_producao']):
        if not o.get('nome'):
            continue
        d = {'tipo': 'financiamento_producao', 'nome': o['nome'], 'ordem': 0}
        for c in ('ativo', 'valor', 'taxa_anual', 'exposicao_minima', 'percentual_financiavel', 'amortizar_com_caixa_disponivel'):
            if o.get(c) is not None:
                d[c] = o[c]
        base_fin = o.get('base_financiavel')
        if base_fin:
            ids = []
            for nome in [x.strip() for x in str(base_fin).split(';') if x.strip()]:
                cat, _, sub = nome.partition('/')
                alvo = custo_id.get((cat.strip(), sub.strip() or None)) or custo_id.get((cat.strip(), None))
                if alvo is None:
                    api.log.append(('AVISO', f'base financiável: "{nome}" não casa com nenhuma linha de custo', 'aviso', ''))
                else:
                    ids.append(alvo)
            if ids:
                d['custo_linha_ids'] = ids
        api.chamar('POST', f'{base}/funding', d)
    for n, o in ordenados(m['funding.divida']):
        if not o.get('nome'):
            continue
        d = {'tipo': 'divida', 'nome': o['nome'], 'ordem': n, **anc(o)}
        for c, col in (('valor', 'valor'), ('mes', 'inicio_mes'), ('distribuir_aporte', 'distribuir_aporte'), ('aporte_meses', 'aporte_meses'),
                       ('taxa_anual', 'taxa_anual'), ('amortizacao_meses', 'periodo_amortizacao_meses'),
                       ('carencia_meses', 'periodo_carencia_meses'), ('estruturacao_pct', 'taxa_estruturacao_pct'),
                       ('administracao_mensal', 'taxa_administracao_mensal'), ('outros_encargos', 'outros_encargos_iniciais')):
            if o.get(c) is not None:
                d[col] = o[c]
        api.chamar('POST', f'{base}/funding', d)
    for n, o in ordenados(m['funding.equity']):
        if not o.get('nome'):
            continue
        d = {'tipo': 'equity', 'nome': o['nome'], 'ordem': n, **anc(o)}
        for c, col in (('valor', 'valor'), ('mes', 'inicio_mes'), ('modo_retorno', 'modo_retorno'), ('pct_retorno', 'pct_retorno')):
            if o.get(c) is not None:
                d[col] = o[c]
        api.chamar('POST', f'{base}/funding', d)
    for n, c in ordenados(m['cenarios']):
        if c.get('nome'):
            api.chamar('POST', f'{base}/cenarios', {'nome': c['nome'], 'preco_venda_pct': c.get('preco_venda_pct', 0),
                                                    'custo_obra_pct': c.get('custo_obra_pct', 0), 'ordem': n - 1})


def canonico(eid):
    env = dict(os.environ, URBI_BASE=os.environ['URBIVERSO_QA_URL'], URBI_TOKEN=os.environ['URBIVERSO_QA_TOKEN_PCPAL'])
    r = subprocess.run(['node', '--import', 'tsx/esm', 'scripts/formularios/aplicar-pagamento-canonico.ts', str(eid)],
                       cwd=RAIZ, env=env, capture_output=True, text=True, timeout=180)
    return r.returncode, (r.stdout + r.stderr).strip()


# ═════════════════════════ releitura ═════════════════════════
def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def igual(enviado, gravado, tol=0.0051):
    if isinstance(enviado, bool) or isinstance(gravado, bool):
        return bool(enviado) == bool(gravado)
    a, b = _num(enviado), _num(gravado)
    if a is not None and b is not None and not isinstance(enviado, str):
        return abs(a - b) <= tol
    return str(enviado).strip() == str(gravado).strip()


def reler(api, m, eid):
    div = []
    est = api.get(f'/estudos/{eid}')
    enviados = {k: v for k, v in m.estudo.items() if k not in ('nivel_analise', 'tipo_empreendimento')}
    for col, v in enviados.items():
        if col not in est:
            div.append(f'estudos.{col}: a coluna não existe na resposta do app')
        elif not igual(v, est[col], tol=0.0051 if col != 'pct_alv' else 0.00006):
            div.append(f'estudos.{col}: enviado {v!r}, gravado {est[col]!r}')
    if m.estudo.get('nivel_analise') == 'preliminar':
        gravados = sorted(api.lista(f'/estudos/{eid}/preliminar/produtos'), key=lambda p: p.get('ordem', 0))
        pedidos = [v for _, v in ordenados(m['preliminar_produtos'])]
        if len(gravados) != len(pedidos):
            div.append(f'produtos: pedidos {len(pedidos)}, gravados {len(gravados)}')
        for p, g in zip(pedidos, gravados):
            for c in ('nome', 'tipo', 'unidades', 'preco_venda_m2'):
                if not igual(p.get(c), g.get(c)):
                    div.append(f'produto "{p.get("nome")}".{c}: enviado {p.get(c)!r}, gravado {g.get(c)!r}')
            if not igual(p.get('pct_alv'), g.get('pct_alv'), tol=0.00006):
                div.append(f'produto "{p.get("nome")}".pct_alv: enviado {p.get("pct_alv")!r}, gravado {g.get("pct_alv")!r}')
        return div
    par = api.get(f'/estudos/{eid}/avancado/parametros')
    for c, v in m.param.items():
        if c in par and not igual(v, par[c]):
            div.append(f'parametros.{c}: enviado {v!r}, gravado {par[c]!r}')
    cr = {x['evento']: x for x in api.lista(f'/estudos/{eid}/avancado/cronograma')}
    for ev, campos in m.crono.items():
        for c, v in campos.items():
            if v is not None and ev in cr and c in cr[ev] and not (c == 'inicio_mes' and cr[ev].get('travado_inicio')) and not igual(v, cr[ev][c]):
                div.append(f'cronograma.{ev}.{c}: enviado {v!r}, gravado {cr[ev][c]!r}')
    tips = api.lista(f'/estudos/{eid}/avancado/tipologias')
    pedidas = [v for _, v in ordenados(m['tipologias']) if v.get('nome')]
    if len(tips) != len(pedidas):
        div.append(f'tipologias: pedidas {len(pedidas)}, gravadas {len(tips)}')
    por_nome = {t['nome']: t for t in tips}
    for t in pedidas:
        g = por_nome.get(t['nome'])
        if not g:
            div.append(f'tipologia "{t["nome"]}" não foi gravada')
            continue
        for c in ('area_privativa_m2', 'area_privativa_aberta_m2', 'quantidade', 'preco_m2'):
            if t.get(c) is not None and not igual(t[c], g.get(c)):
                div.append(f'tipologia "{t["nome"]}".{c}: enviado {t[c]!r}, gravado {g.get(c)!r}')
    receitas = api.lista(f'/estudos/{eid}/avancado/receitas')
    pedidos_g = {v['nome']: v for _, v in ordenados(m['grupos']) if v.get('nome')}
    if len(receitas) != len(pedidos_g):
        div.append(f'grupos: pedidos {len(pedidos_g)}, gravados {len(receitas)}')
    for r in receitas:
        fp = r.get('fluxo_pagamento') or {}
        comp = fp.get('componentes')
        if not (isinstance(comp, list) and comp):
            div.append(f'grupo "{r.get("nome")}": fluxo de pagamento SEM componentes (o motor calcula sem juros)')
        elif abs(sum(float(c.get('participacaoPct') or 0) for c in comp) - 100) > 0.01:
            div.append(f'grupo "{r.get("nome")}": Σ componentes ≠ 100')
        pos = [b for b in (r.get('absorcao') or {}).get('blocos', []) if b.get('evento') == 'pos_obra']
        g = pedidos_g.get(r.get('nome'))
        if g and pos:
            esperado = 100 - sum(float(g.get(c) or 0) for c in ('pre_lancamento_pct', 'lancamento_pct', 'obra_pct'))
            if not igual(esperado, pos[0].get('pct'), tol=0.01):
                div.append(f'grupo "{r.get("nome")}": pós-chaves gravado {pos[0].get("pct")!r}, derivado {esperado!r}')
        if g and not igual(g.get('residuo_sem_prazo', 'imediato'), fp.get('residuoAteMarco', 'imediato')):
            div.append(f'grupo "{r.get("nome")}": resíduo sem prazo enviado {g.get("residuo_sem_prazo")!r}, gravado {fp.get("residuoAteMarco")!r}')
        alocado = sum(int(t.get('quantidade') or 0) for t in r.get('tipologias', []))
        pedido = sum(int(a.get('unidades') or 0) for _, a in ordenados(m['alocacoes']) if a.get('grupo') == r.get('nome'))
        if alocado != pedido:
            div.append(f'grupo "{r.get("nome")}": unidades alocadas pedidas {pedido}, gravadas {alocado}')
    custos = api.lista(f'/estudos/{eid}/avancado/custos')
    esperados = []
    for _, c in ordenados(m['custos']):
        if c.get('categoria') is None:
            continue
        un = c['unidade']
        esperados.append((c['grupo'], c['categoria'], c.get('subcategoria') or None, un,
                          c.get('valor_pct') if str(un).startswith('pct') else c.get('valor_rs')))
    for _, q in ordenados(m['permuta_fisica']):
        if q.get('unidades') is not None:
            esperados.append(('terreno', 'Preço', 'Permuta física', 'rs', None))
    for _, q in ordenados(m['permuta_financeira']):
        if q.get('unidade') is not None:
            esperados.append(('terreno', 'Preço', 'Permuta financeira', q['unidade'],
                              q.get('valor_pct') if q['unidade'] == 'pct_vgv' else q.get('valor_rs')))
    gravados = [(c['grupo'], c['categoria'], c.get('subcategoria') or None, c['orcamento_unidade'], c.get('orcamento_valor')) for c in custos]
    if len(gravados) != len(esperados):
        div.append(f'custos: pedidos {len(esperados)}, gravados {len(gravados)}')
    restantes = list(gravados)
    for e in esperados:
        achou = next((g for g in restantes if g[:4] == e[:4] and (e[4] is None or igual(e[4], g[4]))), None)
        if achou is None:
            div.append(f'custo {e[0]}/{e[1]}{"/" + e[2] if e[2] else ""} ({e[3]}={e[4]!r}) não foi gravado como pedido')
        else:
            restantes.remove(achou)
    ops = api.lista(f'/estudos/{eid}/avancado/funding')
    pedidas = (len(ordenados(m['funding.financiamento_producao'])) + len(ordenados(m['funding.divida'])) + len(ordenados(m['funding.equity'])))
    pedidas = sum(1 for lista in ('funding.financiamento_producao', 'funding.divida', 'funding.equity')
                  for _, o in ordenados(m[lista]) if o.get('nome'))
    if len(ops) != pedidas:
        div.append(f'funding: pedidas {pedidas}, gravadas {len(ops)}')
    cen = api.lista(f'/estudos/{eid}/avancado/cenarios')
    ped = [c for _, c in ordenados(m['cenarios']) if c.get('nome')]
    if len(cen) != len(ped):
        div.append(f'cenários: pedidos {len(ped)}, gravados {len(cen)}')
    return div


def conferir(eid):
    env = dict(os.environ, URBI_BASE=os.environ['URBIVERSO_QA_URL'], URBI_TOKEN=os.environ['URBIVERSO_QA_TOKEN_PCPAL'])
    r = subprocess.run(['node', '--import', 'tsx/esm', 'scripts/conferir-estudo.ts', str(eid)], cwd=RAIZ, env=env,
                       capture_output=True, text=True, timeout=300)
    saida = r.stdout + r.stderr
    resumo, reais, conhecidos = [], [], []
    for ln in saida.splitlines():
        s = ln.strip()
        if re.match(r'^(VGV|Receita líquida|Custo (direto|indireto|total)|Resultado|Margem|ROI|TIR|VPL|Payback|Exposição|Juros de clientes|Carteira|Repasse)', s):
            resumo.append(s)
        if s.startswith('FALHA') or s.startswith('[erro]') or s.startswith('[alerta]'):
            rotulo = next((c for rx, c in CONHECIDOS if rx.search(s)), None)
            (conhecidos if rotulo else reais).append(f'{s[:200]}' + (f'  → {rotulo}' if rotulo else ''))
    reais = [x for x in reais if not x.startswith('[alerta]') or 'CAIXA_ACUMULADO' not in x]
    return resumo, reais, conhecidos, r.returncode


# ═════════════════════════ main ═════════════════════════
def main(argv):
    args = [a for a in argv[1:]]
    executar = '--executar' in args
    nome = args[args.index('--nome-estudo') + 1] if '--nome-estudo' in args else None
    rel = args[args.index('--relatorio') + 1] if '--relatorio' in args else None
    arquivo = next(a for a in args if a.endswith('.xlsx'))
    m = montar(ler(arquivo))
    if nome:
        m.estudo['nome'] = nome
    erros, avisos = validar(m)
    relatorio = {'arquivo': arquivo, 'erros_de_preenchimento': erros, 'avisos': avisos,
                 'ignoradas': m.ignoradas, 'estudo_id': None}
    print(f'Formulário: {arquivo}')
    for a in avisos:
        print('  aviso :', a)
    for rot, k in m.ignoradas:
        print(f'  ignorado (sem tratamento): "{rot}" [{k}]')
    for er in erros:
        print('  ERRO  :', er)
    if erros:
        print(f'\n{len(erros)} erro(s) de preenchimento — nada foi escrito.')
        if rel:
            Path(rel).write_text(json.dumps(relatorio, ensure_ascii=False, indent=2))
        return 1
    api = Api(executar)
    eid = criar_estudo(api, m)
    if eid is None:
        print('ERRO: o POST /estudos falhou:', api.falhas())
        return 1
    (escrever_preliminar if m.estudo['nivel_analise'] == 'preliminar' else escrever_avancado)(api, m, eid)
    falhas = api.falhas()
    for mt, c, s, r_ in api.log:
        if s == 'aviso':
            print('  aviso :', c)
    print(f'\nestudo_id = {eid} · {len(api.log)} chamadas · {len(falhas)} falha(s) HTTP')
    for mt, c, s, r_ in falhas:
        print(f'  XX {mt} {c} {s} {r_}')
    relatorio.update(estudo_id=eid, falhas_http=[list(f) for f in falhas])
    if not executar:
        print('\n(plano — use --executar para escrever)')
        return 0
    if m.estudo['nivel_analise'] == 'avancado':
        rc, saida = canonico(eid)
        print('\npagamento canônico:', 'ok' if rc == 0 else 'FALHOU')
        for ln in saida.splitlines():
            print('  ', ln)
    div = reler(api, m, eid)
    print(f'\nreleitura: {len(div)} divergência(s)')
    for d in div:
        print('  DIVERGE:', d)
    resumo, reais, conhecidos, _ = conferir(eid)
    print('\nmotor do app:')
    for ln in resumo:
        print('  ', ln)
    for x in conhecidos:
        print('  conhecido:', x)
    for x in reais:
        print('  PROBLEMA :', x)
    relatorio.update(divergencias=div, motor=resumo, problemas=reais, conhecidos=conhecidos)
    if rel:
        Path(rel).write_text(json.dumps(relatorio, ensure_ascii=False, indent=2))
    ok = not falhas and not div and not reais
    print('\nRESULTADO:', 'OK' if ok else 'COM PENDÊNCIAS')
    return 0 if ok else 2


if __name__ == '__main__':
    sys.exit(main(sys.argv))
