# Download e compartilhamento de PDFs — 10/11/2026

## Falhas encontradas

- As chamadas de PDF usavam o prazo comum de 12 segundos. A geração podia continuar na VPS depois de o aplicativo desistir e marcar o telefone como desconectado.
- O prazo terminava ao receber os cabeçalhos; uma leitura do corpo travada podia continuar sem limite.
- Em relatórios aprovados, o POST gerava o documento e o GET renderizava novamente todo o mesmo conteúdo.
- Cada chamada iniciava outro Chromium, sem limitar concorrência na VPS.
- O aplicativo convertia todo PDF para base64 antes de gravar no telefone, mesmo quando o transporte oferecia leitura binária direta.
- A ação aguardava atualização de listas do painel antes de começar o download e não indicava as etapas de preparação.

## Correções

- PDF: prazo total de 180 segundos por chamada, incluindo a leitura do arquivo. Cancelamento e prazo excedido não alteram o telefone para offline. Chamadas comuns mantêm a compatibilidade com o fallback offline.
- Preparação binária no celular limitada a 30 segundos, com leitura direta quando disponível e FileReader como alternativa. Arquivo com URI nova a cada resposta para evitar prévias antigas no visualizador.
- Validação de tipo e conteúdo vazio antes de oferecer o arquivo; erro amigável para falta de espaço ao gravar.
- Mensagens de preparação/download/abertura e cancelamento do download, liberando nova tentativa após falhas. A geração POST que registra uma versão não é cancelada pelo botão; possui seu próprio prazo.
- Atualização das listas em segundo plano, sem atrasar a entrega do documento.
- Cache de renderização compartilhado entre os serviços de POST/GET: até 32 MiB, 20 documentos e cinco minutos, somente em memória. Chave inclui os dados do relatório, empresa, obra, fotos, marcações, assinaturas e indicação de prévia/final. Campos apenas do ciclo de geração não provocam renderização duplicada.
- Mudanças nos dados invalidam a chave; reiniciar a API elimina o cache e usa os templates novos inclusive em relatórios antigos. Arquivos históricos não são sobrescritos.
- Uma renderização por vez, chamadas idênticas compartilham o trabalho; fila limitada, espera de até 30 segundos com aviso para tentar novamente. Geração limitada a 120 segundos, com cancelamento do Chromium. Falhas não entram no cache.
- Desenhos são analisados uma vez para localizar imagens, evitando repetir a validação completa para cada foto.
- Nginx já tinha prazo de 300 segundos nos proxies da API e do painel; não houve mudança de configuração.

## Validação

- 93 testes em sete suítes unitárias: transporte iOS/Android/web simulado, espera acima de 12 segundos, corpo/cabeçalhos travados, cancelamento, repetição, resposta HTML/vazia, gravação, compatibilidade Blob, cache/limite/fila, preservação de observações internas e sincronização offline.
- Integração com PostgreSQL isolado e Chromium real: EVS, EVD, LP, TH, ME e RDO com fotos; POST aprovado seguido de dois GETs usa uma única renderização. Bytes entregues iguais ao arquivo gerado. Alteração de título exige outra renderização; reabrir bloqueia PDF final e acesso anônimo continua bloqueado. Testes adicionais de Visual Direto também passaram.
- Interface web em viewport de celular: download após 15 segundos, cancelamento de resposta travada, erro de HTML e nova tentativa, compartilhamento com gesto de confirmação. API e seletor de compartilhamento simulados neste teste de interface.
- Typecheck de app/API, lint dos arquivos alterados e exportação web aprovados.
- Não validado em aparelho Android/iOS físico nem medido na VPS. A folha nativa de compartilhamento foi simulada nos testes; a escolha do aplicativo de destino depende do aparelho.

## Publicação

Há alterações na API e no aplicativo. Depois de enviar o código ao repositório, atualizar a VPS com `git pull origin master` e `npm run docker:production`. No PC, gerar com `npm run apk` e instalar o APK novo. Nenhuma migration nova é necessária para esta correção.

Se for atualizar apenas a API para uso pelo APK, `npm run docker:production:api` evita reconstruir o painel web. O painel só recebe as mudanças da interface após reconstrução do serviço web.
