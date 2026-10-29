# Maiúsculas e assinatura do cliente

28/10/2026.

- Retirado o uso de `specificData.client` como substituto do nome do representante no campo de assinatura dos modelos EVS e de referência. O campo fica vazio quando não existe responsável CLIENT; quando existe, mostra o nome e os demais dados dele.
- Estilo do documento aplica `text-transform: uppercase` a todos os textos impressos, incluindo identificação, laudo e assinaturas. Valores armazenados no relatório são preservados.

Build da API, ESLint e 20 testes de desenho/PDF passaram. Verificação no Chromium com nomes mistos, acentos e empresa fictícia confirmou EVS e LP com e sem representante. PDF de seis páginas foi renderizado com PyMuPDF; páginas de identificação e laudo final inspecionadas. Representante mantido e nenhuma empresa adicionada ao campo vazio. Artefatos locais em `docs/verificacao/report-uppercase-client.pdf` e PNGs correspondentes (ignorados).

Atualizar a API na VPS e gerar o PDF novamente para aplicar a apresentação nova. Nenhuma implantação realizada nesta tarefa.
