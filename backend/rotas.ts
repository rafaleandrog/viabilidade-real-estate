import '@urbiverso/sdk/express';
import { Router } from 'express';
import { rotasEstudos } from './rotas/estudos.js';
import { rotasMembrosEstudo } from './rotas/membros-estudo.js';
import { rotasImoveisEstudo } from './rotas/imoveis-estudo.js';
import { rotasBenchmarks } from './rotas/benchmarks.js';
import { rotasConfig } from './rotas/config.js';
import { rotasApelo } from './rotas/apelo-comercial.js';
import { rotasEmpreendimento } from './rotas/empreendimento.js';
import { rotasPreliminarProdutos } from './rotas/preliminar-produtos.js';
import { rotasManutencao } from './rotas/manutencao.js';
import { rotasAvancado } from './rotas/avancado.js';
import { rotasAnaliseMercado } from './rotas/analise-mercado.js';
import { rotasCapitalStack } from './rotas/capital-stack.js';

// Rotas de negócio da app `viabilidade`.
// O shell prefixa tudo com /api/viabilidade/ — as rotas aqui são sempre relativas.
// req.contexto (usuário/nível/roles), req.dados (persistência) e req.eventos já
// vêm injetados pelo shell.
export const rotas: ReturnType<typeof Router> = Router();

rotas.use(rotasEstudos);
rotas.use(rotasMembrosEstudo);
rotas.use(rotasImoveisEstudo);
rotas.use(rotasBenchmarks);
rotas.use(rotasConfig);
rotas.use(rotasApelo);
rotas.use(rotasEmpreendimento);
rotas.use(rotasPreliminarProdutos);
rotas.use(rotasManutencao);
rotas.use(rotasAvancado);
rotas.use(rotasAnaliseMercado);
rotas.use(rotasCapitalStack);

// Rotinas agendadas (framework de agenda do UrbiVerso, #200). Declaradas em
// `manifesto.json` → `rotinas`; o shell descobre este export no mesmo módulo de
// entrada do backend e chama o handler na frequência declarada (`diaria`).
export { rotinas } from './rotinas.js';
