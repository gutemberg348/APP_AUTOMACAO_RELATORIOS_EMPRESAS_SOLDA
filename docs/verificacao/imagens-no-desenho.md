# Imagens no desenho e tela cheia — 26/10/2026

- Botão de imagem ao lado de Ferramentas na tela cheia e acesso no desenho em linha. Galeria, câmera e arquivos usam o seletor e progresso existentes.
- A imagem entra selecionada, mantém sua proporção e aceita mover, girar e redimensionar. Ela é desenhada atrás dos traços, textos e pontos, independentemente da ordem de inserção. A seleção prioriza as marcações por cima.
- Laço e Selecionar tudo transformam a imagem junto com as marcações, preservando IDs e vínculos dos pontos. Limpar traços preserva a imagem; Limpar desenho remove os elementos da folha.
- Arquivos usam o envio multipart existente, limite de 10 MB e referência clientUploadId. O JSON do desenho guarda apenas referência, posição, dimensão e rotação. Não contém a imagem em base64.
- Imagens pendentes continuam disponíveis para nova tentativa quando o envio falha. Imagens removidas antes do envio são ignoradas no salvamento. Mídias já enviadas permanecem armazenadas se retiradas da folha, permitindo desfazer durante a edição.
- A imagem reaparece ao reabrir com download autenticado e é incorporada à página do desenho no PDF, sem recorte ou página duplicada. PDF com imagem ainda não enviada retorna aviso para salvar e aguardar o envio.
- Tela cheia abre com a folha inteira enquadrada. Ferramentas, ações e zoom ficam recolhidos no topo; o painel aberto tem altura limitada e rolagem própria. A área do desenho mantém espaço em retrato e paisagem.

## Verificação

- Build shared/API, TypeScript do app, ESLint e exportação web passaram. 152 testes unitários passaram.
- Chromium com API simulada, 390 × 844: inserir PNG, diminuir, marcar novo ponto sobre a imagem, selecionar segurando, redimensionar conjunto, salvar, simular falha de envio, tentar novamente e recarregar. Imagem e dois pontos reapareceram. Corpo do desenho maior que 600 px com ferramentas recolhidas.
- Em 844 × 390, abrir/recolher ferramentas mantém área utilizável do desenho.
- PDF EVS gerado e página renderizada com Poppler: imagem inteira e ambos os pontos na mesma página, sem repetição como croqui avulso. Captura `drawing-image-page.png`, PDF `drawing-image-qa.pdf`.
- Capturas de interface: `drawing-image-reopened.png` e `drawing-image-landscape.png`.
- Sem teste em celular físico, deploy ou APK gerado. Atualizar API e app; não há migração de banco.
