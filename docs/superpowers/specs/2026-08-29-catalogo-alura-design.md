# Catálogo de Treinamentos Multi-Fonte — Design

**Data:** 2026-08-29
**Status:** aprovado, pronto para virar plano de implementação
**Fontes na v1:** Microsoft Learn e Alura

## 1. Objetivo

Um site pessoal que reúne, num catálogo único e pesquisável, **os treinamentos disponíveis agora** em mais de uma plataforma, para decidir o que estudar em seguida. Uso individual, acessível do PC e do celular.

Não é um produto público, não tem usuários além do autor, não precisa de SEO, autenticação ou escala.

## 2. Escolha das fontes

Quatro APIs foram sondadas diretamente em 2026-08-29. A comparação abaixo é comportamento medido, não documentação.

| | **Microsoft Learn** | **Alura** | **Coursera** | **edX** |
|---|---|---|---|---|
| Autenticação | não | não | não | catálogo real exige JWT |
| Requisições para o catálogo inteiro | **1** | **2.309** | 119 | 380 |
| Itens catalogáveis | 4.667 | 2.309 | 23.776 | 37.905 (muito curso de teste) |
| Taxonomia pronta na API | ✅ completa e traduzida | ❌ só dentro do detalhe | parcial (`domainTypes`) | ❌ |
| Português | ✅ nativo | ✅ 100% | ~0% na amostra | ❌ |
| CORS liberado | ✅ `*` | ✅ `*` | ❌ | ❌ |
| Documentação confiável | ✅ oficial e estável | ❌ descreve filtros inexistentes | beta, "muda sem aviso" | oficial |
| Licença para republicar | Microsoft APIs Terms of Use | não declarada | ❌ proibido republicar descrições | — |

**Escolhidas: Microsoft Learn e Alura.**

**Coursera foi descartada** apesar do volume: a própria documentação declara que a API é beta e pode mudar de forma incompatível sem aviso, e que os direitos das descrições pertencem às universidades parceiras, sem licença para republicação. Num site publicado, isso é um risco jurídico real por um catálogo majoritariamente em inglês e sem nenhuma métrica de qualidade.

**edX foi descartada** porque o endpoint público é o da LMS, não o de catálogo: devolve 37.905 objetos incluindo cursos de teste e turmas privadas, sem assunto, sem nota e sem idioma utilizável. O catálogo curado exige autenticação JWT.

## 3. O que cada API entrega

### 3.1 Microsoft Learn

`GET https://learn.microsoft.com/api/catalog/?locale=pt-br&type=modules,learningPaths,courses,certifications,levels,products,roles,subjects`

**Uma única requisição devolve o catálogo inteiro:** 7,55 MB, `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=86399`.

| Coleção | Quantidade |
|---|---|
| `modules` | 3.524 |
| `learningPaths` | 849 |
| `courses` | 143 |
| `certifications` | 151 |
| **Total catalogável** | **4.667** |

Taxonomia entregue pronta e traduzida: 6 `subjects` com subníveis (76 distintos em uso), 60 `products`, 35 `roles`, 3 `levels`. Locales confirmados: `pt-br`, `en-us`, `es-es`.

As 28.466 `units` (conteúdo interno de cada módulo) são **descartadas** — irrelevantes para um catálogo e responsáveis por metade do payload.

**Os quatro tipos não compartilham o mesmo formato.** Esta tabela é o contrato real, verificado campo a campo, e é o que o normalizador precisa tratar:

| | `modules` | `learningPaths` | `courses` | `certifications` |
|---|---|---|---|---|
| Texto descritivo | `summary`, texto puro | `summary`, texto puro | `summary`, **contém HTML** | `subtitle`, **contém HTML** |
| Duração | `duration_in_minutes` | `duration_in_minutes` | **`duration_in_hours`** | ausente |
| `subjects` | 2.796 de 3.524 | 718 de 849 | **nenhum** | **nenhum** |
| `roles` | 3.524 (100%) | 849 (100%) | 143 (100%) | 151 (100%) |
| `products` | 3.524 | 849 | 143 | **ausente** |
| `popularity` | 3.424 de 3.524 | presente | ausente | ausente |
| `rating` | ausente | `{count, average}` | ausente | ausente |

Consequências diretas para o normalizador:

