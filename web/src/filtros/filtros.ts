import type { ItemCatalogo, Nivel, Plataforma, TipoItem } from '@compartilhado/types';

export type Ordem = 'titulo' | 'duracao' | 'atualizacao' | 'popularidade' | 'nota';

/** Ordens cujo significado depende da escala, logo restritas a uma plataforma. */
export type OrdemRestrita = 'popularidade' | 'nota';

export type Permissoes = Record<OrdemRestrita, boolean>;

const ORDENS_RESTRITAS: OrdemRestrita[] = ['popularidade', 'nota'];

export function ehOrdemRestrita(ordem: Ordem): ordem is OrdemRestrita {
  return (ORDENS_RESTRITAS as Ordem[]).includes(ordem);
}

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

// Normalizar titulo + resumo custa NFD, regex e lowercase. Sem memoizacao isso
// se repete sobre o catalogo inteiro a cada tecla digitada, e o custo aparece
// como travamento na busca. O WeakMap guarda o alvo ja normalizado por item e
// nao impede a coleta de lixo: quando o indice sai de cena, os alvos vao junto.
const alvos = new WeakMap<ItemCatalogo, string>();

function alvoDe(item: ItemCatalogo): string {
  let alvo = alvos.get(item);
  if (alvo === undefined) {
    alvo = normalizarTexto(`${item.titulo} ${item.resumo ?? ''}`);
    alvos.set(item, alvo);
  }
  return alvo;
}

export function buscar(itens: ItemCatalogo[], texto: string): ItemCatalogo[] {
  const termos = normalizarTexto(texto).split(' ').filter(Boolean);
  if (termos.length === 0) return itens;

  return itens.filter((item) => {
    const alvo = alvoDe(item);
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

function escalaUnica(
  itens: ItemCatalogo[],
  valor: 'nota' | 'popularidade',
  escala: 'escalaNota' | 'escalaPopularidade',
): boolean {
  const escalas = new Set(itens.filter((i) => i[valor] !== null).map((i) => i[escala]));
  return escalas.size <= 1;
}

/**
 * Nota e popularidade sao numeros que so significam algo dentro da sua escala:
 * NPS de 0 a 10 na Alura contra media de 0 a 5 no Microsoft Learn; contagem de
 * alunos na Alura contra um `popularity` de 0 a 1 no Microsoft Learn. Ordenar
 * escalas diferentes juntas produz um ranking sem significado — colocaria toda
 * a Alura acima de todo o Microsoft Learn, ou o contrario —, entao a operacao
 * e recusada (spec 5.1 e 9.4). As demais ordens nao dependem de escala.
 */
export function ordenacaoPermitida(itens: ItemCatalogo[], ordem: Ordem): boolean {
  if (ordem === 'nota') return escalaUnica(itens, 'nota', 'escalaNota');
  if (ordem === 'popularidade') return escalaUnica(itens, 'popularidade', 'escalaPopularidade');
  return true;
}

/**
 * Responde de uma vez por todas as ordens restritas. A interface precisa das
 * duas respostas juntas para desabilitar cada opcao do seletor; perguntar ordem
 * a ordem espalharia a regra de escala pelos componentes.
 */
export function permissoesDe(itens: ItemCatalogo[]): Permissoes {
  return {
    nota: ordenacaoPermitida(itens, 'nota'),
    popularidade: ordenacaoPermitida(itens, 'popularidade'),
  };
}

function porNumero(valor: number | null): number {
  return valor === null ? Number.NEGATIVE_INFINITY : valor;
}

function porDuracao(valor: number | null): number {
  return valor === null ? Number.POSITIVE_INFINITY : valor;
}

// Subtracao pura quebra quando os dois lados caem na sentinela infinita:
// Infinity - Infinity e NaN, e um comparador que devolve NaN viola o contrato
// de Array.sort. A igualdade explicita garante compare(x, x) === 0 sempre.
function comparar(x: number, y: number): number {
  return x === y ? 0 : x - y;
}

export type Comparador = (a: ItemCatalogo, b: ItemCatalogo) => number;

const COMPARADORES: Record<Ordem, Comparador> = {
  titulo: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'),
  // Crescente, mas sem duracao vai para o fim: um item sem informacao nao e
  // "o mais curto".
  duracao: (a, b) => comparar(porDuracao(a.duracaoMinutos), porDuracao(b.duracaoMinutos)),
  atualizacao: (a, b) => (b.atualizadoEm ?? '').localeCompare(a.atualizadoEm ?? ''),
  popularidade: (a, b) => comparar(porNumero(b.popularidade), porNumero(a.popularidade)),
  nota: (a, b) => comparar(porNumero(b.nota), porNumero(a.nota)),
};

/** Exposto para que o teste verifique diretamente que compare(x, x) === 0. */
export function comparadorDe(ordem: Ordem): Comparador {
  return COMPARADORES[ordem];
}

export function ordenar(itens: ItemCatalogo[], ordem: Ordem): ItemCatalogo[] {
  return [...itens].sort(comparadorDe(ordem));
}

/**
 * Busca e filtra, sem ordenar. E o conjunto do qual tudo o mais depende: a
 * ordenacao, e tambem as permissoes, que olham as escalas presentes no
 * resultado e nao no catalogo inteiro. Existe para ter um nome so para esse
 * meio do caminho: antes a pagina repetia a expressao que vive dentro de
 * aplicar, e as duas precisavam mudar juntas se a definicao de "encontrado"
 * mudasse. O ganho e de acoplamento, nao de tempo — medido, o passe repetido
 * custava de 1 a 3 ms sobre os 4667 itens.
 */
export function encontrar(itens: ItemCatalogo[], criterios: Criterios): ItemCatalogo[] {
  return filtrar(buscar(itens, criterios.texto), criterios);
}

/** A ordem que de fato vale: a pedida, ou titulo quando ela e proibida. */
export function ordemEfetiva(encontrados: ItemCatalogo[], ordem: Ordem): Ordem {
  return ordenacaoPermitida(encontrados, ordem) ? ordem : 'titulo';
}

export function aplicar(itens: ItemCatalogo[], criterios: Criterios): ItemCatalogo[] {
  const encontrados = encontrar(itens, criterios);
  return ordenar(encontrados, ordemEfetiva(encontrados, criterios.ordem));
}
