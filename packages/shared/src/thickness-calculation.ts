/** Legacy fields kept to reopen older reports; calculation sheets now use custom image pages. */
export const thicknessCalculationFields = [
  { path: 'calculationMinimumThickness', label: 'Espessura mínima calculada (mm)', symbol: 't' },
  { path: 'calculationPressure', label: 'Pressão (MPa)', symbol: 'P' },
  { path: 'calculationExternalDiameter', label: 'Diâmetro externo (mm)', symbol: 'D' },
  { path: 'calculationAllowableStress', label: 'Tensão admissível (MPa)', symbol: 'S' },
  {
    path: 'calculationWeldEfficiency',
    label: 'Fator de eficiência de solda (tabela ASME)',
    symbol: 'E',
  },
  {
    path: 'calculationAllowance',
    label: 'Sobreespessura para corrosão, erosão e mecânica (mm)',
    symbol: 'C',
  },
  { path: 'calculationInternalDiameter', label: 'Diâmetro interno (mm)', symbol: 'd' },
  { path: 'calculationStrengthFactor', label: 'Fator de resistência (tabela ASME)', symbol: 'W' },
  {
    path: 'calculationReductionCoefficient',
    label: 'Coeficiente de redução (tabela ASME)',
    symbol: 'Y',
  },
  { path: 'calculationHydrostaticTest', label: 'Teste hidrostático (kgf/cm²)', symbol: 'TH' },
  {
    path: 'calculationMeasuredThickness',
    label: 'Espessura encontrada (medida em mm)',
    symbol: '',
  },
] as const;
