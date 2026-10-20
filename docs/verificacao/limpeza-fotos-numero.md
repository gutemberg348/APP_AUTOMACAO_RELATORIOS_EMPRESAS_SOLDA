# Limpeza de pontos, fotos completas e número obrigatório — 20/10/2026

**Limpar pontos do desenho** agora exclui os pontos associados da lista de soldas, resultados, fotos e marcações desses mesmos pontos nos outros desenhos. O aviso pede confirmação antes de alterar o formulário; cancelar preserva o preenchimento. Pontos não presentes no desenho limpo e suas fotos são mantidos. A exclusão é efetivada ao salvar o relatório, usando a operação transacional já existente para remover fotos de pontos excluídos. Rascunhos de fotos desses pontos também saem da fila. O histórico local é reiniciado para não oferecer um desfazer que recupere apenas o desenho e deixe as fotos pendentes de exclusão.

As fotos do PDF usam `contain`, centralizadas e com a proporção original, nos cinco tipos de relatório. Os quadros continuam com duas imagens por linha. Imagens verticais ou panorâmicas podem deixar margens brancas para manter todo o conteúdo visível.

O número do relatório é obrigatório desde o rascunho. Os schemas compartilhados rejeitam ausência, vazio e somente espaços. Relatórios novos ou antigos sem número abrem a identificação. Salvar, baixar e compartilhar orientam o preenchimento do campo; API de atualização, mudanças para análise/aprovação e geração de PDF também validam a identificação. Confirmar outras pendências não dispensa o número. Reabrir um relatório antigo como rascunho continua permitido para corrigi-lo.

## Verificação

- 132 testes unitários passaram. Schemas conferem número obrigatório e normalização dos espaços; o teste de permissões mantém payload válido para conferir bloqueio de empresa.
- Compilação da API, TypeScript do app, ESLint e exportação Expo para web, iOS e Android passaram.
- Chromium em 390 × 844, com API simulada: cancelamento; exclusão de dois pontos, fotos e marcações compartilhadas; preservação do terceiro ponto e sua foto; envio conjunto de `removePointMediaIds`; número vazio bloqueia salvar e destaca a identificação; número válido salva; relatório antigo sem número abre o campo.
- Cinco templates renderizados com imagens vertical e panorâmica: enquadramento completo e proporção preservada. PDF EVS gerado para QA, renderizado com Poppler e inspecionado visualmente; arquivos temporários removidos após revisão.
- Testes de integração foram atualizados para exigir número e cobrir dados antigos sem número, inclusive tentativa de aprovar com confirmação de pendências. Não foram executados: Docker Desktop está desligado.

Não houve publicação na VPS nem geração de APK.
