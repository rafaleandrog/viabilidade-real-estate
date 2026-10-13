#!/usr/bin/env python3
"""Cria um estudo na instância a partir de um formulário simplificado preenchido (.xlsx).

    python3 -I scripts/formularios/importar_formulario.py <formulario.xlsx> [--nome-estudo "qa-..."] [--executar]

Sem --executar só mostra o plano (o que seria enviado, por rota). Com --executar escreve na instância
apontada por URBIVERSO_QA_URL, com o token URBIVERSO_QA_TOKEN_PCPAL (nunca impresso).

O que é lido da planilha — e é isto o que o teste valida: a coluna A (rótulo), B (valor), C (unidade),
D (chave técnica) e o FORMATO da célula B (célula formatada em % guarda fração: 0,04 vira 4 na API).
Nada é lido do gerador. Onde a chave técnica não basta para decidir, o importador usa o rótulo e registra a
ocorrência em `lacunas_da_chave` — vira insumo do diagnóstico.
"""
import json
import os
import re
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

import openpyxl

CTX = ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
LACUNAS_DA_CHAVE = []       # (rótulo, motivo)
RESPOSTAS = []              # (método, caminho, status, resumo)


# ───────────────────────── leitura da planilha ─────────────────────────
def ler(caminho):
    ws = openpyxl.load_workbook(caminho)['Formulário']
    linhas = []
    for row in ws.iter_rows(min_row=4):
        a, b, c, d = row[0], row[1], row[2], row[3]
        if a.value is None:
            continue
        if str(a.value).startswith('REFERÊNCIA CALCULADA'):
            break                      # a zona calculada não é entrada
        if b.fill is None or d.value is None:
            continue                   # faixa de seção/grupo/nota (sem chave técnica)
        v = b.value
        if v is None or v == '':
            continue
        pct = '%' in (b.number_format or '')
        if isinstance(v, (int, float)) and pct:
            v = round(v * 100, 8)      # fração do Excel -> pontos da API
        if isinstance(v, str) and v in ('Sim', 'Não'):
            v = v == 'Sim'
        if hasattr(v, 'strftime'):
            meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
            v = f'{meses[v.month - 1]}/{v.year}'
        linhas.append(dict(rotulo=str(a.value), valor=v, unidade=c.value, chave=str(d.value), pct=pct))
    return linhas


# ───────────────────────── HTTP ─────────────────────────
def chamar(metodo, caminho, corpo=None, executar=True):
    if not executar:
        RESPOSTAS.append((metodo, caminho, 'plano', json.dumps(corpo, ensure_ascii=False)[:160] if corpo else ''))
        return 0, {'id': 0}
    url = os.environ['URBIVERSO_QA_URL'].rstrip('/') + caminho
    dados = json.dumps(corpo).encode() if corpo is not None else None
    req = urllib.request.Request(url, data=dados, method=metodo, headers={
        'Authorization': 'Bearer ' + os.environ['URBIVERSO_QA_TOKEN_PCPAL'], 'Content-Type': 'application/json'})
    try:
        r = urllib.request.urlopen(req, context=CTX, timeout=60)
        status, txt = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, txt = e.code, e.read().decode()
    try:
        js = json.loads(txt) if txt else {}
    except ValueError:
        js = {'_texto': txt[:300]}
    RESPOSTAS.append((metodo, caminho, status, (json.dumps(js, ensure_ascii=False)[:200] if status >= 400 else '')))
    return status, js


# ───────────────────────── montagem ─────────────────────────
ALT = re.compile(r'^(\w+) = (\w+) → (\w+)')


