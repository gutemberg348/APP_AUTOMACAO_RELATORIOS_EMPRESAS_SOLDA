# Contorno da seleção no desenho

O contorno e as alças estavam em um SVG interno diretamente sob o SVG principal,
enquanto os elementos estavam em SVGs internos dentro de grupos. Nos renderizadores
nativos, essas hierarquias têm caminhos diferentes para calcular o viewport. Isso
permitia aplicar uma escala/posição diferente à seleção, apesar de sua geometria
usar as mesmas coordenadas da linha.

`DrawingCanvas` agora monta os filhos vetoriais do XML em grupos, com um único SVG
principal. Fundo, linhas, textos, símbolos, imagens, contorno e alças compartilham
o mesmo viewport. O parse continua memorizado e os elementos não editados continuam
montados durante os gestos. O formato salvo e o SVG de exportação não mudaram.

## Verificação realizada

- Typecheck do app, ESLint, Prettier e exportação web concluídos.
- 334 testes unitários existentes passaram.
- Interface real em Chromium, com API simulada e dados descartáveis: pressão de
  2,5 segundos, linha vertical, rotação de 45 graus, redimensionamento, arraste
  durante e após o gesto, desfazer/refazer, zoom, retrato/paisagem e editor embutido.
- Conferência das coordenadas de tela: as duas pontas ficam dentro do contorno,
  as alças coincidem com as pontas e nenhuma camada cria outro SVG interno.
- Regressão do posicionamento do número do ponto: arraste do número e da bolinha,
  quatro posições rápidas, prévia, desfazer/refazer e salvamento passaram.
- Captura da interface inspecionada visualmente.

Não foi executado um APK em aparelho físico nesta verificação. Validar a mesma
sequência no Android/iOS, especialmente após segurar a linha com Endireitar ativo.

## Atualização

Esta correção altera apenas o renderizador do cliente. Para o aplicativo instalado,
gerar e instalar outro APK (`npm run apk`). Não exige atualizar a API. Para receber
a correção no painel web, é necessário publicar a nova compilação web.
