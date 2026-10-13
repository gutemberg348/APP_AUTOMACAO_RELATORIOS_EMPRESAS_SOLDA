# Relatórios: três etapas e envio com pendências

Atualizado em 13/10/2026.

O progresso de relatórios novos e existentes mostra Rascunho, Análise e Aprovado, sem ações no cabeçalho. Durante o preenchimento, Salvar, Baixar PDF, Enviar e as ações de aprovação/revisão estão agrupados no rodapé somente da Conclusão. O fim da Inspeção tem **Ir para conclusão**; voltar preserva os dados e esconde o bloco de ações. Enviar abre as opções de análise ou compartilhamento do PDF. Relatórios legados finalizados aparecem como Aprovado.

Baixar e enviar salvam as alterações antes de prosseguir. Um aviso permite conferir as pendências ou continuar explicitamente, preservando pontos, fotos, desenhos e responsáveis. Cancelar o aviso mantém o rascunho salvo e editável. Depois do primeiro salvamento de um relatório novo, a próxima gravação atualiza o mesmo registro.

O endpoint `POST /reports/:id/pdf` gera o documento aprovado sem exigir finalização adicional. Permissões, controle de versão, armazenamento privado e descarte do arquivo em conflito continuam aplicados. A dispensa de campos obrigatórios nas transições rápidas exige `acknowledgeIncomplete: true` e registra as pendências na auditoria.

Verificações realizadas:

- 89 testes unitários e 26 de integração passaram. A integração usa banco e storage temporários e inclui transição parcial, ausência de confirmação, acesso negado, versão desatualizada, preservação das coleções e geração/download do PDF mantendo Aprovado.
- TypeScript e ESLint passaram; exportações Expo para web, Android e iOS passaram.
- Navegador com API simulada: salvamento antes do aviso, cancelamento, confirmação de envio, aprovação, download, compartilhamento após um novo toque, erros de salvar/enviar e ausência de duplicação na criação. Larguras de 320, 390, 768 e 1440 pixels conferidas sem transbordamento horizontal.
- Seletor e filtro apresentam somente Rascunho, Análise e Aprovado, incluindo registros legados finalizados.
- Bloco de ações somente na Conclusão conferido nos cinco modelos de relatório novo, em rascunho existente e em análise: avançar mostra os controles, voltar os esconde e mantém as edições. Acesso direto à conclusão e larguras de 390/1440 pixels também conferidos, sem gravações pela navegação. Capturas: [fim da inspeção](report-inspection-next-only.png) e [ações na conclusão](report-actions-conclusion-only.png).
- O seletor também foi conferido com campos obrigatórios faltantes: cancelar mantém o status anterior; confirmar repete a requisição com consentimento explícito e preserva os pontos. O fechamento da folha precede a próxima ação para evitar sobreposição de modais no aplicativo.
- Imagem Docker reconstruída e API local atualizada, com resposta 200 em `/health`. A conferência somente de leitura manteve os mesmos 7 relatórios, 27 pontos, 6 desenhos e 8 imagens; nenhum PDF final foi gravado no banco real pelos testes.

Capturas: [progresso e formulário](report-three-phases-dark.png) e [aviso de envio incompleto](report-incomplete-send-warning.png). O compartilhamento do navegador foi simulado, sem enviar arquivos a outras pessoas. A abertura do compartilhamento em aparelho físico ainda precisa ser conferida.
