export type Plataforma = 'ms-learn' | 'alura';
export type TipoItem = 'curso' | 'modulo' | 'trilha' | 'certificacao';
export type Nivel = 'iniciante' | 'intermediario' | 'avancado';

// A escala acompanha o valor: notas de plataformas diferentes NAO sao comparaveis.
export type EscalaNota = 'alura-nps' | 'ms-rating';
export type EscalaPopularidade = 'alura-alunos' | 'ms-popularity';

export interface ItemCatalogo {
  id: string;
  plataforma: Plataforma;
  tipo: TipoItem;
  titulo: string;
  resumo: string | null;
  url: string;
  duracaoMinutos: number | null;
  nivel: Nivel | null;
  temas: string[];
  temasOriginais: string[];
  instrutores: string[];
  idioma: string;
  criadoEm: string | null;
  atualizadoEm: string | null;
  nota: number | null;
  escalaNota: EscalaNota | null;
  popularidade: number | null;
  escalaPopularidade: EscalaPopularidade | null;
  ehCheckpoint: boolean;
}

export interface Tema {
  id: string;
  nome: string;
}

export interface ResumoFonte {
  plataforma: Plataforma;
  total: number;
  coletadoEm: string;
}

export interface Indice {
  geradoEm: string;
  fontes: ResumoFonte[];
  temas: Tema[];
  itens: ItemCatalogo[];
}

export interface ItemDescartado {
  id: string;
  motivo: string;
}

export interface ResultadoFonte {
  plataforma: Plataforma;
  itens: ItemCatalogo[];
  descartados: ItemDescartado[];
  rotulosNaoMapeados: string[];
}
