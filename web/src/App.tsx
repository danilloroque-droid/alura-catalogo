import { useEffect, useState } from 'react';
import type { Indice } from '@compartilhado/types';
import { carregarIndice } from './dados/carregar.js';
import { Catalogo } from './paginas/Catalogo.js';

export function App() {
  const [indice, setIndice] = useState<Indice | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarIndice()
      .then(setIndice)
      .catch((e: Error) => setErro(e.message));
  }, []);

  if (erro) {
    return (
      <main>
        <p role="alert">{erro}</p>
        <button onClick={() => window.location.reload()}>Tentar de novo</button>
      </main>
    );
  }

  if (!indice) return <main><p>Carregando catálogo…</p></main>;

  return (
    <>
      <header className="topo">
        <h1>Catálogo de treinamentos</h1>
        <p>
          {indice.itens.length} itens · atualizado em{' '}
          {new Date(indice.geradoEm).toLocaleDateString('pt-BR')}
        </p>
      </header>
      <Catalogo indice={indice} />
    </>
  );
}
