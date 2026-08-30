import type { ItemCatalogo } from '@compartilhado/types';

const NOME_PLATAFORMA: Record<string, string> = {
  'ms-learn': 'Microsoft Learn',
  alura: 'Alura',
};

const NOME_TIPO: Record<string, string> = {
  curso: 'Curso', modulo: 'Módulo', trilha: 'Trilha', certificacao: 'Certificação',
};

const NOME_NIVEL: Record<string, string> = {
  iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado',
};

export function formatarDuracao(minutos: number | null): string | null {
  if (minutos === null) return null;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

// Cada escala e exibida no seu proprio idioma; nunca convertida (spec 5.1).
export function formatarNota(item: ItemCatalogo): string | null {
  if (item.nota === null) return null;
  if (item.escalaNota === 'alura-nps') return `${item.nota.toFixed(1)}/10`;
  if (item.escalaNota === 'ms-rating') return `${item.nota.toFixed(1)}/5`;
  return null;
}

export function CartaoItem({ item }: { item: ItemCatalogo }) {
  const duracao = formatarDuracao(item.duracaoMinutos);
  const nota = formatarNota(item);

  return (
    <article className="cartao">
      <div className="cartao-selos">
        <span className="selo">{NOME_PLATAFORMA[item.plataforma] ?? item.plataforma}</span>
        <span className="selo">{NOME_TIPO[item.tipo] ?? item.tipo}</span>
      </div>
      <h3>
        <a href={item.url} target="_blank" rel="noreferrer">{item.titulo}</a>
      </h3>
      {item.resumo && <p className="cartao-resumo">{item.resumo}</p>}
      <dl className="cartao-meta">
        {duracao && <div><dt>Duração</dt><dd>{duracao}</dd></div>}
        {item.nivel && <div><dt>Nível</dt><dd>{NOME_NIVEL[item.nivel]}</dd></div>}
        {nota && <div><dt>Nota</dt><dd>{nota}</dd></div>}
      </dl>
    </article>
  );
}
