# Verificação de relatórios e PDFs — 08/10/2026

Esta conferência antecede o editor vetorial. A implementação e os testes posteriores estão registrados em [Verificação do editor técnico](./desenhos-tecnicos.md).

- Build da API/shared, TypeScript strict e ESLint passaram.
- 23 testes unitários e 12 testes de integração passaram. Banco PostgreSQL e storage dos testes são temporários, com remoção ao terminar.
- Fluxo real via Playwright nos cinco modelos: cadastrar dados-base da obra, abrir formulário preenchido, editar cliente, apagar fábrica, preencher pontos/medições/descontinuidades/responsáveis, salvar, anexar foto e croqui, baixar prévia, revisar, aprovar, finalizar e baixar PDF final.
- Leitura `5,9` foi persistida como `5.9`; aceitabilidade `Não` e campos apagados foram preservados. Texto extraído dos documentos confirmou cliente e conclusão editados, resultados, legendas e paginação. Nenhuma rubrica dos exemplos foi copiada.
- PDFs dessa conferência: EVS com 5 páginas, LP com 7, TH com 4, ME com 5 e RDO com 1. A quantidade varia com os dados e imagens.
- Conferência visual desktop/mobile sem rolagem horizontal da página; capturas e PDFs locais nesta pasta são ignorados pelo Git.
- Rascunho existente conferido: reaplicar os dados da obra preservou laudo, resultado, pontos e responsáveis; os campos continuaram editáveis e puderam ser apagados novamente antes de salvar.
- Depois da correção do estado inicial das imagens, a conferência mobile não registrou erros de renderização nem violações no axe para WCAG 2 A/AA e 2.1 AA. Isso é uma verificação automática pontual, sem substituir uma auditoria completa de acessibilidade.
- Docker atualizado com Chromium e migration de dados-base. Prévia de um relatório existente retornou PDF válido pela API local, sem alterar dados de negócio.
- `expo install --check` passou; exportação Expo para web, Android e iOS passou.

O banco principal não recebeu empresas, obras ou relatórios fictícios dos testes. Geração com falha preserva a aprovação; conflito de versão não deixa PDF final registrado; edições e anexos são bloqueados após aprovação/finalização.

APK/IPA, Expo Go em aparelho físico e Safari/iOS não foram executados nesta verificação. Na ocasião, croquis eram anexados como imagem; o editor vetorial foi implementado na etapa posterior indicada acima. Assinatura digital permanece pendente.
