# Verificação — cores e relatórios (29/10/2026)

## Alterações

- Conta-gotas nas opções de cor: captura a cor de uma prévia do desenho ou da foto e permite confirmar antes de aplicar.
- Pincel Esfumaçado com camadas de opacidade, compartilhadas entre a prévia durante o gesto, o desenho salvo e a exportação para PDF.
- Correção da validação do número no PDF e na troca rápida de status: o esquema restrito de número agora recebe somente esse campo, em vez de rejeitar os demais dados do relatório.
- Campos vazios de responsáveis e códigos de descontinuidade são preservados quando aceitos pelo esquema de rascunho.
- Erros do formulário e da API mantêm o caminho do campo. Falhas de fotos, imagens de desenho e assinaturas no PDF identificam o item e orientam a correção.
- Descontinuidades de LP recebem indicação e navegação para a linha com problema.
- O número do relatório continua obrigatório. Dados incompletos permitidos em rascunho não impedem salvar; a prévia pode ser gerada após o aviso. Valores inválidos e arquivos indisponíveis exigem correção.

## Verificação executada

- Build do shared/API, typecheck do app, ESLint dos arquivos de relatórios e conta-gotas, e exportação web aprovados.
- 56 testes em 8 arquivos aprovados: rascunhos, mudança de status, geração de PDF e erros localizados, correções do formulário, esquemas, avisos, anotações de fotos e borracha.
- Chrome com viewport de celular e API simulada: EVS, LP, TH, ME e RDO salvam rascunhos incompletos e acionam o PDF após o aviso.
- Interface: erro simultâneo de número ausente e ponto duplicado; Corrigir abre o ponto/identificação; erro técnico recebido da API abre a seção correta; falha de servidor mantém as edições e apresenta orientação.
- Geração real em Chrome dos cinco templates com dados incompletos: arquivos PDF válidos, sem conexão ao banco de produção.
- Conta-gotas: captura de traço vermelho e de foto PNG com cor conhecida; pintura e persistência de Esfumaçado verificadas no navegador.

## Limites e publicação

### Ajuste da paleta e captura no iPhone (29/10)

- Conta-gotas e cor personalizada agora são atalhos circulares de 44 × 44 junto das cores. A cor personalizada expande o seletor e revela o painel pela rolagem do formulário.
- Captura nativa usa o tamanho real do SVG exibido, com uma única raiz. O código iOS de `react-native-svg` desenha usando os limites da view mesmo quando `toDataURL` recebe uma imagem de saída maior; a captura anterior de 1000 × 800 podia ler transparência fora do desenho. As coordenadas agora são normalizadas pela largura/altura da prévia e convertidas usando as dimensões reais do PNG, inclusive Retina.
- Nova captura limpa a amostra anterior para não oferecer uma cor antiga se ocorrer falha.
- Quatro testes de pixels aprovados: densidades 1×/2×/3×, quatro regiões de cores diferentes, bordas, transparência e coordenadas inválidas.
- Chrome em 390 × 844: atalhos compactos na mesma paleta, expansão/rolagem automática, quatro pontos capturados iguais aos pixels visíveis da foto e persistência da cor no traço. Typecheck, ESLint e exportação web aprovados. A confirmação em iPhone físico continua pendente.

Testes de interação executados no navegador; conta-gotas nativo ainda precisa de conferência em dispositivo físico. Não houve deploy, alteração de dados de produção ou geração de APK nesta verificação. Publicar a API/web e atualizar o app para disponibilizar o conjunto de alterações; nenhuma migração de banco nova foi adicionada nesta etapa.
