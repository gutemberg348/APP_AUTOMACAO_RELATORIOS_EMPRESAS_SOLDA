# Responsáveis no relatório — 19/10/2026

O preenchimento agora começa pela função: inspetor, responsável técnico ou representante do cliente. As funções ainda não adicionadas têm atalhos próprios. Adicionar responsável abre a escolha da função, incluindo revisor e outro. Um cadastro vazio já existente da mesma função é reaproveitado.

Escolher uma pessoa cadastrada, cadastrar uma pessoa dentro do relatório ou reutilizar outro responsável mantém a função de destino. Nome, registro e assinatura podem ser reutilizados em várias funções sem alterar a função padrão da pessoa no cadastro geral. A função de um responsável já existente continua editável, preservando seus dados.

Quem não tem permissão de gerenciar pessoas pode preencher os responsáveis e suas assinaturas no relatório, mas não recebe o botão para gravar no cadastro geral.

## Verificação

- TypeScript do app e ESLint dos dois arquivos alterados: passaram.
- Exportação Expo para web, Android e iOS: passou.
- Fluxo em Chromium com viewport 390 × 844 e API simulada: passou. Nenhum dado de produção foi alterado.
- Conferidos: três funções, preenchimento manual, pessoa cadastrada como OTHER aplicada como CLIENT, reutilização da assinatura como TECHNICAL_RESPONSIBLE, cadastro com função de destino preservada, reaproveitamento de campo vazio, alteração manual de função, salvar e reabrir, permissões do inspetor.
- Captura `responsaveis-mobile.png` inspecionada: título e descrição ocupam a largura disponível e o botão de adicionar fica abaixo.

Não foi feito teste em aparelho físico nem publicação na VPS ou geração de APK.
