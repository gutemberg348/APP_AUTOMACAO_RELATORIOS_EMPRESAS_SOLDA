# Cores personalizadas e borracha por trechos

Verificado em 29/10/2026.

- O seletor de cor usa faixa de matiz, quadrado de saturação/claridade e prévia. Não solicita código hexadecimal. A escolha é aplicada uma única vez ao confirmar, inclusive para texto.
- A borracha tem diâmetro ajustável de 4 a 80 pixels de tela, com prévia e atalhos de tamanho. O círculo acompanha a passada.
- Linhas e traços livres são recortados geometricamente; os fragmentos mantêm cor, espessura e pincel. A passada inteira corresponde a um único Desfazer.
- Fotos, pontos de inspeção, textos, símbolos e hachuras continuam sendo objetos independentes, excluídos pela seleção e lixeira. A borracha não pinta branco sobre a foto.
- Os fragmentos usam o formato já existente dos desenhos e marcações; esta alteração não acrescenta migração de banco.

## Validação

- TypeScript do app, ESLint dos arquivos alterados e exportação web: passaram.
- 30 testes unitários: conversão de cores, corte da ponta/meio, movimentos rápidos, preservação da curva e transparência, limites do esquema e regressões de desenhos/marcações de fotos.
- Navegador com viewport móvel e API simulada: ajuste da borracha, corte parcial, desfazer uma passada, escolha visual da cor e salvamento dos fragmentos e da cor.
- Editor de fotos com API simulada: recorte parcial do marca-texto, imagem original preservada, desfazer, reabrir, cancelar e salvar. Conferido também em largura de 320 pixels.

Não foi feita validação em aparelho físico nem publicação na VPS.
