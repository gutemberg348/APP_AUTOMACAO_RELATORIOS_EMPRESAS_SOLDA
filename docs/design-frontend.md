# Design do frontend — Weldcosta

A interface foi refinada sobre o projeto Expo existente. Web, iOS e Android compartilham os mesmos componentes e fluxos.

## Pessoas e assinaturas

O cadastro reutilizável está no menu lateral do painel, no menu do perfil do app e na seleção de responsáveis do relatório. Selecionar uma pessoa preenche nome, função, registro e assinatura, com edição livre no documento. É possível repetir os responsáveis do relatório anterior, cadastrar durante o preenchimento, assinar na tela ou enviar uma imagem. Os cinco modelos de PDF exibem as assinaturas. [Fluxo, persistência e verificações](verificacao/pessoas-assinaturas.md).

Assinar abre uma área em tela cheia com desfazer, limpar, guia e confirmação. Girar o aparelho mantém os traços; a imagem salva centraliza e suaviza a assinatura sem deformá-la. O desenho distingue excluir o ponto e todos os vínculos de retirar só a marcação. Pontos sem marcação têm atalhos para posicionar e aviso antes da prévia. Consultas em segundo plano preservam alterações ainda não salvas. [Correção e verificações de pontos e assinatura](verificacao/pontos-assinatura-correcao.md).

O envio de imagens mostra um indicador giratório e uma barra animada. Ao selecionar a foto, o seletor informa preparação e envio para verificação; durante o processamento as opções de origem ficam recolhidas. Ao salvar fotos do relatório, um painel mostra a etapa, nome do arquivo, ponto e **Enviando foto X de Y**, com a quantidade realmente enviada. Ao concluir ou falhar, o painel fecha; fotos pendentes continuam disponíveis para nova tentativa. O envio de assinatura também informa preparação e upload. [Verificação do carregamento de fotos](verificacao/progresso-envio-fotos.md).

## Lista de relatórios

Os seletores de situação usam texto, indicador e seta no mesmo eixo vertical, sem uma etiqueta interna presa ao topo. Nos relatórios recentes, as linhas têm espaçamento uniforme, título/subtítulo com altura de linha explícita, ícones alinhados e seletores de largura fixa com alvo de 44 px. A atividade de salvamento ocupa o próprio seletor compacto para evitar deslocamento vertical do nome durante a requisição.

O status de cada cartão e de cada linha é um seletor com seta. Escolher uma opção envia a alteração imediatamente, sem abrir o relatório ou exigir outro botão de salvar. As opções respeitam as permissões do usuário; quem apenas consulta vê a indicação estática. O seletor permite aprovação direta e reabertura como rascunho. Finalizar gera o PDF; finalizar novamente depois de reabrir preserva as versões anteriores. Durante a requisição o seletor fica ocupado; falhas preservam o status salvo e mostram o erro. O filtro acima da lista permanece separado dessa edição.

O seletor **Status do relatório** fica visível acima da lista com Todos os status, Rascunho, Em revisão, Aprovado e Finalizado. Filtrar mantém empresa, obra e os demais filtros e volta à primeira página. Usuários com `reports.delete` têm **Excluir relatório** em cada cartão no app e em cada linha no painel. A ação pede confirmação, identifica o relatório e sua situação e retira o registro da lista sem apagar seus dados, fotos, desenhos, assinaturas ou PDFs do histórico. A API permite essa exclusão lógica em qualquer situação, verifica a versão e registra a situação anterior na auditoria. Excluir o último item de uma página volta à página anterior; conflitos atualizam a lista e exigem uma nova seleção. Os controles de exclusão são separados do link que abre o relatório.

No EVS, **Título da linha / equipamento** identifica o nome impresso no centro da segunda página do PDF. Novos relatórios sugerem o nome da obra, sem anexar o nome do tipo de ensaio. O PDF também reconhece a sugestão automática antiga exata e usa o nome da obra; títulos personalizados permanecem como informados. O cabeçalho mantém **RELATÓRIO DE ENSAIO VISUAL DE SOLDAS**. As fontes do cabeçalho, número/data, título e dados foram aumentadas e a paginação foi conferida nos cinco modelos.

