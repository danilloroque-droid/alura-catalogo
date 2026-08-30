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

  // Popularidade sofre do mesmo problema de escala que nota, e ate a fix wave
  // a recusa existia em aplicar() mas nao aparecia na interface: a ordem caia
  // para titulo em silencio.
  it('explica por que ordenar por popularidade fica indisponivel com plataformas misturadas', () => {
    const misto: Indice = {
      ...indice,
      itens: [
        item('a', { popularidade: 0.9, escalaPopularidade: 'ms-popularity' }),
        item('b', { plataforma: 'alura', popularidade: 12000, escalaPopularidade: 'alura-alunos' }),
      ],
    };
    window.location.hash = '#/?ordem=popularidade';
    render(<Catalogo indice={misto} />);
    expect(screen.getByText(/alunos matriculados/i)).toBeDefined();
  });

  it('desabilita no seletor apenas a ordem cuja escala se mistura', () => {
    const misto: Indice = {
      ...indice,
      itens: [
        item('a', { popularidade: 0.9, escalaPopularidade: 'ms-popularity', nota: 4.8, escalaNota: 'ms-rating' }),
        item('b', { plataforma: 'alura', popularidade: 12000, escalaPopularidade: 'alura-alunos', nota: 4.7, escalaNota: 'ms-rating' }),
      ],
    };
    render(<Catalogo indice={misto} />);
    const opcao = (nome: string) => screen.getByRole('option', { name: nome }) as HTMLOptionElement;
    // Popularidade mistura ms-popularity com alura-alunos; nota esta em
    // ms-rating dos dois lados, entao segue comparavel.
    expect(opcao('Popularidade').disabled).toBe(true);
    expect(opcao('Nota').disabled).toBe(false);
    expect(opcao('Título').disabled).toBe(false);
  });

  // A permissao e do conjunto filtrado, nao do catalogo: estreitar para uma
  // unica plataforma devolve o sentido a escala e a ordem volta a valer.
  it('libera de novo a ordem restrita quando o filtro estreita para uma plataforma', () => {
    const misto: Indice = {
      ...indice,
      itens: [
        item('a', { popularidade: 0.9, escalaPopularidade: 'ms-popularity' }),
        item('b', { plataforma: 'alura', popularidade: 12000, escalaPopularidade: 'alura-alunos' }),
      ],
    };
    window.location.hash = '#/?ordem=popularidade&plat=ms-learn';
    render(<Catalogo indice={misto} />);

    expect(screen.queryByText(/alunos matriculados/i)).toBeNull();
    const opcao = screen.getByRole('option', { name: 'Popularidade' }) as HTMLOptionElement;
    expect(opcao.disabled).toBe(false);
  });
});
