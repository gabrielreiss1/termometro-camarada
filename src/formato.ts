const num = (casas: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const n0 = num(0);
const n1 = num(1);
const n2 = num(2);
const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/** 0.5123 → "51,2%" */
export const pct = (x: number, casas = 1) => `${(casas === 0 ? n0 : casas === 2 ? n2 : n1).format(100 * x)}%`;
/** 0.0123 → "+1,2" */
export const pontos = (x: number, casas = 1) => {
  const v = (casas === 2 ? n2 : n1).format(100 * Math.abs(x));
  if (v === (casas === 2 ? '0,00' : '0,0')) return v;
  return `${x > 0 ? '+' : '−'}${v}`;
};
export const votos = (x: number) => inteiro.format(x);

export const plural = (n: number, um: string, varios: string) => `${inteiro.format(n)} ${n === 1 ? um : varios}`;

export function horaBrasilia(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}
