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
