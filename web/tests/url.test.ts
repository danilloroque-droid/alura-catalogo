import { describe, it, expect } from 'vitest';
import { CRITERIOS_VAZIOS, deHash, paraHash } from '../src/filtros/url.js';
import type { Criterios } from '../src/filtros/filtros.js';

describe('paraHash', () => {
  it('omite tudo que esta no padrao', () => {
    expect(paraHash(CRITERIOS_VAZIOS)).toBe('#/');
  });

  it('serializa listas separadas por virgula', () => {
    const hash = paraHash({ ...CRITERIOS_VAZIOS, temas: ['dados', 'seguranca'], tipos: ['trilha'] });
    expect(hash).toContain('tema=dados%2Cseguranca');
    expect(hash).toContain('tipo=trilha');
  });

  it('serializa texto, duracao e ordem', () => {
    const hash = paraHash({
      ...CRITERIOS_VAZIOS, texto: 'power bi', duracaoMaxima: 120, ordem: 'duracao',
    });
    expect(hash).toContain('q=power+bi');
    expect(hash).toContain('ate=120');
    expect(hash).toContain('ordem=duracao');
  });
});

describe('deHash', () => {
  it('devolve os criterios vazios para hash ausente ou raiz', () => {
    expect(deHash('')).toEqual(CRITERIOS_VAZIOS);
    expect(deHash('#/')).toEqual(CRITERIOS_VAZIOS);
  });

  it('reconstroi listas e numeros', () => {
    const c = deHash('#/?tema=dados,seguranca&ate=90&ordem=popularidade');
    expect(c.temas).toEqual(['dados', 'seguranca']);
    expect(c.duracaoMaxima).toBe(90);
    expect(c.ordem).toBe('popularidade');
  });

  it('ignora ordem desconhecida em vez de quebrar', () => {
    expect(deHash('#/?ordem=inventada').ordem).toBe('titulo');
  });

  it('ignora duracao nao numerica', () => {
    expect(deHash('#/?ate=abc').duracaoMaxima).toBeNull();
  });

  it('faz ida e volta sem perder informacao', () => {
    // Anotado como Criterios em vez de `as const`: `as const` produziria
    // arrays readonly, que nao sao atribuiveis aos campos mutaveis do tipo.
    const original: Criterios = {
      texto: 'azure devops', plataformas: ['ms-learn'], tipos: ['modulo'],
      temas: ['devops'], niveis: ['iniciante'], duracaoMaxima: 45,
      ordem: 'atualizacao',
    };
    expect(deHash(paraHash(original))).toEqual(original);
  });
});
