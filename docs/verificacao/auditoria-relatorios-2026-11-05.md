# Auditoria dos relatórios - 05/11/2026

Resultado: os cenários executados passaram após a correção da retomada de exclusão
de fotos. A verificação usou dados descartáveis, PostgreSQL em container isolado,
arquivos locais de teste e a interface real compilada para navegador. Nenhum dado
de produção foi alterado.

## Matriz por tipo

| Tipo                      | Salvar parcial e solicitar PDF na interface | Upload, edição e remoção na API real | Criar offline com duas fotos | Reabrir e recuperar | Sincronizar e resolver conflito | Remover foto offline, reabrir e sincronizar |
| ------------------------- | ------------------------------------------- | ------------------------------------ | ---------------------------- | ------------------- | ------------------------------- | ------------------------------------------- |
| EVS - Visual / Endoscopia | Passou                                      | Passou                               | Passou                       | Passou              | Passou                          | Passou                                      |
| EVD - Visual Direto       | Passou                                      | Passou                               | Passou                       | Passou              | Passou                          | Passou                                      |
| LP - Líquido Penetrante   | Passou                                      | Passou                               | Passou                       | Passou              | Passou                          | Passou                                      |
| TH - Teste Hidrostático   | Passou                                      | Passou                               | Passou                       | Passou              | Passou                          | Passou                                      |
| ME - Medição de Espessura | Passou                                      | Passou                               | Passou                       | Passou              | Passou                          | Passou                                      |
| RDO - Diário de Inspeção  | Passou                                      | Passou                               | Passou                       | Passou              | Passou                          | Passou                                      |

Na interface offline de cada tipo foram preparados catálogos, interrompida a rede,
escolhidas duas fotos, cancelada uma foto ainda pendente e escolhida sua substituta.
Uma nova página, com uma nova instância JavaScript, recuperou o formulário e as
prévias do IndexedDB. A reconexão criou um único relatório, com dois uploads ligados
ao ponto correto. Fotos já sincronizadas foram preparadas e consultadas sem rede.
Uma exclusão posterior ficou guardada após reabrir e foi aplicada na sincronização,
preservando a outra foto e o ponto.

Os casos de conflito mantiveram a versão do outro aparelho até a comparação e a
confirmação explícita do usuário. A tela continuou permitindo recuperar o texto local.

## Falha encontrada e corrigida

Se o servidor concluísse a exclusão de uma foto e a conexão caísse antes da resposta,
o telefone conservava a operação na fila. Na retomada, mesmo recebendo um snapshot
atualizado sem a foto, tentava excluí-la novamente. O erro 404 mantinha a pendência.

`saveReportPhotos` agora reconhece a ausência da foto no snapshot recebido do servidor
como confirmação da exclusão anterior e conclui essa pendência. Se a foto ainda existe,
a exclusão normal continua sendo executada. Foram adicionados testes de regressão
para esse caso em EVS, EVD, LP, TH, ME e RDO; todos falharam antes da correção e passaram
depois dela.

## Fotos e API

Testes com banco e armazenamento reais, para cada tipo:

- Fotos verticais, horizontais com orientação EXIF e foto grande de 6000 x 8000 no EVD.
- Marcações e legendas salvas, arquivo original preservado e rasterização para PDF.
- Imagem inválida rejeitada sem apagar as anteriores; nova imagem válida aceita.
- Reenvio com o mesmo identificador após perda de resposta sem duplicar a imagem.
- Mesma foto repetida no mesmo ponto aceita; em outro ponto da mesma obra rejeitada.
- Remoção de ambas as cópias, manutenção dos pontos e reutilização posterior aceita.
- Mesma foto em outra obra aceita.
- PDF real gerado antes e depois das remoções.

A interface também passou pelo lote de duas fotos, repetição ao lado, rejeição de
duplicidade em outro ponto e manutenção das fotos válidas de uma seleção parcial.
Os testes existentes cobrem limite de tamanho, arquivo inválido e erros de campos
sem apresentar incorretamente o aviso de 10 MB para qualquer erro de upload.

