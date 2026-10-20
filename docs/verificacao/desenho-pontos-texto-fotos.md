# Pontos, texto e seleção de fotos

## Comportamento

- **Limpar pontos do desenho** fica ao lado da contagem abaixo do canvas e nas ações da tela cheia. A confirmação informa quantos pontos vinculados têm conteúdo ou fotos. Remove somente pontos e marcações da prancha atual; preserva linhas, textos, símbolos, outros desenhos e todos os cadastros, fotos e resultados. É possível cancelar ou desfazer.
- Ao posicionar um ponto já cadastrado, o editor avança para o próximo sem marcação e depois para novos números. O próximo número aparece junto ao desenho, com **Alterar** e retorno à numeração automática.
- Ao informar um número existente no painel, o aviso explica que será usado o mesmo cadastro. Se já estiver no desenho, o próximo toque reposiciona a marcação.
- Avisos aparecem sobre o canvas, com fechamento acessível. Não é necessário procurar a mensagem no fim do formulário.
- **Texto** abre um painel próprio com tamanho e inclinação. É possível escrever e depois posicionar, ou tocar em um local vazio e escrever para inserir ali. Após inserir, um novo toque inicia outro texto; segurar permite mover o existente.
- O seletor de fotos identifica o ponto. Ao tirar a primeira de duas fotos, continua aberto com a prévia, permitindo tirar a próxima, escolher na galeria ou concluir com uma só.
- Seleção dupla na galeria, progresso, duplicação no mesmo ponto e bloqueio de foto usada em outro ponto continuam disponíveis. Em falhas parciais, as imagens válidas são mantidas e aparecem no resumo.

## Validação em 19/10/2026

- 129 testes unitários passaram; TypeScript do app e ESLint dos componentes alterados sem erros.
- Exportação Expo para Android, iOS e web concluída.
- Navegador em 390×844 com API simulada: numeração automática/manual, reposicionar número existente, aviso flutuante, cancelar/confirmar/desfazer limpeza, preservar outro desenho e dados preenchidos, inserir texto pelos dois fluxos e salvar.
- Regressão da hachura: três cantos, rejeição de triângulo degenerado, escala, rotação, espelhamento, edição dos cantos e persistência.
- Fotos: lote de duas, cópia ao lado, bloqueio em outro ponto, lote parcialmente válido e salvamento com vínculos corretos.
- Fluxo de câmera simulado por seleção de arquivos no navegador: primeira prévia, segunda foto sem reabrir o seletor, concluir com uma e salvar.
- Capturas móveis inspecionadas: `drawing-points-text-mobile.png` e `point-photos-camera-mobile.png`.
- Não foram usados câmera/teclado de aparelho físico, API de produção nem publicação nesta verificação.