def colunas_do_estudo(linhas):
    """estudos.<col> diretos + pares 'modo = x → valor' -> dict coluna -> valor (pontos)."""
    out = {}
    for ln in linhas:
        k = ln['chave']
        m = ALT.match(k)
        if m:
            modo_col, modo, valor_col = m.groups()
            out[modo_col] = modo
            out[valor_col] = ln['valor']
            continue
        if k.startswith('estudos.') and re.fullmatch(r'estudos\.\w+', k):
            out[k.split('.', 1)[1]] = ln['valor']
        elif k.startswith('parametros.'):
            out['__param_' + k.split('.', 1)[1]] = ln['valor']
        elif k.startswith('cronograma.'):
            out['__crono_' + k.split('.', 1)[1]] = ln['valor']
    return out


def itens(linhas, prefixo_rotulo, sep=' — '):
    """Agrupa linhas 'Prefixo N — campo' em {N: {campo: valor}}."""
    grupos = {}
    pat = re.compile(rf'^{re.escape(prefixo_rotulo)} (\d+){sep}(.+)$')
    for ln in linhas:
        m = pat.match(ln['rotulo'])
        if m:
            grupos.setdefault(int(m.group(1)), {})[m.group(2)] = ln
    return grupos


def val(d, campo, padrao=None):
    return d[campo]['valor'] if campo in d else padrao


def preliminar(linhas, nome_estudo, executar):
    c = colunas_do_estudo(linhas)
    tipo = c.pop('tipo_empreendimento')
    corpo = {'nome': nome_estudo or c.pop('nome'), 'tipo_empreendimento': tipo, 'nivel_analise': 'preliminar',
             'origem_terreno': c.pop('origem_terreno', 'manual'), 'uf': c.pop('uf', None)}
    c.pop('nome', None); c.pop('nivel_analise', None)
    for k in ('terreno_manual_nome', 'terreno_manual_area', 'notas'):
        if k in c:
            corpo[k] = c.pop(k)
    st, e = chamar('POST', '/api/viabilidade/estudos', corpo, executar)
    if st not in (0, 201):
        return None
    eid = e['id']
    resto = {k: v for k, v in c.items() if not k.startswith('__')}
    chamar('PATCH', f'/api/viabilidade/estudos/{eid}', resto, executar)
    for i, p in sorted(itens(linhas, 'Produto').items()):
        corpo_p = {'nome': val(p, 'Nome'), 'tipo': val(p, 'Tipo'), 'pct_alv': val(p, '% da base'),
                   'unidades': val(p, 'Unidades'), 'preco_venda_m2': val(p, 'Preço de venda'), 'ordem': i - 1}
        chamar('POST', f'/api/viabilidade/estudos/{eid}/preliminar/produtos', corpo_p, executar)
    return eid


MESES = {'planejamento': 'plan', 'pre_lancamento': 'pre', 'lancamento': 'lanc', 'obra': 'obra', 'pos_obra': 'pos'}


