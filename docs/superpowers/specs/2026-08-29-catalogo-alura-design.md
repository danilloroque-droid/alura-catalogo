# Catálogo de Treinamentos Alura — Design

**Data:** 2026-08-29
**Status:** aprovado, pronto para virar plano de implementação

## 1. Objetivo

Um site pessoal que mostra **todos os cursos disponíveis agora na plataforma Alura**, com busca e filtros ricos, para decidir o que estudar em seguida. Uso individual, acessível do PC e do celular.

Não é um produto público, não tem usuários além do autor, não precisa de SEO, autenticação ou escala.

## 2. O que a API da Alura realmente entrega

Verificado por sondagem direta em 2026-08-29. A documentação oficial é incompleta; o que vale é o comportamento observado.

| Endpoint | Comportamento real |
|---|---|
| `GET /api/cursos` | 2.309 cursos. **Apenas 3 campos:** `slug`, `nome`, `tempo_estimado`. 312 KB, `Cache-Control: public, max-age=7200` |
| `GET /api/curso-<slug>` | ~23 KB por curso: `categoria`, `subcategoria`, `nota`, `quantidade_alunos`, `carga_horaria`, `quantidade_aulas`, `minutos_video`, `ementa`, `instrutores`, `publico_alvo`, `requerimentos`, `data_criacao`, `data_atualizacao`, `video_1a_aula`, `showable`, `curso_substituto` |

**Achados que moldam o design:**

- **Os filtros documentados não funcionam.** `?categoria=` e `?subcategoria=` são ignorados — a resposta volta idêntica (mesmos 2.309 itens, mesmo tamanho). A taxonomia só existe dentro do detalhe de cada curso.
- **Não existem endpoints de listagem auxiliares.** `/api/categorias`, `/api/formacoes` e `/api/cursos/<categoria>` retornam 404. `/api/formacao-data-science`, citado na documentação, também retorna 404.
- **Sem autenticação e sem token.** `access-control-allow-origin: *` — chamável direto do navegador, sem proxy.
- **`video_1a_aula` é uma URL assinada com expiração de 7 dias** (`X-Amz-Expires=604800`). Não pode ser cacheada por mais tempo que isso.
- **O `/api/cursos` já lista apenas cursos ativos.** Na amostra de 12 cursos, todos vieram com `showable: true` e `curso_substituto: null`. O coletor valida essa premissa em vez de assumi-la.

**Volume de dados medido** (amostra de 12 cursos, extrapolada para 2.309):

| Conjunto | Tamanho |
|---|---|
| Detalhes brutos completos | 50,9 MB |
| Índice enxuto (sem ementa) | 0,6 MB |
| Índice + texto da ementa para busca | **1,6 MB** (~400 KB com gzip) |

Consequência direta: **um índice único de 1,6 MB carrega de uma vez e permite busca, filtro e ordenação inteiramente em memória**, sem paginação e sem backend. Os detalhes ficam em arquivos separados, buscados sob demanda.

## 3. Arquitetura

```
API Alura ──▶ coletor (Node+TS) ──▶ dados/ versionados no git ──▶ site React ──▶ GitHub Pages
             (1x/semana via CI)      (índice, detalhes, snapshots)  (100% no navegador)
```

**Princípio central:** só o coletor conhece o JSON cru da Alura. Ele normaliza para os tipos de `shared/types.ts`, e o site enxerga exclusivamente esses tipos. Uma mudança na API se conserta em um arquivo de normalização, sem tocar no site.

