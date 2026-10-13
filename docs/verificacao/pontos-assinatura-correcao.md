# Pontos no desenho e assinatura em tela cheia

- Remover um ponto pelo desenho apresenta duas opções explícitas: excluir o ponto, resultados, fotos e marcações em todos os desenhos; ou retirar apenas a marcação selecionada. A exclusão completa confirma a quantidade de fotos e usa o salvamento atômico já existente.
- Pontos cadastrados sem marcação aparecem como atalhos **Posicionar ponto**. O usuário toca no número e depois na posição do desenho. Não se cria outro ponto nem se alteram os resultados ou as fotos.
- Baixar uma prévia com desenhos e pontos sem marcação apresenta um aviso. O usuário pode voltar ao desenho ou baixar assim mesmo.
- O formulário aplica a resposta inicial e as respostas de salvamento explícito. Consultas em segundo plano não substituem pontos e desenhos ainda em edição.
- No relatório mais recente consultado durante a investigação, os dois pontos estavam cadastrados e os desenhos continham linhas, mas nenhum elemento de marcação. Não foram inventadas posições nem alterados dados reais. O reposicionamento permite incluir esses números novamente.
- A assinatura abre um modal em tela cheia com área segura, teclado dispensado, traço suavizado, guia, desfazer, limpar e confirmar. A rotação mantém os traços. Ao salvar, a assinatura é centralizada sem deformar as proporções e enviada à API; o caminho suavizado é usado no PNG armazenado.

## Verificação

- Typecheck e lint passaram; 83 testes unitários e 20 testes de integração passaram. A integração usa banco e armazenamento temporários.
- `scripts/verify-drawing-points.ts` verifica EVS, LP, TH, ME e RDO com os números S-701 e S-702 dentro da área do SVG após paginação. Gera os PDFs `pontos-desenho-*.pdf` e capturas na mesma pasta.
- Conferência no navegador com API simulada: cancelar exclusão, excluir ponto e vínculos, retirar somente marcação, salvar/reabrir, avisar antes do PDF, reposicionar ponto existente, manter desenho ao criar outro em tela cheia; assinatura com movimentos reais do mouse, desfazer, limpar, girar e enviar coordenadas válidas.
- A API Docker foi atualizada preservando volumes e as contagens de relatórios, desenhos, pontos, fotos, pessoas e assinaturas. Saúde do serviço: HTTP 200.
- Exports Expo web, iOS e Android verificados. A interação com o dedo em aparelhos físicos ainda precisa de conferência.
