# Fotos sem repetir a numeração — 02/11/2026

No Líquido Penetrante, o PDF não imprime nenhuma faixa de texto abaixo das fotos: nem identificação, notas, legendas ou complemento da descontinuidade. A página de fotos contém somente as imagens e seus cabeçalhos superiores. Isso também vale quando a identificação difere da numeração (ex.: soldas `1 - 02 - 03` com identificação antiga `1 / |`). Os dados cadastrados permanecem preservados no aplicativo e no banco. Essa regra substitui o filtro anterior que removia somente números repetidos.

Vale para relatórios já salvos: gerar/baixar novamente depois de publicar a API, sem alterar dados cadastrados. Não exige novo APK.

Verificação: testes cobrem LP antigo com identificação diferente da numeração, notas e legendas preenchidas; verificam ausência de qualquer faixa abaixo das fotos e preservação dos cabeçalhos, imagens e dados originais. TH e RDO mantêm seus detalhes específicos. Evidência local do PDF de LP reaberto e rasterizado em `artifacts/lp-no-repeated-weld-rows/`.
