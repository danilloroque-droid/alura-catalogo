import { useEffect, useMemo, useState } from 'react';
import type { Indice } from '@compartilhado/types';
import { aplicar, filtrar, buscar, permissoesDe } from '../filtros/filtros.js';
import { deHash, paraHash } from '../filtros/url.js';
import { PainelFiltros } from '../componentes/PainelFiltros.js';
import { ListaItens } from '../componentes/ListaItens.js';

export function Catalogo({ indice }: { indice: Indice }) {
  const [criterios, setCriterios] = useState(() => deHash(window.location.hash));

  // A URL e a fonte da verdade: o botao voltar e o recarregar precisam funcionar.
  useEffect(() => {
    const aoNavegar = () => setCriterios(deHash(window.location.hash));
    window.addEventListener('hashchange', aoNavegar);
    return () => window.removeEventListener('hashchange', aoNavegar);
  }, []);

  useEffect(() => {
    const novo = paraHash(criterios);
    if (novo !== (window.location.hash || '#/')) window.location.hash = novo;
  }, [criterios]);

  const resultados = useMemo(() => aplicar(indice.itens, criterios), [indice.itens, criterios]);

  // A permissao depende do conjunto filtrado, nao do catalogo inteiro:
  // estreitar para uma unica plataforma volta a liberar nota e popularidade.
  const permissoes = useMemo(
    () => permissoesDe(filtrar(buscar(indice.itens, criterios.texto), criterios)),
    [indice.itens, criterios],
  );

  return (
    <div className="pagina">
      <PainelFiltros
        indice={indice}
        criterios={criterios}
        permissoes={permissoes}
        aoMudar={setCriterios}
      />
      <section className="resultados">
        {/* ListaItens documenta a paginacao como estado local reiniciado por
            remontagem: sem esta key derivada dos criterios, "mostrar mais"
            persistiria ao trocar de filtro (ver contrato em ListaItens.tsx). */}
        <ListaItens key={paraHash(criterios)} itens={resultados} />
      </section>
    </div>
  );
}