```
alura-catalogo/
├─ shared/types.ts          # contrato entre as duas metades
├─ collector/
│  ├─ src/
│  │  ├─ alura-client.ts    # HTTP puro: listar(), detalhe(slug), retry, throttle
│  │  ├─ normalize.ts       # JSON cru ──▶ tipos do domínio
│  │  ├─ build-index.ts     # monta index.json determinístico
│  │  ├─ diff-snapshots.ts  # compara snapshots ──▶ novidades.json
│  │  └─ main.ts            # orquestra
│  ├─ fixtures/             # respostas reais gravadas, usadas nos testes
│  └─ tests/
├─ web/                     # React + Vite + TypeScript
│  ├─ src/
│  │  ├─ dados/             # carrega índice e detalhes
│  │  ├─ filtros/           # lógica pura de busca/filtro/ordenação
│  │  ├─ minha-lista/       # localStorage + exportar/importar
│  │  ├─ paginas/           # Catalogo, Curso, Radar, MinhaLista
│  │  └─ componentes/
│  └─ tests/
└─ dados/                   # SAÍDA, versionada no git
   ├─ index.json
   ├─ cursos/<slug>.json
   ├─ snapshots/AAAA-MM-DD.json
   └─ novidades.json
```

**Por que os dados ficam no git.** Um catálogo pessoal não justifica banco de dados. Commitar dá histórico, diff e rollback de graça, e o Radar de novidades vira uma comparação entre dois arquivos em vez de uma feature de infraestrutura.

**Por que índice único, não paginado.** 1,6 MB baixa uma vez e todo filtro subsequente é instantâneo, sem rede. Paginar adicionaria complexidade e pioraria a experiência.

**Por que os detalhes ficam separados.** Juntar tudo significaria 51 MB no carregamento inicial para dados que só são vistos ao abrir um curso específico.

## 4. Contrato de tipos (`shared/types.ts`)

```ts
export interface CursoIndice {
  slug: string;
  nome: string;
  categoria: string | null;          // slug, ex.: "back-end"
  categoriaNome: string | null;      // ex.: "Back-end"
  subcategoria: string | null;       // ex.: "csharp-dotnet"
  subcategoriaNome: string | null;   // ex.: "C# e .NET"
  cargaHoraria: number;              // horas
  quantidadeAulas: number;
  minutosVideo: number;
  nota: number | null;               // null quando nota_disponivel = false
  quantidadeAvaliacoes: number;
  quantidadeAlunos: number;
  dataCriacao: string;               // AAAA-MM-DD
  dataAtualizacao: string;           // AAAA-MM-DD
  instrutores: string[];             // nomes achatados
  ementaTexto: string;               // capítulos + seções, só para busca
  ehCheckpoint: boolean;
}

export interface Capitulo {
  capitulo: string;
  secoes: string[];
}

export interface Instrutor {
  nome: string;
  username: string;
  fotoUrl: string | null;
}

export interface CursoDetalhe extends CursoIndice {
  metaDescription: string | null;
  publicoAlvo: string[];
  requerimentos: string[];
  ementa: Capitulo[];
  instrutoresDetalhe: Instrutor[];
  videoPrimeiraAula: string | null;
  videoColetadoEm: string;           // ISO — o site usa para saber se expirou
}

export type TipoNovidade = 'novo' | 'removido' | 'atualizado';

export interface Novidade {
  slug: string;
  nome: string;
  tipo: TipoNovidade;
  detectadoEm: string;               // AAAA-MM-DD
}

export interface Taxonomia {
  slug: string;
  nome: string;
  subcategorias: { slug: string; nome: string }[];
}

export interface Indice {
  geradoEm: string;                  // ISO
  totalCursos: number;
  taxonomia: Taxonomia[];
  cursos: CursoIndice[];
}
```

As contagens por categoria **não** são pré-calculadas: mudam conforme os filtros ativos, então o site as calcula em memória.

## 5. Coletor

Responsabilidade única: transformar a API caótica da Alura em arquivos limpos e determinísticos.

### 5.1 `alura-client.ts` — só HTTP

- Concorrência fixa de **4 requisições simultâneas**
- Timeout de **15 s** por requisição
- **3 tentativas** com backoff exponencial
- `User-Agent` identificável, informando que é um catálogo pessoal
- Varredura completa estimada em **5 a 10 minutos** — devagar de propósito, por se tratar de API gratuita de terceiros

