import type { Indice, Nivel, TipoItem } from '@compartilhado/types';
import type { Criterios, Ordem } from '../filtros/filtros.js';
import { CRITERIOS_VAZIOS } from '../filtros/url.js';

const TIPOS: { id: TipoItem; nome: string }[] = [
  { id: 'curso', nome: 'Curso' },
  { id: 'modulo', nome: 'Módulo' },
  { id: 'trilha', nome: 'Trilha' },
  { id: 'certificacao', nome: 'Certificação' },
];

const NIVEIS: { id: Nivel; nome: string }[] = [
  { id: 'iniciante', nome: 'Iniciante' },
  { id: 'intermediario', nome: 'Intermediário' },
  { id: 'avancado', nome: 'Avançado' },
];

const ORDENS: { id: Ordem; nome: string }[] = [
  { id: 'titulo', nome: 'Título' },
  { id: 'duracao', nome: 'Duração' },
  { id: 'atualizacao', nome: 'Atualização' },
  { id: 'popularidade', nome: 'Popularidade' },
  { id: 'nota', nome: 'Nota' },
];

interface Props {
  indice: Indice;
  criterios: Criterios;
  notaPermitida: boolean;
  aoMudar: (c: Criterios) => void;
}

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

export function PainelFiltros({ indice, criterios, notaPermitida, aoMudar }: Props) {
  return (
    <aside className="filtros">
      <label className="campo">
        <span>Buscar</span>
        <input
          type="search"
          value={criterios.texto}
          placeholder="título ou resumo"
          onChange={(e) => aoMudar({ ...criterios, texto: e.target.value })}
        />
      </label>

      <fieldset>
        <legend>Tipo</legend>
        {TIPOS.map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              checked={criterios.tipos.includes(t.id)}
              onChange={() => aoMudar({ ...criterios, tipos: alternar(criterios.tipos, t.id) })}
            />
            {t.nome}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Tema</legend>
        {indice.temas.map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              checked={criterios.temas.includes(t.id)}
              onChange={() => aoMudar({ ...criterios, temas: alternar(criterios.temas, t.id) })}
            />
            {t.nome}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Nível</legend>
        {NIVEIS.map((n) => (
          <label key={n.id}>
            <input
              type="checkbox"
              checked={criterios.niveis.includes(n.id)}
              onChange={() => aoMudar({ ...criterios, niveis: alternar(criterios.niveis, n.id) })}
            />
            {n.nome}
          </label>
        ))}
      </fieldset>

      <label className="campo">
        <span>Duração máxima</span>
        <select
          value={criterios.duracaoMaxima ?? ''}
          onChange={(e) =>
            aoMudar({ ...criterios, duracaoMaxima: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">Qualquer</option>
          <option value="30">Até 30 min</option>
          <option value="60">Até 1 h</option>
          <option value="180">Até 3 h</option>
          <option value="600">Até 10 h</option>
        </select>
      </label>

      <label className="campo">
        <span>Ordenar por</span>
        <select
          value={criterios.ordem}
          onChange={(e) => aoMudar({ ...criterios, ordem: e.target.value as Ordem })}
        >
          {ORDENS.map((o) => (
            <option key={o.id} value={o.id} disabled={o.id === 'nota' && !notaPermitida}>
              {o.nome}
            </option>
          ))}
        </select>
      </label>

      {!notaPermitida && criterios.ordem === 'nota' && (
        <p className="aviso" role="status">
          Ordenar por nota exige uma única plataforma: Alura e Microsoft Learn usam
          escalas diferentes, e compará-las não significaria nada. Ordenando por título.
        </p>
      )}

      <button className="limpar" onClick={() => aoMudar(CRITERIOS_VAZIOS)}>
        Limpar filtros
      </button>
    </aside>
  );
}
