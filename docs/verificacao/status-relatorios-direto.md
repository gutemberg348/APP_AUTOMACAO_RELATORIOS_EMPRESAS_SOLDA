# Alterar status diretamente no relatório

O seletor aparece no lugar da situação de cada cartão do app e de cada linha da tabela no painel. O resumo do início também usa o seletor. Tocar abre as situações permitidas; escolher envia a mudança imediatamente, sem abrir o relatório ou usar um botão de salvar. O filtro da listagem é independente.

A chamada PATCH `/reports/:id/status` envia `quick: true`, a situação escolhida e a versão exibida. Aprovar diretamente exige `reports.approve`; reabrir como rascunho exige `reports.review`; enviar à revisão exige `reports.submit` ou `reports.review`. Finalizar exige `reports.finish` e o relatório aprovado. Na troca rápida, o número é opcional: aprovação/revisão validam título, data e os dados técnicos exigidos pelo tipo. O número preenchido manualmente é preservado, e um relatório sem número continua sem numeração automática. As transições tradicionais continuam disponíveis sem a opção `quick` e mantêm a exigência do número para envio à revisão.

Durante o salvamento o seletor mostra atividade e fica bloqueado, mantendo o nome do status visível. Em erro o status salvo permanece e a janela do seletor reabre com a mensagem legível. Sucesso atualiza a lista, os resumos e o cache do documento. Quando a nova situação não corresponde ao filtro, o item sai da lista; a paginação é ajustada se necessário. Usuários sem permissão veem o status estático.

Reabrir limpa os dados de aprovação/finalização e preserva conteúdo, pontos, imagens e arquivos antigos. Finalizar novamente gera a próxima versão do PDF, preservando as anteriores. Cada mudança fica auditada com a origem `STATUS_SELECT`.

Verificações:

- 84 testes unitários e 22 de integração passaram. A integração cobre aprovação direta, reabertura de aprovado/finalizado, duas versões de PDF preservadas, permissões, conflito, validação e preservação dos desenhos/pontos.
- Navegador com API simulada: seletor no cartão e na tabela, aprovação/reabertura com um PATCH por escolha, versão correta, nenhuma navegação para detalhes, remoção pelo filtro, falha preservando a situação, consulta sem edição e larguras de 320 a 1440 pixels.
- Typecheck, lint, build da API e exports Expo web/iOS/Android passaram.
- A API Docker foi atualizada. Saúde HTTP 200 e schema `quick` presente no serviço em execução. As contagens de registros e arquivos foram preservadas na atualização; nenhum relatório real teve seu status alterado durante os testes.
- Interação em aparelho físico ainda precisa de conferência.