**Cache em disco** (`.cache/`, fora do git): cada detalhe baixado é gravado antes de ser processado. Uma coleta interrompida no curso 1.800 reaproveita os 1.799 anteriores. Isso também permite iterar no normalizador sobre dados locais, sem tocar na rede.

Não há coleta incremental: o `/api/cursos` não expõe `data_atualizacao`, então não há como saber o que mudou sem baixar o detalhe. Uma varredura completa semanal de 5–10 min é aceitável e mais simples.

### 5.2 `normalize.ts` — o único lugar que conhece o formato da Alura

Decisões explícitas e testadas:

- Descartar cursos com `showable: false` ou `curso_substituto` preenchido — não estão mais disponíveis
- `nota` vira `null` quando `nota_disponivel` é falso, nunca zero
- `instrutores` achatado para nomes no índice; objeto completo apenas no detalhe
- `categoria: null` tratado sem quebrar; o curso aparece como "sem categoria"
- Cursos do tipo *checkpoint* (avaliações, não aulas) marcados com `ehCheckpoint: true` para poderem ser escondidos. **Regra de detecção:** `slug` começando com `checkpoint-` (ex.: `checkpoint-back-end-php-nivel-1`). A regra é validada por fixture; se a coleta encontrar cursos com "checkpoint" no nome mas fora desse padrão, eles entram no relatório para revisão manual — a regra nunca é ampliada em silêncio
- `ementaTexto` = capítulos e seções concatenados, apenas para alimentar a busca

### 5.3 `build-index.ts` — serialização determinística

Chaves em ordem fixa e arrays ordenados por slug. Sem isso, cada coleta produziria um diff enorme e inútil no git e a comparação de snapshots viraria ruído.

### 5.4 `diff-snapshots.ts`

Compara o snapshot novo com o anterior e classifica cada mudança:

- **novo** — slug ausente no snapshot anterior
- **removido** — slug ausente no snapshot novo
- **atualizado** — `dataAtualizacao` mudou

O Radar de novidades só produz resultado a partir da **segunda** coleta; a primeira estabelece a linha de base.

### 5.5 Regra de segurança

**Se mais de 5% dos detalhes falharem, o coletor aborta sem escrever em `dados/`.** Um catálogo de uma semana atrás é melhor que um catálogo pela metade publicado por cima do bom.

Ao final, o coletor imprime um relatório: total coletado, descartados (com motivo), falhas e tempo.

## 6. App web

### 6.1 Rotas

Roteamento **por hash** (`/#/curso/<slug>`), porque o GitHub Pages devolve 404 em rotas de SPA e o contorno com `404.html` não se justifica aqui.

- `#/` — Catálogo
- `#/curso/:slug` — Detalhe
- `#/novidades` — Radar
- `#/lista` — Minha Lista

### 6.2 Camadas

**`filtros/`** — o coração, sem nenhuma dependência de React. Funções puras: `buscar(cursos, texto)`, `filtrar(cursos, criterios)`, `ordenar(cursos, campo)`. Com 2.309 itens em memória, o filtro linear roda em ~1 ms; não há necessidade de Fuse.js nem de índice invertido. A busca normaliza acentos e caixa, e varre `nome` + `ementaTexto`.

**`dados/`** — carrega `index.json` uma vez e mantém em memória; detalhes buscados sob demanda.

**`minha-lista/`** — localStorage guardando **apenas slug + estado + data**, nunca os dados do curso, para que a lista continue válida após atualizações do catálogo. Exportar/importar JSON resolve a transferência entre PC e celular.

### 6.3 Estado dos filtros na URL

`#/?q=docker&cat=back-end&nota=9&ordem=alunos`

O botão voltar funciona, buscas úteis podem ser favoritadas e recarregar a página não perde nada.

### 6.4 Filtros disponíveis