## Identidade e componentes

- Tipografia Manrope com cinco pesos carregados localmente pelo Expo Font.
- Tokens de cores, tipografia, espaçamento, bordas e pontos de adaptação em `apps/app/utils/tokens.ts`.
- Azul Weldcosta, superfícies claras e cores de status com texto e ícones.
- Ícones SVG consistentes, marca vetorial de interface e ilustração técnica decorativa no login.
- Botões com estados de foco, interação, processamento e indisponibilidade.
- Campos com rótulos, foco visível, mensagens de erro e tamanho de texto de 16px em telas pequenas para evitar o zoom automático do Safari.
- Seletores de empresa/obra com busca paginada em modal no desktop e painel inferior no mobile.
- Componentes para cards, cabeçalhos, badges, formulários em colunas, vazios e paginação.

## Temas claro e escuro

O botão de lua no cabeçalho alterna para o tema escuro; o sol retorna ao tema claro. Está disponível no login e junto ao perfil, no site e no aplicativo. A preferência é salva por dispositivo e restaurada ao abrir novamente.

As duas paletas cobrem navegação, cards, formulários, seletores, calendário e diálogos. A mudança atualiza os componentes sem remontar o formulário, preservando campos preenchidos, pontos e a etapa atual. A barra de status do aplicativo acompanha o tema.

Conferido no navegador em desktop e celular, incluindo persistência ao recarregar, preservação dos campos e proteção de alterações não salvas. As telas analisadas com axe passaram sem violações nos critérios avaliados. No Expo Go em emulador Android, foram verificadas a alternância, a preservação do texto digitado e a restauração do tema após encerrar e reabrir o aplicativo.

## Máscaras de entrada

O componente `Field` aceita `mask="cnpj"`, `mask="cpf"` e `mask="phone"`, com formatação durante a digitação, exemplos no placeholder e teclado apropriado. CNPJ e telefone estão aplicados no cadastro e na edição das empresas, além da leitura nas consultas/listagens. A máscara de CPF está preparada para cadastros futuros, conforme solicitado; não foi criado um novo campo de CPF.

CNPJ aceita números e letras nas primeiras 12 posições, mantendo os dois últimos caracteres numéricos, conforme o [padrão alfanumérico da Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico). CPF usa `000.000.000-00`. Telefone adapta-se a fixo ou celular com DDD e reconhece o prefixo `+55`.

A edição conserva a posição do cursor ao inserir pontuação e permite apagar separadores sem prender o cursor. Valores antigos são formatados para exibição; alterar outro campo da empresa preserva os valores originais de CNPJ e telefone. Campos continuam opcionais e a API mantém seu contrato de strings. As máscaras não verificam a situação cadastral nem calculam dígitos verificadores.

Foram conferidos 14 cenários de formatação e exemplos de posição do cursor. No navegador, foram verificados digitação, substituição de trechos, exclusão, entrada completa de valores já formatados, CNPJ alfanumérico, telefones fixo/celular e `+55`, payload e abertura da edição. Os endpoints de escrita/consulta da empresa de teste foram interceptados no navegador, sem persistir empresas fictícias no banco de desenvolvimento.

A alteração passou no TypeScript, ESLint e export dos bundles web, iOS e Android no Expo SDK 57.

## Datas e seletores

`DateField` reúne máscara `DD/MM/AAAA`, teclado numérico, validação e calendário em português. Está aplicado ao período das obras, data dos relatórios, validade dos materiais de LP, aferição do manômetro de TH, data do RDO, campos personalizados de data e filtros de relatórios. Datas válidas são convertidas para `AAAA-MM-DD` antes do envio, preservando o contrato da API. Preenchimentos incompletos ou impossíveis são sinalizados; o período final não pode anteceder o inicial. Os filtros enviam somente datas válidas e suspendem a consulta enquanto o período estiver invertido.

