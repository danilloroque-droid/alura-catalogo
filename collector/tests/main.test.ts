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