- **A taxonomia não pode se apoiar em `subjects`:** cursos e certificações não têm nenhum. A precedência é `subjects` → `roles` → `products`, e só `roles` tem cobertura de 100% em todos os tipos.
- **Descrições precisam de remoção de HTML** em cursos e certificações.
- **`duration_in_hours` × 60** nos cursos, para unificar em minutos.
- **`last_modified` é ISO completo com fuso** (`2026-08-27T22:13:00+00:00`), truncado para `AAAA-MM-DD`.
- **`rating` é praticamente inexistente:** apenas **1 das 849 trilhas** tem `count > 0`. Na prática, itens do Microsoft Learn não têm nota, e ordenar por nota é um recurso quase exclusivo da Alura. Isso reforça, e não enfraquece, a decisão da seção 5.1.

### 3.2 Alura

| Endpoint | Comportamento real |
|---|---|
| `GET /api/cursos` | 2.309 cursos, **apenas** `slug`, `nome`, `tempo_estimado`. 312 KB, `Cache-Control: max-age=7200` |
| `GET /api/curso-<slug>` | ~23 KB: `categoria`, `subcategoria`, `nota`, `quantidade_alunos`, `carga_horaria`, `quantidade_aulas`, `minutos_video`, `ementa`, `instrutores`, `publico_alvo`, `requerimentos`, `data_criacao`, `data_atualizacao`, `video_1a_aula`, `showable`, `curso_substituto` |

Achados que moldam o coletor:

- **Os filtros documentados não funcionam.** `?categoria=` e `?subcategoria=` são ignorados — resposta idêntica, mesmo tamanho.
- **Não há endpoints auxiliares.** `/api/categorias`, `/api/formacoes` e `/api/cursos/<categoria>` retornam 404. `/api/formacao-data-science`, citado na documentação oficial, também retorna 404.
- **A taxonomia só existe dentro do detalhe de cada curso** — daí as 2.309 requisições.
- **`video_1a_aula` é URL assinada com expiração de 7 dias** (`X-Amz-Expires=604800`).
- **`/api/cursos` já lista apenas cursos ativos.** Em amostra de 12, todos com `showable: true` e `curso_substituto: null`. O coletor valida em vez de assumir.
- Detalhes brutos completos somam 50,9 MB.

## 4. Arquitetura

```
Microsoft Learn ─┐
                 ├─▶ coletor (Node+TS) ──▶ dados/ no git ──▶ site React ──▶ GitHub Pages
Alura ───────────┘    (1x/semana via CI)   (índice, busca,    (100% no navegador)
                                            detalhes, snapshots)
```

**Princípio central:** cada fonte tem seu próprio normalizador, e só ele conhece o formato cru daquela plataforma. Tudo converge para os tipos de `shared/types.ts`, e o site enxerga exclusivamente esses tipos. Somar ou trocar uma plataforma é escrever um normalizador — o site fica intocado.

```
catalogo-treinamentos/
├─ shared/
│  ├─ types.ts             # contrato único entre coletor e site
│  └─ temas.ts             # mapa de taxonomia por plataforma
├─ collector/
│  ├─ src/
│  │  ├─ fontes/
│  │  │  ├─ ms-learn/      # client.ts, normalize.ts
│  │  │  └─ alura/         # client.ts, normalize.ts
│  │  ├─ build-index.ts    # índice determinístico + arquivo de busca
│  │  ├─ diff-snapshots.ts # novidades.json
│  │  └─ main.ts           # orquestra as fontes, tolera falha isolada
│  ├─ fixtures/            # respostas reais gravadas, usadas nos testes
│  └─ tests/
├─ web/                    # React + Vite + TypeScript
│  ├─ src/
│  │  ├─ dados/            # carrega índice, busca e detalhes
│  │  ├─ filtros/          # lógica pura de busca/filtro/ordenação
│  │  ├─ minha-lista/      # localStorage + exportar/importar
│  │  ├─ paginas/          # Catalogo, Item, Radar, MinhaLista
│  │  └─ componentes/
│  └─ tests/
├─ dados/                  # SAÍDA publicada pelo site, versionada no git
│  ├─ index.json           # 4,4 MB — exibição e filtros
│  ├─ busca.json           # texto de busca, carregado em segundo plano
│  ├─ detalhes/alura/<slug>.json
│  ├─ novidades.json
│  └─ relatorio.json       # o que foi coletado, descartado e por quê
└─ snapshots/              # histórico para o Radar, FORA do publicDir
   └─ AAAA-MM-DD.json
```

