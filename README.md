# whatsapp-finance-organizer

Bot que lê as transações que você manda num grupo do WhatsApp e anota cada uma, como uma linha, na planilha de finanças do Google Sheets. Uma IA entende a mensagem do jeito que você escrever:

```
gastei 32,90 no ifood                 →  SAÍDAS:   28-out. | R$ 32,90    |         | ALIMENTAÇÃO | ifood
uber 18,50 cartão                     →  SAÍDAS:   28-out. | R$ 18,50    | CRÉDITO | TRANSPORTE  |
-25 alimentação pix tauste            →  SAÍDAS:   28-out. | R$ 25,00    | PIX     | ALIMENTAÇÃO | tauste
recebi 1201 do salário                →  ENTRADAS: 28-out. | R$ 1.201,00 | salário
```

O que a mensagem não disser (como pagou, o que comprou) fica em branco. Cada grupo aponta para uma planilha, e todas seguem o mesmo modelo: uma aba por mês com as tabelas de saídas e entradas, totais por tipo e por forma de pagamento e gráficos.

- [Passo a passo](#passo-a-passo)
  - [A. Alguém já roda o bot e vai ligar o seu](#a-alguém-já-roda-o-bot-e-vai-ligar-o-seu)
  - [B. Rodar o seu próprio bot](#b-rodar-o-seu-próprio-bot)
- [Uso no dia a dia](#uso-no-dia-a-dia)
- [A planilha](#a-planilha)
- [Como funciona](#como-funciona)
- [Problemas comuns](#problemas-comuns)
- [Cuidados](#cuidados)

---

## Passo a passo

Um bot conectado a um número de WhatsApp lê os grupos daquele número. Então há dois jeitos de ter o seu:

- **A.** Alguém que já roda o bot (um amigo, alguém da família) liga mais uma cópia para o seu número, no computador dele. Você **não instala nada nem mexe no Google Cloud**.
- **B.** Você roda o bot no seu computador. Precisa de um computador ligado com frequência e uns 30 minutos.

### A. Alguém já roda o bot e vai ligar o seu

**O que você faz:**

1. **Crie o grupo no WhatsApp** (ex.: `Extrato - Nubank`), só com você. Se o WhatsApp exigir um participante, adicione alguém e remova logo depois. Pode ter mais de um grupo (um por banco, por exemplo).
2. **Crie a planilha:** abra [sheets.new](https://sheets.new) (planilha em branco no Google Drive) e dê um nome (ex.: `Finanças`). Deixe em branco; o bot monta tudo.
3. **Compartilhe a planilha** (botão *Compartilhar*) com o e-mail do bot que a pessoa te passar (termina em `iam.gserviceaccount.com`), como **Editor**.
4. **Mande para quem roda o bot:** o link da planilha, o nome **exato** do grupo e o seu número com DDD.
5. **Conecte o WhatsApp:** quem roda vai te passar um código de 8 letras. No celular: *WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone*, e digite o código. Ele expira em cerca de 1 minuto; se expirar, peça outro.
6. **Teste:** mande no grupo `gastei 1 real de teste no pix`. A mensagem deve ganhar um ✅ e aparecer uma linha na aba do mês da planilha. Depois apague essa linha (na aba do mês e na aba Log).
7. **Ajuste as categorias** na aba **Config** da planilha quando quiser (ver [Uso no dia a dia](#mudar-categorias-e-formas-de-pagamento)).

Saiba que: o bot entra na sua conta como um *aparelho conectado* (igual ao WhatsApp Web) e quem roda o computador tem acesso a essa sessão. O texto das mensagens **dos grupos configurados** é enviado à IA (Groq). Você pode desconectar o bot a qualquer momento em *Aparelhos conectados*.

**O que quem roda faz** (uma cópia do projeto por número de WhatsApp):

```sh
git clone https://github.com/dmribeiro0/whatsapp-finance-organizer.git ~/Projects/finance-bot-<nome>
cd ~/Projects/finance-bot-<nome>
npm install
mkdir data && cp <pasta do bot que já roda>/data/service-account.json data/   # mesma conta de serviço
cp config.example.js config.js     # GROUPS, LLM.apiKey e PAIRING_PHONE da pessoa
npm run setup -- <ID_DA_PLANILHA>  # depois que ela compartilhar a planilha
npm start                          # mostra o código de pareamento; a pessoa digita
```

Depois crie um serviço com **outro nome** (ex.: `finance-bot-<nome>`) como na etapa 8 do caminho B. A chave da Groq pode ser a mesma (os limites gratuitos são por conta, ~1.000 mensagens/dia) ou uma da própria pessoa.

### B. Rodar o seu próprio bot

**Você vai precisar de:**
- Um computador ligado com frequência (Linux, macOS ou Windows). O bot só lança enquanto está rodando, mas recupera as mensagens que chegaram com ele desligado.
- [Node.js](https://nodejs.org) 20 ou mais novo e [git](https://git-scm.com).
- Uma conta Google (a mesma da planilha serve).
- Uma conta na [Groq](https://console.groq.com) (gratuita, sem cartão), para a IA.

#### 1. Baixar e instalar

```sh
git clone https://github.com/dmribeiro0/whatsapp-finance-organizer.git
cd whatsapp-finance-organizer
npm install
npm test        # deve terminar com "fail 0"
```

#### 2. Google Cloud: a conta de serviço (o "robô" que escreve na planilha)

É gratuito e não pede cartão.

1. Abra [console.cloud.google.com](https://console.cloud.google.com) e entre com a sua conta Google (aceite os termos se pedir).
2. **Crie um projeto:** no seletor de projetos (topo da página) → *Novo projeto* → nome `finance-bot` → *Criar*. Depois selecione esse projeto no mesmo seletor.
3. **Ative a API do Sheets:** menu ☰ → *APIs e serviços → Biblioteca* → procure **Google Sheets API** → *Ativar*.
4. **Crie a conta de serviço:** menu ☰ → *IAM e administrador → Contas de serviço* → *+ Criar conta de serviço* → nome `bot` → *Criar e continuar* → pule a parte de papéis/permissões → *Concluir*.
5. **Gere a chave:** clique na conta criada → aba *Chaves* → *Adicionar chave → Criar nova chave* → **JSON** → *Criar*. O navegador baixa um arquivo `.json`.
6. Na pasta do projeto, crie a pasta `data` e mova o arquivo para **`data/service-account.json`**.
7. Anote o e-mail da conta de serviço (aparece na lista e no campo `client_email` do JSON; termina em `iam.gserviceaccount.com`).

> Conta Google de empresa/faculdade às vezes bloqueia a criação de chaves. Se der erro no passo 5, use uma conta Gmail pessoal.

#### 3. Groq: a chave da IA

1. Entre em [console.groq.com](https://console.groq.com) (dá para entrar com Google ou GitHub).
2. *API Keys* → *Create API Key* → dê um nome → copie a chave (`gsk_…`). **Ela só aparece uma vez.**
3. Recomendado: em *Settings → Data Controls*, ative **Zero Data Retention**, para a Groq não guardar o texto das mensagens nem nos logs de suporte.

Sem chave o bot também funciona, mas só entende o formato fixo `-valor tipo pagamento observação`.

#### 4. Criar a planilha

1. Abra [sheets.new](https://sheets.new) e dê um nome (ex.: `Finanças - Nubank`). Deixe em branco.
2. *Compartilhar* → cole o e-mail da conta de serviço (passo 2.7) → **Editor** → *Enviar*.
3. Copie o ID da URL: `https://docs.google.com/spreadsheets/d/`**`<ID>`**`/edit`
4. Rode:

```sh
npm run setup -- <ID>
```

Saída esperada: `Pronto: "Finanças - Nubank" tem Config, Log, MODELO (oculta) e NOV 2026.` A planilha fica em pt-BR, com a aba do mês atual pronta.

5. **Opcional: dropdowns em formato de chip.** A API do Google não deixa o bot criar chips, então isso é feito à mão uma vez na aba **MODELO** (os meses novos copiam dela) e na aba do mês atual. Para mostrar a MODELO, abra a lista de abas (☰ no canto inferior esquerdo) e clique nela. Em cada uma: selecione `R4:S200` → *Dados → Validação de dados* → clique na regra → *Opções avançadas → Estilo de exibição: Chip* → *Concluído*. Depois esconda a MODELO de novo (clique direito na aba → *Ocultar*).

Quer outra planilha (outro banco)? Repita este passo.

#### 5. Configurar

```sh
cp config.example.js config.js
```

Edite o `config.js`:

| Campo | O que colocar |
|---|---|
| `GROUPS` | Uma linha por grupo: `{ group: 'Extrato - Nubank', spreadsheetId: '<ID>' }`. O nome do grupo tem que ser **exatamente** igual ao do WhatsApp. Vários grupos podem usar a mesma planilha. Num grupo em que outras pessoas também lançam, acrescente `everyone: true`. |
| `LLM.apiKey` | A chave da Groq (`gsk_…`). |
| `PAIRING_PHONE` | Seu número com DDI e DDD, só dígitos (ex.: `5511987654321`), para conectar por código. Deixe `''` para usar QR code. |
| `TIMEZONE` | Fuso que decide a data e o mês (padrão `America/Sao_Paulo`). |

O `config.js` não vai para o git (tem a chave e o seu número).

#### 6. Conectar o WhatsApp

```sh
npm start
```

- O bot mostra um código tipo `ABCD-EFGH`. No celular: *WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone*, e digite. O código expira em cerca de 1 minuto; se expirar, pare com Ctrl+C e rode de novo. (Com `PAIRING_PHONE = ''`, escaneie o QR que aparece no terminal.)
- Logo depois de conectar, a conexão cai e volta sozinha. É normal.
- A sessão fica salva em `data/auth/`; das próximas vezes ele reconecta sozinho.

Saída esperada:

```
Planilha "Finanças - Nubank" OK (0 transações no Log)
IA: openai/gpt-oss-20b
Conectado. Ouvindo "Extrato - Nubank"
```

O bot ignora tudo que já estava no grupo antes desse momento.

#### 7. Testar

Mande no grupo `gastei 1 real de teste no pix`. Confira o ✅ na mensagem, a linha na aba do mês e a linha na aba **Log**. Depois apague as duas linhas.

#### 8. Deixar rodando sempre

Pare o `npm start` (Ctrl+C) antes, para não ter dois bots na mesma sessão.

**Linux (systemd do usuário)**, de dentro da pasta do projeto:

```sh
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/finance-bot.service <<EOF
[Unit]
Description=WhatsApp finance bot
After=network-online.target

[Service]
WorkingDirectory=$(pwd)
ExecStart=$(which node) src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable --now finance-bot
loginctl enable-linger $USER          # continua rodando mesmo sem login
journalctl --user -u finance-bot -f   # acompanhar os logs
```

`$(pwd)` e `$(which node)` viram caminhos fixos na hora. Se o Node vier de um gerenciador de versões (mise, nvm), o caminho muda quando você atualizar o Node: ajuste o `ExecStart` e rode `systemctl --user daemon-reload && systemctl --user restart finance-bot`. Para um segundo bot na mesma máquina, use outro nome de arquivo e outra pasta.

**macOS ou Windows:** `npm i -g pm2`, depois `pm2 start src/index.js --name finance-bot`, `pm2 save` e `pm2 startup` (siga a instrução que ele imprimir).

Depois de mudar o `config.js`, reinicie (`systemctl --user restart finance-bot` ou `pm2 restart finance-bot`). Mudanças na aba Config da planilha não precisam de reinício.

---

## Uso no dia a dia

### Mandar transações

Escreva como quiser, uma transação por mensagem:

```
gastei 32,90 no ifood
uber 18,50 cartão
paguei 120 de luz no débito
-25 alimentação pix tauste
50 conto
recebi 1201 do salário
+40 carona
```

- **Saída ou entrada:** a IA decide pelo texto ("gastei", "paguei" → saída; "recebi", "vendi" → entrada). Um `-` ou `+` no começo sempre vale. Na dúvida, é saída.
- **Saída:** valor, **tipo** (o que foi comprado), **pagamento** (como pagou) e observação. O que a mensagem não disser fica em branco.
- **Entrada:** valor e observação (de onde veio).
- O **valor precisa estar escrito com números** na mensagem (`50`, `32,90`, `R$ 1.234,56`). "Cinquenta reais" não é lançado.

O bot reage na mensagem:

| Reação | Significado |
|---|---|
| ✅ | Registrado |
| 🤷 | Registrado, mas sem tipo (a mensagem não diz o que foi comprado) |
| ❓ | Não é uma transação (conversa, pergunta, mensagem sem valor) |
| ⚠️ | Erro (o motivo aparece no log do bot) |

### Corrigir

Editar ou apagar a mensagem no WhatsApp **não** muda a planilha. Corrija direto na planilha: a linha na aba do mês (as colunas TIPO e PAGAMENTO têm lista suspensa) e, se quiser manter o histórico certo, a linha na aba **Log**.

### Mudar categorias e formas de pagamento

Na aba **Config** da planilha: adicione, renomeie ou apague linhas de **TIPO** (coluna A) e **PAGAMENTO** (coluna D). As **palavras-chave** (colunas B e E, separadas por vírgula) ajudam a IA a decidir (ex.: `farmácia, remédio` num tipo `SAÚDE`). Vale na próxima mensagem. A IA só escolhe nomes que estão nessas listas; o que foi comprado e não cabe em nenhum tipo vai para **OUTROS**.

### Saldo da conta

No primeiro mês, digite o saldo que a conta tinha no cartão **SALDO ANTERIOR**. Daí em diante cada mês começa com o saldo final do anterior, e o **SALDO ATUAL** acompanha cada lançamento. Se o valor não bater com o banco, corrija o SALDO ANTERIOR do mês (digitar por cima da fórmula vale só para aquele mês; os seguintes continuam puxando dele).

### Nova planilha ou novo grupo

Crie a planilha em branco, compartilhe com a conta de serviço, `npm run setup -- <ID>`, adicione `{ group, spreadsheetId }` em `GROUPS` e reinicie o bot. O bot ignora o que já estava no grupo antes de ser adicionado.

---

## A planilha

Criada pelo `npm run setup`, baseada na planilha FINANÇAS de um amigo:

- **Uma aba por mês** (`OUT 2026`, `NOV 2026`, …), criada pelo bot na primeira mensagem do mês como cópia da aba oculta **MODELO**. Cada uma tem:
  - **SAÍDAS** (colunas P–T): DATA, VALOR, PAGAMENTO, TIPO, OBSERVAÇÕES.
  - **ENTRADAS** (V–X): DATA, VALOR, OBSERVAÇÃO.
  - Resumo à esquerda: gastos totais (vermelho), ganhos totais (verde), saldo do mês, **saldo anterior**, **saldo atual**, total por tipo, total por pagamento e dois gráficos de rosca.
  - **Saldo que passa de um mês para o outro:** quando o bot cria a aba de um mês, o SALDO ANTERIOR vira uma fórmula que puxa o SALDO ATUAL da última aba de mês que existe (se um mês não teve lançamento, ele pula). SALDO ATUAL = SALDO ANTERIOR + ganhos − gastos. No **primeiro mês** de uma planilha não há mês anterior: digite o saldo inicial da conta no cartão SALDO ANTERIOR.
  - TIPO e PAGAMENTO aparecem coloridos como os chips do Google Sheets. A cor vem da **linha** do item na aba Config (1º tipo azul, 2º amarelo…), então renomear ou acrescentar categorias mantém as cores.
- **Config**: TIPOS e PAGAMENTOS com as palavras-chave, cada um pintado com a sua cor. Relida a cada mensagem.
- **Log**: uma linha por transação (data, valor, tipo, categoria, pagamento, observação, mensagem original, ID). Serve de auditoria e evita contar duas vezes.

Dá para digitar linhas à mão e acrescentar coisas no lado esquerdo da aba. O bot escreve sempre na primeira linha **totalmente vazia** de cada tabela, e acha as tabelas pelos títulos `SAÍDAS` / `ENTRADAS` e pelo cabeçalho logo abaixo.

As colunas TIPO e PAGAMENTO têm dropdown com a lista da Config. O formato **chip** (a "pílula") é configurado à mão na MODELO (passo 4.5 do caminho B), porque a API do Google não deixa o bot criá-lo. Uma vez na MODELO, ele vai junto para todos os meses novos.

O visual vem de `src/template.js`. Mudar a aba MODELO de uma planilha muda os meses que ainda vão ser criados nela. Depois de mudar o `template.js`, `npm run setup -- <ID> --modelo` refaz a MODELO de uma planilha que já existe (as abas de mês já criadas não mudam; uma aba de mês vazia pode ser apagada que o bot recria). Refazer a MODELO perde os chips: configure de novo.

---

## Como funciona

```
Grupo do WhatsApp ──(Baileys)──> whatsapp.js ──> index.js ──> llm.js (Groq) ──> sheets.js + layout.js ──(API do Sheets)──> planilha do grupo
                                                     │            └─ se falhar: parser.js (formato fixo)          ├─ aba do mês
                                                     └── reage ✅ 🤷 ❓ ⚠️ na mensagem                               └─ Log
```

1. **src/whatsapp.js** conecta no WhatsApp como um *aparelho conectado* usando o [Baileys](https://github.com/WhiskeySockets/Baileys) (biblioteca não oficial do WhatsApp Web, sem navegador) e escuta as mensagens de texto dos grupos configurados: só as **suas**, ou as de todos os membros num grupo com `everyone: true`.
2. **src/index.js** lê a aba Config da planilha do grupo e manda a mensagem para a IA.
3. **src/llm.js** chama a IA (qualquer API compatível com a da OpenAI; padrão: Groq, modelo `openai/gpt-oss-20b`, plano gratuito). A resposta é forçada num formato JSON (*structured outputs*) em que o tipo e o pagamento só podem ser nomes da Config ou vazio. Depois o código confere:
   - o **valor tem que aparecer escrito na mensagem**, senão a resposta é descartada (a IA não consegue inventar um valor);
   - um `-`/`+` no começo da mensagem manda mais que a IA;
   - entrada nunca tem tipo nem pagamento.
4. Se não há chave, a API falha ou a resposta não passa na conferência, **src/parser.js** tenta o formato fixo: `-`/`+`, valor e palavras que batem com os nomes e palavras-chave da Config.
5. **src/sheets.js** e **src/layout.js** (lógica pura) calculam a data no fuso configurado, criam a aba do mês se precisar, acham a primeira linha vazia da tabela, escrevem e acrescentam no Log.

### Proteções

- **Não conta duas vezes:** os IDs das mensagens no Log de cada planilha são carregados ao iniciar, e mensagens já registradas são puladas.
- **Não importa histórico antigo:** o `data/state.json` guarda, para cada grupo, quando ele foi configurado; o que foi enviado antes disso é ignorado (conectar um aparelho ou adicionar um grupo sincroniza o histórico do chat).
- **Recupera o que perdeu:** mensagens enviadas com o bot desligado são processadas quando ele reconecta.
- **Uma transação por vez:** as mensagens entram numa fila, então duas seguidas não caem na mesma linha.
- **Limite da IA:** se a Groq responder "muitas requisições", o bot espera e tenta de novo uma vez; depois cai no formato fixo.

### O que não é tratado

- Editar ou apagar a mensagem não muda a planilha.
- A data é a do envio: não dá para lançar "ontem" ou "dia 5".
- Uma transação por mensagem. Foto de comprovante, áudio e documento são ignorados.
- Por padrão só mensagens suas contam. Num grupo compartilhado (ex.: a tesouraria de um grupo), `everyone: true` no `GROUPS` faz o bot ler a mensagem de qualquer membro; ali, mensagem sem número é tratada como conversa e ignorada, sem reação. A aba Log guarda quem mandou (coluna *Quem*), e se a tabela do mês tiver uma coluna `QUEM` o bot preenche também.
- O resumo do mês mostra até 15 tipos e 8 pagamentos.

### Estrutura

```
whatsapp-finance-organizer/
├── config.example.js      # modelo de configuração (versionado)
├── config.js              # o seu: grupos → planilhas, chave da IA, fuso, telefone — fora do git
├── src/
│   ├── index.js           # ponto de entrada: mensagem → IA/formato fixo → planilha → reação
│   ├── whatsapp.js        # Baileys: login (QR ou código), reconexão, fila, mensagens do grupo
│   ├── llm.js             # IA: prompt, schema JSON, conferência da resposta, chamada à API
│   ├── parser.js          # formato fixo, valores, leitura da aba Config
│   ├── layout.js          # lógica pura: nome da aba do mês, datas, onde ficam as tabelas
│   ├── sheets.js          # API do Google Sheets: Config, aba do mês, linha nova, Log
│   ├── template.js        # o modelo da planilha (Config, MODELO, Log): valores, formatos, gráficos
│   ├── setup.js           # npm run setup -- <ID>
│   └── paths.js           # caminhos de data/, resolvidos a partir da raiz do projeto
├── scripts/llm-eval.js    # npm run eval: mede a IA em mensagens de exemplo
├── test/                  # npm test (node --test), sem rede e sem config.js
├── data/                  # fora do git: tudo que é local e/ou secreto
│   ├── service-account.json   # chave do Google — secreta
│   ├── auth/                  # sessão do WhatsApp — secreta
│   └── state.json             # desde quando cada grupo é lido
└── package.json
```

### Testes

```sh
npm test        # lógica pura e a IA com respostas simuladas (não usa rede)
npm run eval    # chama a IA de verdade em ~25 mensagens e mostra quantas acertou
```

Para trocar de provedor ou modelo, mude `LLM.baseUrl` / `LLM.model` (e `LLM.extra`, que tem opções específicas do modelo) e rode `npm run eval`. O provedor precisa aceitar `response_format` do tipo `json_schema`.

---

## Problemas comuns

| Problema | Solução |
|---|---|
| `Grupo(s) não encontrado(s)` | O `group` em `GROUPS` tem que ser exatamente o nome do grupo; o erro lista os grupos que o bot vê. Os outros grupos continuam funcionando. |
| `Planilha "…" sem a(s) aba(s) …` | A planilha não foi preparada: `npm run setup -- <ID>`. |
| `Não consegui abrir a planilha` / erro de permissão | Compartilhe a planilha com o e-mail da conta de serviço como Editor. |
| `IA falhou … API 401` | Chave da Groq errada ou apagada: gere outra em console.groq.com/keys. |
| `IA falhou … API 429` | Passou do limite gratuito (por minuto ou por dia). As mensagens com `-`/`+` continuam entrando pelo formato fixo; as outras ganham ❓. Mande de novo mais tarde. |
| `IA falhou … não aparece na mensagem` | A IA leu um valor diferente do escrito. Reescreva a mensagem com o valor mais claro. |
| `Não encontrei a tabela "SAÍDAS"` | Alguém mudou o título ou o cabeçalho (DATA, VALOR) da aba do mês. Restaure, ou apague a aba para o bot recriar a partir da MODELO. |
| `Desconectado do WhatsApp` | O aparelho foi desconectado (ou passou ~14 dias sem conectar). Apague a pasta `data/auth/` e rode `npm start` para conectar de novo. |
| Conexão falhando depois de uma atualização do WhatsApp | `npm update baileys`; se a versão 7.x (release candidate) der problema, tente `npm i baileys@legacy` (6.7.x, não testada aqui). |

## Cuidados

- O Baileys não é oficial e vai contra os Termos de Serviço do WhatsApp. Um bot que só lê o seu próprio grupo tem risco baixo, mas não zero.
- **Segredos:** `data/service-account.json` dá acesso às planilhas compartilhadas, `data/auth/` dá acesso total à conta do WhatsApp e o `config.js` tem a chave da Groq. Nada disso vai para o git; não mande para ninguém e faça backup num lugar seguro se precisar.
- O texto das mensagens dos grupos configurados (e as listas da aba Config) vai para a API da IA. Num grupo com `everyone: true`, isso inclui as mensagens dos outros membros que tiverem número: avise o grupo. A Groq não guarda os dados por padrão, mas pode manter logs por até 30 dias para suporte; ative o **Zero Data Retention** para desligar isso.

## Licença

[MIT](LICENSE).
