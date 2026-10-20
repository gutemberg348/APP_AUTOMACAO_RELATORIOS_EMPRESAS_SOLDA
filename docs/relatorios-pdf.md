# Relatórios preenchidos pela obra e geração de PDF

Atualização de fotos: a mesma imagem pode ocupar os dois espaços do **mesmo ponto**. Em outro ponto ou relatório, a seleção é bloqueada. A galeria permite escolher as duas imagens juntas. Veja [regras e verificação de fotos](verificacao/fotos-mesmo-ponto.md).

## Preenchimento e edição

No cadastro/edição da obra, **Dados-base dos relatórios** reúne fábrica, proprietário, referência do projeto e os dados técnicos de cada ensaio. Cliente vem da razão social/nome da empresa; obra vem do nome do projeto; a referência usa o código/nome da obra quando não houver referência específica. Local do TH usa a localização cadastrada. Fábrica e proprietário têm campos próprios: não são deduzidos de outros nomes.

Ao criar um relatório, esses dados são copiados para os campos do tipo escolhido. Os campos continuam editáveis, inclusive para apagar um valor. Título e data são sugeridos; número continua manual. O RDO sugere a data atual e o nome do usuário como inspetor, ambos editáveis. Laudos, resultados, aceitabilidade e leituras não são inventados nem herdados dos exemplos.

Cada relatório salva sua própria cópia. Alterar a obra não modifica relatórios já criados. **Preencher com dados da obra** permite reaplicar explicitamente os dados-base nos campos permitidos, preservando resultados, laudos, pontos e imagens. As regras de cargo e bloqueio após aprovação/finalização continuam válidas.

## Campos dos cinco modelos

O catálogo compartilhado em `packages/shared/src/report-fields.ts` é utilizado pelo formulário, dados-base e templates. Os cinco originais de `materiais_base/` foram conferidos novamente; seus dados, fotos e assinaturas não foram copiados para cadastros ou templates.

| Tipo | Seções disponíveis                                                                                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EVS  | Cliente, fábrica, proprietário, obra, projeto; procedimento/revisão, ensaio, processo, metal de base, chanfro, gás, critério e norma; pontos/soldas com número, dimensão, descontinuidade, aceitabilidade e observações; fotos/croqui; laudo, resultado e responsáveis.                                                                          |
| LP   | Identificação e dados do ensaio, incluindo metal de adição; temperatura, espessura, superfície, iluminação e metal; penetrante/técnica de remoção; fabricante, marca, lote e validade de limpeza, penetrante, removedor e revelador; pontos/soldas, fotos/croqui, lista de descontinuidades, laudo, resultado e responsáveis.                    |
| TH   | Cliente/local, proprietário, obra, projeto, desenho de referência, norma do material, procedimento/revisão, ART e norma de referência; fluido, temperatura, fabricante, pressão, duração, equipamento, material, espessura e dimensão; fabricante/certificado/aferição/série do manômetro; imagens/croqui, observação, resultado e responsáveis. |
| ME   | Identificação, desenho, ensaio, espessura de projeto, metal e norma; equipamento; pontos com número, lado/parte, leitura, unidade, espessura de projeto, descontinuidade, aceitabilidade e observações; fotos/croqui, laudo, resultado e responsáveis.                                                                                           |
| RDO  | Data, inspetor, cliente, obra, fábrica, material, gás, diâmetro, tipo de solda e inspeção; fotos, observação e visto opcional.                                                                                                                                                                                                                   |

As leituras aceitam vírgula ou ponto decimal e são salvas como números. Os códigos de descontinuidade são manuais, pois as referências têm códigos ambíguos/repetidos. Nomes, registros e datas dos responsáveis geram espaços para assinatura; não há assinatura digital ou reprodução de rubricas dos exemplos.

## Fotos e croqui

Cada ponto reúne número, dimensão/leitura, descontinuidade, resultado e fotos. **Adicionar ponto** pergunta o primeiro número, sugerindo `1`; os seguintes acompanham o último número, preservando zeros e prefixos como `01` e `S-01`. Qualquer número permanece editável. Ao adicionar o próximo, o anterior é recolhido e mostra resultado e quantidade de fotos. Números vazios/repetidos são destacados antes de salvar.

