# Salvamento de fotos e baixar como está — 10/11/2026

## Evidência

Vídeo local `WhatsApp Video 2026-11-10 at 13.13.15.mp4`, aproximadamente 32 segundos. A tela mostra um relatório LP com nove fotos e o erro: “A foto não pôde ser vinculada ao ponto”. O aviso genérico não oferecia acesso ao vínculo pendente e o botão de download tentava salvar de novo antes de baixar.

## Causa e correção

`useReportPhotoDrafts.move` não fazia nada quando a chave de origem e destino eram iguais. Isso acontece ao incluir pontos novos em relatórios existentes: o relatório continua com o mesmo ID, mas cada ponto novo recebe seu ID definitivo no servidor. A fila ficava com o identificador local, tornando a foto invisível nas fichas após a atualização dos pontos e impedindo o upload.

- O remapeamento agora é feito também na mesma chave. Fotos já enviadas não são repetidas durante uma nova tentativa.
- Novas fotos guardam também o número do ponto, permitindo recuperar um vínculo após restaurar a fila quando o identificador local já não estiver no formulário.
- Uma foto antiga sem vínculo reconhecido continua no telefone e aparece em “Fotos aguardando vínculo”, com miniatura, nome, seletor de ponto e opção para retirar somente a foto pendente.
- O erro `PHOTO_POINT_PENDING` leva à seção de pontos com instrução concreta. Erros localizados de foto abrem a lista com “Corrigir”, evitando a segunda janela genérica mostrada no vídeo.
- “Baixar como está” aparece nos avisos de falha/correção e nas ações da conclusão após uma falha. **Ajustado conforme a solicitação seguinte: gera o PDF normal com o preenchimento atual e as fotos locais disponíveis**, sem usar a versão anterior como conteúdo do arquivo e sem a marca de prévia.
- O formulário é capturado sem passar pela validação que bloqueou o salvamento. Fotos locais e assinaturas ainda pendentes são enviadas em multipart somente para a geração desse documento. Fotos sem ponto reconhecido entram como imagens complementares, com aviso explícito.
- Cada campo inválido, foto ilegível ou arquivo ausente é identificado no aviso antes do download. Somente os itens que não podem ser interpretados ficam vazios ou de fora; os demais dados e imagens entram normalmente. O usuário confirma “Baixar como está” depois de conferir esses avisos.
- A API monta uma cópia temporária para impressão. O relatório, suas fotos persistidas, sua versão e seu estado de aprovação não são alterados. A fila local permanece disponível para correção e sincronização posteriores.
- A entrega usa um token restrito ao usuário e ao relatório, válido por cinco minutos. PDFs temporários têm limite total de 64 MiB em memória; arquivos do multipart são removidos ao concluir a requisição. O envio de fotos tem limites de 10 MiB por arquivo e 100 MiB no conjunto.
- Observações internas e a folha de observações do desenho continuam excluídas do PDF. Imagens dos pontos seguem o mesmo padrão de preenchimento dos quadros usado nos demais downloads.
- Relatórios sem nenhuma versão salva precisam ser salvos antes de usar essa alternativa. As permissões de download e de edição/envio de fotos continuam sendo respeitadas.

## Validação

- A correção inicial do vínculo passou em 57 testes de fotos, sincronização e orientação de erros. A rodada seguinte passou em **124 testes de oito suítes**, incluindo montagem do PDF atual nos seis tipos, fotos locais, foto sem vínculo, arquivo ilegível, validade/privacidade dos tokens, download nativo simulado e regressões de upload/sincronização.
- **Seis testes de integração com PostgreSQL isolado e Chromium real**: um para EVS, EVD, LP, TH, ME e RDO. O salvamento normal foi recusado por um ponto inválido, mas o PDF foi gerado e entregue com título/dados atuais, foto local e foto sem vínculo. Arquivo quebrado gerou aviso identificado; observações internas e marca de prévia não apareceram. Comparação integral do banco confirmou ausência de alterações no relatório, pontos, fotos e assinaturas; não foi criado arquivo de histórico nem aprovação. Download sem autenticação e uso do token por outro usuário foram bloqueados.
- Interface compilada, Chromium e viewport de tablet com toque: fila antiga sem vínculo injetada no IndexedDB; salvar reproduziu o erro localizado; a preparação do PDF recebeu o preenchimento atual e os bytes da foto local; o aviso informou a inclusão da imagem complementar; o download foi entregue com nome normal, sem novo salvamento/aprovação. Depois, escolher o ponto e salvar enviou a foto; adicionar outro ponto LP com duas fotos ao mesmo relatório também salvou corretamente. API e seletor de compartilhamento simulados nesse teste de interface.
- Typecheck de app/API, lint e exportação web aprovados. Não houve teste em tablet físico.

## Atualização

**Esta versão altera a API e o aplicativo.** Após enviar o código, atualizar a VPS (`git pull origin master`; `npm run docker:production`) e gerar/instalar o APK novo no PC (`npm run apk`). Para uso somente pelo APK, `npm run docker:production:api` evita reconstruir o painel web. Não há migration nova nesta correção.
