import { useState } from 'react';
import type { ItemCatalogo } from '@compartilhado/types';
import { CartaoItem } from './CartaoItem.js';

export const POR_PAGINA = 60;

interface Props {
  itens: ItemCatalogo[];
  porPagina?: number;
}

// A paginacao e estado local deste componente: ela nao observa mudancas em
// `itens`. Para voltar ao topo quando os criterios de filtro mudam, quem usa
// este componente deve remonta-lo com uma `key` derivada dos criterios
// (ex.: `<ListaItens key={paraHash(criterios)} ... />`).
export function ListaItens({ itens, porPagina = POR_PAGINA }: Props) {
  const [visiveis, setVisiveis] = useState(porPagina);

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
