import type { Nivel, Plataforma, TipoItem } from '@compartilhado/types';
import type { Criterios, Ordem } from './filtros.js';

export const CRITERIOS_VAZIOS: Criterios = {
  texto: '', plataformas: [], tipos: [], temas: [], niveis: [],
  duracaoMaxima: null, ordem: 'titulo',
};

const ORDENS: Ordem[] = ['titulo', 'duracao', 'atualizacao', 'popularidade', 'nota'];

export function paraHash(c: Criterios): string {
  const params = new URLSearchParams();
  if (c.texto.trim()) params.set('q', c.texto.trim());
  if (c.plataformas.length) params.set('plat', c.plataformas.join(','));
  if (c.tipos.length) params.set('tipo', c.tipos.join(','));
  if (c.temas.length) params.set('tema', c.temas.join(','));
  if (c.niveis.length) params.set('nivel', c.niveis.join(','));
  if (c.duracaoMaxima !== null) params.set('ate', String(c.duracaoMaxima));
  if (c.ordem !== 'titulo') params.set('ordem', c.ordem);

  const consulta = params.toString();
  return consulta ? `#/?${consulta}` : '#/';
}

function lista(params: URLSearchParams, chave: string): string[] {
  const bruto = params.get(chave);
  return bruto ? bruto.split(',').filter(Boolean) : [];
}

export function deHash(hash: string): Criterios {
  const inicio = hash.indexOf('?');
  if (inicio === -1) return { ...CRITERIOS_VAZIOS };

  const params = new URLSearchParams(hash.slice(inicio + 1));
  const ate = Number(params.get('ate'));
  const ordem = params.get('ordem') as Ordem | null;

  return {
    texto: params.get('q') ?? '',
    plataformas: lista(params, 'plat') as Plataforma[],
    tipos: lista(params, 'tipo') as TipoItem[],
    temas: lista(params, 'tema'),
    niveis: lista(params, 'nivel') as Nivel[],
    duracaoMaxima: Number.isFinite(ate) && params.get('ate') ? ate : null,
    ordem: ordem && ORDENS.includes(ordem) ? ordem : 'titulo',
  };
}