**Adicionar foto ao ponto** oferece galeria, câmera ou arquivos, mesmo antes do primeiro salvamento. A imagem fica em prévia, com legenda opcional e cancelamento. **Salvar ponto e fotos** salva os dados do formulário e envia as fotos com o vínculo ao ID do ponto; renumerar não troca esse vínculo. Em uma falha parcial, os dados e envios concluídos ficam salvos e somente as fotos pendentes são mantidas para nova tentativa enquanto o app permanece aberto. Descartar alterações ao sair também descarta as fotos ainda não enviadas. A remoção de uma foto existente pede confirmação e ocorre ao salvar.

**Fotos adicionais (opcional)** recebe somente imagens gerais ou complementares, sem repetir as fotos dos pontos. Abre recolhido e não solicita salvar/liberar antes de escolher imagens: elas ficam em prévia e são enviadas no salvamento normal do relatório. O bloco não tem seletor de ponto ou segundo título. **Desenho técnico (opcional)** continua separado, com o isométrico/croqui. Legendas das imagens já salvas são editadas no cartão de origem, preservando o vínculo e a classificação dos anexos existentes. JPG, PNG e WebP têm limite de 10 MB; fotos da galeria em HEIC são convertidas. O [editor de desenho técnico](desenhos-tecnicos.md) permite pranchas vetoriais isométricas ou ortogonais, com pontos numerados, textos em várias linhas/inclinados e biblioteca visual de componentes.

A API verifica a imagem decodificada, limita pixels, ajusta orientação e tamanho e armazena JPEG sem metadados. SHA-256 é calculado sobre o arquivo recebido e a restrição única bloqueia reutilização exata, inclusive concorrente. Arquivos e PDFs permanecem privados, acessíveis somente pelas rotas autenticadas. Anexos usam a versão do relatório e são bloqueados após aprovação. As imagens podem ser escolhidas antes de salvar; o formulário bloqueia edição enquanto grava os dados, imagens e legendas, atualizando a versão entre operações.

## PDF e aprovação

O topo mostra somente três etapas: **Rascunho → Análise → Aprovado**. No fim da Inspeção, **Ir para conclusão** abre a etapa Concluir. Somente nessa etapa aparece o bloco do rodapé com **Salvar**, **Baixar PDF** e **Enviar**, além de aprovação e observações quando permitidas. Voltar à Inspeção esconde esse bloco e preserva o preenchimento. Enviar oferece **Enviar para análise** e **Compartilhar PDF**; aprovar ou reabrir depende das permissões do usuário. Ao baixar ou enviar, alterações do formulário são salvas primeiro.

Campos obrigatórios ausentes, pontos sem resultado/leitura, fotos faltantes no EVS, pontos sem marcação em desenhos existentes e responsáveis cadastrados sem assinatura aparecem em um aviso. O usuário pode conferir os dados ou continuar com as pendências. Continuar não exclui pontos, não preenche resultados e não transforma uma inspeção incompleta em aceitável. A API exige confirmação explícita para dispensar os campos obrigatórios da transição, mantendo autenticação, permissões, versão e validação da estrutura dos dados. A confirmação e as pendências são registradas na auditoria.

Rascunho e análise geram prévias; o relatório aprovado gera um PDF armazenado sem mudar para uma quarta etapa. Na web, Baixar PDF baixa o arquivo. Compartilhar PDF usa o compartilhamento do navegador quando disponível, com um novo toque após preparar o arquivo; em navegadores sem esse recurso, baixa o PDF. No aplicativo, o PDF abre o compartilhamento do sistema para salvar ou escolher WhatsApp, e-mail ou outro aplicativo disponível. A escolha e o envio ficam com o usuário.