O calendário permite navegar pelos meses, escolher mês e ano diretamente, selecionar hoje, confirmar ou cancelar. Cancelar preserva o valor anterior; limpar está disponível para campos opcionais. Dias fora dos limites ficam indisponíveis. O cálculo dos dias usa UTC e a data de hoje usa o horário local do dispositivo, evitando deslocamento de um dia na conversão.

`SelectField` oferece opções com ícone, descrição, seleção destacada, foco e limpeza. Está aplicado ao resultado do laudo e ao filtro de tipo de inspeção. Listas locais com mais de seis opções disponibilizam busca sem distinção de acentos. `EntityPicker` compartilha o mesmo visual, com busca e paginação na API para empresas e obras, detalhes dos registros, indicação da seleção atual e estados de carregamento, vazio e erro.

`PickerSheet` apresenta os controles em modal central no desktop e painel inferior no celular, com área de conteúdo rolável, ações fixas e respeito às áreas seguras. Campos sem permissão de edição permanecem bloqueados. O teclado permite acionar as opções com Enter e fechar com Escape na web.

Foram conferidos anos bissextos, datas impossíveis e 60 meses de calendário, incluindo anos nos extremos permitidos. No navegador, foram verificados digitação, payload ISO, validação do período e de datas específicas de relatório, confirmação/cancelamento/limpeza, navegação por mês e ano, busca/paginação/limpeza dos seletores e filtros. A conferência visual cobriu 1440px, 768px, 390px, 360px e paisagem 740×360, sem rolagem horizontal e com ações do calendário visíveis. Os seletores de empresa e resultado no desktop e o calendário no desktop/celular passaram na auditoria axe nos critérios analisados. As escritas foram interceptadas, sem persistir registros fictícios. Capturas: `docs/verificacao/controls-*.png`.

TypeScript, ESLint e export web/iOS/Android são as verificações de compilação. A execução em aparelho físico continua pendente.

## Navegação e telas

### Digitação e máscaras

CNPJ, CPF, telefone e datas compartilham a correção de cursor. A máscara mantém uma cópia local do texto digitado enquanto o controlador do formulário publica a atualização; redefinições externas e escolhas no calendário continuam atualizando o campo. A posição é aplicada uma única vez depois da atualização do texto; eventos de seleção não são devolvidos continuamente ao campo. A posição é calculada a partir da edição efetiva, inclusive quando o iOS envia eventos atrasados. Apagar sobre separadores remove o caractere de conteúdo vizinho e evita prender o cursor. Telefones com DDD 55 preservam sua numeração ao chegar ao limite, sem interpretar um dígito extra como código de país.

Foram conferidos os campos básicos dos cadastros de empresa e obra, as quatro validades dos materiais LP, a aferição do manômetro TH, colagem, substituição de seleção, edição no meio do valor e payload de salvamento com datas ISO. CNPJ numérico/alfanumérico, CPF, telefone fixo/celular e datas passaram em testes de regressão. O componente também foi exercitado com uma ponte nativa simulada, incluindo atualização diferida do controlador, seleção antes do texto e notificações atrasadas depois da formatação. As 79 verificações unitárias, TypeScript, ESLint e exportações web/iOS/Android passaram. A execução física no iPhone ainda exige conferência no Expo Go.

