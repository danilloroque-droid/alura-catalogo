import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizarMsLearn, removerHtml, paraData } from '../src/fontes/ms-learn/normalize.js';
import type { CatalogoBruto } from '../src/fontes/ms-learn/client.js';
import type { ItemCatalogo } from '@compartilhado/types';

const bruto = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/ms-learn-amostra.json', import.meta.url)), 'utf8'),
) as CatalogoBruto;

const resultado = normalizarMsLearn(bruto);
const porId = (id: string): ItemCatalogo => {
  const item = resultado.itens.find((i) => i.id === id);
  if (!item) throw new Error(`item ausente: ${id}`);
  return item;
};

describe('normalizarMsLearn', () => {
  it('normaliza os quatro tipos, sem perder nenhum item', () => {
    expect(resultado.itens).toHaveLength(7);
    const tipos = resultado.itens.map((i) => i.tipo);
    expect(tipos.filter((t) => t === 'modulo')).toHaveLength(3);
    expect(tipos.filter((t) => t === 'trilha')).toHaveLength(2);
    expect(tipos.filter((t) => t === 'curso')).toHaveLength(1);
    expect(tipos.filter((t) => t === 'certificacao')).toHaveLength(1);
  });

  it('prefixa o id com a plataforma', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').plataforma).toBe('ms-learn');
  });

  it('traduz os niveis do ingles', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').nivel).toBe('iniciante');
    expect(porId('ms-learn:learn.wwl.modulo-sem-subjects').nivel).toBe('intermediario');
    expect(porId('ms-learn:learn.wwl.modulo-sem-popularidade').nivel).toBe('avancado');
  });

  it('converte duration_in_hours dos cursos para minutos', () => {
    expect(porId('ms-learn:course.gh-200t00').duracaoMinutos).toBe(24 * 60);
  });

  it('deixa duracao nula em certificacoes, que nao declaram duracao', () => {
    expect(porId('ms-learn:certification.azure-for-sap-workloads-specialty').duracaoMinutos).toBeNull();
  });

  it('remove HTML do resumo de cursos e usa subtitle em certificacoes', () => {
    expect(porId('ms-learn:course.gh-200t00').resumo).toBe(
      'Saiba como GitHub Actions permite automatizar seu ciclo de desenvolvimento.',
    );
    expect(porId('ms-learn:certification.azure-for-sap-workloads-specialty').resumo).toBe(
      'Você é um arquiteto que gerencia o cenário SAP em Azure. Migrações e integrações.',
    );
  });

  it('trunca last_modified para data', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').atualizadoEm).toBe('2026-08-27');
  });

  it('so atribui nota quando rating tem count maior que zero', () => {
    const semAvaliacao = porId('ms-learn:learn.wwl.trilha-sem-avaliacao');
    expect(semAvaliacao.nota).toBeNull();
    expect(semAvaliacao.escalaNota).toBeNull();

    const avaliada = porId('ms-learn:learn.wwl.trilha-avaliada');
    expect(avaliada.nota).toBe(4.83);
    expect(avaliada.escalaNota).toBe('ms-rating');
  });

  it('marca a escala de popularidade e aceita ausencia', () => {
    const com = porId('ms-learn:learn.wwl.experiment-azure-machine-learning');
    expect(com.escalaPopularidade).toBe('ms-popularity');

    const sem = porId('ms-learn:learn.wwl.modulo-sem-popularidade');
    expect(sem.popularidade).toBeNull();
    expect(sem.escalaPopularidade).toBeNull();
  });

  it('mapeia tema por subjects e cai para roles quando nao ha subjects', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').temas).toEqual([
      'inteligencia-artificial',
    ]);
    expect(porId('ms-learn:learn.wwl.modulo-sem-subjects').temas).toEqual(['seguranca']);
    expect(porId('ms-learn:certification.azure-for-sap-workloads-specialty').temas).toEqual([
      'infraestrutura-nuvem',
    ]);
  });

  it('preserva todos os rotulos originais, sem duplicatas', () => {
    expect(porId('ms-learn:learn.wwl.experiment-azure-machine-learning').temasOriginais).toEqual([
      'machine-learning',
      'data-scientist',
      'azure-machine-learning',
    ]);
  });

  it('preenche os campos que o Microsoft Learn nao tem', () => {
    const item = porId('ms-learn:course.gh-200t00');
    expect(item.instrutores).toEqual([]);
    expect(item.criadoEm).toBeNull();
    expect(item.ehCheckpoint).toBe(false);
    expect(item.idioma).toBe('pt-BR');
  });

  it('descarta item sem uid, registrando o motivo', () => {
    const r = normalizarMsLearn({ modules: [{ title: 'sem uid', url: 'x' } as never] });
    expect(r.itens).toHaveLength(0);
    expect(r.descartados).toEqual([{ id: 'modulo[0]', motivo: 'sem uid' }]);
  });
});

describe('removerHtml', () => {
  it('remove tags e normaliza espacos', () => {
    expect(removerHtml('<p>Um</p>\n<ul>\n<li>dois</li>\n</ul>')).toBe('Um dois');
  });

  it('converte entidades comuns', () => {
    expect(removerHtml('a &amp; b &lt;c&gt; &nbsp;d &quot;e&quot;')).toBe('a & b <c> d "e"');
  });

  // Encontrado na coleta real: o titulo do modulo de Apple Messages traz
  // Google&apos;s. Antes da guarda de entidades, virava "Google s" em silencio.
  it('converte &apos;, que aparece no catalogo real', () => {
    expect(removerHtml('Google&apos;s Business Messages')).toBe("Google's Business Messages");
  });

  // A tabela nomeada cobre 6 entradas. Trocar o resto por espaco apagava o
  // dado em silencio: "caf&eacute;" virava "caf" e nada registrava a perda.
  it('preserva entidade nomeada desconhecida em vez de engoli-la', () => {
    expect(removerHtml('caf&eacute; da manha')).toBe('caf&eacute; da manha');
  });

  it('decodifica entidade numerica decimal e hexadecimal', () => {
    expect(removerHtml('Voc&#234; e &#x41;rquiteto')).toBe('Você e Arquiteto');
  });

  // fromCodePoint lanca RangeError acima de 0x10FFFF. Um resumo malformado
  // nao pode derrubar uma coleta de 4667 itens.
  it('preserva entidade numerica fora da faixa Unicode sem lancar', () => {
    expect(removerHtml('a &#999999999; b')).toBe('a &#999999999; b');
  });
});

describe('paraData', () => {
  it('trunca ISO com fuso para AAAA-MM-DD', () => {
    expect(paraData('2026-08-27T22:13:00+00:00')).toBe('2026-08-27');
  });

  it('devolve nulo quando ausente ou invalido', () => {
    expect(paraData(undefined)).toBeNull();
    expect(paraData('nao é data')).toBeNull();
  });
});
