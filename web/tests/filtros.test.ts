import { describe, it, expect } from 'vitest';
import {
  aplicar, buscar, comparadorDe, filtrar, normalizarTexto, ordenar, ordenacaoPermitida,
  permissoesDe,
  type Ordem,
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

  it('ordena consistentemente quando ha multiplos itens nulos', () => {
    const variosNulos = [
      item({ id: 'a', duracaoMinutos: 90 }),
      item({ id: 'b', duracaoMinutos: null }),
      item({ id: 'c', duracaoMinutos: 30 }),
      item({ id: 'd', duracaoMinutos: null }),
    ];
    // Todos os nulos devem ir para o fim, e a ordem entre eles nao importa.
    const resultado = ordenar(variosNulos, 'duracao').map((i) => i.id);
    expect(resultado.slice(0, 2)).toEqual(['c', 'a']);
    expect(resultado.slice(2)).toContain('b');
    expect(resultado.slice(2)).toContain('d');
  });

  it('nao muta o array recebido', () => {
    const original = [...itens];
    ordenar(itens, 'titulo');
    expect(itens).toEqual(original);
  });
});

describe('comparadorDe', () => {
  const ORDENS: Ordem[] = ['titulo', 'duracao', 'atualizacao', 'popularidade', 'nota'];

  // Array.prototype.sort so garante um resultado estavel se o comparador for
  // consistente: compare(x, x) tem de ser 0. Como valor ausente vira sentinela
  // infinita, a subtracao direta devolve Infinity - Infinity = NaN para dois
  // itens sem valor, e a ordem final passa a depender do motor, nao do codigo.
  it('devolve 0 ao comparar um item consigo mesmo, em qualquer ordem', () => {
    const cheio = item({
      id: 'a', duracaoMinutos: 90, nota: 4.8, escalaNota: 'ms-rating',
      popularidade: 0.7, escalaPopularidade: 'ms-popularity',
    });
    for (const ordem of ORDENS) {
      expect(comparadorDe(ordem)(cheio, cheio)).toBe(0);
    }
  });

  it('devolve 0 ao comparar dois itens sem valor, nunca NaN', () => {
    const semValor = { titulo: 'x', duracaoMinutos: null, atualizadoEm: null, nota: null, popularidade: null };
    const a = item({ id: 'a', ...semValor });
    const b = item({ id: 'b', ...semValor });
    for (const ordem of ORDENS) {
      expect(comparadorDe(ordem)(a, b)).toBe(0);
    }
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

  // Popularidade sofre do mesmo problema que nota: o Microsoft Learn devolve um
  // indice de 0 a 1 e a Alura conta alunos matriculados. Ordenar as duas juntas
  // coloca uma plataforma inteira acima da outra por unidade, nao por merito.
  const msPop = item({ id: 'c', popularidade: 0.9, escalaPopularidade: 'ms-popularity' });
  const aluraPop = item({ id: 'd', plataforma: 'alura', popularidade: 12000, escalaPopularidade: 'alura-alunos' });

  it('permite ordenar por popularidade dentro de uma unica escala', () => {
    expect(ordenacaoPermitida([msPop], 'popularidade')).toBe(true);
    expect(ordenacaoPermitida([aluraPop], 'popularidade')).toBe(true);
  });

  it('proibe ordenar por popularidade misturando escalas incompativeis', () => {
    expect(ordenacaoPermitida([msPop, aluraPop], 'popularidade')).toBe(false);
  });

  it('ignora itens sem valor ao decidir se as escalas se misturam', () => {
    const semPopularidade = item({ id: 'e', plataforma: 'alura', popularidade: null, escalaPopularidade: null });
    expect(ordenacaoPermitida([msPop, semPopularidade], 'popularidade')).toBe(true);
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

describe('permissoesDe', () => {
  // A interface precisa das duas respostas de uma vez para desabilitar cada
  // opcao do seletor; perguntar ordem a ordem espalharia a regra pela UI.
  it('responde as duas ordens restritas numa passada', () => {
    const itens = [
      item({ id: 'a', nota: 4.8, escalaNota: 'ms-rating', popularidade: 0.9, escalaPopularidade: 'ms-popularity' }),
      item({ id: 'b', plataforma: 'alura', nota: 4.7, escalaNota: 'ms-rating', popularidade: 12000, escalaPopularidade: 'alura-alunos' }),
    ];
    expect(permissoesDe(itens)).toEqual({ nota: true, popularidade: false });
  });

  it('libera as duas quando nada se mistura', () => {
    const itens = [item({ id: 'a', nota: 4.8, escalaNota: 'ms-rating' })];
    expect(permissoesDe(itens)).toEqual({ nota: true, popularidade: true });
  });
});
