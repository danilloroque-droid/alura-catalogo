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
