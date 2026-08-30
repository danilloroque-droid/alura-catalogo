# Plano 1 — Fundação, Microsoft Learn e Catálogo Navegável

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um site funcionando que lista os 4.667 itens do catálogo do Microsoft Learn em português, com busca, filtros, ordenação e estado na URL.

**Architecture:** Um repositório único com três pastas — `shared/` (tipos e taxonomia), `collector/` (script Node que baixa e normaliza) e `web/` (SPA React). O coletor grava JSON em `dados/`, versionado no git; o site lê esse JSON e faz todo o resto em memória, sem backend. Nenhuma das duas metades conhece o formato cru da outra: o contrato é `shared/src/types.ts`.

**Tech Stack:** Node 22+, TypeScript strict, tsx, Vitest, React 18, Vite 5, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-29-catalogo-alura-design.md`

## Global Constraints

- **Node ≥ 22.** O ambiente de desenvolvimento tem 24.19.0.
- **TypeScript em modo `strict`.** Sem `any` implícito, sem `@ts-ignore`.
- **Nenhum teste toca a rede.** Todo acesso HTTP entra por injeção de dependência; os testes passam um `fetch` falso.
- **Nomes de domínio em português**, conforme o spec: `ItemCatalogo`, `temas`, `plataforma`, `duracaoMinutos`. Nomes de bibliotecas e APIs externas permanecem no original.
- **Textos de interface em pt-BR.**
- **Mensagens de commit em português**, no imperativo.
- **Serialização determinística:** itens sempre ordenados por `id`, chaves de objeto em ordem fixa de declaração. Duas coletas com os mesmos dados produzem bytes idênticos.
- **Nunca comparar ou ordenar `nota` entre plataformas diferentes** (spec §5.1). Vale desde já, mesmo com uma única fonte.
- **Este plano não inclui a Alura.** Ela entra no Plano 2. Não crie `fontes/alura/` nem `busca.json` aqui.
- **O filtro de plataforma existe no modelo, mas não na tela.** `Criterios.plataformas` e o parâmetro `plat=` da URL são implementados e testados desde já, porque mudá-los depois quebraria URLs salvas. O controle visual só aparece no Plano 2, quando houver uma segunda plataforma para escolher — um filtro com uma única opção é ruído.
- **Nenhuma dependência além das listadas na Task 1.** Em particular, nada de biblioteca de roteamento (o `hashchange` nativo basta) nem de busca difusa (spec §13).

## Convenções de teste

- Arquivos em `*/tests/`, nomeados `<assunto>.test.ts` ou `.test.tsx`
- Testes que precisam de DOM começam com `// @vitest-environment jsdom` na primeira linha
- Nomes de teste descrevem o comportamento observável, não o método chamado
- Cada `describe` cobre uma função exportada

---

### Task 1: Fundação — projeto, tipos e mapa de temas

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `shared/src/types.ts`
- Create: `shared/src/temas.ts`
- Test: `shared/tests/temas.test.ts`

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: todos os tipos de `shared/src/types.ts`; `TEMAS: Tema[]`; `mapearTemas(rotulos: RotulosBrutos): ResultadoTemas` com `RotulosBrutos = { subjects: string[]; roles: string[]; products: string[] }` e `ResultadoTemas = { temas: string[]; naoMapeados: string[] }`

- [ ] **Step 1: Criar o esqueleto do projeto**

`package.json`:

```json
{
  "name": "catalogo-treinamentos",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "coletar": "tsx collector/src/main.ts",
    "dev": "vite --config web/vite.config.ts",
    "build": "vite build --config web/vite.config.ts",
    "preview": "vite preview --config web/vite.config.ts"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^24.1.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "vitest": "^2.0.0"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@compartilhado/*": ["shared/src/*"]
    }
  },
  "include": ["shared", "collector", "web"]
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@compartilhado': fileURLToPath(new URL('./shared/src', import.meta.url)),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    include: ['**/tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**'],
  },
});
```

`.gitignore`:

```
node_modules/
dist/
.cache/
*.local
```

Rode `npm install` antes de seguir.

- [ ] **Step 2: Escrever os tipos compartilhados**

`shared/src/types.ts` — transcrição do spec §5, sem lógica:

```ts
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
```

- [ ] **Step 3: Escrever o teste do mapa de temas (vai falhar)**

`shared/tests/temas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapearTemas, TEMAS } from '@compartilhado/temas';

describe('mapearTemas', () => {
  it('usa subjects quando eles mapeiam', () => {
    const r = mapearTemas({
      subjects: ['backend-development', 'databases'],
      roles: ['developer'],
      products: ['azure'],
    });
    expect(r.temas).toEqual(['back-end', 'dados']);
    expect(r.naoMapeados).toEqual([]);
  });

  it('cai para roles quando nao ha subjects, como em cursos e certificacoes', () => {
    const r = mapearTemas({
      subjects: [],
      roles: ['security-engineer'],
      products: ['azure'],
    });
    expect(r.temas).toEqual(['seguranca']);
  });

  it('nao consulta roles quando subjects ja produziu tema', () => {
    const r = mapearTemas({
      subjects: ['machine-learning'],
      roles: ['developer'],
      products: [],
    });
    expect(r.temas).toEqual(['inteligencia-artificial']);
  });

  it('reporta rotulos consultados que nao mapeiam', () => {
    const r = mapearTemas({
      subjects: ['backend-development', 'assunto-inexistente'],
      roles: [],
      products: [],
    });
    expect(r.temas).toEqual(['back-end']);
    expect(r.naoMapeados).toEqual(['assunto-inexistente']);
  });

  it('devolve outros e reporta tudo quando nada mapeia', () => {
    const r = mapearTemas({ subjects: ['xpto'], roles: ['ypto'], products: ['zpto'] });
    expect(r.temas).toEqual(['outros']);
    expect(r.naoMapeados).toEqual(['xpto', 'ypto', 'zpto']);
  });

  it('remove duplicatas e mantem ordem estavel', () => {
    const r = mapearTemas({
      subjects: ['databases', 'data-analytics', 'databases'],
      roles: [],
      products: [],
    });
    expect(r.temas).toEqual(['dados']);
  });

  it('expoe exatamente doze temas, com outros no fim', () => {
    expect(TEMAS).toHaveLength(12);
    expect(TEMAS[TEMAS.length - 1]?.id).toBe('outros');
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Rode: `npx vitest run shared/tests/temas.test.ts`
Esperado: FAIL — `Cannot find module '@compartilhado/temas'`

- [ ] **Step 5: Implementar o mapa de temas**

`shared/src/temas.ts`:

```ts
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
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Rode: `npx vitest run shared/tests/temas.test.ts`
Esperado: PASS, 7 testes

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore shared/
git commit -m "Adiciona fundacao do projeto, tipos compartilhados e mapa de temas"
```

---

### Task 2: Cliente HTTP do Microsoft Learn

**Files:**
- Create: `collector/src/fontes/ms-learn/client.ts`
- Test: `collector/tests/ms-learn-client.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores
- Produces: `buscarCatalogo(opcoes?: OpcoesBusca): Promise<CatalogoBruto>` com `OpcoesBusca = { locale?: string; fetch?: typeof globalThis.fetch; tentativas?: number; esperarMs?: (ms: number) => Promise<void> }`; os tipos brutos `CatalogoBruto`, `ModuloBruto`, `TrilhaBruta`, `CursoBruto`, `CertificacaoBruta`; a constante `URL_CATALOGO`

- [ ] **Step 1: Escrever o teste (vai falhar)**

