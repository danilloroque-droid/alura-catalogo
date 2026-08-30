import { TEMAS } from '@compartilhado/temas';
import type { Indice, ItemCatalogo, ResultadoFonte } from '@compartilhado/types';

// Ordem fixa das chaves: e o que torna o diff no git legivel entre coletas.
const CHAVES: (keyof ItemCatalogo)[] = [
  'id', 'plataforma', 'tipo', 'titulo', 'resumo', 'url', 'duracaoMinutos',
  'nivel', 'temas', 'temasOriginais', 'instrutores', 'idioma', 'criadoEm',
  'atualizadoEm', 'nota', 'escalaNota', 'popularidade', 'escalaPopularidade',
  'ehCheckpoint',
];

function ordenarChaves(item: ItemCatalogo): ItemCatalogo {
  const saida: Record<string, unknown> = {};
  for (const chave of CHAVES) saida[chave] = item[chave];
  return saida as unknown as ItemCatalogo;
}

export function construirIndice(fontes: ResultadoFonte[], geradoEm: string): Indice {
  const itens = fontes
    .flatMap((f) => f.itens)
    .map(ordenarChaves)
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));

  const usados = new Set(itens.flatMap((i) => i.temas));

  return {
    geradoEm,
    fontes: fontes.map((f) => ({
      plataforma: f.plataforma,
      total: f.itens.length,
      coletadoEm: geradoEm.slice(0, 10),
    })),
    temas: TEMAS.filter((t) => usados.has(t.id)),
    itens,
  };
}

export function serializar(indice: Indice): string {
  return JSON.stringify(indice);
}
