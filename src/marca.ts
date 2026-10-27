/**
 * Versão neutra do site (sem a marca "Camarada" e com textos imparciais entre os dois candidatos).
 * Liga no build com a variável de ambiente VITE_MARCA=neutra; o site Camarada é o padrão.
 */
export const NEUTRA = import.meta.env.VITE_MARCA === 'neutra';

export const NOME_SITE = NEUTRA ? 'Termômetro do 2º turno' : 'Termômetro Camarada';
