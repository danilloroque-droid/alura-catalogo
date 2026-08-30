// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Catalogo } from '../src/paginas/Catalogo.js';
import type { Indice, ItemCatalogo } from '@compartilhado/types';

function item(id: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo {
  return {
    id, plataforma: 'ms-learn', tipo: 'modulo', titulo: `Item ${id}`,
    resumo: null, url: `https://exemplo/${id}`, duracaoMinutos: 60,
    nivel: 'iniciante', temas: ['dados'], temasOriginais: [], instrutores: [],
    idioma: 'pt-BR', criadoEm: null, atualizadoEm: '2026-01-01', nota: null,
    escalaNota: null, popularidade: null, escalaPopularidade: null,
    ehCheckpoint: false, ...extra,
  };
}

const indice: Indice = {
  geradoEm: '2026-08-29T00:00:00Z',
  fontes: [{ plataforma: 'ms-learn', total: 3, coletadoEm: '2026-08-29' }],
  temas: [{ id: 'dados', nome: 'Dados' }, { id: 'seguranca', nome: 'Segurança' }],
  itens: [
    item('a', { titulo: 'Docker na prática', temas: ['dados'] }),
    item('b', { titulo: 'Segurança em nuvem', temas: ['seguranca'], tipo: 'trilha' }),
    item('c', { titulo: 'Power BI', temas: ['dados'] }),
  ],
};

beforeEach(() => { window.location.hash = ''; });

describe('Catalogo', () => {
  it('lista tudo ao abrir', () => {
    render(<Catalogo indice={indice} />);
    expect(screen.getByText('3 resultados')).toBeDefined();
  });

  it('filtra ao digitar na busca', async () => {
    render(<Catalogo indice={indice} />);
    await userEvent.type(screen.getByLabelText(/buscar/i), 'docker');
    expect(screen.getByText('1 resultado')).toBeDefined();
  });

  it('filtra ao marcar um tema', async () => {
    render(<Catalogo indice={indice} />);
    await userEvent.click(screen.getByLabelText('Segurança'));
    expect(screen.getByText('1 resultado')).toBeDefined();
  });

  it('escreve os criterios na URL', async () => {
    render(<Catalogo indice={indice} />);
    await userEvent.type(screen.getByLabelText(/buscar/i), 'power');
    expect(window.location.hash).toContain('q=power');
  });

  it('le os criterios da URL ao abrir', () => {
    window.location.hash = '#/?tipo=trilha';
    render(<Catalogo indice={indice} />);
    expect(screen.getByText('1 resultado')).toBeDefined();
  });

  it('limpa todos os filtros', async () => {
    render(<Catalogo indice={indice} />);
    await userEvent.type(screen.getByLabelText(/buscar/i), 'docker');
    await userEvent.click(screen.getByRole('button', { name: /limpar filtros/i }));
    expect(screen.getByText('3 resultados')).toBeDefined();
    expect(window.location.hash).toBe('#/');
  });

  it('explica por que ordenar por nota fica indisponivel com plataformas misturadas', () => {
    const misto: Indice = {
      ...indice,
      itens: [
        item('a', { nota: 4.8, escalaNota: 'ms-rating' }),
        item('b', { plataforma: 'alura', nota: 9.4, escalaNota: 'alura-nps' }),
      ],
    };
    window.location.hash = '#/?ordem=nota';
    render(<Catalogo indice={misto} />);
    expect(screen.getByText(/escalas diferentes/i)).toBeDefined();
  });

  it('volta para a primeira pagina da lista quando um filtro muda', async () => {
    const muitos: Indice = {
      ...indice,
      itens: [
        ...Array.from({ length: 100 }, (_, i) =>
          item(`dados-${i}`, { titulo: `Item dados ${i}`, temas: ['dados'] }),
        ),
        ...Array.from({ length: 100 }, (_, i) =>
          item(`seguranca-${i}`, { titulo: `Item seguranca ${i}`, temas: ['seguranca'] }),
        ),
      ],
    };
    render(<Catalogo indice={muitos} />);
    await userEvent.click(screen.getByRole('button', { name: /mostrar mais/i }));
    expect(screen.getAllByRole('article')).toHaveLength(120);

    await userEvent.click(screen.getByLabelText('Segurança'));

    // Sem a remontagem via key, o estado de paginacao (120 visiveis)
    // persistiria e os 100 itens filtrados apareceriam de uma vez.
    expect(screen.getAllByRole('article')).toHaveLength(60);
  });
});
