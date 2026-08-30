import { describe, it, expect } from 'vitest';
import { construirIndice, serializar } from '../src/build-index.js';
import type { ItemCatalogo, ResultadoFonte } from '@compartilhado/types';

function item(id: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo {
  return {
    id, plataforma: 'ms-learn', tipo: 'modulo', titulo: id, resumo: null,
    url: `https://exemplo/${id}`, duracaoMinutos: 10, nivel: 'iniciante',
    temas: ['dados'], temasOriginais: ['databases'], instrutores: [],
    idioma: 'pt-BR', criadoEm: null, atualizadoEm: '2026-01-01',
    nota: null, escalaNota: null, popularidade: null, escalaPopularidade: null,
    ehCheckpoint: false, ...extra,
  };
}

const fonte = (itens: ItemCatalogo[]): ResultadoFonte => ({
  plataforma: 'ms-learn', itens, descartados: [], rotulosNaoMapeados: [],
});

describe('construirIndice', () => {
  it('ordena os itens por id, qualquer que seja a ordem de entrada', () => {
    const indice = construirIndice([fonte([item('c'), item('a'), item('b')])], '2026-08-29T00:00:00Z');
    expect(indice.itens.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('resume cada fonte com o total coletado', () => {
    const indice = construirIndice([fonte([item('a'), item('b')])], '2026-08-29T00:00:00Z');
    expect(indice.fontes).toEqual([
      { plataforma: 'ms-learn', total: 2, coletadoEm: '2026-08-29' },
    ]);
  });

  it('inclui apenas os temas de fato usados, na ordem canonica', () => {
    const indice = construirIndice(
      [fonte([item('a', { temas: ['seguranca'] }), item('b', { temas: ['back-end'] })])],
      '2026-08-29T00:00:00Z',
    );
    expect(indice.temas.map((t) => t.id)).toEqual(['back-end', 'seguranca']);
    expect(indice.temas[0]?.nome).toBe('Back-end');
  });

  it('produz bytes identicos para a mesma entrada em ordens diferentes', () => {
    const a = serializar(construirIndice([fonte([item('x'), item('y')])], '2026-08-29T00:00:00Z'));
    const b = serializar(construirIndice([fonte([item('y'), item('x')])], '2026-08-29T00:00:00Z'));
    expect(a).toBe(b);
  });

  it('serializa as chaves de cada item sempre na mesma ordem', () => {
    // Criar um item com chaves fora de ordem para forçar ordenarChaves a trabalhar
    const itemComChavesDesordenadas = Object.fromEntries(
      Object.entries(item('a')).reverse(),
    ) as unknown as ItemCatalogo;

    const texto = serializar(construirIndice([fonte([itemComChavesDesordenadas])], '2026-08-29T00:00:00Z'));
    const primeiro = JSON.parse(texto).itens[0];
    expect(Object.keys(primeiro)[0]).toBe('id');
    expect(Object.keys(primeiro)[1]).toBe('plataforma');
    expect(Object.keys(primeiro)).toHaveLength(19);
  });
});

describe('invariante valor/escala', () => {
  const QUANDO = '2026-08-29T00:00:00Z';
  const constroi = (extra: Partial<ItemCatalogo>) =>
    () => construirIndice([fonte([item('a', extra)])], QUANDO);

  // O tipo declara valor e escala como campos independentes, entao "os dois ou
  // nenhum" so vale por convencao. Sem guarda, um normalizador que esquecesse a
  // escala publicaria um ranking sem sentido em silencio.
  it('recusa nota sem escala', () => {
    expect(constroi({ nota: 4.5, escalaNota: null })).toThrow(/a: nota e escalaNota/);
  });

  it('recusa escala de nota sem nota', () => {
    expect(constroi({ nota: null, escalaNota: 'ms-rating' })).toThrow(/a: nota e escalaNota/);
  });

  it('recusa popularidade sem escala', () => {
    expect(constroi({ popularidade: 0.7, escalaPopularidade: null })).toThrow(/a: popularidade e escalaPopularidade/);
  });

  it('recusa escala de popularidade sem popularidade', () => {
    expect(constroi({ popularidade: null, escalaPopularidade: 'ms-popularity' })).toThrow(/a: popularidade e escalaPopularidade/);
  });

  it('aceita o par completo e o par inteiramente ausente', () => {
    expect(() => construirIndice([fonte([
      item('a', { nota: 4.5, escalaNota: 'ms-rating', popularidade: 0.7, escalaPopularidade: 'ms-popularity' }),
      item('b'),
    ])], QUANDO)).not.toThrow();
  });
});
