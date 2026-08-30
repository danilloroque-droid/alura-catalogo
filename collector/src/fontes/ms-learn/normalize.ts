import { mapearTemas } from '@compartilhado/temas';
import type {
  ItemCatalogo,
  ItemDescartado,
  Nivel,
  ResultadoFonte,
  TipoItem,
} from '@compartilhado/types';
import type {
  CatalogoBruto,
  CertificacaoBruta,
  CursoBruto,
  ModuloBruto,
  TrilhaBruta,
} from './client.js';

const NIVEIS: Record<string, Nivel> = {
  beginner: 'iniciante',
  intermediate: 'intermediario',
  advanced: 'avancado',
};

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&nbsp;': ' ',
};

/**
 * Decodifica uma entidade HTML. A tabela nomeada cobre so o que a API de fato
 * devolve; entidade numerica e mecanicamente decodificavel e dispensa tabela.
 * O que sobra volta intacto de proposito: trocar entidade desconhecida por
 * espaco apagava caracteres em silencio ("caf&eacute;" virava "caf"), sem
 * deixar rastro de que havia algo ali.
 */
function decodificarEntidade(entidade: string): string {
  const nomeada = ENTIDADES[entidade.toLowerCase()];
  if (nomeada !== undefined) return nomeada;

  const [, hex, digitos] = /^&#(x?)([0-9a-f]+);$/i.exec(entidade) ?? [];
  if (digitos !== undefined) {
    const ponto = parseInt(digitos, hex ? 16 : 10);
    // String.fromCodePoint lanca RangeError acima de 0x10FFFF. Um resumo
    // malformado nao pode derrubar uma coleta de milhares de itens.
    if (ponto <= 0x10ffff) return String.fromCodePoint(ponto);
  }

  return entidade;
}

export function removerHtml(texto: string): string {
  return texto
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, decodificarEntidade)
    .replace(/\s+/g, ' ')
    .trim();
}

export function paraData(iso: string | undefined): string | null {
  if (!iso) return null;
  const data = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
}

function semDuplicatas(valores: (string[] | undefined)[]): string[] {
  const vistos: string[] = [];
  for (const lista of valores) {
    for (const v of lista ?? []) if (!vistos.includes(v)) vistos.push(v);
  }
  return vistos;
}

interface Cru {
  uid?: string;
  title?: string;
  url?: string;
  levels?: string[];
  roles?: string[];
  products?: string[];
  subjects?: string[];
  last_modified?: string;
}

function base(cru: Cru, tipo: TipoItem, resumo: string | null) {
  const { temas, naoMapeados } = mapearTemas({
    subjects: cru.subjects ?? [],
    roles: cru.roles ?? [],
    products: cru.products ?? [],
  });

  const item: ItemCatalogo = {
    id: `ms-learn:${cru.uid}`,
    plataforma: 'ms-learn',
    tipo,
    titulo: cru.title ?? '',
    resumo,
    url: cru.url ?? '',
    duracaoMinutos: null,
    nivel: NIVEIS[cru.levels?.[0] ?? ''] ?? null,
    temas,
    temasOriginais: semDuplicatas([cru.subjects, cru.roles, cru.products]),
    instrutores: [],
    idioma: 'pt-BR',
    criadoEm: null,
    atualizadoEm: paraData(cru.last_modified),
    nota: null,
    escalaNota: null,
    popularidade: null,
    escalaPopularidade: null,
    ehCheckpoint: false,
  };

  return { item, naoMapeados };
}

export function normalizarMsLearn(bruto: CatalogoBruto): ResultadoFonte {
  const itens: ItemCatalogo[] = [];
  const descartados: ItemDescartado[] = [];
  const naoMapeados: string[] = [];

  const registrar = (resultado: { item: ItemCatalogo; naoMapeados: string[] }) => {
    itens.push(resultado.item);
    for (const r of resultado.naoMapeados) {
      if (!naoMapeados.includes(r)) naoMapeados.push(r);
    }
  };

  const validar = (cru: Cru, rotulo: string, indice: number): boolean => {
    if (!cru.uid) {
      descartados.push({ id: `${rotulo}[${indice}]`, motivo: 'sem uid' });
      return false;
    }
    return true;
  };

  (bruto.modules ?? []).forEach((m: ModuloBruto, i) => {
    if (!validar(m, 'modulo', i)) return;
    const r = base(m, 'modulo', m.summary ? removerHtml(m.summary) : null);
    r.item.duracaoMinutos = m.duration_in_minutes ?? null;
    if (typeof m.popularity === 'number') {
      r.item.popularidade = m.popularity;
      r.item.escalaPopularidade = 'ms-popularity';
    }
    registrar(r);
  });

  (bruto.learningPaths ?? []).forEach((t: TrilhaBruta, i) => {
    if (!validar(t, 'trilha', i)) return;
    const r = base(t, 'trilha', t.summary ? removerHtml(t.summary) : null);
    r.item.duracaoMinutos = t.duration_in_minutes ?? null;
    if (typeof t.popularity === 'number') {
      r.item.popularidade = t.popularity;
      r.item.escalaPopularidade = 'ms-popularity';
    }
    // Apenas 1 das 849 trilhas tem count > 0: nota aqui e excecao, nao regra.
    if (t.rating && t.rating.count > 0 && typeof t.rating.average === 'number') {
      r.item.nota = t.rating.average;
      r.item.escalaNota = 'ms-rating';
    }
    registrar(r);
  });

  (bruto.courses ?? []).forEach((c: CursoBruto, i) => {
    if (!validar(c, 'curso', i)) return;
    const r = base(c, 'curso', c.summary ? removerHtml(c.summary) : null);
    r.item.duracaoMinutos =
      typeof c.duration_in_hours === 'number' ? c.duration_in_hours * 60 : null;
    registrar(r);
  });

  (bruto.certifications ?? []).forEach((c: CertificacaoBruta, i) => {
    if (!validar(c, 'certificacao', i)) return;
    registrar(base(c, 'certificacao', c.subtitle ? removerHtml(c.subtitle) : null));
  });

  return { plataforma: 'ms-learn', itens, descartados, rotulosNaoMapeados: naoMapeados };
}
