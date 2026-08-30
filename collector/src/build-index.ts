import { TEMAS } from '@compartilhado/temas';
import type { Indice, ItemCatalogo, ResultadoFonte } from '@compartilhado/types';

// Ordem fixa das chaves: e o que torna o diff no git legivel entre coletas.
const CHAVES: (keyof ItemCatalogo)[] = [
  'id', 'plataforma', 'tipo', 'titulo', 'resumo', 'url', 'duracaoMinutos',
  'nivel', 'temas', 'temasOriginais', 'instrutores', 'idioma', 'criadoEm',
  'atualizadoEm', 'nota', 'escalaNota', 'popularidade', 'escalaPopularidade',
  'ehCheckpoint',
];

// Cada numero e a escala que lhe da sentido.
const PARES = [
  ['nota', 'escalaNota'],
  ['popularidade', 'escalaPopularidade'],
] as const;

/**
 * Um numero so significa algo junto da sua escala: 4,8 e otimo numa media de 0
 * a 5 e pessimo num NPS de 0 a 10. O tipo declara valor e escala como campos
 * independentes, entao "os dois ou nenhum" vale apenas por convencao. Aqui a
 * convencao falha alto e cedo: o proximo normalizador que esquecer a escala
 * derruba a coleta em vez de publicar um ranking sem sentido em silencio.
 */
function conferirEscalas(item: ItemCatalogo): ItemCatalogo {
  for (const [valor, escala] of PARES) {
    if ((item[valor] === null) !== (item[escala] === null)) {
      throw new Error(
        `${item.id}: ${valor} e ${escala} precisam vir juntos ou nenhum dos dois ` +
          `(${valor}=${item[valor]}, ${escala}=${item[escala]})`,
      );
    }
  }
  return item;
}

function ordenarChaves(item: ItemCatalogo): ItemCatalogo {
  const saida: Record<string, unknown> = {};
  for (const chave of CHAVES) saida[chave] = item[chave];
  return saida as unknown as ItemCatalogo;
}

export function construirIndice(fontes: ResultadoFonte[], geradoEm: string): Indice {
  const itens = fontes
    .flatMap((f) => f.itens)
    .map(conferirEscalas)
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
