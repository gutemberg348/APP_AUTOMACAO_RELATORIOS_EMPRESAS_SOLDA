# Imagens giradas e indicadores de seleção

26/10/2026.

- Extremidades e cantos de seleção reduzidos para raio de 3 px na tela, preservando as áreas maiores de detecção dos gestos. Controle de rotação reduzido para raio de 11 px.
- O marcador temporário de início da tubulação/linha era representado pelo símbolo de flange. Agora é um ponto azul de 2,5 px, somente na prévia, sem objeto adicional no relatório/PDF.
- Aviso visível quando existe imagem desbloqueada e nenhuma seleção: “⚠️ Para selecionar a imagem, segure nela. Depois, arraste para mover.”
- Ampliação considera a área ocupada após a rotação. O limite anterior de altura local de 800 impedia ampliar fotografias giradas mesmo com espaço disponível. Dimensões locais aceitam até 1281 (diagonal da folha arredondada); a transformação continua limitada à área de 1000 × 800 e ajusta o último passo até a borda.
- Mensagens de limite explicam a diferença entre tamanho do objeto e zoom da visualização.

Validação: 160 testes em 27 arquivos passaram, incluindo imagem de 350 × 800 girada 89°, ampliada para 367,5 × 840 e depois até a largura da folha. Dados resultantes aceitos pelo schema compartilhado. TypeScript, ESLint e exportação web passaram. Chromium com API simulada confirmou aviso, toque simples sem seleção da foto, seleção ao segurar, aumento de 5% e indicadores de 3 px. Nenhuma alteração enviada à produção. Conferência nativa em aparelho físico pendente.

**Implantação:** atualizar a API na VPS junto com o app, pois a validação compartilhada agora aceita dimensões locais maiores em imagens giradas. Sem atualização da API, salvar essas imagens ampliadas pode ser rejeitado. Não há migração de banco.