## Desenho, recuperação e mensagens

- Pressão fora de Selecionar: sem seleção em 2,1 segundos e com seleção em 2,75 segundos.
- Pausa de 800 ms sobre a ponta seguida de arraste em Endireitar cria a linha.
- Contorno em volta da linha e alças nas pontas: vertical, giro, tamanho, arraste,
  zoom, retrato/paisagem, desfazer/refazer e editor embutido.
- Número do ponto: arraste separado, movimentação da bolinha, quatro posições rápidas,
  prévia, desfazer/refazer e salvamento do deslocamento.
- Um desenho criado offline no EVD foi recuperado após reabrir a interface e enviado
  junto com as fotos na reconexão.
- Persistência automatizada nos seis tipos com desenho não vazio, número reposicionado,
  observação interna, pintura da foto, valor de medição, legenda e referência de arquivo.
- Sincronização interrompida na segunda foto e reinício: somente a pendente é reenviada,
  com o vínculo correto. Esse caso foi ampliado para os seis tipos.
- Erros simultâneos de número obrigatório e ponto repetido; botão Corrigir abre a ficha
  ou identificação correspondente. Erros de validação do servidor também navegam até
  o campo e preservam o preenchimento.
- Testes existentes de isolamento de conta, assinatura offline, disco cheio e gravação
  interrompida passaram.

## PDF e relatórios existentes

Foram conferidos os seis renderizadores com 1, 6, 7 e 12 fotos: quadros uniformes dentro
da sequência, imagens preenchendo os quadros, até três duplas por folha, fotos ímpares
e continuação sem perda de evidência ou transbordamento dos blocos. Casos adicionais
preservaram 36 leituras de medição e legendas extensas.

Outra sequência verificou identificação e conclusão longas, tabelas extensas de LP e
registros de EVD, fontes e exclusão das observações internas. Os PDFs reais dos seis
tipos foram rasterizados e a composição visual foi inspecionada.

Os testes de regressão também confirmam:

- Observações internas do desenho ficam fora de prévia, geração e download nos seis tipos.
- LP não imprime dimensão antiga do ponto nem linhas repetidas abaixo das fotos.
- Cliente mantém linha sem assinatura e identificação padrão da empresa conforme a regra vigente.
- Relatório finalizado existente usa o renderizador atual no download e conserva o arquivo histórico.

## Checks e reprodução

- 360 testes unitários em 51 arquivos: passaram.
- 63 testes de integração em 10 arquivos: passaram.
- Os seis testes de fotos da API foram ampliados com remoção, reenvio e mudança de obra
  e executados novamente: passaram.
- Typecheck dos workspaces, build compartilhado/API, exportação web e lint dos arquivos
  alterados nesta auditoria: passaram.
- Prettier dos arquivos alterados nesta auditoria: passou.

```powershell
npm run typecheck
npm run build
npm test
npm run test:integration
npm run export:web --workspace @weldcosta/app -- --max-workers 2
```

Os testes de integração exigem Docker e criam/removem seu próprio banco de teste.
As capturas e PDFs sintéticos desta execução estão no diretório ignorado `artifacts/`.

## Limites da verificação e publicação

Não havia aparelho conectado no ADB. Esta auditoria não executou um APK em Android/iOS
físico; câmera nativa, teclado, permissões da galeria e encerramento forçado pelo sistema
continuam dependendo de validação no telefone. A recuperação da interface foi testada
em navegador, e o armazenamento nativo teve testes automatizados com a API de arquivos
simulada. Isso não equivale a uma homologação física.

PDF, envio para análise, aprovação e compartilhamento de PDF continuam exigindo internet.
O offline exige a preparação prévia dos catálogos e das fotos de relatórios existentes.
A sincronização acontece com o app aberto.

A correção de exclusão encontrada nesta auditoria está no cliente e exige novo APK
(`npm run apk`). No painel web, exige publicar a nova interface. Para o conjunto de
alterações offline anteriores, a API e sua migração também precisam estar atualizadas,
conforme `relatorios-offline.md`.
