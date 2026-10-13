# Formulário simplificado e correção do isométrico — 08/10/2026

## Alterações

- Três etapas: Dados, Inspeção e Conclusão. Todos os campos dos modelos continuam disponíveis em blocos recolhíveis. Dados técnicos complementares, desenhos e fotos abrem sob demanda.
- Lista compacta de pontos com identificação e resultado. Abrir um ponto permite editar todos os seus campos; recolher preserva o preenchimento.
- Novas pranchas abrem com Tubulação ativa. Arrastar desenha um trecho com prévia; dois toques continuam criando linhas. Antes, gestos com deslocamento eram descartados, sem criar uma linha.
- Ferramentas principais e opções adicionais separadas. Metadados da prancha e coordenadas precisas podem ser expandidos.
- Campos ausentes recebem valores vazios consistentes no formulário. Abrir um bloco não deve marcar o relatório como alterado nem bloquear os anexos. Valores vazios continuam sendo removidos do payload ao salvar, preservando a edição e a limpeza dos dados.
- Salvar pelo bloco de fotos preserva a etapa e mantém esse bloco aberto na criação do relatório.

## Conferência

- Navegador desktop: linha visível durante o arraste, persistência ao soltar, desfazer/refazer, linhas por toques, seleção e movimentação.
- Toque emulado em 390px: inserção de texto e arraste de tubulação com prévia e persistência. Tela cheia e zoom conferidos.
- Duas pranchas, pontos novos e existentes, cota, símbolo, texto, foto e edição do vínculo/legenda. Salvar, reabrir e renumerar preservaram os vínculos; a prévia e o PDF final foram gerados. O documento final contém 7 páginas, e seu texto extraído confirmou a numeração, cota, observações e referências às pranchas.
- As três etapas permaneceram visíveis em 360px, sem rolagem horizontal da página. Capturas do editor simplificado e da navegação foram inspecionadas visualmente.
- Os cinco modelos (EVS, LP, TH, ME e RDO) passaram pelo fluxo de preenchimento, edição/limpeza de dados-base, pontos, leitura decimal, descontinuidades, responsáveis, fotos, prévia, aprovação e PDF final. Extração dos documentos confirmou os campos editados e resultados. A conferência sem pranchas vetoriais gerou, respectivamente, 5, 7, 4, 5 e 1 páginas; a quantidade depende do conteúdo.
- Não foram registrados erros de renderização nos fluxos. As telas finais mobile analisadas com axe não apresentaram violações nos critérios WCAG 2 A/AA e 2.1 AA; é uma conferência automática pontual.
- TypeScript e ESLint passaram. Exportação Expo para web, Android e iOS passou.

Os testes usam bancos e armazenamento temporários, sem registros fictícios no ambiente principal. Capturas/PDFs locais nesta pasta são artefatos ignorados pelo Git. Toque emulado e exportação não substituem a conferência em aparelho físico; essa execução continua pendente.

## Criação sequencial

A criação foi separada em duas telas de escolha e uma tela de preenchimento. O passo 1 mostra somente empresa/obra e habilita Continuar após carregar o contexto correto. O passo 2 mostra somente os modelos e um resumo da obra. Selecionar um modelo substitui as opções pelo formulário e reinicia a rolagem no topo.

Seleção manual de empresa/obra, acesso com apenas `projectId`, retorno para alterar a obra e cancelamento/confirmação de descarte passaram pela interface. As seleções anteriores ficam preservadas ao voltar. Na tela de preenchimento, os seletores de empresa e os cards de modelos não são renderizados. Capturas `report-pdf-wizard-*-mobile.png` foram conferidas em 390px. TypeScript, ESLint, formatação e exportação web/Android/iOS passaram.

EVS, LP, TH, ME e RDO foram criados pelo novo fluxo e concluídos até o PDF final. Os testes confirmaram que os campos, resultados, anexos e dados-base editados continuaram presentes nos documentos.
