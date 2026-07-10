// Entrada da página de demonstração (GitHub Pages).
// Ordem importa: o mock precisa registrar globalThis.urbiVerso ANTES de os
// componentes serem importados (viabilidade-api.ts lê no load do módulo).
import './mock.js';
import '../frontend/index.js'; // registra <app-viabilidade> e <viabilidade-config-benchmarks>

const root = document.getElementById('root');

function mostrar(view: string) {
  if (!root) return;
  root.innerHTML = '';
  root.appendChild(document.createElement(view === 'config' ? 'viabilidade-config-benchmarks' : 'app-viabilidade'));
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
    b.classList.toggle('ativa', b.dataset.view === view);
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
  b.addEventListener('click', () => mostrar(b.dataset.view || 'app'));
});

mostrar('app');
