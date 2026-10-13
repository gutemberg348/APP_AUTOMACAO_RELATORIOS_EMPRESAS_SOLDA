# EVS: título da segunda página e fontes

O cabeçalho continua **RELATÓRIO DE ENSAIO VISUAL DE SOLDAS**, como na referência. O título central é o nome da linha/equipamento informado no campo do relatório, por exemplo **LINHA RETORNO DE CIP**.

Novos EVS sugerem o nome da obra sem o sufixo automático `· Ensaio Visual / Endoscopia`. O campo passou a se chamar **Título da linha / equipamento** e informa sua posição no PDF. Relatórios antigos com exatamente a sugestão automática têm o sufixo removido na apresentação do PDF. Títulos personalizados, inclusive os que mencionam endoscopia, são preservados. Nenhum registro foi reescrito no banco.

Fontes: dados de 15 para 18 px; título central de 21 para 26 px; cabeçalho de 20 para 22 px; número, página e data de 12 para 14 px. Os estilos compartilhados foram conferidos também em LP, TH, ME e RDO. Os modelos compactos mantêm suas sobrescritas próprias.

`scripts/verify-evs-layout.ts` verifica o cabeçalho, nome da linha, tamanhos de fonte, seis páginas da amostra, pares de fotos, assinaturas, textos extensos, sugestão antiga e título personalizado. `scripts/verify-reference-reports.ts` conferiu os outros quatro modelos e seus textos extensos. A segunda página foi inspecionada visualmente em `report-EVS-modelo-pagina-2.png`; o PDF está em `report-EVS-modelo-verificado.pdf`.

Typecheck, lint, build da API e exports Expo web/iOS/Android passaram. A criação de EVS no navegador com API simulada confere o nome sugerido e a edição do título. A API Docker foi atualizada; os arquivos finais já emitidos continuam preservados, e novas prévias/versões usam o novo layout.