`collector/tests/ms-learn-client.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { buscarCatalogo, URL_CATALOGO } from '../src/fontes/ms-learn/client.js';

function respostaOk(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('buscarCatalogo', () => {
  it('monta a URL com locale pt-br e os quatro tipos catalogaveis', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaOk({ modules: [] }));
    await buscarCatalogo({ fetch: fetchFalso as unknown as typeof fetch });

    const chamada = String(fetchFalso.mock.calls[0]?.[0]);
    expect(chamada.startsWith(URL_CATALOGO)).toBe(true);
    expect(chamada).toContain('locale=pt-br');
    expect(chamada).toContain('modules');
    expect(chamada).toContain('learningPaths');
    expect(chamada).toContain('courses');
    expect(chamada).toContain('certifications');
    // As unidades sao descartadas: pedi-las dobraria o payload a toa.
    expect(chamada).not.toContain('units');
  });

  it('devolve o corpo ja desserializado', async () => {
    const corpo = { modules: [{ uid: 'a' }], learningPaths: [] };
    const fetchFalso = vi.fn().mockResolvedValue(respostaOk(corpo));
    const r = await buscarCatalogo({ fetch: fetchFalso as unknown as typeof fetch });
    expect(r.modules).toEqual([{ uid: 'a' }]);
  });

  it('tenta de novo apos falha e devolve o sucesso seguinte', async () => {
    const fetchFalso = vi
      .fn()
      .mockRejectedValueOnce(new Error('rede caiu'))
      .mockResolvedValue(respostaOk({ modules: [] }));
    const esperas: number[] = [];

    const r = await buscarCatalogo({
      fetch: fetchFalso as unknown as typeof fetch,
      esperarMs: async (ms) => { esperas.push(ms); },
    });

    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(esperas).toEqual([1000]);
    expect(r.modules).toEqual([]);
  });

  it('usa backoff exponencial e desiste apos as tentativas configuradas', async () => {
    const fetchFalso = vi.fn().mockRejectedValue(new Error('rede caiu'));
    const esperas: number[] = [];

    await expect(
      buscarCatalogo({
        fetch: fetchFalso as unknown as typeof fetch,
        tentativas: 3,
        esperarMs: async (ms) => { esperas.push(ms); },
      }),
    ).rejects.toThrow('rede caiu');

    expect(fetchFalso).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([1000, 2000]);
  });

  it('trata status fora de 2xx como falha, com o codigo na mensagem', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValue(new Response('erro', { status: 503 }));

    await expect(
      buscarCatalogo({
        fetch: fetchFalso as unknown as typeof fetch,
        tentativas: 1,
        esperarMs: async () => {},
      }),
    ).rejects.toThrow('503');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rode: `npx vitest run collector/tests/ms-learn-client.test.ts`
Esperado: FAIL — módulo `../src/fontes/ms-learn/client.js` não existe

- [ ] **Step 3: Implementar o cliente**

`collector/src/fontes/ms-learn/client.ts`:

```ts
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Rode: `npx vitest run collector/tests/ms-learn-client.test.ts`
Esperado: PASS, 5 testes

- [ ] **Step 5: Commit**

```bash
git add collector/src/fontes/ms-learn/client.ts collector/tests/ms-learn-client.test.ts
git commit -m "Adiciona cliente HTTP do Microsoft Learn com retry e backoff"
```

---

### Task 3: Normalizador do Microsoft Learn

Esta é a task de maior risco do plano: os quatro tipos do Microsoft Learn **não compartilham formato** (spec §3.1). A fixture abaixo é dado real, recortado da resposta de 2026-08-29, e cobre exatamente as divergências.

**Files:**
- Create: `collector/fixtures/ms-learn-amostra.json`
- Create: `collector/src/fontes/ms-learn/normalize.ts`
- Test: `collector/tests/ms-learn-normalize.test.ts`

**Interfaces:**
- Consumes: `CatalogoBruto` (Task 2); `mapearTemas` (Task 1); `ItemCatalogo`, `ResultadoFonte` (Task 1)
- Produces: `normalizarMsLearn(bruto: CatalogoBruto): ResultadoFonte`; utilitários exportados `removerHtml(texto: string): string` e `paraData(iso: string | undefined): string | null`

- [ ] **Step 1: Criar a fixture com dados reais**

`collector/fixtures/ms-learn-amostra.json`:

```json
{
  "modules": [
    {
      "uid": "learn.wwl.experiment-azure-machine-learning",
      "title": "Experimente com o Azure Machine Learning",
      "summary": "Escolha este módulo se quiser comparar modelos usando o machine learning automatizado.",
      "url": "https://learn.microsoft.com/pt-br/training/modules/experiment-azure-machine-learning/",
      "duration_in_minutes": 65,
      "levels": ["beginner"],
      "roles": ["data-scientist"],
      "products": ["azure-machine-learning"],
      "subjects": ["machine-learning"],
      "popularity": 0.5939815210230943,
      "last_modified": "2026-08-27T22:13:00+00:00"
    },
    {
      "uid": "learn.wwl.modulo-sem-subjects",
      "title": "Módulo sem assunto declarado",
      "summary": "Cobre o caso dos 728 módulos que não trazem subjects.",
      "url": "https://learn.microsoft.com/pt-br/training/modules/sem-subjects/",
      "duration_in_minutes": 30,
      "levels": ["intermediate"],
      "roles": ["security-engineer"],
      "products": ["azure"],
      "last_modified": "2026-07-01T10:00:00+00:00"
    },
    {
      "uid": "learn.wwl.modulo-sem-popularidade",
      "title": "Módulo sem popularidade",
      "summary": "Cobre os 100 módulos com popularity ausente.",
      "url": "https://learn.microsoft.com/pt-br/training/modules/sem-popularidade/",
      "duration_in_minutes": 12,
      "levels": ["advanced"],
      "roles": ["developer"],
      "products": ["dotnet"],
      "subjects": ["backend-development"],
      "last_modified": "2026-06-15T08:30:00+00:00"
    }
  ],
  "learningPaths": [
    {
      "uid": "learn.wwl.trilha-sem-avaliacao",
      "title": "Trilha sem avaliação",
      "summary": "Cobre as 848 trilhas cujo rating tem count zero.",
      "url": "https://learn.microsoft.com/pt-br/training/paths/sem-avaliacao/",
      "duration_in_minutes": 300,
      "levels": ["beginner"],
      "roles": ["administrator"],
      "products": ["azure"],
      "subjects": ["cloud-computing"],
      "popularity": 0.71,
      "rating": { "count": 0 },
      "last_modified": "2026-08-10T08:50:00+00:00"
    },
    {
      "uid": "learn.wwl.trilha-avaliada",
      "title": "Trilha avaliada",
      "summary": "A única trilha com count maior que zero na coleta de referência.",
      "url": "https://learn.microsoft.com/pt-br/training/paths/avaliada/",
      "duration_in_minutes": 180,
      "levels": ["intermediate"],
      "roles": ["devops-engineer"],
      "products": ["github"],
      "subjects": ["devops"],
      "popularity": 0.88,
      "rating": { "count": 6, "average": 4.83 },
      "last_modified": "2026-05-20T12:00:00+00:00"
    }
  ],
  "courses": [
    {
      "uid": "course.gh-200t00",
      "course_number": "GH-200T00",
      "title": "Automatize o fluxo de trabalho com o GitHub Actions",
      "summary": "<p>Saiba como <b>GitHub Actions</b> permite automatizar seu ciclo de desenvolvimento.</p>",
      "url": "https://learn.microsoft.com/pt-br/training/courses/gh-200t00",
      "duration_in_hours": 24,
      "levels": ["intermediate"],
      "roles": ["devops-engineer"],
      "products": ["github"],
      "last_modified": "2026-04-02T00:00:00+00:00"
    }
  ],
  "certifications": [
    {
      "uid": "certification.azure-for-sap-workloads-specialty",
      "title": "Microsoft Certified: Azure for SAP Workloads Specialty",
      "subtitle": "<p>Você é um arquiteto que gerencia o cenário SAP em Azure.</p>\n<ul>\n<li>Migrações e integrações.</li>\n</ul>",
      "url": "https://learn.microsoft.com/pt-br/credentials/certifications/azure-for-sap-workloads-specialty/",
      "levels": ["advanced"],
      "roles": ["solution-architect"],
      "last_modified": "2026-03-11T09:00:00+00:00"
    }
  ]
}
```

- [ ] **Step 2: Escrever o teste (vai falhar)**

