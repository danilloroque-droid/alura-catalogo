// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListaItens } from '../src/componentes/ListaItens.js';
import type { ItemCatalogo } from '@compartilhado/types';

function item(id: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo {
  return {
    id, plataforma: 'ms-learn', tipo: 'modulo', titulo: `Item ${id}`,
    resumo: 'Um resumo', url: `https://exemplo/${id}`, duracaoMinutos: 90,
    nivel: 'iniciante', temas: ['dados'], temasOriginais: [], instrutores: [],
    idioma: 'pt-BR', criadoEm: null, atualizadoEm: '2026-01-01', nota: null,
    escalaNota: null, popularidade: null, escalaPopularidade: null,
    ehCheckpoint: false, ...extra,
  };
}

const muitos = Array.from({ length: 25 }, (_, i) => item(String(i).padStart(2, '0')));

describe('ListaItens', () => {
  it('mostra o numero de resultados', () => {
    render(<ListaItens itens={muitos} porPagina={10} />);
    expect(screen.getByText('25 resultados')).toBeDefined();
  });

  it('usa o singular quando ha um unico resultado', () => {
    render(<ListaItens itens={[item('a')]} />);
    expect(screen.getByText('1 resultado')).toBeDefined();
  });

  it('renderiza apenas a primeira pagina', () => {
    render(<ListaItens itens={muitos} porPagina={10} />);
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('mostra mais itens ao acionar o botao', async () => {
    render(<ListaItens itens={muitos} porPagina={10} />);
    await userEvent.click(screen.getByRole('button', { name: /mostrar mais/i }));
    expect(screen.getAllByRole('article')).toHaveLength(20);
  });

  it('esconde o botao quando tudo ja esta na tela', async () => {
    render(<ListaItens itens={muitos} porPagina={10} />);
    const botao = screen.getByRole('button', { name: /mostrar mais/i });
    await userEvent.click(botao);
    await userEvent.click(screen.getByRole('button', { name: /mostrar mais/i }));
    expect(screen.queryByRole('button', { name: /mostrar mais/i })).toBeNull();
  });

  it('mantem a pagina atual quando a lista muda mas a key nao muda', async () => {
    const { rerender } = render(<ListaItens itens={muitos} porPagina={10} />);
    await userEvent.click(screen.getByRole('button', { name: /mostrar mais/i }));
    expect(screen.getAllByRole('article')).toHaveLength(20);
    const outros = Array.from({ length: 25 }, (_, i) => item(`x${i}`));
    rerender(<ListaItens itens={outros} porPagina={10} />);
    expect(screen.getAllByRole('article')).toHaveLength(20);
  });

  it('volta para a primeira pagina quando a key muda (remontagem)', async () => {
    const { rerender } = render(<ListaItens key="a" itens={muitos} porPagina={10} />);
    await userEvent.click(screen.getByRole('button', { name: /mostrar mais/i }));
    expect(screen.getAllByRole('article')).toHaveLength(20);
    rerender(<ListaItens key="b" itens={muitos} porPagina={10} />);
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('avisa quando nao ha resultado', () => {
    render(<ListaItens itens={[]} />);
    expect(screen.getByText(/nenhum item encontrado/i)).toBeDefined();
  });

  it('mostra duracao em horas e minutos e liga para a plataforma', () => {
    render(<ListaItens itens={[item('a', { duracaoMinutos: 150 })]} />);
    expect(screen.getByText('2 h 30 min')).toBeDefined();
    expect(screen.getByRole('link', { name: /item a/i }).getAttribute('href'))
      .toBe('https://exemplo/a');
  });

  it('mostra a nota com a escala da propria plataforma', () => {
    render(<ListaItens itens={[
      item('a', { nota: 4.83, escalaNota: 'ms-rating' }),
      item('b', { plataforma: 'alura', nota: 9.4, escalaNota: 'alura-nps' }),
    ]} />);
    expect(screen.getByText('4.8/5')).toBeDefined();
    expect(screen.getByText('9.4/10')).toBeDefined();
  });
});
