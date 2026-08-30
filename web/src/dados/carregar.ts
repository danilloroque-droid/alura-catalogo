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