**Por que os snapshots ficam fora de `dados/`.** `dados/` é o `publicDir` do Vite, que copia a pasta inteira para o `dist` sem opção de exclusão. Snapshot guardado ali dentro entraria no deploy a cada build — megabytes por coleta de um arquivo que o site nunca lê — e o custo cresceria a cada semana do Radar. Na raiz, o histórico continua versionado no git e o deploy leva só o que o site usa.

**Por que os dados ficam no git.** Um catálogo pessoal não justifica banco de dados. Commitar dá histórico, diff e rollback de graça, e o Radar de novidades vira a comparação de dois arquivos em vez de uma feature de infraestrutura.

**Por que só a Alura tem arquivos de detalhe.** O catálogo do Microsoft Learn já vem completo na resposta única — não existe endpoint de detalhe nem necessidade dele. A Alura, ao contrário, guarda ementa, instrutores e requisitos apenas no detalhe de cada curso.

## 5. Contrato de tipos (`shared/types.ts`)

```ts
export type Plataforma = 'ms-learn' | 'alura';
export type TipoItem = 'curso' | 'modulo' | 'trilha' | 'certificacao';
export type Nivel = 'iniciante' | 'intermediario' | 'avancado';

// A escala acompanha o valor: notas de plataformas diferentes NÃO são comparáveis.
export type EscalaNota = 'alura-nps' | 'ms-rating';
export type EscalaPopularidade = 'alura-alunos' | 'ms-popularity';

export interface ItemCatalogo {
  id: string;                    // `${plataforma}:${slug|uid}`
  plataforma: Plataforma;
  tipo: TipoItem;
  titulo: string;
  resumo: string | null;         // texto puro, sem HTML
  url: string;                   // link para a plataforma de origem
  duracaoMinutos: number | null;
  nivel: Nivel | null;
  temas: string[];               // taxonomia unificada
  temasOriginais: string[];      // rótulos crus da plataforma, preservados
  instrutores: string[];         // sempre vazio no Microsoft Learn
  idioma: string;                // 'pt-BR'
  criadoEm: string | null;       // AAAA-MM-DD
  atualizadoEm: string | null;   // AAAA-MM-DD
  nota: number | null;
  escalaNota: EscalaNota | null;
  popularidade: number | null;
  escalaPopularidade: EscalaPopularidade | null;
  ehCheckpoint: boolean;         // só Alura; sempre false no MS Learn
}

export interface Indice {
  geradoEm: string;              // ISO
  fontes: { plataforma: Plataforma; total: number; coletadoEm: string }[];
  temas: { id: string; nome: string }[];
  itens: ItemCatalogo[];
}

// Arquivo separado, carregado em segundo plano.
export interface EntradaBusca {
  id: string;
  texto: string;                 // título + resumo + ementa, sem acento, minúsculo
}

export interface Capitulo { capitulo: string; secoes: string[] }
export interface Instrutor { nome: string; username: string; fotoUrl: string | null }

// Detalhe existe apenas para a Alura; discriminado por `plataforma`.
export interface DetalheAlura extends ItemCatalogo {
  plataforma: 'alura';
  metaDescription: string | null;
  publicoAlvo: string[];
  requerimentos: string[];
  ementa: Capitulo[];
  instrutoresDetalhe: Instrutor[];
  quantidadeAulas: number;
  quantidadeAvaliacoes: number;
  videoPrimeiraAula: string | null;
  videoColetadoEm: string;       // ISO — o site usa para saber se expirou
}

export type TipoNovidade = 'novo' | 'removido' | 'atualizado';
export interface Novidade {
  id: string;
  titulo: string;
  plataforma: Plataforma;
  tipo: TipoNovidade;
  detectadoEm: string;           // AAAA-MM-DD
}
```

### 5.1 Notas não são comparáveis entre plataformas

Esta é a decisão de modelagem mais importante do documento.

A Alura publica **nota NPS de 0 a 10 apoiada em milhares de avaliações** (`nota: 9.4`, `quantidade_avaliacoes: 5826`). O Microsoft Learn publica um `popularity` interno de 0 a 1, e `rating` apenas nas trilhas. São grandezas de natureza diferente, com amostras e significados diferentes.

Fundir as duas numa coluna "nota" produziria um ranking bonito e falso. Portanto:

- O valor sempre viaja acompanhado da sua escala (`nota` + `escalaNota`)
- A interface renderiza cada escala no seu próprio idioma visual, nunca convertida
- **Ordenar por nota opera dentro de uma plataforma.** Com o filtro abrangendo as duas, a ordenação por nota fica desabilitada e a interface explica o motivo em uma linha