- Sidebar de 248px a partir de 960px; navegação inferior nas telas menores.
- Cabeçalho contextual, perfil acessível e saída da sessão.
- Dashboard com indicadores reais, relatórios recentes, distribuição por ensaio e fluxo de aprovação. As visualizações usam os dados da API e não apresentam tendências ou números inventados.
- Tabelas de empresas, obras e relatórios a partir de 1100px; cards no mobile e tablet.
- Telas de consulta de empresa/obra separadas da edição, com ações de arquivamento explícitas.
- Na obra, fábrica/unidade e proprietário ficam junto da identificação e são opcionais. Referência do projeto e dados técnicos por tipo ficam recolhidos em uma seção opcional. Recolher ou trocar o tipo preserva os valores preenchidos. Erros ao salvar mostram o campo exato e deslocam a tela até ele; um erro técnico abre a seção e seleciona o tipo correspondente.
- Criação sequencial: passo 1 com empresa/obra e botão Continuar; passo 2 com os modelos; selecionar um modelo abre somente o formulário, no topo da tela. Um resumo mantém a obra e a empresa visíveis, com ações para alterar a obra ou trocar o tipo. Alterações não salvas continuam protegidas pela confirmação de descarte.
- Formulários específicos com navegação por etapas, validação junto aos campos e indicação de alterações ainda não salvas.
- Revisão com fluxo visual, ações de aprovação/correção e leitura organizada dos campos.
- Datas de consulta e preenchimento apresentadas em DD/MM/AAAA, com conversão para o formato definido pela API ao salvar.

## Atalhos de preenchimento dos relatórios

O cartão **Preenchimento rápido** reúne os últimos valores informados nos 100 relatórios mais recentes da mesma obra e tipo. Um rascunho incompleto não esconde dados informados nos anteriores. Em novos relatórios, campos vazios são preenchidos uma vez, automaticamente, preservando os dados-base da obra e campos digitados ou limpos enquanto a consulta carrega. Em relatórios existentes, o botão preenche os campos vazios e respeita as permissões de edição. Laudos, resultados, observações extensas, data da inspeção e identificação do inspetor não são reaproveitados. Dados técnicos, lotes e datas de calibração/validade ficam editáveis e devem ser conferidos.

Cada seção aberta termina com **Pular para próxima seção**: o botão recolhe a atual, abre a próxima e desloca a tela até ela. O último passo de inspeção passa para a conclusão. Em **Responsáveis**, **Fechar seção e revisar** recolhe o cadastro e leva ao salvamento. A identificação do relatório também permite seguir para a primeira seção. O preenchimento é preservado e as validações continuam ocorrendo ao salvar.

Os desenhos usam **Novo desenho**, seleção **Desenho 1 / Desenho 2** e **Excluir desenho** visível, com confirmação, inclusive em tela cheia. Criar um novo mantém os desenhos existentes. Excluir preserva os outros desenhos, pontos, fotos e resultados; o botão Desfazer recupera a exclusão quando há desenho ativo. A exclusão definitiva ocorre ao salvar o relatório.

Botões de voltar aparecem nos detalhes e nas listagens: empresa → empresas, obra → obras da empresa, obras → empresas e relatórios filtrados → obra/empresa de origem. As demais listagens permitem voltar ao início. A navegação passa pela proteção de alterações ainda não salvas.

Nos pontos, **Repetir dados do ponto anterior** vem ativo e reaproveita identificação, dimensão, unidade e espessura de projeto, quando aplicável. O usuário pode desativar a opção. Leituras, aceitabilidade, descontinuidades, observações e fotos continuam individuais. **Criar vários pontos** permite gerar de 1 a 50 pontos por vez, a partir de um número editável, preservando prefixos e zeros da sequência e impedindo números duplicados. Cada ponto continua editável no seu cartão.

Em Responsáveis, **Usar meu nome como inspetor** inclui o nome do usuário conectado. Registro profissional e data permanecem para preenchimento; o atalho não representa uma assinatura digital.

Cada ponto mostra dois espaços de foto lado a lado, com contagem, prévia e legenda. É possível anexar outras imagens. **Finalizar e ir ao próximo** recolhe o ponto e abre o próximo já cadastrado; no último, **Finalizar ponto** recolhe o cartão e **Finalizar e adicionar próximo** cria a próxima numeração. Com zero ou uma foto, uma confirmação permite prosseguir ou voltar para completar. Esses botões organizam o preenchimento; os dados e anexos são gravados em **Salvar rascunho** ou **Salvar alterações**.

