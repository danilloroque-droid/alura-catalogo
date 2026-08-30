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
