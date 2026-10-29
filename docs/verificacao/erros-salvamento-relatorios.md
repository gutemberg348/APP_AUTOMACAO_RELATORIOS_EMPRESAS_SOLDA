# Erros de salvamento dos relatórios

O formulário compartilhado por EVS, LP, TH, ME, RDO e tipos configurados reúne as validações comuns e específicas antes de salvar. O aviso mostra o campo, ponto, responsável ou desenho, a causa e uma orientação. Cada item tem **Corrigir**, que abre a etapa e seção correspondente, inclusive pontos recolhidos, e rola até o destino.

Erros de validação retornados pela API usam o mesmo fluxo. Códigos conhecidos de assinaturas, pontos e desenhos recebem orientações específicas. Falhas de conexão, permissão e conflito continuam com orientação própria; não são atribuídas a um campo arbitrário. Os dados editados permanecem no formulário.

Falhas em fotos identificam o arquivo e o ponto quando disponíveis. O aviso distingue dados salvos de fotos, legendas ou marcações pendentes; somente os envios restantes são repetidos. A criação não navega para outra tela enquanto houver erro de fotos.

## Verificação

- 177 testes automatizados passaram, incluindo nomes/caminhos de todos os campos dos tipos configurados, número obrigatório, ponto duplicado, datas e erros de negócio.
- TypeScript, ESLint e exportação web passaram.
- Chrome, viewport móvel 390 × 844, API simulada: número ausente e ponto duplicado no mesmo aviso; Corrigir abre o segundo ponto e a identificação; salvar novamente funciona. Validação da API abre Dados do ensaio. Falha 503 mostra orientação de conexão e preserva o preenchimento até nova tentativa bem-sucedida.
- Captura conferida: `report-save-errors.png`. Nenhum dado de produção foi alterado. Não houve teste em aparelho físico.

Esta melhoria é no aplicativo/web. Não adiciona migração nem altera a API. As mudanças anteriores de marcações nas fotos continuam exigindo a atualização da API e a migração já preparada.
