# Anotação, pontos e espessura do desenho

- A ferramenta **Anotação** abre o campo de observação do desenho. Na edição normal, o campo fica abaixo da área de desenho. Em tela cheia, a edição usa o painel com ajuste para o teclado e a anotação fica disponível abaixo da área de desenho.
- A anotação usa `data.notes`, já persistido no relatório e impresso abaixo do desenho correspondente no PDF. As notas existentes continuam disponíveis.
- Pontos vinculados e marcações independentes mostram somente a bolinha e o número ao lado. Coordenadas antigas de etiquetas continuam aceitas, mas não afastam mais o número nem geram linhas ou caixas. Perto da borda direita, o número fica à esquerda da bolinha.
- **Afinar** e **Engrossar** ajustam novos traços ou o elemento selecionado. A espessura é persistida em linhas, lápis, formas, símbolos e cotas, aparece durante o gesto e é usada pelo SVG compartilhado com o PDF. Elementos antigos mantêm a espessura anterior.

## Verificação

- TypeScript dos workspaces e ESLint dos arquivos alterados aprovados.
- 16 testes de desenho aprovados: geometria, seleção, limites, compatibilidade de dados, espessura e anotação abaixo de cada desenho no HTML usado pelo PDF.
- Navegador com API simulada: espessura de traço novo e existente, desfazer, anotação por desenho, tela cheia, viewport de celular, salvar e recarregar preservando os dados. Nenhuma escrita na API de produção.
- Capturas locais: `drawing-notes-desktop.png` e `drawing-notes-mobile.png`.

Para salvar a nova espessura usando a API online, atualizar também a API/shared na VPS. Sem migração de banco: os desenhos já são armazenados como JSON. A validação não substitui teste em aparelho físico.
