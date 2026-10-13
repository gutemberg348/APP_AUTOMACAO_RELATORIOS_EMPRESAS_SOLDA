# Usabilidade de relatórios — 11/10/2026

- Retorno contextual no cabeçalho das páginas, preservando o filtro de empresa ao voltar da obra e a confirmação de alterações pendentes.
- Preenchimento automático somente em novo relatório, com consulta por obra e tipo. Combina os últimos dados não vazios dos 100 relatórios mais recentes. Dados-base existentes e campos editados/limpos durante a consulta prevalecem. Relatórios existentes mantêm o preenchimento por botão. Sem histórico, os campos permanecem disponíveis para preenchimento manual.
- Cada seção permite seguir para a próxima e recolhe a atual. A última seção leva à revisão/salvamento. EVS, LP, TH, ME e RDO usam esse fluxo, mantendo a validação ao salvar.
- Novo desenho preserva os anteriores. Exclusão visível com confirmação, também em tela cheia; a gravação continua no salvamento do relatório. Alternar/criar/excluir cancela gestos pendentes para evitar que um traço iniciado em outro desenho seja aplicado ao selecionado.

Verificação: TypeScript, ESLint e 80 testes unitários passaram. Exportação Expo concluída para web, iOS e Android. Navegador com API simulada conferiu retornos, preservação dos desenhos e linhas, cancelamento, exclusão, Desfazer, exclusão em tela cheia, remoção de todos os desenhos e criação novamente; histórico incompleto, prioridade dos dados-base, isolamento por obra/tipo, resultados não copiados e navegação por todas as seções dos cinco modelos. Larguras de 360, 390, 768 e 1440 px sem rolagem horizontal ou erro JavaScript.

Captura: `report-usability-drawings-mobile.png`. Não foi necessário alterar a API ou o banco nesta tarefa. Gestos e teclado em iOS/Android físicos ainda dependem de conferência no aparelho.
