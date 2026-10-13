# Desenhos técnicos e pontos de inspeção

O editor usa os desenhos de `materiais_base/` como referência de organização: tubulações em malha isométrica no EVS e estruturas em vista ortogonal no LP. Os desenhos e dados dos clientes dos exemplos não são importados para cadastros.

## Uso

1. Abra um relatório em rascunho, entre em **Inspeção** e abra **Desenho técnico**. O formulário tem duas etapas: Inspeção e Concluir. Os blocos podem ser recolhidos sem apagar informações.
2. Crie a primeira prancha. Ela abre em **Lápis livre**, que acompanha o dedo ou mouse sem prender à malha. A identificação da prancha permite editar título, revisão e notas; **Mais ferramentas** permite trocar a malha.
3. Use **Endireitar** para desenhar à mão e transformar o traço em uma linha reta ao soltar, mantendo o início e o fim. **Círculo** parte do centro e cresce durante o arraste; **Retângulo** usa dois cantos opostos. **Tubulação** mantém o alinhamento isométrico/ortogonal e permite trechos conectados por toques; **Concluir traçado** encerra a sequência. **Linha**, em Mais ferramentas, desenha um segmento por vez. Todos mostram prévia durante o gesto.
4. Em **Mais ferramentas**, insira válvulas, flanges, reduções, suportes, bombas, tanques e setas de fluxo. Ajuste posição e rotação no painel de propriedades.
5. Use **Texto** para identificações e **Cota** para medidas informadas em campo. O desenho é sem escala; nenhuma dimensão de campo é calculada a partir dos pixels.
6. Use **Ponto** para criar um ponto numerado ou marcar um ponto existente. A numeração sugerida usa o próximo número disponível e pode ser alterada manualmente.
7. Selecione e arraste elementos ou use **Ajustar posição precisa** para editar coordenadas e deslocar as chamadas dos números. Na **Tela cheia**, a área de desenho ocupa o espaço entre as barras de ferramentas; as ferramentas têm rolagem horizontal no celular, sem rolar o relatório. **Ajustes** abre os controles de malha, pontos e propriedades. Desfazer/refazer, zoom, Mão e Ajustar permanecem acessíveis; Ajustar mostra a prancha inteira sem distorcer as formas. O cinza ao redor delimita o espaço fora da prancha, que não recebe traços.
8. Adicione e confira as fotos no cartão de cada ponto. Para registros gerais, use **Fotos adicionais (opcional)**. O salvamento normal grava os dados e as imagens; não existe uma etapa de liberar fotos. As legendas são editadas no próprio cartão da imagem.
9. Confira a prévia em PDF. Após a revisão/aprovação, finalize para preservar o documento final.

**Texto**, **Símbolos** e **Cota** ficam na barra principal. Texto aceita várias linhas, tamanho e inclinações horizontal, ±30° e vertical; a seleção permite editar seu conteúdo e ângulo. A biblioteca visual inclui válvula, válvula de esfera com acionamento, flange, redução, suporte, bomba, tanque, fluxo, conexão em T, curva, tampão e união. Componentes têm rotação e tamanho ajustáveis. Os novos elementos usam o mesmo SVG na tela e no PDF, com compatibilidade para pranchas já salvas.

O cadastro em **Pontos / soldas** pergunta o número inicial e sugere a sequência a partir do último ponto, mantendo o número editável. Fotos são selecionadas e conferidas dentro do próprio cartão do ponto, inclusive antes de salvar o rascunho. **Salvar ponto e fotos** grava os dados e vínculos. Adicionar o próximo recolhe o anterior; o resumo mostra número, resultado e quantidade de fotos.

Os pontos criados no editor também aparecem em **Pontos / soldas** ou **Pontos de medição**, onde se preenchem dimensão, leitura, descontinuidade, aceitabilidade e observações. Números e vínculos se mantêm ao reabrir o relatório. Remover somente uma marcação preserva o ponto e suas fotos. A exclusão de um ponto com vínculos pede que as marcações e fotos sejam removidas ou desvinculadas primeiro.

## Documento final

Cada prancha é incluída como SVG vetorial, com título, revisão, malha, carimbo da obra/projeto e indicação de prancha. A tabela identifica em quais pranchas cada ponto aparece. Fotos são agrupadas por ponto, acompanhadas de seus dados e resultados. A numeração do desenho, da tabela e das fotos é obtida do mesmo registro de ponto, evitando cópias divergentes.

Os símbolos são uma biblioteca gráfica para croquis de inspeção; o usuário confere sua adequação ao desenho. A ferramenta não importa/edita DWG ou DXF, não faz modelagem 3D e não substitui um projeto dimensional de engenharia. O PDF conserva os vetores; fotografias e croquis anexados como imagem continuam rasterizados.

## Persistência e validação

- Contrato e geometria em `packages/shared/src/drawings.ts`; os mesmos vetores são utilizados no app/web e no PDF.
- `ReportDrawing.data` armazena pranchas, metadados e elementos. Pontos novos usam chaves locais que a API resolve para os IDs persistidos, na mesma transação do relatório.
- POST/PUT de `/reports` aceitam `drawings`. A permissão `drawing.edit`, o status do relatório e a versão são verificados. Aprovação/finalização bloqueiam alterações.
- Até 12 pranchas por relatório e 600 elementos por prancha. Coordenadas, símbolos, quantidades, IDs repetidos e vínculos são validados. Cada ponto aparece no máximo uma vez por prancha e pode aparecer em várias pranchas. Números usados em desenhos devem ser únicos no relatório.
- SVG é gerado por código a partir de elementos permitidos; textos são escapados. Não se recebe HTML/SVG arbitrário nem recursos externos.
- Lápis, círculos e retângulos usam polilinhas vetoriais do contrato existente; Endireitar usa linha. Não é necessária migração de banco. Traços longos são reamostrados para respeitar o limite de 300 posições por elemento, preservando o início e o fim. Círculos têm contorno fechado de 96 segmentos e respeitam as bordas da prancha.
- PATCH de `/reports/:id/media/:mediaId` edita identificação da imagem, exige `media.upload`, verifica ponto/relatório, incrementa a versão e registra auditoria.
- O salvamento é manual. Fechar a tela cheia mantém o trabalho no formulário; é preciso salvar o relatório. Desfazer/refazer guarda até 40 alterações durante a permanência na etapa e reinicia após salvar, preservando a integridade dos IDs persistidos.