Uma fricção honesta é preferível a um número inventado.

## 6. Taxonomia unificada (`shared/temas.ts`)

Alura organiza em `back-end`, `front-end`, `dados`, `design-ux`, `inteligencia-artificial`, `gestao-negocios`. Microsoft Learn organiza em `app-development`, `data-management`, `infrastructure`, `artificial-intelligence`, `security`, `business-applications`.

Um mapa escrito à mão converte ambos para este conjunto de temas unificados:

`back-end`, `front-end`, `mobile`, `dados`, `inteligencia-artificial`, `infraestrutura-nuvem`, `devops`, `seguranca`, `design-ux`, `gestao-negocios`, `produtividade`, `outros`.

Doze temas é deliberado: poucos o bastante para caber num painel de filtros sem rolagem, específicos o bastante para separar o que de fato se procura. O mapa é a única peça do sistema que precisa de julgamento humano — todo o resto é derivado dos dados.

Três regras o mantêm confiável:

- **Precedência explícita de rótulos:** `subjects` → `roles` → `products`. Cursos e certificações do Microsoft Learn não têm `subjects` nenhum, e `roles` é o único rótulo com cobertura de 100% em todos os tipos — apoiar a taxonomia só em `subjects` deixaria 294 itens sem tema.
- **Nada se perde:** cada item também guarda `temasOriginais` com os rótulos crus, permitindo filtrar do jeito nativo de cada plataforma
- **Nada é descartado em silêncio:** rótulo sem mapeamento cai no tema `outros` **e** entra em `relatorio.json`, para revisão manual e ampliação consciente do mapa

## 7. Coletores

### 7.1 Microsoft Learn

Uma requisição, sem throttling, sem cache de rede. Descarta `units`. Normaliza `levels[0]` para `Nivel`, concatena `subjects` + `roles` + `products` em `temasOriginais`, mapeia `duration_in_minutes` direto e usa `last_modified` como `atualizadoEm`.

`popularity` vira `popularidade` com escala `ms-popularity`; `rating` das trilhas vira `nota` com escala `ms-rating`. Módulos e cursos ficam com `nota: null`.

### 7.2 Alura

**`client.ts` — só HTTP.** Concorrência fixa de 4 requisições simultâneas, timeout de 15 s, 3 tentativas com backoff exponencial, `User-Agent` identificável. Varredura completa estimada em **5 a 10 minutos** — devagar de propósito, por se tratar de API gratuita de terceiros.

**Cache em disco** (`.cache/`, fora do git): cada detalhe é gravado antes de ser processado. Coleta interrompida no curso 1.800 reaproveita os 1.799 anteriores, e o normalizador pode ser desenvolvido inteiramente sobre dados locais, sem tocar a rede.

Sem coleta incremental: `/api/cursos` não expõe `data_atualizacao`, então não há como saber o que mudou sem baixar o detalhe. Varredura completa semanal é aceitável e mais simples.

**`normalize.ts` — decisões explícitas e testadas:**

- Descartar cursos com `showable: false` ou `curso_substituto` preenchido — não estão mais disponíveis
- `nota` vira `null` quando `nota_disponivel` é falso, nunca zero
- `quantidade_alunos` vira `popularidade` com escala `alura-alunos`
- `carga_horaria` (horas) convertida para `duracaoMinutos`
- `categoria: null` não quebra; o item recebe o tema `outros`
- Checkpoints marcados com `ehCheckpoint: true`. **Regra de detecção:** `slug` começando com `checkpoint-` (ex.: `checkpoint-back-end-php-nivel-1`), validada por fixture. Cursos com "checkpoint" no nome fora desse padrão entram no relatório — a regra nunca é ampliada em silêncio
- A Alura não expõe nível de dificuldade: `nivel` fica `null`

### 7.3 Orquestração e isolamento de falhas

`main.ts` roda as fontes de forma independente. **A regra de segurança vale por fonte:**

- Microsoft Learn: se a requisição única falhar após as tentativas, a fonte é considerada falha
- Alura: se mais de 5% dos detalhes falharem, a fonte é considerada falha

**Uma fonte falha preserva os dados da coleta anterior; as demais atualizam normalmente.** O índice é reconstruído combinando dados novos e preservados, e `relatorio.json` registra qual fonte está desatualizada e desde quando. Uma API quebrada nunca derruba o catálogo inteiro nem publica um catálogo pela metade.

### 7.4 Determinismo

