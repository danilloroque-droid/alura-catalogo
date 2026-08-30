import { describe, it, expect } from 'vitest';
import {
  aplicar, buscar, filtrar, normalizarTexto, ordenar, ordenacaoPermitida,
  type Criterios,
} from '../src/filtros/filtros.js';
import type { ItemCatalogo } from '@compartilhado/types';

function item(p: Partial<ItemCatalogo> & { id: string }): ItemCatalogo {
  return {
    plataforma: 'ms-learn', tipo: 'modulo', titulo: p.id, resumo: null,
    url: '', duracaoMinutos: 60, nivel: 'iniciante', temas: ['dados'],
    temasOriginais: [], instrutores: [], idioma: 'pt-BR', criadoEm: null,
    atualizadoEm: '2026-01-01', nota: null, escalaNota: null,
    popularidade: null, escalaPopularidade: null, ehCheckpoint: false, ...p,
  };
}

const VAZIO: Criterios = {
  texto: '', plataformas: [], tipos: [], temas: [], niveis: [],
  duracaoMaxima: null, ordem: 'titulo',
};

describe('normalizarTexto', () => {
  it('remove acentos e caixa', () => {
    expect(normalizarTexto('Inteligência ARTIFICIAL')).toBe('inteligencia artificial');
  });
});

describe('buscar', () => {
  const itens = [
    item({ id: 'a', titulo: 'Introdução ao Docker' }),
    item({ id: 'b', titulo: 'Kubernetes', resumo: 'Orquestração de contêineres com Docker' }),
    item({ id: 'c', titulo: 'Power BI' }),
  ];

  it('devolve tudo quando o texto esta vazio', () => {
    expect(buscar(itens, '   ')).toHaveLength(3);
  });

  it('encontra no titulo e no resumo, ignorando acentos', () => {
    expect(buscar(itens, 'docker').map((i) => i.id)).toEqual(['a', 'b']);
    expect(buscar(itens, 'orquestracao').map((i) => i.id)).toEqual(['b']);
  });

  it('exige que todos os termos apareçam', () => {
    expect(buscar(itens, 'docker kubernetes').map((i) => i.id)).toEqual(['b']);
  });
});

describe('filtrar', () => {
  const itens = [
    item({ id: 'a', plataforma: 'ms-learn', tipo: 'modulo', temas: ['dados'], nivel: 'iniciante', duracaoMinutos: 30 }),
    item({ id: 'b', plataforma: 'ms-learn', tipo: 'trilha', temas: ['seguranca'], nivel: 'avancado', duracaoMinutos: 600 }),
    item({ id: 'c', plataforma: 'ms-learn', tipo: 'certificacao', temas: ['dados', 'seguranca'], nivel: null, duracaoMinutos: null }),
  ];

  it('nao filtra nada quando os criterios estao vazios', () => {
    expect(filtrar(itens, VAZIO)).toHaveLength(3);
  });

  it('filtra por tipo', () => {
    expect(filtrar(itens, { ...VAZIO, tipos: ['trilha'] }).map((i) => i.id)).toEqual(['b']);
  });

  it('filtra por tema, aceitando itens com mais de um', () => {
    expect(filtrar(itens, { ...VAZIO, temas: ['seguranca'] }).map((i) => i.id)).toEqual(['b', 'c']);
  });

  it('combina criterios com E', () => {
    const r = filtrar(itens, { ...VAZIO, temas: ['dados'], tipos: ['modulo'] });
    expect(r.map((i) => i.id)).toEqual(['a']);
  });

  it('mantem itens sem duracao fora do corte por duracao maxima', () => {
    const r = filtrar(itens, { ...VAZIO, duracaoMaxima: 60 });
    expect(r.map((i) => i.id)).toEqual(['a']);
  });
});

describe('ordenar', () => {
  const itens = [
    item({ id: 'a', titulo: 'Beta', duracaoMinutos: 300, atualizadoEm: '2026-01-01', popularidade: 0.2, escalaPopularidade: 'ms-popularity' }),
    item({ id: 'b', titulo: 'Alfa', duracaoMinutos: 60, atualizadoEm: '2026-08-01', popularidade: 0.9, escalaPopularidade: 'ms-popularity' }),
  ];

  it('ordena por titulo em pt-BR', () => {
    expect(ordenar(itens, 'titulo').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('ordena por duracao crescente', () => {
    expect(ordenar(itens, 'duracao').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('ordena por atualizacao, mais recente primeiro', () => {
    expect(ordenar(itens, 'atualizacao').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('ordena por popularidade, maior primeiro', () => {
    expect(ordenar(itens, 'popularidade').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('joga itens sem valor para o fim, nunca para o topo', () => {
    const comNulo = [...itens, item({ id: 'c', duracaoMinutos: null })];
    expect(ordenar(comNulo, 'duracao').map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('nao muta o array recebido', () => {
    const original = [...itens];
    ordenar(itens, 'titulo');
    expect(itens).toEqual(original);
  });
});

describe('ordenacaoPermitida', () => {
  const ms = item({ id: 'a', nota: 4.8, escalaNota: 'ms-rating' });
  const alura = item({ id: 'b', plataforma: 'alura', nota: 9.4, escalaNota: 'alura-nps' });

  it('permite ordenar por nota dentro de uma unica plataforma', () => {
    expect(ordenacaoPermitida([ms], 'nota')).toBe(true);
    expect(ordenacaoPermitida([alura], 'nota')).toBe(true);
  });

  it('proibe ordenar por nota misturando plataformas: as escalas nao sao comparaveis', () => {
    expect(ordenacaoPermitida([ms, alura], 'nota')).toBe(false);
  });

  it('permite as demais ordenacoes mesmo misturando plataformas', () => {
    expect(ordenacaoPermitida([ms, alura], 'titulo')).toBe(true);
    expect(ordenacaoPermitida([ms, alura], 'duracao')).toBe(true);
  });
});

describe('aplicar', () => {
  it('busca, filtra e ordena numa passada so', () => {
    const itens = [
      item({ id: 'a', titulo: 'Docker avançado', tipo: 'modulo', duracaoMinutos: 90 }),
      item({ id: 'b', titulo: 'Docker básico', tipo: 'modulo', duracaoMinutos: 30 }),
      item({ id: 'c', titulo: 'Outro assunto', tipo: 'modulo', duracaoMinutos: 10 }),
    ];
    const r = aplicar(itens, { ...VAZIO, texto: 'docker', ordem: 'duracao' });
    expect(r.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('cai para ordenacao por titulo quando a ordem pedida e proibida', () => {
    const itens = [
      item({ id: 'a', titulo: 'Zeta', nota: 4.8, escalaNota: 'ms-rating' }),
      item({ id: 'b', titulo: 'Alfa', plataforma: 'alura', nota: 9.4, escalaNota: 'alura-nps' }),
    ];
    expect(aplicar(itens, { ...VAZIO, ordem: 'nota' }).map((i) => i.id)).toEqual(['b', 'a']);
  });
});
