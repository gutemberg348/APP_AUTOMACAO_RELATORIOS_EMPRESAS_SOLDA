# Símbolos das referências — 26/10/2026

- Adicionados Tanque cilíndrico isométrico (pontilhado azul), Válvula com atuador (corpo escuro e atuador azul) e Atuador separado.
- Novos componentes aparecem no início da paleta Símbolos, com prévia completa e orientação inicial vertical. Aceitam tamanho, rotação, movimento, laço e desfazer.
- O catálogo agora informa as dimensões reais de cada novo símbolo. Contorno de seleção, região de toque, laço e centro da rotação usam essas dimensões; o tanque pode ser selecionado pelo topo.
- Geometria vetorial compartilhada pelo app e pela geração de PDF; os componentes têm códigos novos no schema. Atualizar a API na VPS antes de usar o novo APK. Não há migração de banco.

## Validação

- Build compartilhado e API, TypeScript do app, ESLint e exportação web passaram.
- 145 testes unitários passaram, incluindo aceitação dos novos códigos, estilo pontilhado, duas cores, dimensões do tanque, seleção pelo topo, laço e rotação.
- Chromium 390 × 844, API simulada: inserir os três componentes pela paleta, selecionar, diminuir, girar, desfazer e salvar pelo schema passaram. Verificada a saída SVG usada no relatório.
- Captura revisada: `drawing-new-reference-symbols.png`.
- Sem teste em aparelho físico, publicação na VPS ou geração de APK.