A migration `20261008000200_drawing_order` acrescenta a ordem das pranchas e preserva os desenhos existentes, garantindo que a numeração das pranchas se mantenha após reabrir ou editar. Referências técnicas: [gestos do React Native](https://reactnative.dev/docs/panresponder) e [react-native-svg](https://github.com/software-mansion/react-native-svg).

## Conferência das ferramentas livres

### Área segura, teclado e telas pequenas

A tela cheia tem um `SafeAreaProvider` próprio no modal e respeita as áreas superior, inferior e laterais, inclusive ao girar o aparelho. `KeyboardAvoidingView` adapta o espaço no iOS/Android. A medição do campo focado ajusta a rolagem após mudanças de layout e abertura do teclado. O formulário de relatórios também usa o ajuste de teclado do ScrollView no iOS; não há ajuste duplicado no painel do desenho.

Número do ponto, texto e cota aparecem antes da malha. Durante a digitação em telas pequenas, o painel ocupa o espaço disponível e o desenho/ferramentas ficam recolhidos. **Voltar ao desenho** fecha teclado e painel, mantendo os valores. Telas largas exibem os ajustes ao lado da prancha. A barra inferior tem botões de pelo menos 44 px e rolagem em larguras menores. Abrir/fechar o painel mantém zoom e posição; Ajustar ou girar/redimensionar a janela reenquadra a prancha.

Conferência de 09/10/2026: 48 testes unitários, TypeScript e ESLint passaram. O navegador verificou 320×568, 390×844, 430×932, 740×360, 844×390, 768×1024 e 1440×1000, incluindo área reduzida para simular teclado, número/texto visíveis, campo numérico apagável, zoom preservado, roda do mouse após remontar o canvas, marcação/desfazer e biblioteca de símbolos. O painel em desktop passou pela auditoria axe nos critérios avaliados. As exportações web/Android/iOS foram conferidas. O teclado e a barra de status nativos precisam de conferência em aparelho físico; o teste de viewport não substitui essa verificação. Capturas em `docs/verificacao/drawing-safe-*.png` e `drawing-keyboard-viewport.png`.

Referências de implementação: [área segura no modal](https://appandflow.github.io/react-native-safe-area-context/api/safe-area-provider/), [KeyboardAvoidingView](https://reactnative.dev/docs/keyboardavoidingview) e [ScrollView](https://reactnative.dev/docs/scrollview).

### Seleção, navegação e limpeza

**Mão** desloca a prancha com um dedo ou mouse. Dois dedos movem e ampliam em qualquer ferramenta; iniciar esse gesto cancela o traço provisório. A roda do mouse amplia em torno do cursor. **Selecionar** também aceita toques dentro de círculos e retângulos; arrastar uma área vazia move a prancha. A seleção oferece excluir, duplicar figuras e soltar a seleção. Pontos não são duplicados para preservar a numeração.

**Limpar traços** remove figuras e mantém as marcações dos pontos. **Limpar desenho** remove todos os elementos da prancha atual. Ambos pedem confirmação, aceitam desfazer e preservam pontos cadastrados, fotos e resultados do relatório. As outras pranchas permanecem intactas.

**Anexar imagem** pergunta a origem: galeria, câmera ou arquivos. A foto fica em prévia até tocar em **Enviar foto**, com opções de trocar ou cancelar. A câmera pede permissão no dispositivo; o seletor nativo da galeria permite escolher somente os itens desejados. Imagens HEIC são convertidas para JPEG. Tutoriais usam a mesma escolha, incluindo vídeos na galeria e documentos em arquivos. Referências: [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) e [ImageManipulator](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/).

Conferência de 09/10/2026: 38 testes unitários, TypeScript, ESLint e exportações web/iOS/Android passaram. No navegador, com API e banco isolados, foram verificados pinça com dois dedos sem traço acidental, roda do mouse, mão, seleção pelo interior, confirmação/cancelamento de limpeza, desfazer preservando pontos, PDF, cancelamento do seletor, prévia antes de enviar, upload real de imagem e publicação de tutorial pela galeria. A câmera web foi conferida pelo seletor com captura; permissões e galeria em aparelho físico ainda precisam de conferência. Captura da confirmação em `docs/verificacao/drawing-photo-confirm.png`.

Testes de geometria cobrem traços longos, limites da prancha, seleção/movimentação das formas e proporções do canvas. No navegador foram conferidos prévia durante o arraste, mouse e eventos de toque, lápis livre, Endireitar, círculo, retângulo, desfazer/refazer, tela cheia em retrato/paisagem, pontos vinculados, gravação/reabertura e geração real da prévia PDF com banco isolado. A tela cheia passou pela auditoria axe nos critérios avaliados. Capturas em `docs/verificacao/drawing-sketch-*.png` e PDF em `docs/verificacao/drawing-sketch-preview.pdf`. Gestos em aparelho nativo precisam de conferência no dispositivo; o teste de toque foi feito no navegador.
