import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buscarCatalogo } from './fontes/ms-learn/client.js';
import { normalizarMsLearn } from './fontes/ms-learn/normalize.js';
import { construirIndice, serializar } from './build-index.js';
import type { ItemDescartado } from '@compartilhado/types';

export interface OpcoesColeta {
  /** O que o site publica: index.json e relatorio.json. E o publicDir do Vite. */
  diretorio: string;
  /**
   * Onde ficam os snapshots historicos. Separado de `diretorio` de proposito:
   * o publicDir do Vite nao tem exclusao, entao snapshot guardado la dentro ia
   * inteiro para o dist a cada build — megabytes por coleta que o site nunca le.
   */
  diretorioSnapshots: string;
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
  const {
    diretorio,
    diretorioSnapshots,
    agora = new Date(),
    buscar = buscarCatalogo,
  } = opcoes;
  const geradoEm = agora.toISOString();

  // A fonte roda por inteiro antes de qualquer escrita: uma falha nao pode
  // deixar dados/ pela metade.
  const bruto = await buscar();
  const fonte = normalizarMsLearn(bruto);
  const indice = construirIndice([fonte], geradoEm);
  const texto = serializar(indice);

  mkdirSync(diretorio, { recursive: true });
  mkdirSync(diretorioSnapshots, { recursive: true });
  writeFileSync(join(diretorio, 'index.json'), texto, 'utf8');
  writeFileSync(join(diretorioSnapshots, `${geradoEm.slice(0, 10)}.json`), texto, 'utf8');

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
  const relatorio = await coletar({
    diretorio: join(raiz, 'dados'),
    diretorioSnapshots: join(raiz, 'snapshots'),
  });
  const fonte = relatorio.fontes[0];
  console.log(`Coletados ${fonte?.total ?? 0} itens do Microsoft Learn.`);
  if (fonte?.descartados.length) console.log(`Descartados: ${fonte.descartados.length}`);
  if (fonte?.rotulosNaoMapeados.length) {
    console.log(`Rotulos sem tema: ${fonte.rotulosNaoMapeados.join(', ')}`);
  }
}