**Remover ponto** informa a quantidade de fotos e pede confirmação. Se houver marcações vinculadas, oferece **Manter no desenho** ou **Remover também do desenho**. Manter transforma a referência em uma marcação independente com o mesmo número, posição e aparência, sem manter o ponto na lista de inspeção. Ela continua editável no desenho e aparece no PDF. Cancelar preserva o preenchimento. Ao salvar, a API remove as fotos confirmadas e o ponto na mesma transação, respeitando permissões e versão do relatório. Falhas desfazem a operação inteira. Os demais elementos do desenho são preservados e os arquivos das fotos só são excluídos depois da confirmação da transação.

Verificação: 66 testes unitários e 18 testes de integração em banco temporário, incluindo remoção de ponto com fotos, permissões, conflito de versão e reversão da transação. Fluxo web com API simulada: dois espaços de foto, avanço entre pontos, confirmação com zero/uma foto, criação no último ponto, cancelamento e remoção com vínculos. Conferência em 360, 390, 768 e 1440px, TypeScript, ESLint e exportações web/iOS/Android. Teclado e interação em aparelhos físicos ainda precisam de conferência.

## Proteção do trabalho e tutoriais

A aba **Tutoriais** compartilha o tema e a navegação do painel/app. O dono publica um arquivo com título e orientações; a equipe encontra os materiais por busca e filtros e abre fotos, documentos e vídeos. Administração e consulta usam permissões distintas. Consulte [Tutoriais](tutoriais.md) para formatos, limites e verificações.

A navegação pelos controles do sistema pede confirmação quando existem alterações não salvas. O navegador também sinaliza alterações ao recarregar ou fechar a página. Trocar empresa/obra/tipo no formulário novo exige descartar explicitamente o preenchimento anterior. Exclusão de rascunho e arquivamento usam diálogos próprios.

A proteção documentada se refere aos controles de navegação do aplicativo e ao fechamento/recarregamento web. Gestos de saída e botão físico de voltar em Android devem ser conferidos na validação em aparelho.

## Limites preservados

Os formulários incluem dados-base da obra preenchidos e editáveis, pontos/soldas/medições, descontinuidades, fotos/croqui como imagem, editor vetorial e identificação dos responsáveis. Prévia e PDF final usam os dados salvos; aprovação/finalização preservam o fluxo e as permissões da API. Assinatura digital continua pendente. Consulte [relatórios e PDFs](relatorios-pdf.md) e [desenhos técnicos](desenhos-tecnicos.md).

Após selecionar empresa, obra e modelo, o preenchimento tem duas etapas: Inspeção e Concluir. A inspeção abre nos pontos; título/data, identificação da obra e dados técnicos ficam recolhidos e editáveis. Cada ponto mostra número, identificação, leitura (para medição de espessura) e resultado. Unidade, dimensão, espessura de projeto, descontinuidade e observações ficam em Mais detalhes do ponto, sem perder valores ao recolher ou trocar de etapa. Adicionar próximo ponto permite continuar a sequência no próprio formulário.

A conclusão reúne o laudo, o resultado informado pelo inspetor, responsáveis e um resumo das quantidades. É possível salvar o rascunho durante a inspeção e baixar a prévia em PDF no fim, após salvar. A aprovação e a finalização continuam necessárias para o PDF final. Nenhum resultado é aprovado automaticamente. Erros de validação abrem o bloco correspondente e deslocam a tela até ele. O salvamento reúne os dados e as fotos de todos os pontos.

O fluxo simplificado foi conferido no navegador com os cinco modelos (EVS, LP, TH, ME e RDO), banco temporário e geração real das prévias em PDF. A conferência verificou dados da obra editáveis, preservação dos detalhes recolhidos, troca de etapa, leitura decimal, salvamento e conteúdo dos PDFs. A tela de pontos no tema escuro passou pela análise axe nos critérios avaliados.

