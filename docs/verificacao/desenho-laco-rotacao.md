# Laço e rotação no desenho — 26/10/2026

- Ferramenta Laço junto de Selecionar: desenhe um contorno para selecionar os elementos inteiramente contidos. Contornos côncavos não incluem linhas que atravessam uma região exterior, mesmo que suas pontas estejam dentro.
- Dois ou mais elementos formam um bloco de seleção: arrastar dentro do retângulo move todos juntos. Novo laço inicia outra seleção; Soltar bloco permite editar os elementos separadamente. A seleção não cria um novo tipo persistente de elemento: o relatório salva as geometrias transformadas, com seus IDs e vínculos originais.
- Uma alça de rotação aparece acima da seleção, com linha até o centro. Arrastar a alça gira ao redor desse centro, mostra graus durante o movimento e ajuda a encaixar nos múltiplos de 15°. Os dois botões junto ao indicador de graus ajustam −15° e +15°.
- Blocos também aceitam mover, girar e redimensionar com dois dedos. Um gesto gera uma única entrada de desfazer. Cancelar o gesto descarta a prévia.
- O bloco é limitado à página como um conjunto. Os membros nunca são presos à borda individualmente. Se um giro no lugar não cabe, ele é recusado com aviso em vez de deslocar o centro.
- Pontos mantêm vínculo, número, resultado e fotos; seus números continuam legíveis. Texto de cotas e espessuras são preservados. Escala conjunta respeita os limites do formato.
- Laço, retângulo, alça e graus são controles da prévia, sem inclusão no PDF. Não há mudança de contrato ou migração da API.

## Verificação

- Build compartilhado, TypeScript do app, ESLint e exportação Expo para web, Android e iOS passaram.
- 143 testes unitários passaram, incluindo laço côncavo, traços parcialmente contidos, transformação rígida na borda, centro do giro, vínculos dos pontos, escala conjunta, limite de cotas e exclusão dos controles da saída normal.
- Chromium 390 × 844, API simulada: seleção de duas linhas com outra fora, movimento conjunto, desfazer/refazer, alça com giro de 90° e graus ao vivo, passos de 15°, símbolo girando sem deslocar o centro, gesto de dois dedos com cancelamento e confirmação, desfazer da pinça e salvamento validado pelo schema passaram.
- Regressões do editor passaram: seleção e contorno, desenho sem riscos em toques leves, texto/símbolos, hachura, pinça, pan/zoom, orientação horizontal e salvamento.
- Capturas revisadas: `drawing-lasso-block.png` e `drawing-lasso-rotation-live.png`.

Sem teste em aparelho físico, geração de APK ou publicação na VPS.

# Redimensionar o desenho inteiro — 26/10/2026

- A seleção por laço agora oferece Diminuir bloco e Aumentar bloco, mantendo os elementos juntos em torno de um centro comum. O gesto de pinça continua funcionando.
- Selecionar tudo está disponível na ferramenta Laço e no bloco selecionado, incluindo textos, símbolos, linhas e pontos do desenho ativo. Soltar bloco encerra a seleção temporária.
- IDs dos elementos, vínculos dos pontos e estilos são preservados. Os limites de tamanho existentes continuam sendo respeitados; uma tentativa sem efeito mostra um aviso.
- 149 testes unitários, TypeScript, ESLint e exportação web passaram. Teste Chromium 390 × 844 com API simulada verificou diminuir/aumentar uma seleção parcial sem afetar o restante, selecionar seis elementos de tipos diferentes, diminuir/girar o desenho inteiro e salvar. Regressão de arraste, pinça, cancelamento, rotação e desfazer também passou.
- Captura: drawing-whole-block.png. Sem teste em aparelho físico. Esta melhoria não adiciona campos à API; a atualização da API continua necessária para os símbolos e estilos adicionados anteriormente.
