# LP — agrupamento automático de soldas — 11/11/2026

Somente no LP, a primeira ficha que informa uma solda fica responsável por ela. Ao informar `01 - 02 - 03 - 04`, as fichas individuais já existentes desses números deixam de aparecer separadamente. As fotos dessas fichas são reunidas no grupo. Se uma ficha posterior contiver números usados e novos, somente os novos aparecem nela. Os números são uma lista: `01 - 04` significa duas soldas, não um intervalo.

O agrupamento é uma projeção compartilhada pelo formulário, revisão e PDF. `data.weldNumbers` guarda a cobertura da ficha, separadamente do número original. Os IDs, dados individuais e marcações do desenho são preservados, inclusive no armazenamento offline. Retirar um número do grupo permite que sua ficha original reapareça. Relatórios antigos com vários números no campo `number` também são interpretados. Não há migração de banco.

Cada ficha começa com um espaço para foto e permite selecionar várias imagens. Não exige duas fotos. O PDF distribui as fotos em sequência, duas por linha e até três duplas por página. Uma ficha independente sem fotos ocupa um quadro com **SEM FOTO ANEXADA**, mantendo as informações acima. Fichas agrupadas não criam quadros vazios adicionais. As páginas opcionais **FOTOS DO ENSAIO** continuam separadas.

Validação realizada:

- TypeScript nos três workspaces, ESLint e exportação web passaram.
- 100 testes unitários em sete suites passaram: agrupamento, zeros à esquerda, sobreposição parcial, liberação de números, PDF, fotos e restauração/sincronização da fila offline.
- Dois testes de integração com PostgreSQL isolado, API e Chromium real passaram. A atualização preservou IDs de seis pontos, cinco fotos e todas as marcações do desenho. O PDF do grupo apresentou três duplas, cinco fotos carregadas e um quadro sem foto.
- No navegador com API simulada, o formulário agrupou seis fichas em três, apresentou um espaço inicial para foto, selecionou três arquivos de uma vez, salvou os três e reabriu mantendo o agrupamento, sem erros JavaScript.
- Conferência visual da página gerada: `artifacts/lp-weld-groups/photo-page.png`. Conferência da tela: `artifacts/lp-test-photos/group-selection.png`.

Não foi testado em aparelho físico Android/iOS. Para disponibilizar, atualizar API e web na VPS e gerar/instalar outro APK. Nenhum dado de produção foi usado nos testes.
