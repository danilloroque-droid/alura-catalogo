export const URL_CATALOGO = 'https://learn.microsoft.com/api/catalog/';

const TIPOS = ['modules', 'learningPaths', 'courses', 'certifications'].join(',');
const TIMEOUT_MS = 60_000; // o payload passa de 7 MB
const AGENTE = 'catalogo-treinamentos-pessoal/1.0 (uso pessoal, 1 requisicao por semana)';

export interface ModuloBruto {
  uid: string;
  title: string;
  summary?: string;
  url: string;
  duration_in_minutes?: number;
  levels?: string[];
  roles?: string[];
  products?: string[];
  subjects?: string[];
  popularity?: number;
  last_modified?: string;
}

export interface TrilhaBruta extends ModuloBruto {
  rating?: { count: number; average?: number };
}

export interface CursoBruto {
  uid: string;
  title: string;
  summary?: string;
  url: string;
  duration_in_hours?: number;
  levels?: string[];
  roles?: string[];
  products?: string[];
  last_modified?: string;
}

export interface CertificacaoBruta {
  uid: string;
  title: string;
  subtitle?: string;
  url: string;
  levels?: string[];
  roles?: string[];
  last_modified?: string;
}

export interface CatalogoBruto {
  modules?: ModuloBruto[];
  learningPaths?: TrilhaBruta[];
  courses?: CursoBruto[];
  certifications?: CertificacaoBruta[];
}

export interface OpcoesBusca {
  locale?: string;
  fetch?: typeof globalThis.fetch;
  tentativas?: number;
  esperarMs?: (ms: number) => Promise<void>;
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function buscarCatalogo(opcoes: OpcoesBusca = {}): Promise<CatalogoBruto> {
  const {
    locale = 'pt-br',
    fetch: buscar = globalThis.fetch,
    tentativas = 3,
    esperarMs = dormir,
  } = opcoes;

  const url = `${URL_CATALOGO}?locale=${locale}&type=${TIPOS}`;
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    if (tentativa > 0) await esperarMs(1000 * 2 ** (tentativa - 1));

    try {
      const resposta = await buscar(url, {
        headers: { 'user-agent': AGENTE, accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) {
        throw new Error(`Microsoft Learn respondeu ${resposta.status}`);
      }
      return (await resposta.json()) as CatalogoBruto;
    } catch (erro) {
      ultimoErro = erro;
    }
  }

  throw ultimoErro;
}