`collector/tests/ms-learn-normalize.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizarMsLearn, removerHtml, paraData } from '../src/fontes/ms-learn/normalize.js';
import type { CatalogoBruto } from '../src/fontes/ms-learn/client.js';
import type { ItemCatalogo } from '@compartilhado/types';

const bruto = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/ms-learn-amostra.json', import.meta.url)), 'utf8'),
) as CatalogoBruto;

const resultado = normalizarMsLearn(bruto);
const porId = (id: string): ItemCatalogo => {
  const item = resultado.itens.find((i) => i.id === id);
  if (!item) throw new Error(`item ausente: ${id}`);
  return item;
};

describe('normalizarMsLearn', () => {
  it('normaliza os quatro tipos, sem perder nenhum item', () => {
    expect(resultado.itens).toHaveLength(7);
    const tipos = resultado.itens.map((i) => i.tipo);
    expect(tipos.filter((t) => t === 'modulo')).toHaveLength(3);
    expect(tipos.filter((t) => t === 'trilha')).toHaveLength(2);
    expect(tipos.filter((t) => t === 'curso')).toHaveLength(1);
    expect(tipos.filter((t) => t === 'certificacao')).toHaveLength(1);
  });

  it('prefixa o id com a plataforma', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').plataforma).toBe('ms-learn');
  });

  it('traduz os niveis do ingles', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').nivel).toBe('iniciante');
    expect(porId('ms-learn:learn.wwl.modulo-sem-subjects').nivel).toBe('intermediario');
    expect(porId('ms-learn:learn.wwl.modulo-sem-popularidade').nivel).toBe('avancado');
  });

  it('converte duration_in_hours dos cursos para minutos', () => {
    expect(porId('ms-learn:course.gh-200t00').duracaoMinutos).toBe(24 * 60);
  });

  it('deixa duracao nula em certificacoes, que nao declaram duracao', () => {
    expect(porId('ms-learn:certification.azure-for-sap-workloads-specialty').duracaoMinutos).toBeNull();
  });

  it('remove HTML do resumo de cursos e usa subtitle em certificacoes', () => {
    expect(porId('ms-learn:course.gh-200t00').resumo).toBe(
      'Saiba como GitHub Actions permite automatizar seu ciclo de desenvolvimento.',
    );
    expect(porId('ms-learn:certification.azure-for-sap-workloads-specialty').resumo).toBe(
      'Você é um arquiteto que gerencia o cenário SAP em Azure. Migrações e integrações.',
    );
  });

  it('trunca last_modified para data', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').atualizadoEm).toBe('2026-08-27');
  });

  it('so atribui nota quando rating tem count maior que zero', () => {
    const semAvaliacao = porId('ms-learn:learn.wwl.trilha-sem-avaliacao');
    expect(semAvaliacao.nota).toBeNull();
    expect(semAvaliacao.escalaNota).toBeNull();

    const avaliada = porId('ms-learn:learn.wwl.trilha-avaliada');
    expect(avaliada.nota).toBe(4.83);
    expect(avaliada.escalaNota).toBe('ms-rating');
  });

  it('marca a escala de popularidade e aceita ausencia', () => {
    const com = porId('ms-learn:learn.wwl.experiment-azure-machine-learning');
    expect(com.escalaPopularidade).toBe('ms-popularity');

    const sem = porId('ms-learn:learn.wwl.modulo-sem-popularidade');
    expect(sem.popularidade).toBeNull();
    expect(sem.escalaPopularidade).toBeNull();
  });

  it('mapeia tema por subjects e cai para roles quando nao ha subjects', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').temas).toEqual([
      'inteligencia-artificial',
    ]);
    expect(porId('ms-learn:learn.wwl.modulo-sem-subjects').temas).toEqual(['seguranca']);
    expect(porId('ms-learn:certification.azure-for-sap-workloads-specialty').temas).toEqual([
      'infraestrutura-nuvem',
    ]);
  });

  it('preserva todos os rotulos originais, sem duplicatas', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').temasOriginais).toEqual([
      'machine-learning',
      'data-scientist',
      'azure-machine-learning',
    ]);
  });

  it('preenche os campos que o Microsoft Learn nao tem', () => {
    const item = porId('ms-learn:course.gh-200t00');
    expect(item.instrutores).toEqual([]);
    expect(item.criadoEm).toBeNull();
    expect(item.ehCheckpoint).toBe(false);
    expect(item.idioma).toBe('pt-BR');
  });

  it('descarta item sem uid, registrando o motivo', () => {
    const r = normalizarMsLearn({ modules: [{ title: 'sem uid', url: 'x' } as never] });
    expect(r.itens).toHaveLength(0);
    expect(r.descartados).toEqual([{ id: 'modulo[0]', motivo: 'sem uid' }]);
  });
});

describe('removerHtml', () => {
  it('remove tags e normaliza espacos', () => {
    expect(removerHtml('<p>Um</p>\n<ul>\n<li>dois</li>\n</ul>')).toBe('Um dois');
  });

  it('converte entidades comuns', () => {
    expect(removerHtml('a &amp; b &lt;c&gt; &nbsp;d &quot;e&quot;')).toBe('a & b <c> d "e"');
  });
});

describe('paraData', () => {
  it('trunca ISO com fuso para AAAA-MM-DD', () => {
    expect(paraData('2026-08-27T22:13:00+00:00')).toBe('2026-08-27');
  });

  it('devolve nulo quando ausente ou invalido', () => {
    expect(paraData(undefined)).toBeNull();
    expect(paraData('nao é data')).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Rode: `npx vitest run collector/tests/ms-learn-normalize.test.ts`
Esperado: FAIL — módulo `normalize.js` não existe

- [ ] **Step 4: Implementar o normalizador**

`collector/src/fontes/ms-learn/normalize.ts`:

```ts
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
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function removerHtml(texto: string): string {
  return texto
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTIDADES[e.toLowerCase()] ?? ' ')
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
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Rode: `npx vitest run collector/tests/ms-learn-normalize.test.ts`
Esperado: PASS, 17 testes

- [ ] **Step 6: Commit**

```bash
git add collector/fixtures collector/src/fontes/ms-learn/normalize.ts collector/tests/ms-learn-normalize.test.ts
git commit -m "Adiciona normalizador do Microsoft Learn com fixture dos quatro tipos"
```

---

### Task 4: Índice determinístico

**Files:**
- Create: `collector/src/build-index.ts`
- Test: `collector/tests/build-index.test.ts`

**Interfaces:**
- Consumes: `ResultadoFonte`, `Indice`, `ItemCatalogo`, `TEMAS` (Tasks 1 e 3)
- Produces: `construirIndice(fontes: ResultadoFonte[], geradoEm: string): Indice`; `serializar(indice: Indice): string`

- [ ] **Step 1: Escrever o teste (vai falhar)**

`collector/tests/build-index.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { construirIndice, serializar } from '../src/build-index.js';
import type { ItemCatalogo, ResultadoFonte } from '@compartilhado/types';

function item(id: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo {
  return {
    id, plataforma: 'ms-learn', tipo: 'modulo', titulo: id, resumo: null,
    url: `https://exemplo/${id}`, duracaoMinutos: 10, nivel: 'iniciante',
    temas: ['dados'], temasOriginais: ['databases'], instrutores: [],
    idioma: 'pt-BR', criadoEm: null, atualizadoEm: '2026-01-01',
    nota: null, escalaNota: null, popularidade: null, escalaPopularidade: null,
    ehCheckpoint: false, ...extra,
  };
}

const fonte = (itens: ItemCatalogo[]): ResultadoFonte => ({
  plataforma: 'ms-learn', itens, descartados: [], rotulosNaoMapeados: [],
});