`PdfService` usa HTML e Puppeteer no backend, com templates próprios em `templates/reports/{evs,lp,hydrostatic,thickness,rdo}/`. Todas as páginas A4 repetem o cabeçalho com marca Weldcosta, tipo do relatório, número, página atual/total e data. Fotos são organizadas em pares com número da solda, dimensão/leitura, descontinuidade e aceitabilidade repetidos acima de cada par, inclusive quando um ponto possui muitas imagens. O conteúdo inclui os valores editados, pontos, descontinuidades, responsáveis e imagens salvas. O RDO usa estrutura compacta. Quantidade de páginas acompanha o conteúdo.

O PDF é gerado antes da transação de gravação. `POST /reports/:id/pdf` confere novamente status/versão, grava `ReportPdf` e auditoria e mantém `APPROVED`. Falha de renderização preserva a aprovação; conflito descarta o arquivo reservado e não registra PDF final. A rota antiga de finalização permanece compatível; relatórios legados `FINISHED` aparecem como Aprovado, inclusive no filtro. Templates escapam textos, desabilitam JavaScript e bloqueiam requisições externas durante a renderização.

| Método | Rota                          | Permissão      |
| ------ | ----------------------------- | -------------- |
| GET    | `/reports/:id/pdf/preview`    | `pdf.download` |
| GET    | `/reports/:id/pdf`            | `pdf.download` |
| POST   | `/reports/:id/pdf`            | `pdf.download` |
| POST   | `/reports/:id/media`          | `media.upload` |
| GET    | `/reports/:id/media/:mediaId` | `reports.view` |
| DELETE | `/reports/:id/media/:mediaId` | `media.delete` |

Pontos e responsáveis são persistidos pelo POST/PUT do relatório, sob a mesma versão e política de campos. Atualizar pontos preserva IDs existentes e seus vínculos com imagens; IDs de outro relatório são rejeitados. A criação via API aplica dados-base por padrão; clientes que já enviam a cópia editada usam `prefillFromProject: false` para preservar inclusive remoções intencionais.

O mesmo POST/PUT persiste `drawings` com permissão `drawing.edit`. A resolução dos pontos criados no desenho e o salvamento das pranchas ocorrem na mesma transação. PATCH de `/reports/:id/media/:mediaId` edita a identificação da imagem com permissão `media.upload`, status/versão e vínculos verificados. O PDF inclui pranchas e fotos agrupadas com seus resultados. No EVS, os pontos aparecem nos blocos fotográficos, sem tabela separada.

## Modelo de endoscopia e seleção de fotos — 10/10/2026

O EVS segue a estrutura do arquivo fornecido `REL- 001 ENDOSCOPIA (1).pdf`: moldura preta, logotipo extraído do próprio documento, capa cliente/fábrica, identificação e dados técnicos, desenho, soldas e laudo final. Cada página tem cabeçalho com título da seção, número do relatório, página/total e data. Cada bloco de solda tem duas posições de foto e a aba SOLDA/DIMENSÃO/DESCONT./ACEITÁVEL; cabem quatro blocos por página sem legendas adicionais. Uma foto única ocupa uma posição, sem duplicação automática. Pontos sem fotos permanecem identificados com espaço vazio. Legendas e observações informadas são preservadas.

O fechamento tem texto do laudo, legenda de descontinuidades do modelo, resultado marcado e três espaços para assinatura: INSPETOR, APROVADO POR e CLIENTE, com nomes, registros e datas cadastrados. Os traços manuscritos do documento de referência não são reutilizados. Responsáveis adicionais continuam incluídos. Textos extensos ganham páginas de continuação, medidas pelo Chromium antes de numerar o documento.

`POST /reports/media/check` exige `media.upload` e verifica formato, tamanho e SHA-256 antes de aceitar a foto no formulário. Não cria relatório, arquivo ou registro. O seletor aguarda essa conferência e mantém o aviso aberto quando a imagem já existe; a fila também compara os hashes das fotos selecionadas em outros pontos/rascunhos do usuário. Renomear o arquivo não contorna a conferência. O upload mantém a validação final para concorrência. A comparação identifica arquivos com os mesmos bytes; não faz reconhecimento visual de recortes ou imagens reeditadas.

