import { describe, it, expect } from 'vitest';
import { mapearTemas, TEMAS } from '@compartilhado/temas';

describe('mapearTemas', () => {
  it('usa subjects quando eles mapeiam', () => {
    const r = mapearTemas({
      subjects: ['backend-development', 'databases'],
      roles: ['developer'],
      products: ['azure'],
    });
    expect(r.temas).toEqual(['back-end', 'dados']);
    expect(r.naoMapeados).toEqual([]);
  });

  it('cai para roles quando nao ha subjects, como em cursos e certificacoes', () => {
    const r = mapearTemas({
      subjects: [],
      roles: ['security-engineer'],
      products: ['azure'],
    });
    expect(r.temas).toEqual(['seguranca']);
  });

  it('nao consulta roles quando subjects ja produziu tema', () => {
    const r = mapearTemas({
      subjects: ['machine-learning'],
      roles: ['developer'],
      products: [],
    });
    expect(r.temas).toEqual(['inteligencia-artificial']);
  });

  it('reporta rotulos consultados que nao mapeiam', () => {
    const r = mapearTemas({
      subjects: ['backend-development', 'assunto-inexistente'],
      roles: [],
      products: [],
    });
    expect(r.temas).toEqual(['back-end']);
    expect(r.naoMapeados).toEqual(['assunto-inexistente']);
  });

  it('devolve outros e reporta tudo quando nada mapeia', () => {
    const r = mapearTemas({ subjects: ['xpto'], roles: ['ypto'], products: ['zpto'] });
    expect(r.temas).toEqual(['outros']);
    expect(r.naoMapeados).toEqual(['xpto', 'ypto', 'zpto']);
  });

  it('remove duplicatas e mantem ordem estavel', () => {
    const r = mapearTemas({
      subjects: ['databases', 'data-analytics', 'databases'],
      roles: [],
      products: [],
    });
    expect(r.temas).toEqual(['dados']);
  });

  it('expoe exatamente doze temas, com outros no fim', () => {
    expect(TEMAS).toHaveLength(12);
    expect(TEMAS[TEMAS.length - 1]?.id).toBe('outros');
  });
});
