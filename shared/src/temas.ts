import type { Tema } from './types.js';

export const TEMAS: Tema[] = [
  { id: 'back-end', nome: 'Back-end' },
  { id: 'front-end', nome: 'Front-end' },
  { id: 'mobile', nome: 'Mobile' },
  { id: 'dados', nome: 'Dados' },
  { id: 'inteligencia-artificial', nome: 'Inteligência artificial' },
  { id: 'infraestrutura-nuvem', nome: 'Infraestrutura e nuvem' },
  { id: 'devops', nome: 'DevOps' },
  { id: 'seguranca', nome: 'Segurança' },
  { id: 'design-ux', nome: 'Design e UX' },
  { id: 'gestao-negocios', nome: 'Gestão e negócios' },
  { id: 'produtividade', nome: 'Produtividade' },
  { id: 'outros', nome: 'Outros' },
];

export type TemaId = (typeof TEMAS)[number]['id'];

export interface RotulosBrutos {
  subjects: string[];
  roles: string[];
  products: string[];
}

export interface ResultadoTemas {
  temas: string[];
  naoMapeados: string[];
}

// Rotulos do Microsoft Learn: subjects (76 em uso) e roles (35).
const MAPA: Record<string, string> = {
  // desenvolvimento
  'backend-development': 'back-end',
  'app-development': 'back-end',
  'custom-app-development': 'back-end',
  'frontend-development': 'front-end',
  'mobile-development': 'mobile',
  'cross-development': 'mobile',
  // dados
  'data-analytics': 'dados',
  'data-engineering': 'dados',
  'data-integration': 'dados',
  'data-modeling': 'dados',
  'data-storage': 'dados',
  'data-visualization': 'dados',
  'data-management': 'dados',
  'business-reporting': 'dados',
  databases: 'dados',
  // ia
  'artificial-intelligence': 'inteligencia-artificial',
  'machine-learning': 'inteligencia-artificial',
  'generative-ai': 'inteligencia-artificial',
  'natural-language-processing': 'inteligencia-artificial',
  'classification-analysis': 'inteligencia-artificial',
  chatbots: 'inteligencia-artificial',
  bots: 'inteligencia-artificial',
  // infraestrutura
  'cloud-computing': 'infraestrutura-nuvem',
  infrastructure: 'infraestrutura-nuvem',
  networking: 'infraestrutura-nuvem',
  storage: 'infraestrutura-nuvem',
  virtualization: 'infraestrutura-nuvem',
  'virtual-machine': 'infraestrutura-nuvem',
  'serverless-computing': 'infraestrutura-nuvem',
  architecture: 'infraestrutura-nuvem',
  migration: 'infraestrutura-nuvem',
  'it-management-monitoring': 'infraestrutura-nuvem',
  'application-management': 'infraestrutura-nuvem',
  'asset-management': 'infraestrutura-nuvem',
  cache: 'infraestrutura-nuvem',
  // devops
  devops: 'devops',
  containers: 'devops',
  'site-reliability-engineering': 'devops',
  'platform-engineering': 'devops',
  // seguranca
  security: 'seguranca',
  'cloud-security': 'seguranca',
  compliance: 'seguranca',
  'identity-access': 'seguranca',
  'information-protection-governance': 'seguranca',
  'insider-risk': 'seguranca',
  'key-management': 'seguranca',
  'threat-protection': 'seguranca',
  // design
  accessibility: 'design-ux',
  // negocios
  'business-applications': 'gestao-negocios',
  'change-management': 'gestao-negocios',
  'customer-relationship-management': 'gestao-negocios',
  'e-commerce': 'gestao-negocios',
  'employee-engagement': 'gestao-negocios',
  'employee-management': 'gestao-negocios',
  'field-management': 'gestao-negocios',
  'finance-accounting': 'gestao-negocios',
  'marketing-sales': 'gestao-negocios',
  'manufacturing-processes': 'gestao-negocios',
  'process-workflow': 'gestao-negocios',
  'product-lifecycle-management': 'gestao-negocios',
  'resource-management': 'gestao-negocios',
  'supply-chain-management': 'gestao-negocios',
  'inventory-management': 'gestao-negocios',
  'warehouse-management': 'gestao-negocios',
  'knowledge-management': 'gestao-negocios',
  'frontline-support': 'gestao-negocios',
  'solution-design': 'gestao-negocios',
  // produtividade
  automation: 'produtividade',
  collaboration: 'produtividade',
  communication: 'produtividade',
  productivity: 'produtividade',
  'remote-hybrid-work': 'produtividade',
  'device-management': 'produtividade',
  // roles
  developer: 'back-end',
  maker: 'back-end',
  'devops-engineer': 'devops',
  'data-analyst': 'dados',
  'data-engineer': 'dados',
  'data-scientist': 'dados',
  'database-administrator': 'dados',
  'business-analyst': 'dados',
  'ai-engineer': 'inteligencia-artificial',
  'ai-edge-engineer': 'inteligencia-artificial',
  administrator: 'infraestrutura-nuvem',
  'network-engineer': 'infraestrutura-nuvem',
  'solution-architect': 'infraestrutura-nuvem',
  'support-engineer': 'infraestrutura-nuvem',
  'service-adoption-specialist': 'infraestrutura-nuvem',
  'security-engineer': 'seguranca',
  'security-operations-analyst': 'seguranca',
  'identity-access-admin': 'seguranca',
  'ip-admin': 'seguranca',
  'privacy-manager': 'seguranca',
  'risk-practitioner': 'seguranca',
  auditor: 'seguranca',
  'business-owner': 'gestao-negocios',
  'business-user': 'gestao-negocios',
  'functional-consultant': 'gestao-negocios',
  'startup-founder': 'gestao-negocios',
  'technology-manager': 'gestao-negocios',
  student: 'produtividade',
  'k-12-educator': 'produtividade',
  'higher-ed-educator': 'produtividade',
  'school-leader': 'produtividade',
  'parent-guardian': 'produtividade',
};

const ORDEM = new Map(TEMAS.map((t, i) => [t.id, i]));

/**
 * Precedencia subjects -> roles -> products: o primeiro nivel que produzir ao
 * menos um tema vence, e os niveis seguintes nao sao consultados. Cursos e
 * certificacoes do Microsoft Learn nao tem subjects nenhum, e so roles tem
 * cobertura de 100% em todos os tipos.
 */
export function mapearTemas(rotulos: RotulosBrutos): ResultadoTemas {
  const niveis = [rotulos.subjects, rotulos.roles, rotulos.products];
  const naoMapeados: string[] = [];

  for (const nivel of niveis) {
    if (nivel.length === 0) continue;
    const encontrados = new Set<string>();
    const faltantes: string[] = [];

    for (const rotulo of nivel) {
      const tema = MAPA[rotulo];
      if (tema) encontrados.add(tema);
      else if (!faltantes.includes(rotulo)) faltantes.push(rotulo);
    }

    naoMapeados.push(...faltantes);
    if (encontrados.size > 0) {
      const temas = [...encontrados].sort(
        (a, b) => (ORDEM.get(a) ?? 99) - (ORDEM.get(b) ?? 99),
      );
      return { temas, naoMapeados };
    }
  }

  return { temas: ['outros'], naoMapeados };
}