Conferência: 62 testes unitários e 17 de integração passaram, incluindo seleção antes do primeiro salvamento, arquivo renomeado, permissões e ausência de escrita na conferência. `node node_modules/tsx/dist/cli.mjs scripts/verify-evs-layout.ts` verifica quatro blocos/oito fotos por página, três assinaturas, numeração e preservação de textos extensos. Prévia do relatório enviado pelo usuário gerada em modo somente leitura: `docs/verificacao/report-EVS-previa-corrigida.pdf`; exemplo com nove soldas/dezoito fotos: `docs/verificacao/report-EVS-modelo-verificado.pdf`.

No navegador, o seletor recusou a repetição de uma foto pendente renomeada e exibiu a recusa de uma imagem já cadastrada retornada pela API, mantendo apenas uma foto na fila e nenhuma escrita de relatório/upload. Captura: `docs/verificacao/photo-duplicate-selection.png`. TypeScript, ESLint, build da API e exportações web/Android/iOS passaram. O seletor no iPhone físico não foi executado nesta conferência.

## Ambiente

### Demais modelos-base — 10/10/2026

Os PDFs em `materiais_base` foram comparados visualmente página a página. LP, TH, ME e RDO agora têm templates próprios com a moldura, o logotipo, os campos e o fechamento do respectivo modelo. A paginação usa a quantidade real de folhas produzidas, inclusive quando o arquivo-base tem numeração impressa divergente da quantidade de páginas.

- **LP:** capa e identificação; desenho; fotos em duas colunas com identificação por solda; dados gerais; materiais em colunas de limpeza, penetrante, removedor e revelador com fabricante, marca, lote e validade; descontinuidades/legenda; laudo e três espaços de assinatura.
- **TH:** capa cliente/local; identificação; ficha com fluido, ART, procedimento, manômetro, certificado e aferição; dados do equipamento/teste; fotos; observação, resultado e assinaturas de técnico de inspeção, engenheiro mecânico e cliente.
- **ME:** capa e identificação; equipamento/linha com fotos e leituras por lado. Pontos com o mesmo texto no campo de lado/identificação são agrupados; leituras e fotos excedentes ganham continuação. Os valores cadastrados, unidades, observações e espessuras são preservados. Fechamento com laudo, resultado, três assinaturas e contato.
- **RDO:** ficha compacta sem capa ou laudo separado, com inspetor, visto, cliente, obra, fábrica, material, gás, diâmetro e tipos de solda/inspeção no topo. Dados de identificação se repetem nas continuações; imagem única fica centralizada e múltiplas imagens usam pares; observações seguem no corpo da ficha.

Número do relatório, página/total e data constam em todas as folhas. As assinaturas usam os responsáveis cadastrados e espaços para assinatura, sem copiar os traços dos documentos-base. Normas, nomes e resultados de exemplo não são importados para relatórios do usuário.

Verificação reproduzível: `node node_modules/tsx/dist/cli.mjs scripts/verify-reference-reports.ts`. Os exemplos verificam todos os campos dos formulários, imagens, assinaturas, textos longos e continuações. Saídas: `docs/verificacao/report-{LP,TH,ME,RDO}-modelo-verificado.pdf`. Nos cenários de referência: LP com seis páginas, TH com cinco, ME com quatro e RDO com uma. A quantidade real de páginas e os cabeçalhos foram conferidos também nos PDFs renderizados, além do HTML.

### Upload no Expo SDK 57

O SDK 57 instala `expo/fetch` como transporte nativo padrão. O formato antigo de multipart `{ uri, name, type }` não é aceito por seu serializador: a leitura do JSON do relatório funciona, mas a imagem falha antes de chegar à API e o app pode mostrar uma falha de conexão. `services/upload-file.ts` agora usa `expo-file-system` para validar o arquivo e fornecer os bytes binários, preservando nome/MIME. O cliente usa `expo/fetch` explicitamente em iOS/Android e o fetch do navegador na web. Relatórios e tutoriais usam o mesmo helper, sem definir manualmente o boundary.

