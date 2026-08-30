import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
let snapshots: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'catalogo-'));
  snapshots = mkdtempSync(join(tmpdir(), 'catalogo-snapshots-'));
  return () => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(snapshots, { recursive: true, force: true });
  };
});

const opcoes = () => ({
  diretorio: dir,
  diretorioSnapshots: snapshots,
  agora: new Date('2026-08-29T12:00:00Z'),
});

describe('coletar', () => {
  it('grava indice, snapshot e relatorio', async () => {
    await coletar({ ...opcoes(), buscar: async () => CATALOGO });

    const indice = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8'));
    expect(indice.itens).toHaveLength(1);
    expect(indice.itens[0].id).toBe('ms-learn:m1');
    expect(indice.fontes[0].total).toBe(1);

    const snapshot = JSON.parse(
      readFileSync(join(snapshots, '2026-08-29.json'), 'utf8'),
    );
    expect(snapshot.itens).toHaveLength(1);

    const relatorio = JSON.parse(readFileSync(join(dir, 'relatorio.json'), 'utf8'));
    expect(relatorio.fontes[0].plataforma).toBe('ms-learn');
    expect(relatorio.fontes[0].total).toBe(1);
  });

  // O publicDir do Vite copia dados/ inteiro para o dist. Um snapshot ali
  // dentro dobra o tamanho do deploy com um arquivo que o site nunca le, e
  // cresce a cada coleta.
  it('mantem o snapshot fora do diretorio que o site publica', async () => {
    await coletar({ ...opcoes(), buscar: async () => CATALOGO });

    expect(existsSync(join(dir, 'snapshots'))).toBe(false);
    expect(existsSync(join(snapshots, '2026-08-29.json'))).toBe(true);
  });

  it('propaga a falha da fonte sem gravar indice pela metade', async () => {
    await expect(
      coletar({
        ...opcoes(),
        buscar: async () => { throw new Error('Microsoft Learn respondeu 503'); },
      }),
    ).rejects.toThrow('503');

    expect(() => readFileSync(join(dir, 'index.json'), 'utf8')).toThrow();
  });

  it('registra rotulos nao mapeados no relatorio', async () => {
    await coletar({
      ...opcoes(),
      buscar: async () => ({
        modules: [{ ...CATALOGO.modules![0]!, uid: 'm2', subjects: ['assunto-novo'] }],
      }),
    });

    const relatorio = JSON.parse(readFileSync(join(dir, 'relatorio.json'), 'utf8'));
    expect(relatorio.fontes[0].rotulosNaoMapeados).toContain('assunto-novo');
  });
});
