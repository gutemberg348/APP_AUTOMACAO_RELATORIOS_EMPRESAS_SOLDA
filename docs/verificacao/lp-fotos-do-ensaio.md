# LP — fotos opcionais do ensaio — 11/11/2026

O formulário do LP oferece **Fotos do ensaio** imediatamente após os desenhos. A galeria e os arquivos aceitam seleção múltipla (até 100 em um lote; é possível adicionar outros lotes). As fotos podem ser conferidas, pintadas, legendadas e retiradas antes de salvar. Não dependem de um ponto de solda.

Os anexos usam `ReportMedia.sectionKey = test-photos`, sem alteração no schema do banco. A API permite essa seção apenas em LP. O PDF imprime até três fotos empilhadas por folha, com cabeçalho **FOTOS DO ENSAIO** e rodapé, depois de todos os desenhos e antes das páginas de solda. Zero anexos significa zero folhas opcionais. As fotos dos pontos não se misturam com as fotos gerais do ensaio.

O fluxo normal grava e remove os anexos usando a fila de fotos existente. Ela mantém a seção ao guardar no telefone, restaurar e sincronizar. **Baixar como está** inclui também as fotos dessa seção que ainda estão no telefone. Falhas de envio e leitura apontam para **Fotos do ensaio**, com orientação e botão de correção.

Validação:

- TypeScript dos três workspaces, ESLint dos arquivos alterados e exportação web passaram.
- 121 testes em nove suites passaram, incluindo paginação opcional com 0/1/2/3/4/6/7/10 fotos, isolamento dos pontos, restauração offline e transporte no PDF atual.
- Integração com PostgreSQL isolado e Chromium real passou: sete fotos produziram páginas 3 + 3 + 1; edição de legenda/marcações, download normal, exportação com três fotos locais adicionais e remoção de todos os anexos foram conferidos. O PDF atual não alterou o banco. Nenhuma foto de solda foi excluída.
- As imagens foram carregadas e a geometria das páginas foi conferida sem transbordamento. A folha renderizada foi inspecionada em `artifacts/lp-test-photos/test-photos-page.png`; PDF em `artifacts/lp-test-photos/lp-test-photos.pdf`.
- Navegador em viewport de tablet, com API simulada: seleção de quatro arquivos de uma vez, resumo de duas folhas e salvamento dos quatro anexos sem vínculo com ponto passaram, sem erros de JavaScript.

Ainda não foi validado em aparelho Android/iOS físico. É necessário atualizar a API e gerar/instalar outro APK para disponibilizar a funcionalidade no telefone; atualizar o web também para uso pelo navegador.
