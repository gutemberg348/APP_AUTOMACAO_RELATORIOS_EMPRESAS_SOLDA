# Fotos sem repetir a numeração — 02/11/2026

O PDF não gera mais uma linha abaixo das fotos quando a identificação do ponto apenas repete sua numeração (ex.: `SOLDAS 3: 3`). A comparação ignora espaços e diferenças entre maiúsculas/minúsculas. A identificação da solda continua no cabeçalho acima da imagem. Legendas, identificações adicionais e notas com informação real continuam disponíveis.

Vale para relatórios já salvos: gerar/baixar novamente depois de publicar a API, sem alterar dados cadastrados. Não exige novo APK.

Verificação: build da API, ESLint e 51 testes unitários aprovados. PDF de LP existente com quatro fotos, soldas 3 e 4 e dimensões antigas foi gerado, reaberto e rasterizado; conferidas ausência das linhas repetidas e preservação dos cabeçalhos, imagens e dados originais. Evidência local em `artifacts/lp-no-repeated-weld-rows/`.