def avancado(linhas, nome_estudo, executar):
    c = colunas_do_estudo(linhas)
    tipo = c.pop('tipo_empreendimento'); lote = tipo == 'loteamento'
    corpo = {'nome': nome_estudo or c.pop('nome'), 'tipo_empreendimento': tipo, 'nivel_analise': 'avancado',
             'origem_terreno': c.pop('origem_terreno', 'manual'), 'uf': c.pop('uf', None)}
    c.pop('nome', None); c.pop('nivel_analise', None)
    for k in ('terreno_manual_nome', 'terreno_manual_area', 'notas'):
        if k in c:
            corpo[k] = c.pop(k)
    st, e = chamar('POST', '/api/viabilidade/estudos', corpo, executar)
    if st not in (0, 201):
        return None
    eid = e['id']
    base = f'/api/viabilidade/estudos/{eid}'
    estudo = {k: v for k, v in c.items() if not k.startswith('__')}
    chamar('PATCH', base, estudo, executar)
    pr = {k[len('__param_'):]: v for k, v in c.items() if k.startswith('__param_')}
    # tem_pre_lancamento ANTES do cronograma
    chamar('PATCH', f'{base}/avancado/parametros', pr, executar)

    # cronograma: só inícios livres (planejamento e obra) e durações
    cr = {k[len('__crono_'):]: v for k, v in c.items() if k.startswith('__crono_')}
    eventos = {}
    for ev in MESES:
        d = {}
        if f'{ev}.inicio_mes' in cr:
            d['inicio_mes'] = cr[f'{ev}.inicio_mes']
        if f'{ev}.duracao_meses' in cr:
            d['duracao_meses'] = cr[f'{ev}.duracao_meses']
        if d:
            eventos[ev] = d
    chamar('PATCH', f'{base}/avancado/cronograma', {'eventos': eventos}, executar)

    # fases customizadas
    fase_id = {}
    for i, f in sorted(itens(linhas, 'Fase').items()):
        nome = val(f, 'Nome')
        if not nome:
            continue
        st, r = chamar('POST', f'{base}/avancado/fases', {'tipo': 'cronograma', 'nome': nome,
                       'inicio_mes': val(f, 'Início', 0), 'duracao_meses': val(f, 'Duração', 1)}, executar)
        fase_id[nome] = r.get('id')

    # tipologias
    tip_id = {}
    rot_tip = 'Lote' if lote else 'Tipologia'
    for i, t in sorted(itens(linhas, rot_tip).items()):
        nome = val(t, 'Nome')
        if not nome:
            continue
        corpo_t = {'nome': nome, 'tipo_unidade': 'lote' if lote else val(t, 'Tipo', 'apartamento'),
                   'area_privativa_m2': val(t, 'Área privativa (fechada)'), 'area_privativa_aberta_m2': val(t, 'Área aberta', 0),
                   'quantidade': val(t, 'Unidades', 0), 'preco_m2': val(t, 'Preço/m² sugerido'), 'ordem': i - 1}
        if not lote:
            corpo_t['dormitorios'] = val(t, 'Dormitórios'); corpo_t['vagas'] = val(t, 'Vagas')
        st, r = chamar('POST', f'{base}/avancado/tipologias', corpo_t, executar)
        tip_id[nome] = r.get('id')

    # grupos de venda + pagamento
    pag = itens(linhas, 'Condição')
    grupo_id = {}
    for g, gr in sorted(itens(linhas, 'Grupo').items()):
        nome = val(gr, 'Nome')
        if not nome:
            continue
        st, r = chamar('POST', f'{base}/avancado/fases', {'tipo': 'receita', 'nome': nome}, executar)
        fid = r.get('id'); grupo_id[nome] = fid
        pre = val(gr, 'Absorção no Pré-lançamento (só com pré)')
        blocos = []
        if pr.get('tem_pre_lancamento') is True:
            blocos.append({'evento': 'pre_lancamento', 'pct': pre or 0})
        blocos += [{'evento': 'lancamento', 'pct': val(gr, 'Absorção no Lançamento', 0)},
                   {'evento': 'obra', 'pct': val(gr, 'Absorção Durante a obra', 0)}, {'evento': 'pos_obra', 'pct': 0}]
        absorcao = {'modo': 'distribuido', 'correcao_estoque': bool(val(gr, 'Correção de estoque', False)),
                    'pos_chaves_meses': val(gr, 'Janela pós-chaves', 12), 'blocos': blocos}
        entradas, parcelas = [], []
        for j, p in sorted(pag.items()):
            if val(p, 'Grupo') != nome:
                continue
            if val(p, 'Linha') == 'Entrada':
                entradas.append({'pct': val(p, '% do total', 0), 'parcelas': val(p, 'Nº de parcelas', 1),
                                 'descontoPct': val(p, 'Desconto (só Entrada)', 0)})
            else:
                parcelas.append({'periodicidade': 'mensal', 'parcelas': val(p, 'Nº de parcelas', 0),
                                 'ao_longo_obra': bool(val(p, 'Ao longo da obra (só Parcelamento)', False)),
                                 'juros': True, 'pct': val(p, '% do total', 0),
                                 'sinalPct': val(p, 'Sinal (só Parcelamento)', 0)})
        fluxo = {'entrada': entradas, 'parcelas': parcelas, 'repasse': {'apos_entrega_meses': 1},
                 'residuoAteMarco': val(gr, 'Resíduo sem prazo', 'imediato')}
        chamar('PATCH', f'{base}/avancado/fases/{fid}', {'absorcao': absorcao, 'fluxo_pagamento': fluxo}, executar)

    # alocações
    for j, a in sorted(itens(linhas, 'Alocação').items()):
        if val(a, 'Grupo') is None:
            continue
        tnome = val(a, rot_tip)
        chamar('POST', f'{base}/avancado/fases/{grupo_id.get(val(a, "Grupo"))}/alocacoes',
               {'tipologia_id': tip_id.get(tnome), 'unidades': val(a, 'Unidades', 0), 'preco_m2': val(a, 'Preço')}, executar)

    # curvas do catálogo da instância (nome -> id)
    curvas = {}
    if executar:
        _, cv = chamar('GET', '/api/viabilidade/avancado/curvas', None, True)
        lista = cv.get('dados') if isinstance(cv, dict) else cv
        curvas = {x['nome']: x['id'] for x in (lista or [])}

    def custo_comum(cu, extra):
        d = dict(extra)
        dist = val(cu, 'Distribuição')
        if dist in curvas:
            d['curva_id'] = curvas[dist]; d['distribuicao_modo'] = 'fixo'
        elif dist in ('unit_delivery', 'sales_revenue'):
            d['distribuicao_modo'] = dist
        elif dist:
            d['distribuicao_modo'] = 'fixo'
            if dist != 'Linear':
                LACUNAS_DA_CHAVE.append((f'Distribuição "{dist}"', 'rótulo sem curva correspondente no catálogo da instância'))
        cron = val(cu, 'Cronograma')
        if cron and str(cron).startswith('fase:'):
            d['fase_ancora_id'] = fase_id.get(str(cron)[5:].strip())
        elif cron:
            d['cronograma_evento'] = cron
            if cron == 'customizado':
                d['inicio_mes'] = val(cu, 'Início (só customizado)', 0)
                d['duracao_meses'] = val(cu, 'Duração (só customizado)', 1)
        return d

    for k, cu in sorted(itens(linhas, 'Custo').items()):
        if val(cu, 'Categoria') is None:
            continue
        un = val(cu, 'Unidade')
        valor = val(cu, 'Valor (%)') if str(un).startswith('pct') else val(cu, 'Valor (R$ ou R$/m²)')
        d = {'grupo': val(cu, 'Grupo'), 'categoria': val(cu, 'Categoria'), 'subcategoria': val(cu, 'Subcategoria / descrição'),
             'orcamento_unidade': un, 'orcamento_valor': valor, 'ordem': k}
        chamar('POST', f'{base}/avancado/custos', custo_comum(cu, d), executar)
    for m, p in sorted(itens(linhas, 'Permuta física').items()):
        if val(p, 'Unidades entregues') is None:
            continue
        chamar('POST', f'{base}/avancado/custos', {'grupo': 'terreno', 'categoria': 'Preço', 'subcategoria': 'Permuta física',
               'permuta_tipologia_id': tip_id.get(val(p, rot_tip + ' entregue')), 'permuta_quantidade': val(p, 'Unidades entregues'),
               'distribuicao_modo': 'unit_delivery'}, executar)
    for m, p in sorted(itens(linhas, 'Permuta financeira').items()):
        un = val(p, 'Unidade')
        if un is None:
            continue
        valor = val(p, 'Valor em % do VGV') if un == 'pct_vgv' else val(p, 'Valor em R$')
        chamar('POST', f'{base}/avancado/custos', {'grupo': 'terreno', 'categoria': 'Preço', 'subcategoria': 'Permuta financeira',
               'orcamento_unidade': un, 'orcamento_valor': valor, 'distribuicao_modo': 'sales_revenue',
               'permuta_financeira_deduzir_imposto': bool(val(p, 'Deduzir impostos', False)),
               'permuta_financeira_deduzir_corretagem': bool(val(p, 'Deduzir corretagem', False))}, executar)

    # funding
    def funding(prefixo, tipo_op, mapa):
        for n, o in sorted(itens(linhas, prefixo).items()) if prefixo != 'Financiamento à produção' else [(0, {x['rotulo'].split(' — ', 1)[1]: x for x in linhas if x['rotulo'].startswith('Financiamento à produção — ')})]:
            if val(o, 'Nome') is None:
                continue
            d = {'tipo': tipo_op, 'nome': val(o, 'Nome')}
            for campo, col in mapa.items():
                if campo in o:
                    d[col] = o[campo]['valor']
            aporte = val(o, 'Mês do aporte')
            if aporte and str(aporte).startswith('fase:'):
                d['fase_ancora_id'] = fase_id.get(str(aporte)[5:].strip())
            elif aporte:
                d['cronograma_evento'] = aporte
            chamar('POST', f'{base}/avancado/funding', d, executar)
    funding('Financiamento à produção', 'financiamento_producao', {
        'Ativo': 'ativo', 'Teto': 'valor', 'Taxa': 'taxa_anual', 'Exposição mínima': 'exposicao_minima',
        '% do custo financiado': 'percentual_financiavel', 'Caixa amortiza antes das chaves': 'amortizar_com_caixa_disponivel'})
    if any('Base financiável' in x['rotulo'] for x in linhas):
        LACUNAS_DA_CHAVE.append(('Financiamento à produção — Base financiável', 'texto livre sem id de linha de custo; não enviado'))
    funding('Dívida', 'divida', {
        'Valor': 'valor', 'Mês (só customizado)': 'inicio_mes', 'Distribuir aporte': 'distribuir_aporte', 'Aporte em': 'aporte_meses',
        'Taxa': 'taxa_anual', 'Amortização': 'periodo_amortizacao_meses', 'Carência': 'periodo_carencia_meses',
        'Estruturação': 'taxa_estruturacao_pct', 'Administração': 'taxa_administracao_mensal', 'Outros encargos': 'outros_encargos_iniciais'})
    funding('Equity', 'equity', {'Valor': 'valor', 'Mês (só customizado)': 'inicio_mes', 'Modo de retorno': 'modo_retorno',
                                 '% de retorno': 'pct_retorno'})
    for n, o in sorted(itens(linhas, 'Cenário').items()):
        if val(o, 'Nome') is None:
            continue
        chamar('POST', f'{base}/avancado/cenarios', {'nome': val(o, 'Nome'), 'preco_venda_pct': val(o, 'Preço de venda', 0),
               'custo_obra_pct': val(o, 'Custo de obra', 0), 'ordem': n - 1}, executar)
    return eid


def main(argv):
    args = [a for a in argv[1:] if not a.startswith('--')]
    executar = '--executar' in argv
    nome = argv[argv.index('--nome-estudo') + 1] if '--nome-estudo' in argv else None
    if nome:
        args = [a for a in args if a != nome]
    linhas = ler(args[0])
    nivel = next(l['valor'] for l in linhas if l['chave'] == 'estudos.nivel_analise')
    eid = (preliminar if nivel == 'preliminar' else avancado)(linhas, nome, executar)
    print('estudo_id =', eid)
    for m, c, s, r in RESPOSTAS:
        marca = 'XX' if isinstance(s, int) and s >= 400 else '  '
        print(f'{marca} {m:6} {c.replace("/api/viabilidade", ""):58} {s} {r}')
    for l, mot in LACUNAS_DA_CHAVE:
        print('lacuna_da_chave:', l, '->', mot)


if __name__ == '__main__':
    main(sys.argv)
