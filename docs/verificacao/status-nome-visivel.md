# Nome do status e mensagens de erro

O seletor dos cartões não tinha largura explícita. O texto com `flex: 1` podia ficar sem espaço no layout nativo, restando somente o ponto e a seta. A mensagem de erro também ficava dentro dessa coluna estreita.

O componente agora reserva 150 px nos cartões/tabela e 126 px no resumo recente, com `flexShrink: 0`. O status salvo continua escrito durante o envio, acompanhado do indicador de carregamento. Falhas preservam o status salvo e reabrem o seletor com a mensagem em largura completa e conteúdo rolável. Erros de validação de número, título e data identificam o campo e oferecem o botão para abrir o relatório e corrigir. A validação da API foi mantida.

Verificação: typecheck, lint e exports Expo web, iOS e Android passaram. No navegador, API simulada verificou os quatro nomes em cartões/tabela, larguras de 320 a 1440 px, carregamento com nome visível, atualização após sucesso, erro de número ausente, falhas de conexão/conflito, nova tentativa, permissões de leitura e alinhamento no resumo recente. A janela de erro também foi conferida em paisagem de 667 × 375 px. Não foram alterados relatórios reais nem os processos Expo do usuário. A verificação em aparelho físico permanece pendente.

Capturas: `report-status-name-visible.png` e `report-status-validation-readable.png`.
