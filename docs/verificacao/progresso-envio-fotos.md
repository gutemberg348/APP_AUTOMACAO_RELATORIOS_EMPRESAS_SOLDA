# Carregamento no envio de imagens

O seletor de origem mostra preparação/conversão, envio para verificação e conferência de duplicidade. A animação usa indicador de atividade e barra indeterminada, sem porcentagens inventadas. Durante a espera, os botões de origem ficam recolhidos; cancelamento do seletor nativo ou falha restaura as opções. Imagens de assinatura mostram a etapa de envio correspondente.

Salvar um relatório com imagens pendentes abre um painel com a etapa atual: salvar dados, preparar foto, enviar foto X de Y e atualizar o relatório. O nome do arquivo e o ponto acompanham cada foto. A contagem só avança depois da confirmação da API. A animação roda nativamente em iOS/Android e pelo Animated no navegador. O painel usa área segura e respeita retrato/paisagem.

Sucesso ou falha fecha o carregamento. A fila existente preserva somente as fotos pendentes, permitindo repetir o envio sem reenviar aquelas já confirmadas. O progresso é transitório e não altera o conteúdo dos relatórios ou a API.

Verificações realizadas:

- 84 testes unitários passaram. A verificação existente da fila também confere progresso e contagem de imagens confirmadas.
- Typecheck e lint passaram; exports Expo web, iOS e Android concluídos.
- Navegador com API simulada lenta: animação em movimento durante verificação, etapas de salvamento/upload, contagem 0/2 e 1/2, falha na segunda imagem fechando o painel, pendência preservada e tentativa seguinte enviando apenas essa foto; painel em paisagem sem transbordamento e sem erros de JavaScript.
- Capturas: `photo-check-progress-mobile.png`, `photo-upload-progress-mobile.png`, `photo-upload-progress-landscape.png`.
- Nenhum relatório real foi alterado nos testes. Nenhum processo Expo do usuário foi iniciado ou interrompido. A interação em aparelho físico ainda precisa de conferência.
