# EVS/EVD — três duplas de fotos por folha — 11/11/2026

O paginador já dimensionava as imagens para três linhas, mas calculava apenas os cabeçalhos internos dos blocos de foto. As legendas e os detalhes dos pontos, que são elementos seguintes no HTML, consumiam espaço adicional. Com esses campos preenchidos, o resultado era duas duplas por folha.

O cálculo agora reserva também a altura real dos textos que acompanham cada dupla antes de definir a altura uniforme das fotos. As informações continuam presentes. Textos excepcionalmente longos ainda podem exigir mais páginas para manter a leitura; o limite mínimo das fotos foi preservado.

O erro foi reproduzido no Chromium: três duplas produziam `[2, 1]`, e sete produziam `[2, 2, 2, 1]`. Depois da correção, os mesmos relatórios EVS e EVD produziram `[3]` e `[3, 3, 1]`, com todas as fotos carregadas, todas as legendas e notas presentes, sem conteúdo ultrapassando a folha. A renderização foi inspecionada em `artifacts/evs-photo-pagination/three-pairs.png`.

Passaram 33 testes em cinco arquivos, incluindo os quatro cenários no Chromium e regressões de LP, medição de espessura, Visual Direto e observações internas. TypeScript da API e ESLint dos arquivos alterados passaram.

Atualizar a API disponibiliza a correção para os PDFs gerados novamente, inclusive relatórios existentes. Essa correção isolada não exige novo APK. Os novos símbolos do desenho, desenvolvidos anteriormente, continuam exigindo API/web e APK atualizados.
