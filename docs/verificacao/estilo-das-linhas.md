# Estilo das linhas — 26/10/2026

- O botão Estilo da linha aparece junto ao desenho para configurar os próximos traços ou editar uma linha selecionada por toque/pressão prolongada.
- Painel com prévia, espessura de 0,5 a 12, cores prontas e cor personalizada HEX. Tipos: contínua, pontilhada e tracejada.
- Alterar uma seleção modifica apenas o elemento selecionado; os padrões dos próximos traços permanecem independentes. As alterações podem ser desfeitas.
- Cor e tipo de traço são persistidos no desenho e usados pelo renderizador SVG compartilhado com o PDF. Desenhos antigos preservam os padrões anteriores.
- Atualizar a API na VPS antes de instalar o novo APK: o schema agora aceita os campos opcionais strokeColor e strokeStyle. Não há migração de banco.

## Validação

- 148 testes unitários passaram, incluindo persistência, transformação, compatibilidade com desenhos antigos e rejeição de cores/estilos inválidos.
- Build compartilhado e API, TypeScript do app, ESLint e exportação web passaram.
- Chromium em 390 × 844, com API simulada: configurar antes de desenhar; criar linha vermelha pontilhada; selecionar segurando; mudar espessura, cor e tipo; validar HEX; desenhar outra linha preservando os padrões; desfazer e salvar com validação do schema.
- Revisada a captura do painel em drawing-line-style-panel.png. Saída SVG verificada no teste, sem nova renderização de PDF.
- Sem teste em aparelho físico, publicação ou geração de APK.