Chaves em ordem fixa e itens ordenados por `id`. Sem isso, cada coleta produziria um diff enorme e inútil no git e a comparação de snapshots viraria ruído.

### 7.5 Novidades

`diff-snapshots.ts` compara o snapshot novo com o anterior por `id`:

- **novo** — ausente no snapshot anterior
- **removido** — ausente no snapshot novo
- **atualizado** — `atualizadoEm` mudou

O Radar só produz resultado a partir da **segunda** coleta; a primeira estabelece a linha de base.

## 8. Índice e carregamento

`resumo` vive no `index.json`, não num arquivo separado: itens do Microsoft Learn não têm arquivo de detalhe, então o resumo é dado de exibição obrigatório. Isso tem uma consequência boa — **a busca por título e resumo funciona assim que o índice chega**, sem esperar mais nada.

| Arquivo | Conteúdo | Tamanho |
|---|---|---|
| `index.json` | exibição, filtros, título e resumo | 4,4 MB medidos só com Microsoft Learn (4.667 itens); ~5,3 MB com a Alura |
| `busca.json` | **apenas o texto extra**: capítulos e seções da ementa da Alura | ~1,0 MB, e **inexistente enquanto a Alura não entrar** |

**Carregamento em duas etapas.** `index.json` chega e o catálogo funciona por completo, incluindo busca textual em títulos e resumos. `busca.json` carrega em segundo plano e **aprofunda** a busca, passando a alcançar o conteúdo das aulas da Alura. Enquanto não chegou, a busca funciona — apenas mais rasa —, e a interface indica discretamente que a busca em ementas ainda está carregando.

Essa divisão é melhor que a alternativa óbvia (jogar todo o texto de busca no segundo arquivo): ali a busca ficaria *desabilitada* até o segundo download. Aqui ela nunca fica indisponível, só fica mais rica com o tempo.

## 9. App web

### 9.1 Rotas

Roteamento **por hash** (`/#/item/<id>`), porque o GitHub Pages devolve 404 em rotas de SPA e o contorno com `404.html` não se justifica aqui.

- `#/` — Catálogo
- `#/item/:id` — Detalhe
- `#/novidades` — Radar
- `#/lista` — Minha Lista

### 9.2 Camadas

**`filtros/`** — o coração, sem nenhuma dependência de React. Funções puras: `buscar(itens, indiceBusca, texto)`, `filtrar(itens, criterios)`, `ordenar(itens, campo)`. Com ~7.000 itens em memória, o filtro linear roda em poucos milissegundos; não há necessidade de Fuse.js nem de índice invertido. A busca normaliza acentos e caixa.

**`dados/`** — carrega `index.json`, depois `busca.json` em segundo plano, e detalhes da Alura sob demanda.

**`minha-lista/`** — localStorage guardando **apenas id + estado + data**, nunca os dados do item, para que a lista continue válida após atualizações do catálogo. Exportar/importar JSON resolve a transferência entre PC e celular.

### 9.3 Estado dos filtros na URL

`#/?q=docker&plat=ms-learn&tema=infraestrutura&nivel=iniciante&ordem=duracao`

O botão voltar funciona, buscas úteis podem ser favoritadas e recarregar a página não perde nada.

### 9.4 Filtros

Texto livre; **plataforma**; **tipo** (curso, módulo, trilha, certificação); tema; nível; faixa de duração; instrutor (só Alura); esconder checkpoints.

Ordenação por duração, data de atualização, popularidade ou nota — as duas últimas **restritas a uma única plataforma**, conforme a seção 5.1.

### 9.5 Layout

Painel de filtros fixo à esquerda, virando gaveta no celular; grade de cards à direita com contador de resultados sempre visível. **60 cards renderizados por vez, com "mostrar mais"** — 7.000 nós no DOM travam o navegador, e esta solução é mais simples que virtualização.

Cada card: título, selo da plataforma, tipo, tema, duração, nível, sinal de qualidade no idioma da sua plataforma, marcador da Minha Lista e selo de novo/atualizado quando aplicável.

Página de detalhe: itens do Microsoft Learn mostram resumo, taxonomia e link, já que a API não oferece mais que isso. Itens da Alura mostram ementa em acordeão, instrutores, público-alvo e requisitos. O vídeo da 1ª aula aparece apenas se `videoColetadoEm` tiver menos de 7 dias.

## 10. Tratamento de erros

