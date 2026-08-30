import type { ItemCatalogo, Nivel, Plataforma, TipoItem } from '@compartilhado/types';

export type Ordem = 'titulo' | 'duracao' | 'atualizacao' | 'popularidade' | 'nota';

export interface Criterios {
  texto: string;
  plataformas: Plataforma[];
  tipos: TipoItem[];
  temas: string[];
  niveis: Nivel[];
  duracaoMaxima: number | null;
  ordem: Ordem;
}

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    // \p{Mn} = marcas combinantes que o NFD separa. Escrito como propriedade
    // Unicode para nao deixar acento invisivel no codigo-fonte.
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function buscar(itens: ItemCatalogo[], texto: string): ItemCatalogo[] {
  const termos = normalizarTexto(texto).split(' ').filter(Boolean);
  if (termos.length === 0) return itens;

  return itens.filter((item) => {
    const alvo = normalizarTexto(`${item.titulo} ${item.resumo ?? ''}`);
    return termos.every((termo) => alvo.includes(termo));
  });
}

export function filtrar(itens: ItemCatalogo[], criterios: Criterios): ItemCatalogo[] {
  const { plataformas, tipos, temas, niveis, duracaoMaxima } = criterios;

  return itens.filter((item) => {
    if (plataformas.length && !plataformas.includes(item.plataforma)) return false;
    if (tipos.length && !tipos.includes(item.tipo)) return false;
    if (temas.length && !item.temas.some((t) => temas.includes(t))) return false;
    if (niveis.length && (item.nivel === null || !niveis.includes(item.nivel))) return false;
    // Sem duracao declarada nao ha como afirmar que cabe no corte.
    if (duracaoMaxima !== null && (item.duracaoMinutos === null || item.duracaoMinutos > duracaoMaxima)) {
      return false;
    }
    return true;
  });
}

/**
 * Notas de plataformas diferentes vem de escalas incompativeis: NPS de 0 a 10
 * na Alura, media de 0 a 5 no Microsoft Learn. Ordenar as duas juntas produz
 * um ranking sem significado, entao a operacao e recusada.
 */
export function ordenacaoPermitida(itens: ItemCatalogo[], ordem: Ordem): boolean {
  if (ordem !== 'nota') return true;
  const escalas = new Set(itens.filter((i) => i.nota !== null).map((i) => i.escalaNota));
  return escalas.size <= 1;
}

function porNumero(valor: number | null): number {
  return valor === null ? Number.NEGATIVE_INFINITY : valor;
}

function porDuracao(valor: number | null): number {
  return valor === null ? Number.POSITIVE_INFINITY : valor;
}

export function ordenar(itens: ItemCatalogo[], ordem: Ordem): ItemCatalogo[] {
  const copia = [...itens];

  switch (ordem) {
    case 'titulo':
      return copia.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    case 'duracao':
      // Crescente, mas sem duracao vai para o fim: um item sem informacao nao
      // e "o mais curto". Usa POSITIVE_INFINITY para garantir consistencia:
      // compare(null, null) === 0.
      return copia.sort((a, b) => porDuracao(a.duracaoMinutos) - porDuracao(b.duracaoMinutos));
    case 'atualizacao':
      return copia.sort((a, b) => (b.atualizadoEm ?? '').localeCompare(a.atualizadoEm ?? ''));
    case 'popularidade':
      return copia.sort((a, b) => porNumero(b.popularidade) - porNumero(a.popularidade));
    case 'nota':
      return copia.sort((a, b) => porNumero(b.nota) - porNumero(a.nota));
  }
}

export function aplicar(itens: ItemCatalogo[], criterios: Criterios): ItemCatalogo[] {
  const encontrados = filtrar(buscar(itens, criterios.texto), criterios);
  const ordem = ordenacaoPermitida(encontrados, criterios.ordem) ? criterios.ordem : 'titulo';
  return ordenar(encontrados, ordem);
}