Texto livre; categoria; subcategoria; nota mínima; faixa de carga horária; instrutor; esconder checkpoints. Ordenação por nota, número de alunos, carga horária ou data de atualização.

### 6.5 Layout

Painel de filtros fixo à esquerda, virando gaveta no celular; grade de cards à direita com contador de resultados sempre visível. **60 cards renderizados por vez, com "mostrar mais"** — 2.309 nós no DOM travam o navegador, e esta solução é mais simples que virtualização.

Cada card: nome, categoria, carga horária, nota, número de alunos, marcador da Minha Lista e selo de novo/atualizado quando aplicável.

Página do curso: metadados no topo, ementa em acordeão de capítulos, instrutores, público-alvo, requerimentos e link para a Alura. O vídeo da 1ª aula é exibido apenas se `videoColetadoEm` tiver menos de 7 dias.

## 7. Tratamento de erros

| Situação | Comportamento |
|---|---|
| >5% dos detalhes falham na coleta | Aborta sem escrever em `dados/`; catálogo anterior preservado |
| Curso descartado na normalização | Registrado no relatório com o motivo; nunca some em silêncio |
| `index.json` não carrega | Tela de erro com botão "tentar de novo" |
| Detalhe do curso dá 404 | "Este curso pode ter saído do catálogo" + link para a Alura |
| localStorage bloqueado (aba anônima) | App funciona; Minha Lista desativada com aviso visível |
| URL do vídeo expirada | Player ocultado; link para a Alura permanece |
| `novidades.json` ausente (1ª coleta) | Radar explica que a linha de base foi estabelecida |

## 8. Testes

Vitest nos dois lados. **Nenhum teste toca a rede.**

As fixtures são respostas reais gravadas da API, incluindo casos difíceis escolhidos deliberadamente: `nota_disponivel: false`, `categoria: null`, checkpoint, curso substituído, curso sem instrutores.

Cobertura unitária obrigatória em `normalize`, `build-index` (determinismo), `diff-snapshots`, `filtros` e `minha-lista`. Testes de componente apenas no fluxo principal do catálogo: buscar, filtrar, abrir curso.

Desenvolvimento por TDD — teste antes da implementação.

## 9. Ordem de entrega

1. Contrato de tipos + coletor com cache em disco → `dados/` gerado localmente
2. Índice e snapshot determinísticos
3. **Catálogo com busca, filtros, ordenação e estado na URL** ← já utilizável de verdade
4. Página de detalhe do curso
5. Minha Lista + exportar/importar
6. Radar de novidades
7. GitHub Action semanal + publicação no GitHub Pages

Do passo 3 em diante cada etapa é independente: interromper em qualquer ponto deixa um produto funcional.

## 10. Fora de escopo

Deliberadamente excluídos, por não servirem a um catálogo pessoal:

- Autenticação, contas, multiusuário
- Backend, banco de dados, API própria
- SEO, renderização no servidor, geração estática por curso
- Formações e trilhas da Alura — a API não oferece endpoint de listagem funcional
- Sincronização da Minha Lista entre dispositivos (resolvida por exportar/importar)
- Busca difusa e ranqueamento por relevância — substring simples basta em 2.309 itens
- Modo offline / PWA

## 11. Riscos e premissas

- **A API pode mudar sem aviso.** Não é versionada nem contratualmente estável. Mitigação: toda a exposição está em `normalize.ts`, e as fixtures detectam regressões.
- **Não há limite de requisições documentado.** Mitigação: concorrência 4, backoff, frequência semanal, `User-Agent` identificável.
- **Uso responsável.** Consumo pessoal, semanal, de uma API que a Alura documenta publicamente, com link de retorno para o site deles em cada curso. Se a Alura sinalizar objeção, o projeto para.
- **`/api/cursos` como fonte de "disponível agora"** é premissa validada em amostra de 12 cursos, não em toda a base. O coletor registra qualquer curso listado que venha com `showable: false`, para revisão.
