/**
 * Põe lado a lado a Proforma do Preliminar e a do Avançado do MESMO projeto (dois estudos da instância).
 *
 *     URBI_BASE=… URBI_TOKEN=… node --import tsx/esm scripts/formularios/comparar-niveis.ts <idPreliminar> <idAvancado>
 *
 * Só emite GET (via `conferir`). Mostra as linhas da Proforma de cada nível pelo rótulo e a diferença.
 */
import { conferir } from '../conferir-estudo.js';
import { proformaAvancado } from '../../frontend/proforma-avancado.js';
import { areaPrivativaTotalLinhas } from '../../frontend/fluxo-shared.js';

const R = (v: number | null | undefined): string => v === null || v === undefined ? '—'
  : (v < 0 ? '-' : '') + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const [idP, idA] = process.argv.slice(2).map(Number);
const p = await conferir(idP);
const a = await conferir(idA);
const pp: any = p.proforma!;
const area = areaPrivativaTotalLinhas(a.brutos.receitas);
const av: any = proformaAvancado(a.calc!, area);

console.log(`PRELIMINAR ${idP} "${p.nome}"  ×  AVANÇADO ${idA} "${a.nome}"\n`);
const linhasP: [string, number][] = [
  ['VGV (receita bruta)', pp.vgv], ['Imposto', pp.imposto], ['Corretagem', pp.corretagem], ['Marketing', pp.marketing],
  ['Permuta financeira', pp.permutaFinResidencial + pp.permutaFinNaoResidencial], ['Receita líquida', pp.receitaLiquida],
  ['Custo do terreno', pp.custoTerreno], ['Projetos', pp.projetos], ['Infraestrutura', pp.infraestrutura],
  ['Construção', pp.construcao], ['Gestão da construção', pp.gestaoConstrucao], ['Decoração', pp.decoracao],
  ['Incorporação e registro', pp.incorporacaoRegistro], ['Manutenção pós-obra', pp.manutencao], ['Contingências', pp.contingencias],
  ['Custo direto total', pp.custoDiretoTotal], ['Stand de vendas', pp.standVendas], ['Gestão e indiretos', pp.gestaoIndiretos],
  ['Custo indireto total', pp.custoIndiretoTotal], ['RESULTADO', pp.resultado],
];
console.log('— Preliminar (R$) —');
for (const [r, v] of linhasP) console.log(`  ${r.padEnd(28)} ${R(v).padStart(16)}`);
console.log('\n— Avançado: linhas da Proforma (R$) —');
for (const l of av.linhas) console.log(`  ${String(l.rotulo ?? l.nome ?? l.id).padEnd(44)} ${R(l.valor ?? l.rs ?? l.total).padStart(16)}`);
console.log('\n— Totais —');
const k: any = a.calc;
const linha = (r: string, x: number, y: number) => console.log(`  ${r.padEnd(34)} prelim ${R(x).padStart(14)}   avanç ${R(y).padStart(14)}   Δ ${R(y - x).padStart(14)}`);
linha('VGV (após permuta física)', pp.vgv, k.vgvVendavel ?? k.vgvTotal - k.vgvPermutaFisica);
linha('Resultado', pp.resultado, av.resultado ?? k.fluxoAcumulado[k.fluxoAcumulado.length - 1]);
console.log(`  juros de clientes (só o Avançado têm tempo): ${R(k.jurosClientes)}`);
console.log(`  prazo ${k.prazo} meses · TIR ${Number(k.tir).toFixed(2)}% a.a. · VPL ${R(k.vpl)}`);
