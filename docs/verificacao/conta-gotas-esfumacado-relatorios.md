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

Testes de interação executados no navegador; conta-gotas nativo ainda precisa de conferência em dispositivo físico. Não houve deploy, alteração de dados de produção ou geração de APK nesta verificação. Publicar a API/web e atualizar o app para disponibilizar o conjunto de alterações; nenhuma migração de banco nova foi adicionada nesta etapa.
