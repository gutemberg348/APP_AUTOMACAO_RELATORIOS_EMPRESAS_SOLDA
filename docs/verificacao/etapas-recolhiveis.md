# Etapas e pontos com abertura exclusiva

- Abrir uma seção recolhe a anterior, inclusive a identificação do relatório. A navegação para a próxima seção e entre Inspeção/Conclusão mantém uma única seção aberta.
- Dentro dos pontos, apenas um cartão fica aberto. Erros de validação sinalizam os demais com **Revisar campos**, sem expandir todos.
- Novos erros direcionam para o primeiro ponto inválido; corrigir um erro não muda o ponto que está sendo editado.
- Os valores permanecem no formulário ao recolher seções e pontos. Abrir um cartão aproxima seu cabeçalho da área visível.
- Etapas numeradas, cartões separados, borda azul e brilho suave no cartão ativo, com cores dos temas claro e escuro.

Verificação em 19/10/2026: TypeScript do app, ESLint e exportações Expo para Android, iOS e web passaram. Teste no navegador com API simulada cobriu abertura exclusiva, troca de etapas, múltiplos pontos inválidos, correção sem troca involuntária de ponto, preservação dos valores e salvamento. Capturas em 390×844 (escuro) e 1440×1000 (claro) foram inspecionadas. Não houve teste em aparelho físico nem publicação.
