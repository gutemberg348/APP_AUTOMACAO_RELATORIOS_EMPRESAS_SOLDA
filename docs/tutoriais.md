# Tutoriais

A aba Tutoriais está no menu lateral do painel e na navegação inferior do aplicativo. Todos os perfis padrão podem consultar; o administrador pode publicar, editar, substituir o arquivo e remover tutoriais. As permissões `training.view` e `training.manage` também são verificadas na API.

Cada tutorial tem título, orientações opcionais e um arquivo. Para vários materiais, publique um tutorial por arquivo. Há busca por título/orientações, filtros por fotos, documentos e vídeos e paginação.

## Arquivos

- Fotos JPG, PNG e WebP: até 10 MB.
- Documentos PDF, DOCX, XLSX e PPTX: até 20 MB.
- Vídeos MP4, MOV e WebM: até 100 MB. A reprodução depende do codec aceito pelo dispositivo; prefira MP4. O download continua disponível quando o dispositivo não reproduz o arquivo.

Fotos abrem na tela do tutorial. Vídeos têm player com controles e tela cheia. PDF tem visualização incorporada na web; no aplicativo, documentos abrem pelo compartilhamento do dispositivo. Arquivos Office podem ser baixados/compartilhados para abertura no aplicativo apropriado.

O envio grava em disco, valida extensão/assinatura do formato e tamanho; imagens também passam pela leitura de metadados. Falhas de validação ou de gravação no banco removem o arquivo recebido. Atualizações usam controle de versão para evitar sobrescrever alterações de outra sessão. Publicação, alteração e exclusão ficam na auditoria.

Arquivos ficam no storage persistente da API, em `tutorials/`, e só são servidos por endpoint autenticado. Caminhos físicos não são enviados ao cliente. O endpoint suporta requisições parciais para avançar vídeos, e usa cache privado sem armazenamento.

## API e instalação

- `GET /tutorials`: lista com `search`, `kind=all|image|document|video`, `page` e `limit`.
- `GET /tutorials/:id`: consulta.
- `GET /tutorials/:id/file`: arquivo; `?download=1` solicita download.
- `POST /tutorials`: multipart com `title`, `description` e `file`.
- `PUT /tutorials/:id`: multipart com `title`, `description`, `version` e arquivo opcional.
- `DELETE /tutorials/:id`: JSON com `version`.

A migração `20261009000000_tutorial_files` acrescenta metadados de arquivo e versão à tabela de treinamentos existente, sem remover registros. O frontend inclui `expo-video` compatível com o SDK 57 instalado. Referências: [player Expo](https://docs.expo.dev/versions/latest/sdk/video/) e [arquivos Expo](https://docs.expo.dev/versions/latest/sdk/filesystem/).

## Verificação

Testes de integração com PostgreSQL isolado cobrem permissões, publicação, busca/filtros, download autenticado, requisições parciais válidas e inválidas, edição, substituição de arquivo, conflitos de versão, remoção e limpeza após falha. A conferência no navegador inclui envio e leitura de foto/PDF/vídeo real, reprodução, download, edição, remoção e interface do perfil visualizador. A biblioteca no tema escuro passou pela análise axe nos critérios avaliados.

A tentativa de iniciar o emulador foi bloqueada pela revisão automática de permissões nesta sessão. A execução nativa deste recurso em Android/iOS permanece pendente; a compilação dos pacotes é verificada separadamente.
