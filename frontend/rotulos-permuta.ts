// Rótulos das permutas (sem o prefixo "(-) ") — fonte única da Proforma (tela e
// CSV/PDF), da cascata do resultado e do campo de Premissas do Loteamento (#900).
//
// O Loteamento só tem UM campo de cada permuta (o motor normaliza o catálogo
// inteiro no bucket residencial), então "residencial" é vocabulário de
// Incorporação e não aparece lá. Incorporação segue com o par R/NR.

export function rotuloPermutaFisica(lot: boolean): string {
  return lot ? 'Permuta física' : 'Permuta física residencial';
}

export function rotuloPermutaFinanceira(lot: boolean): string {
  return lot ? 'Permuta financeira' : 'Permuta financeira residencial';
}
