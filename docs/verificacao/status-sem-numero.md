# Troca de status sem número do relatório

A API usava a validação de envio do relatório também nas trocas rápidas do seletor, bloqueando aprovação/revisão se o número estivesse vazio. A validação da troca rápida agora omite apenas o número. Título, data, exigências técnicas, permissões e controle de versão continuam validados. O fluxo tradicional de envio à revisão mantém suas regras.

Não há geração automática de números. O número manual é preservado; relatórios sem número continuam exibindo “Sem número” na identificação e podem mudar de status pelo seletor. A finalização usa os dados salvos e mantém o histórico de PDFs.

Regressões adicionadas à integração: revisão, aprovação e retorno ao rascunho sem número nos cinco tipos; rejeição por permissão/versão incorreta; exigência de data; fluxo tradicional com número obrigatório; finalização e refinalização de EVS sem número com duas versões de PDF preservadas.

Nenhum relatório real foi editado para realizar os testes.

Validação: typecheck, lint, build, 85 testes unitários e 25 de integração passaram. A consulta de diagnóstico encontrou quatro relatórios ativos sem número, todos com título e data preenchidos; nenhuma informação foi alterada nessa consulta.

A API local no Docker foi reconstruída e recriada com o código corrigido. Após concluir migrations/seed, `/health` respondeu HTTP 200 e o serviço compilado confirmou o uso da validação sem número no seletor. As contagens permaneceram em 7 relatórios, 27 pontos, 6 desenhos, 8 imagens e 0 PDFs; nenhum status real foi alterado para a verificação.