O editor abre novas pranchas com Lápis livre ativo. Endireitar converte o traço em segmento ao soltar; Círculo e Retângulo mostram a forma durante o arraste. Tubulação, pontos, seleção e navegação permanecem disponíveis. Cotas, símbolos, textos e malha ficam em Mais ferramentas. A tela cheia dedica o espaço principal ao desenho, com ferramentas em barra horizontal e ajustes recolhíveis; mantém zoom, navegação e desfazer/refazer. Título/revisão/notas e coordenadas têm expansões próprias. Pontos numerados mantêm vínculos entre pranchas, fotos e resultados. O salvamento bloqueia temporariamente a edição e mantém a etapa atual.

## Verificação

Fotos de soldas ficam exclusivamente nos cartões dos pontos. A área de imagens/croquis adicionais está desativada no formulário. No lugar dela, depois de **Desenho técnico**, fica **Pontos de solda**, aberta inicialmente, com dados, resultados e fotos dentro de cada ponto. Pontos de medição mantêm sua identificação própria. O botão de liberar fotos foi removido. O salvamento normal envia as fotos selecionadas nos pontos e suas legendas. Registros adicionais já salvos continuam preservados no relatório e no PDF.

A tela cheia do desenho respeita a área segura do próprio modal. Na digitação, o painel ocupa o espaço disponível e desloca o campo focado para a área visível; Voltar ao desenho fecha teclado e ajustes. Campos da ferramenta vêm antes da malha. Em telas largas, o painel é lateral. A barra inferior mantém controles com alvo mínimo de 44 px. Alternar o painel preserva o zoom. O navegador conferiu sete tamanhos em retrato/paisagem e redução de viewport para teclado; barra de status/teclado nativos continuam pendentes de conferência física.

O cartão de cada ponto reúne número, dimensão/leitura, descontinuidade, aceitabilidade e fotos. O primeiro número é perguntado; os próximos seguem o último identificador, com edição manual. O cabeçalho inteiro abre/recolhe o cartão e mostra resultado e fotos. Adicionar o próximo recolhe o anterior. Fotos podem ser escolhidas antes do primeiro salvamento e são enviadas junto dos dados, com retomada das pendentes após uma falha. O desenho apresenta biblioteca visual de componentes e textos em várias linhas, com tamanho e inclinação. O PDF repete o cabeçalho tabular completo em todas as páginas e os dados de cada solda acima de cada par de fotos.

O desenho oferece movimento com a ferramenta Mão, zoom e movimento com dois dedos em qualquer ferramenta e zoom pela roda do mouse. Selecionar aceita o interior das formas e mostra ações contextuais. Limpar traços e Limpar desenho pedem confirmação e podem ser desfeitos. O envio de imagens pergunta entre galeria, câmera e arquivos; relatórios mostram a foto para conferência antes de enviar. Tutoriais também oferecem galeria para fotos e vídeos.

TypeScript e ESLint; export web e bundle Android; conferência no navegador em desktop, laptop, tablet, 390px e 360px; fluxo de empresas, obras, cinco tipos de relatório, revisão/aprovação, validações, busca de seletores, proteção de dados não salvos e saída da sessão. Registros de conferência usam um PostgreSQL temporário e não são inseridos no banco de desenvolvimento.

As capturas locais `docs/verificacao/design-*.png` são ignoradas pelo Git. A execução em um aparelho Android e no Safari real continua pendente.

Na auditoria automatizada, o login passou sem violações nos critérios analisados. Dashboard e listagens foram conferidos em quatro larguras com axe; o único problema encontrado nas listagens foi o contraste do texto de contagem sobre o fundo cinza. O token foi escurecido para corrigir esse contraste. As telas conferidas não apresentaram erros de JavaScript nem rolagem horizontal.