| Situação | Comportamento |
|---|---|
| Uma fonte falha na coleta | Demais fontes atualizam; a que falhou preserva os dados anteriores; `relatorio.json` registra desde quando está desatualizada |
| >5% dos detalhes da Alura falham | Fonte Alura considerada falha (regra acima) |
| Tema sem mapeamento | Cai em `outros` **e** entra no relatório; nunca some em silêncio |
| Item descartado na normalização | Registrado no relatório com o motivo |
| `index.json` não carrega | Tela de erro com botão "tentar de novo" |
| `busca.json` não carrega | Busca segue funcionando em títulos e resumos; apenas não alcança ementas, com aviso discreto |
| Detalhe da Alura dá 404 | "Este curso pode ter saído do catálogo" + link para a plataforma |
| localStorage bloqueado (aba anônima) | App funciona; Minha Lista desativada com aviso visível |
| URL do vídeo expirada | Player ocultado; link permanece |
| `novidades.json` ausente (1ª coleta) | Radar explica que a linha de base foi estabelecida |

## 11. Testes

Vitest nos dois lados. **Nenhum teste toca a rede.**

Fixtures são respostas reais gravadas das duas APIs, incluindo casos difíceis escolhidos deliberadamente: Alura com `nota_disponivel: false`, `categoria: null`, checkpoint, curso substituído; Microsoft Learn com módulo sem `rating`, trilha com `rating`, item com tema fora do mapa.

Cobertura unitária obrigatória em cada `normalize`, no mapa de temas, em `build-index` (determinismo), em `diff-snapshots`, nos `filtros` e na `minha-lista`. Um teste específico garante que **ordenação por nota entre plataformas distintas é rejeitada** — é a regra mais fácil de quebrar sem perceber.

Testes de componente apenas no fluxo principal: buscar, filtrar, abrir item.

Desenvolvimento por TDD — teste antes da implementação.

## 12. Ordem de entrega

1. Contrato de tipos + mapa de temas
2. **Coletor Microsoft Learn** (uma requisição) → índice real gerado
3. **Catálogo web: busca, filtros, ordenação, estado na URL** ← já utilizável de verdade
4. **Coletor Alura** (throttle, cache, detalhes) → segunda fonte no mesmo índice
5. Página de detalhe
6. Minha Lista + exportar/importar
7. Radar de novidades
8. GitHub Action semanal + publicação no GitHub Pages

O Microsoft Learn vem primeiro porque uma requisição entrega um catálogo inteiro: há produto navegável já no passo 3, antes de investir nas 2.309 requisições da Alura. Do passo 3 em diante cada etapa é independente — interromper em qualquer ponto deixa um produto funcional.

## 13. Fora de escopo

Deliberadamente excluídos, por não servirem a um catálogo pessoal:

- Autenticação, contas, multiusuário
- Backend, banco de dados, API própria
- SEO, renderização no servidor, geração estática por item
- Coursera e edX como fontes (motivos na seção 2)
- Unidades internas dos módulos do Microsoft Learn
- Sincronização da Minha Lista entre dispositivos (resolvida por exportar/importar)
- Busca difusa e ranqueamento por relevância — substring simples basta em ~7.000 itens
- Nota unificada ou ranking entre plataformas (seção 5.1)
- Modo offline / PWA

## 14. Riscos e premissas

- **A API da Alura pode mudar sem aviso.** Não é versionada nem documentada corretamente. Mitigação: toda a exposição está em `fontes/alura/normalize.ts`, as fixtures detectam regressões, e o isolamento de falhas impede que uma quebra derrube o catálogo.
- **O Microsoft Learn é estável, mas de escopo restrito.** Cobre o ecossistema Microsoft e áreas adjacentes (IA, dados, segurança, GitHub). Não cobre front-end genérico, design ou UX — é exatamente por isso que a Alura permanece como segunda fonte.
- **Nenhum limite de requisições documentado em nenhuma das duas.** Mitigação: Microsoft Learn faz uma requisição por semana; Alura usa concorrência 4, backoff e `User-Agent` identificável.
- **Uso responsável.** Consumo pessoal e semanal de APIs públicas, com link de retorno para a plataforma de origem em cada item. Se qualquer uma das plataformas sinalizar objeção, aquela fonte é removida.
- **`/api/cursos` como fonte de "disponível agora"** é premissa validada em amostra de 12 cursos, não em toda a base. O coletor registra qualquer curso listado que venha com `showable: false`, para revisão.
- **O nome do repositório ainda é `alura-catalogo`**, anterior à decisão multi-fonte. Renomear é opcional e não bloqueia nada.