Fotos indisponíveis ou maiores que o limite geram uma mensagem específica. Fotos que falham continuam pendentes para nova tentativa; envios concluídos não são repetidos. Depois de recarregar o app, fotos ainda não enviadas precisam ser selecionadas novamente, pois a fila permanece em memória.

Conferência: 59 testes unitários e 17 de integração passaram. O serializador real da versão instalada reproduziu a rejeição do formato antigo e aceitou o binário novo nos casos iOS/Android. A API recebeu esse multipart com fotos vinculadas e gerais; inspeção e conclusão foram gravadas. O navegador também conferiu as duas etapas com upload real em banco temporário. TypeScript, ESLint e exportações web/iOS/Android passaram. O envio em iPhone físico continua pendente de conferência. Referências: [Expo fetch](https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api) e [upload de arquivos no Expo](https://docs.expo.dev/versions/latest/sdk/filesystem/#uploading-files-using-expofetch).

Conferência da separação de fotos: 51 testes unitários, TypeScript, ESLint e exportações web/Android/iOS passaram. No navegador com API/banco isolados, fotos de pontos e fotos gerais foram escolhidas antes do primeiro salvamento, enviadas uma única vez e verificadas nos respectivos blocos. Edição de legenda preservou a associação original. Um rascunho RDO foi salvo sem pontos, imagens ou pranchas. Capturas em `docs/verificacao/additional-photos-mobile.png` e `additional-photos-desktop.png`.

Conferência de 09/10/2026: testes no navegador verificaram a pergunta inicial, sequência manual, cartões recolhíveis, escolha de fotos antes de salvar, renumeração com vínculos preservados, falha parcial e retomada sem duplicar os envios concluídos, remoção de foto e gravação dos textos/símbolos. Uma prévia real de oito páginas foi verificada com cabeçalho completo em cada página. PDF e capturas em `docs/verificacao/report-point-photos-preview.pdf`, `report-point-photos-page.png`, `report-header-page.png`, `point-photos-mobile.png` e `drawing-symbols-desktop.png`. Conferência de gestos e seletores em celular físico permanece pendente.

43 testes unitários e 16 de integração passaram, incluindo descarte/cancelamento da navegação com fotos pendentes. TypeScript, ESLint, build do backend e exportações web/Android/iOS também passaram. A tela cheia do desenho foi verificada com axe nos critérios avaliados.

A imagem Docker instala Chromium/fontes e configura `PDF_CHROME_EXECUTABLE=/usr/bin/chromium` e execução apropriada ao container. Na execução local, `PDF_CHROME_EXECUTABLE` pode apontar para Chrome/Chromium; o serviço também procura a instalação padrão do Chrome no Windows. `PDF_DISABLE_SANDBOX` fica falso por padrão localmente. `STORAGE_PATH` continua privado.

Migration adicional: `20261008000100_project_report_defaults`, adicionando JSONB de dados-base à obra. Não remove registros existentes.

Referências de implementação: [PDFOptions do Puppeteer](https://pptr.dev/api/puppeteer.pdfoptions), [configuração do navegador](https://pptr.dev/guides/configuration), [DocumentPicker do Expo](https://docs.expo.dev/versions/latest/sdk/document-picker/).

## Conferência

Os 28 testes unitários e 13 testes de integração passaram, incluindo o editor técnico. A integração em PostgreSQL e storage temporários cobre os cinco PDFs, edição, coleções, upload/deduplicação, pranchas e ordem, vínculos dos pontos, bloqueio após finalização, autenticação do download e preservação da aprovação/limpeza de artefatos quando a geração falha ou há conflito.

O fluxo dos cinco tipos também foi executado pelo navegador, desde os dados-base da obra até o download final, conferindo o texto extraído do PDF, imagens, valores apagados, leitura decimal, responsáveis e paginação. O servidor Docker gerou uma prévia de relatório existente, sem alterar dados de negócio. TypeScript, ESLint, build e exportação Expo para web, Android e iOS passaram. Detalhes em [verificação dos relatórios](verificacao/relatorios-pdf.md). A execução em aparelho físico continua pendente.
