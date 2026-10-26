# Edição do desenho — seis melhorias

Implementado em 26/10/2026:

1. **Pontas das linhas:** selecionar uma linha ou cota mostra alças nas extremidades. Arrastar uma alça altera apenas aquela ponta; um toque sem movimento não altera a geometria.
2. **Encaixe inteligente:** extremidades, centros e alinhamentos próximos oferecem encaixe com guias visuais. O botão `Encaixe: ligado/desligado` permite desenho livre. As guias não entram no PDF.
3. **Bloqueio de imagem:** em `Editar seleção`, bloquear uma imagem impede selecioná-la ou movê-la por engano. Ela continua visível e no PDF. `Imagens bloqueadas`, nas ferramentas, permite desbloquear.
4. **Grupos persistentes:** selecionar pelo laço e usar `Agrupar` mantém os elementos juntos após salvar e reabrir. Selecionar um membro seleciona o grupo. `Desagrupar` permite voltar à edição individual.
5. **Medidas precisas:** `Editar seleção` permite informar centro X/Y, comprimento e ângulo da linha, ou tamanho percentual e rotação de uma seleção. As unidades são da folha 1000 × 800, não medidas físicas da tubulação. Valores impossíveis mostram aviso e não alteram o desenho.
6. **Duplicação e ordem:** duplicar uma seleção ou grupo, trazer para frente e enviar para trás. Cópias de pontos vinculados recebem novos números e não copiam fotos nem resultados da inspeção. A ordem dos elementos também é respeitada na renderização do PDF.

## Verificação

- Build do shared e da API, TypeScript do app, ESLint dos arquivos da implementação e exportação web concluídos.
- 159 testes unitários passaram, em 27 arquivos.
- Fluxo automatizado em Chromium, com viewport de celular e API simulada: alças, guias e encaixe; comprimento/ângulo/posição exatos; ordem de imagens; bloquear/desbloquear; selecionar tudo ignorando imagens bloqueadas; agrupar, duplicar com ponto novo, salvar e reabrir, desagrupar; desligar encaixe; aviso de medida inválida.
- Regressão de navegação: mover folha, toque com pequena oscilação, seleção de elementos sobrepostos, enquadrar, mover/desfazer, desmarcar sem inserir e alternar retrato/paisagem.
- Revisão visual das telas de grupo e de medidas com erro, após concluir as animações dos diálogos.
- Não foi executado teste em aparelho físico nem gerado APK nesta etapa.

## Publicação

Atualizar a API e o app antes de usar os novos campos `groupId`, `layer` e `locked`: os dados do desenho passam pela validação compartilhada da API. Não há migração de banco específica para essas propriedades, pois fazem parte do JSON do desenho. Para Android, gerar um novo APK após atualizar o código.