describe('construirIndice', () => {
  it('ordena os itens por id, qualquer que seja a ordem de entrada', () => {
    const indice = construirIndice([fonte([item('c'), item('a'), item('b')])], '2026-08-29T00:00:00Z');
    expect(indice.itens.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('resume cada fonte com o total coletado', () => {
    const indice = construirIndice([fonte([item('a'), item('b')])], '2026-08-29T00:00:00Z');
    expect(indice.fontes).toEqual([
      { plataforma: 'ms-learn', total: 2, coletadoEm: '2026-08-29' },
    ]);
  });

  it('inclui apenas os temas de fato usados, na ordem canonica', () => {
    const indice = construirIndice(
      [fonte([item('a', { temas: ['seguranca'] }), item('b', { temas: ['back-end'] })])],
      '2026-08-29T00:00:00Z',
    );
    expect(indice.temas.map((t) => t.id)).toEqual(['back-end', 'seguranca']);
    expect(indice.temas[0]?.nome).toBe('Back-end');
  });

  it('produz bytes identicos para a mesma entrada em ordens diferentes', () => {
    const a = serializar(construirIndice([fonte([item('x'), item('y')])], '2026-08-29T00:00:00Z'));
    const b = serializar(construirIndice([fonte([item('y'), item('x')])], '2026-08-29T00:00:00Z'));
    expect(a).toBe(b);
  });

  it('serializa as chaves de cada item sempre na mesma ordem', () => {
    const texto = serializar(construirIndice([fonte([item('a')])], '2026-08-29T00:00:00Z'));
    const primeiro = JSON.parse(texto).itens[0];
    expect(Object.keys(primeiro)[0]).toBe('id');
    expect(Object.keys(primeiro)[1]).toBe('plataforma');
    expect(Object.keys(primeiro)).toHaveLength(19);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rode: `npx vitest run collector/tests/build-index.test.ts`
Esperado: FAIL — módulo `build-index.js` não existe

- [ ] **Step 3: Implementar**

`collector/src/build-index.ts`:

```ts
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Rode: `npx vitest run collector/tests/build-index.test.ts`
Esperado: PASS, 5 testes

- [ ] **Step 5: Commit**

```bash
git add collector/src/build-index.ts collector/tests/build-index.test.ts
git commit -m "Adiciona construcao deterministica do indice"
```

---

### Task 5: Orquestração e geração real dos dados

**Files:**
- Create: `collector/src/main.ts`
- Test: `collector/tests/main.test.ts`

**Interfaces:**
- Consumes: `buscarCatalogo` (Task 2), `normalizarMsLearn` (Task 3), `construirIndice`/`serializar` (Task 4)
- Produces: `coletar(opcoes: OpcoesColeta): Promise<Relatorio>` com `OpcoesColeta = { diretorio: string; agora?: Date; buscar?: typeof buscarCatalogo }` e `Relatorio = { geradoEm: string; fontes: { plataforma: string; total: number; descartados: ItemDescartado[]; rotulosNaoMapeados: string[] }[] }`

- [ ] **Step 1: Escrever o teste (vai falhar)**

`collector/tests/main.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { coletar } from '../src/main.js';
import type { CatalogoBruto } from '../src/fontes/ms-learn/client.js';

const CATALOGO: CatalogoBruto = {
  modules: [
    {
      uid: 'm1', title: 'Um módulo', summary: 'resumo',
      url: 'https://exemplo/m1', duration_in_minutes: 20,
      levels: ['beginner'], roles: ['developer'], products: ['dotnet'],
      subjects: ['backend-development'], popularity: 0.5,
      last_modified: '2026-08-27T22:13:00+00:00',
    },
  ],
};

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'catalogo-'));
  return () => rmSync(dir, { recursive: true, force: true });
});

describe('coletar', () => {
  it('grava indice, snapshot e relatorio', async () => {
    await coletar({
      diretorio: dir,
      agora: new Date('2026-08-29T12:00:00Z'),
      buscar: async () => CATALOGO,
    });

    const indice = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    expect(indice.itens).toHaveLength(1);
    expect(indice.itens[0].id).toBe('ms-learn:m1');
    expect(indice.fontes[0].total).toBe(1);

    const snapshot = JSON.parse(
      readFileSync(join(dir, 'snapshots', '2026-08-29.json'), 'utf8'),
    );
    expect(snapshot.itens).toHaveLength(1);

    const relatorio = JSON.parse(readFileSync(join(dir, 'relatorio.json'), 'utf8'));
    expect(relatorio.fontes[0].plataforma).toBe('ms-learn');
    expect(relatorio.fontes[0].total).toBe(1);
  });

  it('propaga a falha da fonte sem gravar indice pela metade', async () => {
    await expect(
      coletar({
        diretorio: dir,
        agora: new Date('2026-08-29T12:00:00Z'),
        buscar: async () => { throw new Error('Microsoft Learn respondeu 503'); },
      }),
    ).rejects.toThrow('503');

    expect(() => readFileSync(join(dir, 'index.json'), 'utf8')).toThrow();
  });

  it('registra rotulos nao mapeados no relatorio', async () => {
    await coletar({
      diretorio: dir,
      agora: new Date('2026-08-29T12:00:00Z'),
      buscar: async () => ({
        modules: [{ ...CATALOGO.modules![0]!, uid: 'm2', subjects: ['assunto-novo'] }],
      }),
    });

    const relatorio = JSON.parse(readFileSync(join(dir, 'relatorio.json'), 'utf8'));
    expect(relatorio.fontes[0].rotulosNaoMapeados).toContain('assunto-novo');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rode: `npx vitest run collector/tests/main.test.ts`
Esperado: FAIL — módulo `main.js` não existe

- [ ] **Step 3: Implementar**

`collector/src/main.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buscarCatalogo } from './fontes/ms-learn/client.js';
import { normalizarMsLearn } from './fontes/ms-learn/normalize.js';
import { construirIndice, serializar } from './build-index.js';
import type { ItemDescartado } from '@compartilhado/types';

export interface OpcoesColeta {
  diretorio: string;
  agora?: Date;
  buscar?: typeof buscarCatalogo;
}

export interface Relatorio {
  geradoEm: string;
  fontes: {
    plataforma: string;
    total: number;
    descartados: ItemDescartado[];
    rotulosNaoMapeados: string[];
  }[];
}

export async function coletar(opcoes: OpcoesColeta): Promise<Relatorio> {
  const { diretorio, agora = new Date(), buscar = buscarCatalogo } = opcoes;
  const geradoEm = agora.toISOString();

  // A fonte roda por inteiro antes de qualquer escrita: uma falha nao pode
  // deixar dados/ pela metade.
  const bruto = await buscar();
  const fonte = normalizarMsLearn(bruto);
  const indice = construirIndice([fonte], geradoEm);
  const texto = serializar(indice);

  mkdirSync(join(diretorio, 'snapshots'), { recursive: true });
  writeFileSync(join(diretorio, 'index.json'), texto, 'utf8');
  writeFileSync(join(diretorio, 'snapshots', `${geradoEm.slice(0, 10)}.json`), texto, 'utf8');

  const relatorio: Relatorio = {
    geradoEm,
    fontes: [
      {
        plataforma: fonte.plataforma,
        total: fonte.itens.length,
        descartados: fonte.descartados,
        rotulosNaoMapeados: fonte.rotulosNaoMapeados,
      },
    ],
  };
  writeFileSync(join(diretorio, 'relatorio.json'), JSON.stringify(relatorio, null, 2), 'utf8');

  return relatorio;
}

// Executado apenas via `npm run coletar`, nunca ao importar em teste.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const relatorio = await coletar({ diretorio: join(raiz, 'dados') });
  const fonte = relatorio.fontes[0];
  console.log(`Coletados ${fonte?.total ?? 0} itens do Microsoft Learn.`);
  if (fonte?.descartados.length) console.log(`Descartados: ${fonte.descartados.length}`);
  if (fonte?.rotulosNaoMapeados.length) {
    console.log(`Rotulos sem tema: ${fonte.rotulosNaoMapeados.join(', ')}`);
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Rode: `npx vitest run collector/tests/main.test.ts`
Esperado: PASS, 3 testes

- [ ] **Step 5: Rodar a coleta de verdade**

Rode: `npm run coletar`
Esperado: `Coletados 4667 itens do Microsoft Learn.` (o número pode variar — o catálogo é vivo). Confira que `dados/index.json` tem por volta de 3 MB e que `dados/relatorio.json` existe.

Se aparecerem rótulos sem tema, **não amplie o mapa agora** — anote-os para uma revisão consciente depois.

- [ ] **Step 6: Rodar duas vezes e confirmar o determinismo**

```bash
npm run coletar && cp dados/index.json /tmp/a.json && npm run coletar && diff -q /tmp/a.json dados/index.json && echo "DETERMINISTICO"
```
Esperado: `DETERMINISTICO`. Se houver diferença, o catálogo mudou entre as chamadas ou a ordenação não é estável — investigue antes de seguir.

- [ ] **Step 7: Commit, incluindo os dados**

```bash
git add collector/src/main.ts collector/tests/main.test.ts dados/
git commit -m "Adiciona orquestracao da coleta e primeiro indice do Microsoft Learn"
```

---

### Task 6: Base do site e carregamento do índice

**Files:**
- Create: `web/index.html`
- Create: `web/vite.config.ts`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/estilos.css`
- Create: `web/src/dados/carregar.ts`
- Test: `web/tests/carregar.test.ts`

**Interfaces:**
- Consumes: `Indice` (Task 1); `dados/index.json` (Task 5)
- Produces: `carregarIndice(buscar?: typeof fetch): Promise<Indice>`; `URL_INDICE`

- [ ] **Step 1: Escrever o teste (vai falhar)**

`web/tests/carregar.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { carregarIndice } from '../src/dados/carregar.js';

const indiceValido = { geradoEm: '2026-08-29T00:00:00Z', fontes: [], temas: [], itens: [] };

describe('carregarIndice', () => {
  it('devolve o indice desserializado', async () => {
    const buscar = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(indiceValido), { status: 200 }),
    );
    const indice = await carregarIndice(buscar as unknown as typeof fetch);
    expect(indice.itens).toEqual([]);
  });

  it('falha com mensagem em portugues quando o arquivo nao existe', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    await expect(carregarIndice(buscar as unknown as typeof fetch)).rejects.toThrow(
      'Não foi possível carregar o catálogo',
    );
  });

  it('falha quando a rede cai', async () => {
    const buscar = vi.fn().mockRejectedValue(new TypeError('offline'));
    await expect(carregarIndice(buscar as unknown as typeof fetch)).rejects.toThrow(
      'Não foi possível carregar o catálogo',
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rode: `npx vitest run web/tests/carregar.test.ts`
Esperado: FAIL — módulo não existe

- [ ] **Step 3: Implementar o carregamento**

`web/src/dados/carregar.ts`:

```ts
import type { Indice } from '@compartilhado/types';

export const URL_INDICE = `${import.meta.env.BASE_URL}index.json`;

export async function carregarIndice(buscar: typeof fetch = fetch): Promise<Indice> {
  try {
    const resposta = await buscar(URL_INDICE);
    if (!resposta.ok) throw new Error(String(resposta.status));
    return (await resposta.json()) as Indice;
  } catch (causa) {
    throw new Error('Não foi possível carregar o catálogo.', { cause: causa });
  }
}
```

- [ ] **Step 4: Criar o esqueleto do site**

`web/vite.config.ts` — `publicDir` aponta para `dados/`, então o índice é servido em desenvolvimento e copiado no build:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  publicDir: fileURLToPath(new URL('../dados', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      '@compartilhado': fileURLToPath(new URL('../shared/src', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../dist', import.meta.url)),
    emptyOutDir: true,
  },
});
```

`web/index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Catálogo de treinamentos</title>
  </head>
  <body>
    <div id="raiz"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './estilos.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('elemento #raiz ausente');
createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`web/src/App.tsx` — versão mínima; a página de catálogo entra na Task 10:

```tsx
import { useEffect, useState } from 'react';
import type { Indice } from '@compartilhado/types';
import { carregarIndice } from './dados/carregar.js';

export function App() {
  const [indice, setIndice] = useState<Indice | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarIndice()
      .then(setIndice)
      .catch((e: Error) => setErro(e.message));
  }, []);

  if (erro) {
    return (
      <main>
        <p role="alert">{erro}</p>
        <button onClick={() => window.location.reload()}>Tentar de novo</button>
      </main>
    );
  }

  if (!indice) return <main><p>Carregando catálogo…</p></main>;

  return (
    <main>
      <h1>Catálogo de treinamentos</h1>
      <p>{indice.itens.length} itens disponíveis.</p>
    </main>
  );
}
```

`web/src/estilos.css`:

```css
:root { color-scheme: light dark; --borda: color-mix(in srgb, currentColor 15%, transparent); }
* { box-sizing: border-box; }
body { margin: 0; font: 15px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; }
main { padding: 1.5rem; }
```

- [ ] **Step 5: Rodar os testes e o site**

Rode: `npx vitest run web/tests/carregar.test.ts`
Esperado: PASS, 3 testes

Rode: `npm run dev` e abra o endereço mostrado.
Esperado: a página mostra "4667 itens disponíveis." Encerre com Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "Adiciona base do site e carregamento do indice"
```

---

### Task 7: Filtros puros — buscar, filtrar, ordenar

O núcleo do app. Sem React, sem DOM: só funções sobre arrays.

**Files:**
- Create: `web/src/filtros/filtros.ts`
- Test: `web/tests/filtros.test.ts`

**Interfaces:**
- Consumes: `ItemCatalogo` (Task 1)
- Produces: `normalizarTexto(t: string): string`; `buscar(itens, texto): ItemCatalogo[]`; `filtrar(itens, criterios: Criterios): ItemCatalogo[]`; `ordenar(itens, ordem: Ordem): ItemCatalogo[]`; `ordenacaoPermitida(itens, ordem): boolean`; `aplicar(itens, criterios): ItemCatalogo[]`; os tipos `Criterios` e `Ordem`

- [ ] **Step 1: Escrever o teste (vai falhar)**

`web/tests/filtros.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  aplicar, buscar, filtrar, normalizarTexto, ordenar, ordenacaoPermitida,
  type Criterios,
} from '../src/filtros/filtros.js';
import type { ItemCatalogo } from '@compartilhado/types';

function item(p: Partial<ItemCatalogo> & { id: string }): ItemCatalogo {
  return {
    plataforma: 'ms-learn', tipo: 'modulo', titulo: p.id, resumo: null,
    url: '', duracaoMinutos: 60, nivel: 'iniciante', temas: ['dados'],
    temasOriginais: [], instrutores: [], idioma: 'pt-BR', criadoEm: null,
    atualizadoEm: '2026-01-01', nota: null, escalaNota: null,
    popularidade: null, escalaPopularidade: null, ehCheckpoint: false, ...p,
  };
}

const VAZIO: Criterios = {
  texto: '', plataformas: [], tipos: [], temas: [], niveis: [],
  duracaoMaxima: null, ordem: 'titulo',
};

describe('normalizarTexto', () => {
  it('remove acentos e caixa', () => {
    expect(normalizarTexto('Inteligência ARTIFICIAL')).toBe('inteligencia artificial');
  });
});

describe('buscar', () => {
  const itens = [
    item({ id: 'a', titulo: 'Introdução ao Docker' }),
    item({ id: 'b', titulo: 'Kubernetes', resumo: 'Orquestração de contêineres com Docker' }),
    item({ id: 'c', titulo: 'Power BI' }),
  ];

  it('devolve tudo quando o texto esta vazio', () => {
    expect(buscar(itens, '   ')).toHaveLength(3);
  });

  it('encontra no titulo e no resumo, ignorando acentos', () => {
    expect(buscar(itens, 'docker').map((i) => i.id)).toEqual(['a', 'b']);
    expect(buscar(itens, 'orquestracao').map((i) => i.id)).toEqual(['b']);
  });

  it('exige que todos os termos apareçam', () => {
    expect(buscar(itens, 'docker kubernetes').map((i) => i.id)).toEqual(['b']);
  });
});

describe('filtrar', () => {
  const itens = [
    item({ id: 'a', plataforma: 'ms-learn', tipo: 'modulo', temas: ['dados'], nivel: 'iniciante', duracaoMinutos: 30 }),
    item({ id: 'b', plataforma: 'ms-learn', tipo: 'trilha', temas: ['seguranca'], nivel: 'avancado', duracaoMinutos: 600 }),
    item({ id: 'c', plataforma: 'ms-learn', tipo: 'certificacao', temas: ['dados', 'seguranca'], nivel: null, duracaoMinutos: null }),
  ];

  it('nao filtra nada quando os criterios estao vazios', () => {
    expect(filtrar(itens, VAZIO)).toHaveLength(3);
  });

  it('filtra por tipo', () => {
    expect(filtrar(itens, { ...VAZIO, tipos: ['trilha'] }).map((i) => i.id)).toEqual(['b']);
  });

  it('filtra por tema, aceitando itens com mais de um', () => {
    expect(filtrar(itens, { ...VAZIO, temas: ['seguranca'] }).map((i) => i.id)).toEqual(['b', 'c']);
  });

  it('combina criterios com E', () => {
    const r = filtrar(itens, { ...VAZIO, temas: ['dados'], tipos: ['modulo'] });
    expect(r.map((i) => i.id)).toEqual(['a']);
  });

  it('mantem itens sem duracao fora do corte por duracao maxima', () => {
    const r = filtrar(itens, { ...VAZIO, duracaoMaxima: 60 });
    expect(r.map((i) => i.id)).toEqual(['a']);
  });
});

describe('ordenar', () => {
  const itens = [
    item({ id: 'a', titulo: 'Beta', duracaoMinutos: 300, atualizadoEm: '2026-01-01', popularidade: 0.2, escalaPopularidade: 'ms-popularity' }),
    item({ id: 'b', titulo: 'Alfa', duracaoMinutos: 60, atualizadoEm: '2026-08-01', popularidade: 0.9, escalaPopularidade: 'ms-popularity' }),
  ];

  it('ordena por titulo em pt-BR', () => {
    expect(ordenar(itens, 'titulo').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('ordena por duracao crescente', () => {
    expect(ordenar(itens, 'duracao').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('ordena por atualizacao, mais recente primeiro', () => {
    expect(ordenar(itens, 'atualizacao').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('ordena por popularidade, maior primeiro', () => {
    expect(ordenar(itens, 'popularidade').map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('joga itens sem valor para o fim, nunca para o topo', () => {
    const comNulo = [...itens, item({ id: 'c', duracaoMinutos: null })];
    expect(ordenar(comNulo, 'duracao').map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('nao muta o array recebido', () => {
    const original = [...itens];
    ordenar(itens, 'titulo');
    expect(itens).toEqual(original);
  });
});

describe('ordenacaoPermitida', () => {
  const ms = item({ id: 'a', nota: 4.8, escalaNota: 'ms-rating' });
  const alura = item({ id: 'b', plataforma: 'alura', nota: 9.4, escalaNota: 'alura-nps' });

  it('permite ordenar por nota dentro de uma unica plataforma', () => {
    expect(ordenacaoPermitida([ms], 'nota')).toBe(true);
    expect(ordenacaoPermitida([alura], 'nota')).toBe(true);
  });

  it('proibe ordenar por nota misturando plataformas: as escalas nao sao comparaveis', () => {
    expect(ordenacaoPermitida([ms, alura], 'nota')).toBe(false);
  });

  it('permite as demais ordenacoes mesmo misturando plataformas', () => {
    expect(ordenacaoPermitida([ms, alura], 'titulo')).toBe(true);
    expect(ordenacaoPermitida([ms, alura], 'duracao')).toBe(true);
  });
});

describe('aplicar', () => {
  it('busca, filtra e ordena numa passada so', () => {
    const itens = [
      item({ id: 'a', titulo: 'Docker avançado', tipo: 'modulo', duracaoMinutos: 90 }),
      item({ id: 'b', titulo: 'Docker básico', tipo: 'modulo', duracaoMinutos: 30 }),
      item({ id: 'c', titulo: 'Outro assunto', tipo: 'modulo', duracaoMinutos: 10 }),
    ];
    const r = aplicar(itens, { ...VAZIO, texto: 'docker', ordem: 'duracao' });
    expect(r.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('cai para ordenacao por titulo quando a ordem pedida e proibida', () => {
    const itens = [
      item({ id: 'a', titulo: 'Zeta', nota: 4.8, escalaNota: 'ms-rating' }),
      item({ id: 'b', titulo: 'Alfa', plataforma: 'alura', nota: 9.4, escalaNota: 'alura-nps' }),
    ];
    expect(aplicar(itens, { ...VAZIO, ordem: 'nota' }).map((i) => i.id)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rode: `npx vitest run web/tests/filtros.test.ts`
Esperado: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

`web/src/filtros/filtros.ts`:

```ts
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

export function ordenar(itens: ItemCatalogo[], ordem: Ordem): ItemCatalogo[] {
  const copia = [...itens];

  switch (ordem) {
    case 'titulo':
      return copia.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
    case 'duracao':
      // Crescente, mas sem duracao vai para o fim: um item sem informacao nao
      // e "o mais curto".
      return copia.sort((a, b) => {
        if (a.duracaoMinutos === null) return 1;
        if (b.duracaoMinutos === null) return -1;
        return a.duracaoMinutos - b.duracaoMinutos;
      });
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Rode: `npx vitest run web/tests/filtros.test.ts`
Esperado: PASS, 20 testes

- [ ] **Step 5: Commit**

```bash
git add web/src/filtros web/tests/filtros.test.ts
git commit -m "Adiciona busca, filtros e ordenacao com recusa de nota entre plataformas"
```

---

### Task 8: Critérios na URL

**Files:**
- Create: `web/src/filtros/url.ts`
- Test: `web/tests/url.test.ts`

**Interfaces:**
- Consumes: `Criterios`, `Ordem` (Task 7)
- Produces: `CRITERIOS_VAZIOS: Criterios`; `paraHash(c: Criterios): string`; `deHash(hash: string): Criterios`

- [ ] **Step 1: Escrever o teste (vai falhar)**

`web/tests/url.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rode: `npx vitest run web/tests/url.test.ts`
Esperado: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

`web/src/filtros/url.ts`:

```ts
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Rode: `npx vitest run web/tests/url.test.ts`
Esperado: PASS, 8 testes

- [ ] **Step 5: Commit**

```bash
git add web/src/filtros/url.ts web/tests/url.test.ts
git commit -m "Adiciona serializacao dos criterios de filtro na URL"
```

---

### Task 9: Cartão e lista com "mostrar mais"

**Files:**
- Create: `web/src/componentes/CartaoItem.tsx`
- Create: `web/src/componentes/ListaItens.tsx`
- Test: `web/tests/lista.test.tsx`

**Interfaces:**
- Consumes: `ItemCatalogo` (Task 1)
- Produces: `CartaoItem({ item }: { item: ItemCatalogo })`; `ListaItens({ itens, porPagina? }: { itens: ItemCatalogo[]; porPagina?: number })`; a constante `POR_PAGINA = 60`

- [ ] **Step 1: Escrever o teste (vai falhar)**

`web/tests/lista.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListaItens } from '../src/componentes/ListaItens.js';
import type { ItemCatalogo } from '@compartilhado/types';

function item(id: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo {
  return {
    id, plataforma: 'ms-learn', tipo: 'modulo', titulo: `Item ${id}`,
    resumo: 'Um resumo', url: `https://exemplo/${id}`, duracaoMinutos: 90,
    nivel: 'iniciante', temas: ['dados'], temasOriginais: [], instrutores: [],
    idioma: 'pt-BR', criadoEm: null, atualizadoEm: '2026-01-01', nota: null,
    escalaNota: null, popularidade: null, escalaPopularidade: null,
    ehCheckpoint: false, ...extra,
  };
}

const muitos = Array.from({ length: 25 }, (_, i) => item(String(i).padStart(2, '0')));

describe('ListaItens', () => {
  it('mostra o numero de resultados', () => {
    render(<ListaItens itens={muitos} porPagina={10} />);
    expect(screen.getByText('25 resultados')).toBeDefined();
  });

  it('usa o singular quando ha um unico resultado', () => {
    render(<ListaItens itens={[item('a')]} />);
    expect(screen.getByText('1 resultado')).toBeDefined();
  });

  it('renderiza apenas a primeira pagina', () => {
    render(<ListaItens itens={muitos} porPagina={10} />);
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('mostra mais itens ao acionar o botao', async () => {
    render(<ListaItens itens={muitos} porPagina={10} />);
    await userEvent.click(screen.getByRole('button', { name: /mostrar mais/i }));
    expect(screen.getAllByRole('article')).toHaveLength(20);
  });

  it('esconde o botao quando tudo ja esta na tela', async () => {
    render(<ListaItens itens={muitos} porPagina={10} />);
    const botao = screen.getByRole('button', { name: /mostrar mais/i });
    await userEvent.click(botao);
    await userEvent.click(screen.getByRole('button', { name: /mostrar mais/i }));
    expect(screen.queryByRole('button', { name: /mostrar mais/i })).toBeNull();
  });

  it('volta para a primeira pagina quando a lista muda', async () => {
    const { rerender } = render(<ListaItens itens={muitos} porPagina={10} />);
    await userEvent.click(screen.getByRole('button', { name: /mostrar mais/i }));
    rerender(<ListaItens itens={muitos.slice(0, 15)} porPagina={10} />);
    expect(screen.getAllByRole('article')).toHaveLength(10);
  });

  it('avisa quando nao ha resultado', () => {
    render(<ListaItens itens={[]} />);
    expect(screen.getByText(/nenhum item encontrado/i)).toBeDefined();
  });

  it('mostra duracao em horas e minutos e liga para a plataforma', () => {
    render(<ListaItens itens={[item('a', { duracaoMinutos: 150 })]} />);
    expect(screen.getByText('2 h 30 min')).toBeDefined();
    expect(screen.getByRole('link', { name: /item a/i }).getAttribute('href'))
      .toBe('https://exemplo/a');
  });

  it('mostra a nota com a escala da propria plataforma', () => {
    render(<ListaItens itens={[
      item('a', { nota: 4.83, escalaNota: 'ms-rating' }),
      item('b', { plataforma: 'alura', nota: 9.4, escalaNota: 'alura-nps' }),
    ]} />);
    expect(screen.getByText('4.8/5')).toBeDefined();
    expect(screen.getByText('9.4/10')).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rode: `npx vitest run web/tests/lista.test.tsx`
Esperado: FAIL — módulos não existem

- [ ] **Step 3: Implementar o cartão**

`web/src/componentes/CartaoItem.tsx`:

```tsx
import type { ItemCatalogo } from '@compartilhado/types';

const NOME_PLATAFORMA: Record<string, string> = {
  'ms-learn': 'Microsoft Learn',
  alura: 'Alura',
};

const NOME_TIPO: Record<string, string> = {
  curso: 'Curso', modulo: 'Módulo', trilha: 'Trilha', certificacao: 'Certificação',
};

const NOME_NIVEL: Record<string, string> = {
  iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado',
};

export function formatarDuracao(minutos: number | null): string | null {
  if (minutos === null) return null;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

// Cada escala e exibida no seu proprio idioma; nunca convertida (spec 5.1).
export function formatarNota(item: ItemCatalogo): string | null {
  if (item.nota === null) return null;
  if (item.escalaNota === 'alura-nps') return `${item.nota.toFixed(1)}/10`;
  if (item.escalaNota === 'ms-rating') return `${item.nota.toFixed(1)}/5`;
  return null;
}

export function CartaoItem({ item }: { item: ItemCatalogo }) {
  const duracao = formatarDuracao(item.duracaoMinutos);
  const nota = formatarNota(item);

  return (
    <article className="cartao">
      <div className="cartao-selos">
        <span className="selo">{NOME_PLATAFORMA[item.plataforma] ?? item.plataforma}</span>
        <span className="selo">{NOME_TIPO[item.tipo] ?? item.tipo}</span>
      </div>
      <h3>
        <a href={item.url} target="_blank" rel="noreferrer">{item.titulo}</a>
      </h3>
      {item.resumo && <p className="cartao-resumo">{item.resumo}</p>}
      <dl className="cartao-meta">
        {duracao && <div><dt>Duração</dt><dd>{duracao}</dd></div>}
        {item.nivel && <div><dt>Nível</dt><dd>{NOME_NIVEL[item.nivel]}</dd></div>}
        {nota && <div><dt>Nota</dt><dd>{nota}</dd></div>}
      </dl>
    </article>
  );
}
```

- [ ] **Step 4: Implementar a lista**

`web/src/componentes/ListaItens.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { ItemCatalogo } from '@compartilhado/types';
import { CartaoItem } from './CartaoItem.js';

export const POR_PAGINA = 60;

interface Props {
  itens: ItemCatalogo[];
  porPagina?: number;
}

export function ListaItens({ itens, porPagina = POR_PAGINA }: Props) {
  const [visiveis, setVisiveis] = useState(porPagina);

  // Trocar de filtro precisa recomecar do topo, senao o usuario ve o fim de
  // uma lista que ele nunca rolou.
  useEffect(() => { setVisiveis(porPagina); }, [itens, porPagina]);

  if (itens.length === 0) {
    return <p className="vazio">Nenhum item encontrado. Tente afrouxar os filtros.</p>;
  }

  const mostrados = itens.slice(0, visiveis);

  return (
    <div>
      <p className="contador">
        {itens.length} {itens.length === 1 ? 'resultado' : 'resultados'}
      </p>
      <div className="grade">
        {mostrados.map((item) => <CartaoItem key={item.id} item={item} />)}
      </div>
      {visiveis < itens.length && (
        <button className="mostrar-mais" onClick={() => setVisiveis((v) => v + porPagina)}>
          Mostrar mais ({itens.length - visiveis} restantes)
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Rode: `npx vitest run web/tests/lista.test.tsx`
Esperado: PASS, 9 testes

- [ ] **Step 6: Commit**

```bash
git add web/src/componentes web/tests/lista.test.tsx
git commit -m "Adiciona cartao de item e lista com mostrar mais"
```

---

### Task 10: Painel de filtros e página do catálogo

Fecha o Plano 1: liga índice, filtros, URL e lista numa tela usável.

**Files:**
- Create: `web/src/componentes/PainelFiltros.tsx`
- Create: `web/src/paginas/Catalogo.tsx`
- Modify: `web/src/App.tsx` (substitui o corpo provisório da Task 6)
- Modify: `web/src/estilos.css` (acrescenta o layout)
- Test: `web/tests/catalogo.test.tsx`

**Interfaces:**
- Consumes: `Indice` (Task 1), `carregarIndice` (Task 6), `aplicar`/`Criterios`/`ordenacaoPermitida` (Task 7), `deHash`/`paraHash`/`CRITERIOS_VAZIOS` (Task 8), `ListaItens` (Task 9)
- Produces: `Catalogo({ indice }: { indice: Indice })`; `PainelFiltros({ indice, criterios, aoMudar })`

- [ ] **Step 1: Escrever o teste (vai falhar)**

`web/tests/catalogo.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Catalogo } from '../src/paginas/Catalogo.js';
import type { Indice, ItemCatalogo } from '@compartilhado/types';

function item(id: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo {
  return {
    id, plataforma: 'ms-learn', tipo: 'modulo', titulo: `Item ${id}`,
    resumo: null, url: `https://exemplo/${id}`, duracaoMinutos: 60,
    nivel: 'iniciante', temas: ['dados'], temasOriginais: [], instrutores: [],
    idioma: 'pt-BR', criadoEm: null, atualizadoEm: '2026-01-01', nota: null,
    escalaNota: null, popularidade: null, escalaPopularidade: null,
    ehCheckpoint: false, ...extra,
  };
}

const indice: Indice = {
  geradoEm: '2026-08-29T00:00:00Z',
  fontes: [{ plataforma: 'ms-learn', total: 3, coletadoEm: '2026-08-29' }],
  temas: [{ id: 'dados', nome: 'Dados' }, { id: 'seguranca', nome: 'Segurança' }],
  itens: [
    item('a', { titulo: 'Docker na prática', temas: ['dados'] }),
    item('b', { titulo: 'Segurança em nuvem', temas: ['seguranca'], tipo: 'trilha' }),
    item('c', { titulo: 'Power BI', temas: ['dados'] }),
  ],
};

beforeEach(() => { window.location.hash = ''; });

describe('Catalogo', () => {
  it('lista tudo ao abrir', () => {
    render(<Catalogo indice={indice} />);
    expect(screen.getByText('3 resultados')).toBeDefined();
  });

  it('filtra ao digitar na busca', async () => {
    render(<Catalogo indice={indice} />);
    await userEvent.type(screen.getByLabelText(/buscar/i), 'docker');
    expect(screen.getByText('1 resultado')).toBeDefined();
  });

  it('filtra ao marcar um tema', async () => {
    render(<Catalogo indice={indice} />);
    await userEvent.click(screen.getByLabelText('Segurança'));
    expect(screen.getByText('1 resultado')).toBeDefined();
  });

  it('escreve os criterios na URL', async () => {
    render(<Catalogo indice={indice} />);
    await userEvent.type(screen.getByLabelText(/buscar/i), 'power');
    expect(window.location.hash).toContain('q=power');
  });

  it('le os criterios da URL ao abrir', () => {
    window.location.hash = '#/?tipo=trilha';
    render(<Catalogo indice={indice} />);
    expect(screen.getByText('1 resultado')).toBeDefined();
  });

  it('limpa todos os filtros', async () => {
    render(<Catalogo indice={indice} />);
    await userEvent.type(screen.getByLabelText(/buscar/i), 'docker');
    await userEvent.click(screen.getByRole('button', { name: /limpar filtros/i }));
    expect(screen.getByText('3 resultados')).toBeDefined();
    expect(window.location.hash).toBe('#/');
  });

  it('explica por que ordenar por nota fica indisponivel com plataformas misturadas', () => {
    const misto: Indice = {
      ...indice,
      itens: [
        item('a', { nota: 4.8, escalaNota: 'ms-rating' }),
        item('b', { plataforma: 'alura', nota: 9.4, escalaNota: 'alura-nps' }),
      ],
    };
    window.location.hash = '#/?ordem=nota';
    render(<Catalogo indice={misto} />);
    expect(screen.getByText(/escalas diferentes/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rode: `npx vitest run web/tests/catalogo.test.tsx`
Esperado: FAIL — módulos não existem

- [ ] **Step 3: Implementar o painel de filtros**

`web/src/componentes/PainelFiltros.tsx`:

```tsx
import type { Indice, Nivel, TipoItem } from '@compartilhado/types';
import type { Criterios, Ordem } from '../filtros/filtros.js';
import { CRITERIOS_VAZIOS } from '../filtros/url.js';

const TIPOS: { id: TipoItem; nome: string }[] = [
  { id: 'curso', nome: 'Curso' },
  { id: 'modulo', nome: 'Módulo' },
  { id: 'trilha', nome: 'Trilha' },
  { id: 'certificacao', nome: 'Certificação' },
];

const NIVEIS: { id: Nivel; nome: string }[] = [
  { id: 'iniciante', nome: 'Iniciante' },
  { id: 'intermediario', nome: 'Intermediário' },
  { id: 'avancado', nome: 'Avançado' },
];

const ORDENS: { id: Ordem; nome: string }[] = [
  { id: 'titulo', nome: 'Título' },
  { id: 'duracao', nome: 'Duração' },
  { id: 'atualizacao', nome: 'Atualização' },
  { id: 'popularidade', nome: 'Popularidade' },
  { id: 'nota', nome: 'Nota' },
];

interface Props {
  indice: Indice;
  criterios: Criterios;
  notaPermitida: boolean;
  aoMudar: (c: Criterios) => void;
}

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

export function PainelFiltros({ indice, criterios, notaPermitida, aoMudar }: Props) {
  return (
    <aside className="filtros">
      <label className="campo">
        <span>Buscar</span>
        <input
          type="search"
          value={criterios.texto}
          placeholder="título ou resumo"
          onChange={(e) => aoMudar({ ...criterios, texto: e.target.value })}
        />
      </label>

      <fieldset>
        <legend>Tipo</legend>
        {TIPOS.map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              checked={criterios.tipos.includes(t.id)}
              onChange={() => aoMudar({ ...criterios, tipos: alternar(criterios.tipos, t.id) })}
            />
            {t.nome}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Tema</legend>
        {indice.temas.map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              checked={criterios.temas.includes(t.id)}
              onChange={() => aoMudar({ ...criterios, temas: alternar(criterios.temas, t.id) })}
            />
            {t.nome}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Nível</legend>
        {NIVEIS.map((n) => (
          <label key={n.id}>
            <input
              type="checkbox"
              checked={criterios.niveis.includes(n.id)}
              onChange={() => aoMudar({ ...criterios, niveis: alternar(criterios.niveis, n.id) })}
            />
            {n.nome}
          </label>
        ))}
      </fieldset>

      <label className="campo">
        <span>Duração máxima</span>
        <select
          value={criterios.duracaoMaxima ?? ''}
          onChange={(e) =>
            aoMudar({ ...criterios, duracaoMaxima: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">Qualquer</option>
          <option value="30">Até 30 min</option>
          <option value="60">Até 1 h</option>
          <option value="180">Até 3 h</option>
          <option value="600">Até 10 h</option>
        </select>
      </label>

      <label className="campo">
        <span>Ordenar por</span>
        <select
          value={criterios.ordem}
          onChange={(e) => aoMudar({ ...criterios, ordem: e.target.value as Ordem })}
        >
          {ORDENS.map((o) => (
            <option key={o.id} value={o.id} disabled={o.id === 'nota' && !notaPermitida}>
              {o.nome}
            </option>
          ))}
        </select>
      </label>

      {!notaPermitida && criterios.ordem === 'nota' && (
        <p className="aviso" role="status">
          Ordenar por nota exige uma única plataforma: Alura e Microsoft Learn usam
          escalas diferentes, e compará-las não significaria nada. Ordenando por título.
        </p>
      )}

      <button className="limpar" onClick={() => aoMudar(CRITERIOS_VAZIOS)}>
        Limpar filtros
      </button>
    </aside>
  );
}
```

- [ ] **Step 4: Implementar a página**

`web/src/paginas/Catalogo.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { Indice } from '@compartilhado/types';
import { aplicar, filtrar, buscar, ordenacaoPermitida } from '../filtros/filtros.js';
import { deHash, paraHash } from '../filtros/url.js';
import { PainelFiltros } from '../componentes/PainelFiltros.js';
import { ListaItens } from '../componentes/ListaItens.js';

export function Catalogo({ indice }: { indice: Indice }) {
  const [criterios, setCriterios] = useState(() => deHash(window.location.hash));

  // A URL e a fonte da verdade: o botao voltar e o recarregar precisam funcionar.
  useEffect(() => {
    const aoNavegar = () => setCriterios(deHash(window.location.hash));
    window.addEventListener('hashchange', aoNavegar);
    return () => window.removeEventListener('hashchange', aoNavegar);
  }, []);

  useEffect(() => {
    const novo = paraHash(criterios);
    if (novo !== (window.location.hash || '#/')) window.location.hash = novo;
  }, [criterios]);

  const resultados = useMemo(() => aplicar(indice.itens, criterios), [indice.itens, criterios]);

  // A permissao depende do conjunto filtrado, nao do catalogo inteiro.
  const notaPermitida = useMemo(
    () => ordenacaoPermitida(filtrar(buscar(indice.itens, criterios.texto), criterios), 'nota'),
    [indice.itens, criterios],
  );

  return (
    <div className="pagina">
      <PainelFiltros
        indice={indice}
        criterios={criterios}
        notaPermitida={notaPermitida}
        aoMudar={setCriterios}
      />
      <section className="resultados">
        <ListaItens itens={resultados} />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Ligar na App e acrescentar o layout**

Substitua o `return` final de `web/src/App.tsx` (o bloco que mostra "itens disponíveis") por:

```tsx
  return (
    <>
      <header className="topo">
        <h1>Catálogo de treinamentos</h1>
        <p>
          {indice.itens.length} itens · atualizado em{' '}
          {new Date(indice.geradoEm).toLocaleDateString('pt-BR')}
        </p>
      </header>
      <Catalogo indice={indice} />
    </>
  );
```

E acrescente o import no topo do arquivo:

```tsx
import { Catalogo } from './paginas/Catalogo.js';
```

Acrescente ao fim de `web/src/estilos.css`:

```css
.topo { padding: 1rem 1.5rem; border-bottom: 1px solid var(--borda); }
.topo h1 { margin: 0 0 .25rem; font-size: 1.25rem; }
.topo p { margin: 0; opacity: .7; font-size: .85rem; }

.pagina { display: grid; grid-template-columns: 260px 1fr; gap: 1.5rem; padding: 1.5rem; align-items: start; }
.filtros { position: sticky; top: 1.5rem; display: grid; gap: 1rem; }
.filtros fieldset { border: 1px solid var(--borda); border-radius: 8px; display: grid; gap: .25rem; }
.filtros label { display: flex; gap: .4rem; align-items: center; }
.campo { display: grid; gap: .25rem; }
.campo span { font-weight: 600; font-size: .85rem; }
.campo input, .campo select { padding: .4rem; width: 100%; }

.grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.cartao { border: 1px solid var(--borda); border-radius: 10px; padding: 1rem; }
.cartao h3 { margin: .5rem 0; font-size: 1rem; }
.cartao-selos { display: flex; gap: .4rem; flex-wrap: wrap; }
.selo { font-size: .7rem; text-transform: uppercase; letter-spacing: .04em; border: 1px solid var(--borda); border-radius: 999px; padding: .1rem .5rem; }
.cartao-resumo { font-size: .85rem; opacity: .8; margin: .5rem 0; }
.cartao-meta { display: flex; gap: 1rem; flex-wrap: wrap; margin: 0; font-size: .8rem; }
.cartao-meta dt { opacity: .6; }
.cartao-meta dd { margin: 0; font-weight: 600; }

.contador { opacity: .7; font-size: .85rem; }
.mostrar-mais { margin: 1.5rem auto 0; display: block; padding: .6rem 1.2rem; }
.aviso { font-size: .8rem; border-left: 3px solid currentColor; padding-left: .6rem; opacity: .8; }
.vazio { opacity: .7; }

@media (max-width: 760px) {
  .pagina { grid-template-columns: 1fr; }
  .filtros { position: static; }
}
```

- [ ] **Step 6: Rodar a suíte inteira**

Rode: `npm test`
Esperado: PASS em todos os arquivos — 7 + 5 + 17 + 5 + 3 + 3 + 20 + 8 + 9 + 7 = 84 testes.

- [ ] **Step 7: Conferir no navegador**

Rode: `npm run dev`

Confira, com o catálogo real de 4.667 itens:
1. A lista abre mostrando 60 cartões e o total correto
2. Buscar "azure" reduz os resultados e a URL ganha `q=azure`
3. Marcar um tema, recarregar a página (F5) e ver o filtro preservado
4. O botão voltar do navegador desfaz o último filtro
5. "Mostrar mais" acrescenta 60 itens
6. Em janela estreita, o painel de filtros vai para cima da lista

- [ ] **Step 8: Conferir o build de produção**

```bash
npm run build && npm run preview
```
Esperado: build sem erro, e `dist/index.json` presente (o `publicDir` copiou os dados).

- [ ] **Step 9: Commit**

```bash
git add web/
git commit -m "Adiciona painel de filtros e pagina do catalogo"
```

---

## Encerramento do Plano 1

Ao fim da Task 10 existe um catálogo funcionando de ponta a ponta: 4.667 itens do Microsoft Learn em português, buscáveis, filtráveis por tipo, tema, nível e duração, com estado na URL e dados versionados no git.

**O que fica para os planos seguintes:**

- **Plano 2** — Alura como segunda fonte: cliente com throttle e cache em disco, normalizador, `busca.json` com as ementas, isolamento de falha por fonte, página de detalhe.
- **Plano 3** — Minha Lista com exportar/importar, Radar de novidades (diff de snapshots), GitHub Action semanal e publicação no GitHub Pages.

**Uma decisão deixada em aberto de propósito:** se a coleta real reportar rótulos sem tema em `relatorio.json`, ampliar o mapa é uma escolha humana, não uma correção automática. Revise a lista antes de mexer em `shared/src/temas.ts`.
