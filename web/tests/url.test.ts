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

  it('descarta plataformas invalidas', () => {
    const c = deHash('#/?plat=invalido');
    expect(c.plataformas).toEqual([]);
  });

  it('descarta tipos invalidos', () => {
    const c = deHash('#/?tipo=inventado');
    expect(c.tipos).toEqual([]);
  });

  it('descarta niveis invalidos', () => {
    const c = deHash('#/?nivel=desconhecido');
    expect(c.niveis).toEqual([]);
  });

  it('mantém apenas valores validos em listas mistas', () => {
    const c = deHash('#/?tipo=modulo,inventado,trilha&plat=ms-learn,invalido');
    expect(c.tipos).toEqual(['modulo', 'trilha']);
    expect(c.plataformas).toEqual(['ms-learn']);
  });

  it('retorna arrays novos em cada chamada para evitar compartilhamento', () => {
    const c1 = deHash('');
    const c2 = deHash('');
    expect(c1.plataformas).not.toBe(c2.plataformas);
    expect(c1.tipos).not.toBe(c2.tipos);
    expect(c1.temas).not.toBe(c2.temas);
    expect(c1.niveis).not.toBe(c2.niveis);
  });
});
