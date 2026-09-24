# Mercatto · Financeiro

Controle financeiro interno da Mercatto Imóveis (Balneário Camboriú e Praia Brava):
receitas e despesas, caixa, comissões por VGV e corretor, meta anual de VGV, propostas em negociação,
ponto de equilíbrio, projeções, retiradas de sócios e exportação em CSV.

- **Next.js (App Router)** exportado como site estático → **GitHub Pages**
- **Supabase**: Postgres + Auth (e-mail/senha + **MFA TOTP obrigatório**) + RLS
- **Recharts** para os gráficos

---

## Arquitetura e segurança

O GitHub Pages só serve arquivos estáticos: não existe servidor, middleware nem rota de API.
Por isso o app roda inteiro no navegador e fala direto com o Supabase usando a **chave pública**
(anon / publishable). A proteção fica no banco:

| Camada | O que faz |
|---|---|
| **RLS em todas as tabelas** | O papel `anon` não tem permissão nenhuma. O papel `authenticated` só lê e grava quando o JWT tem **as duas coisas**: `aal = 'aal2'` (senha + código TOTP verificados na sessão) **e** `app_metadata.mercatto_membro = true` (usuário autorizado pela Mercatto). Quem entra só com senha, ou quem não foi autorizado, não vê nenhuma linha. |
| **Autorização de membros** | A marca `mercatto_membro` fica em `app_metadata`, que o próprio usuário não consegue alterar. Ela é dada pela Edge Function de convite ou por `select public.autorizar_membro('email')` no SQL Editor. Assim, mesmo que o cadastro público seja ligado por engano, uma conta criada por estranhos não acessa nada. |
| **Sem cadastro público** | Cadastro desligado no Supabase. Contas são criadas pelo painel do Supabase ou pela tela de convite. |
| **Porteiro no front** | `src/components/Painel.tsx` manda para login, para o código TOTP ou para o cadastro do autenticador. É a camada de experiência de uso: mesmo que alguém a contorne, o banco não entrega dados. |
| **Service role key** | **Nunca** vai para o site. Só a Edge Function `convidar-usuario` a usa, e o próprio Supabase a injeta lá. |
| **Auditoria** | Triggers gravam `criado_por`, `criado_em` e `atualizado_em`; o navegador não consegue forjar esses campos. |

Limitações de hospedar no GitHub Pages:

- **O site é público** (a página de login abre para qualquer pessoa), mesmo com repositório privado. Os dados não são: continuam protegidos por login + MFA + RLS.
- Pages em **repositório privado** exige plano pago do GitHub (Pro/Team). Com repositório público, o código fica visível, mas ele não contém segredos.
- Não dá para configurar cabeçalhos HTTP (CSP, HSTS personalizados). A sessão fica no `localStorage` do navegador.
- Recomendado: em Supabase → Authentication → Sessions, reduzir a duração do JWT (ex.: 1 hora) e, se disponível no seu plano, limitar a duração da sessão.

---

## Estrutura

```
.github/workflows/deploy.yml     build estático + publicação no Pages a cada push na main
supabase/
  migrations/…_schema_inicial.sql tabelas, triggers, permissões e RLS
  migrations/…_somente_membros.sql RLS passa a exigir também membro autorizado
  migrations/…_vgv_metas_itens.sql VGV/imposto NF, origem só em despesas, item de custo, metas anuais
  migrations/…_propostas.sql      propostas em negociação (fora do financeiro)
  functions/convidar-usuario/     Edge Function de convite (única que usa a service role)
  templates/                      e-mails de convite e de redefinição de senha
src/
  app/
    (painel)/                     telas protegidas: visão geral, vendas, despesas, metas,
                                  sócios, lançamentos, exportação, configurações, usuários
    login/ mfa/ esqueci-senha/ auth/   telas de acesso
    globals.css                   tema claro/escuro, layout e componentes visuais
  components/
    Painel.tsx                    porteiro (sessão + MFA) e carga dos dados
    Navegacao.tsx                 menu lateral (gaveta no celular)
    ui.tsx                        cards, indicadores, variação, barras
    FormLancamento.tsx            formulário com calculadora de comissão e autocomplete
    graficos/Graficos.tsx         gráficos (Recharts)
    paginas/                      uma view por aba
  lib/
    financeiro/calculos.ts        TODAS as regras de negócio (funções puras, testadas)
    financeiro/datas.ts           meses, trimestres, períodos
    dados.ts                      leitura e gravação no Supabase
    supabase/cliente.ts           cliente do navegador e checagem de MFA
```

---

## 1. Banco de dados (Supabase)

### Opção A — SQL Editor (mais simples)

1. Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de cada arquivo de `supabase/migrations/`, em ordem de data, e clique em **Run** para cada um.
3. Confira em **Table Editor** que existem `lancamentos` e `configuracoes` (com 1 linha), ambas com o selo **RLS enabled**.

### Opção B — Supabase CLI

```bash
npx supabase login
```

```bash
npx supabase link --project-ref SEU_PROJECT_REF
```

```bash
npx supabase db push
```

## 2. Autenticação (Supabase → Authentication)

1. **Sign In / Providers → Email**: mantenha habilitado. Em **User Signups**, **desligue** "Allow new users to sign up".
   (Mesmo ligado, estranhos não veem dados por causa da marca de membro, mas não há motivo para aceitar cadastros.)
2. **Multi-Factor**: confirme que **TOTP (App Authenticator)** está habilitado (vem ligado por padrão).
3. **URL Configuration**:
   - **Site URL**: `https://wonzimkt.github.io/mercatto-financeiro` (ajuste ao nome do seu repositório, ou ao domínio próprio)
   - **Redirect URLs**: adicione `https://wonzimkt.github.io/mercatto-financeiro/**` e `http://localhost:3000/**`
4. **Emails → Templates** (opcional; exige SMTP próprio, item 6): o app funciona com os modelos
   padrão do Supabase. Com SMTP configurado, dá para trocar pelos modelos em português da Mercatto:
   - **Invite user**: cole `supabase/templates/convite.html`
   - **Reset password**: cole `supabase/templates/redefinir-senha.html`

   Esses modelos levam a `/auth/confirmar/?token_hash=…`, que valida o link no próprio app.
5. **Policies → Password**: defina tamanho mínimo **10** (a tela de senha já exige isso).
6. Para produção, configure um **SMTP próprio** (Authentication → Emails → SMTP): o envio padrão do Supabase tem limite baixo de e-mails por hora.

### Primeiro usuário

Supabase → **Authentication → Users → Add user**:

- **Send invitation** (recomendado): a pessoa recebe o e-mail, define a senha e cadastra o autenticador; ou
- **Create new user** com e-mail e senha (marque *Auto Confirm User*). No primeiro login o app exige cadastrar o autenticador.

Depois, **autorize** o usuário no **SQL Editor** (quem é convidado pela tela de convites já sai autorizado):

```sql
select public.autorizar_membro('voce@mercatto.com.br');
```

Para tirar o acesso de alguém: `select public.revogar_membro('email');` (vale quando o token atual expirar) ou exclua o usuário em Authentication → Users.

## 3. Tela de convites (opcional)

A aba **Usuários e convites** chama a Edge Function `convidar-usuario`. Só quem está em `ADMIN_EMAILS` e passou pelo MFA consegue convidar.

```bash
npx supabase functions deploy convidar-usuario
```

```bash
npx supabase secrets set ADMIN_EMAILS="voce@mercatto.com.br,cris@mercatto.com.br" SITE_URL="https://wonzimkt.github.io/mercatto-financeiro"
```

Sem a função publicada, o sistema funciona normalmente; os convites passam a ser feitos pelo painel do Supabase.

## 4. Deploy no GitHub Pages

1. Crie o repositório (ex.: `wonzimkt/mercatto-financeiro`) e envie este código para a branch `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → aba Variables → New repository variable**:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | a chave **anon** ou **publishable** (`sb_publishable_…`) |

   São valores públicos por natureza (vão para o JavaScript do site). **Não** cadastre a service role key no GitHub.
4. Faça um push na `main` (ou rode o workflow manualmente em **Actions → Deploy no GitHub Pages → Run workflow**).
   O workflow roda checagem de tipos, os testes dos cálculos, gera o site estático em `out/` e publica.
5. O endereço aparece em **Settings → Pages**. O `basePath` (`/mercatto-financeiro`) é aplicado automaticamente.

**Domínio próprio** (ex.: `financeiro.mercatto.com.br`): configure em Settings → Pages → Custom domain e troque
a Site URL / Redirect URLs no Supabase e o `SITE_URL` da Edge Function.

## 5. Desenvolvimento local

```bash
cp .env.example .env.local
```

Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local`, depois:

```bash
npm install
```

```bash
npm run dev
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | testes das regras financeiras (`src/lib/financeiro/*.test.ts`) |
| `npm run typecheck` | checagem de tipos |
| `npm run build:pages` | gera o site estático em `out/`, igual ao publicado |
| `npm run preview` | serve a pasta `out/` localmente |

**Modo demonstração** (dados fictícios, sem login, só em desenvolvimento): `NEXT_PUBLIC_DEMO=1 npm run dev`.
Serve para ver o visual e testar as telas sem tocar no banco. O build publicado nunca entra nesse modo.

---

## Regras de negócio

Todas em `src/lib/financeiro/calculos.ts`, cobertas por testes.

- **Valor** é sempre positivo; o tipo (receita/despesa) dá o sinal.
- **Comissão de Venda** é lançada pelo **VGV**. A calculadora faz: comissão total (5% do VGV) → split Mercatto
  (50% da comissão = 2,5% do VGV) e split corretor (o restante) → imposto sobre a NF (6%, só sobre o split da
  Mercatto) → **líquido Mercatto**, que é o `valor` da receita. Os percentuais padrão ficam em Configurações e podem
  ser ajustados venda a venda; tudo fica gravado (`vgv`, `comissao_bruta`, `imposto_nf`…).
- **Origem (Caixa/Cris) só existe em despesas.** Toda receita entra no caixa da empresa.
- **Caixa** = saldo inicial + receitas − despesas pagas pelo Caixa. Despesas pagas pela Cris **não saem do caixa**
  e são somadas à parte ("total bancado pela Cris"). "Caixa agora" considera só lançamentos com data até hoje.
- **Resultado do mês** = receitas − todas as despesas (inclusive retiradas e as pagas pela Cris).
- **Qual custo**: despesas podem ter um item de custo (ex.: aluguel, contador) além da categoria; a aba Despesas
  agrupa por ele. Maiúsculas e espaços não diferenciam itens.
- **Custo operacional** = todas as despesas **exceto Retirada de Sócios** (retirada é distribuição de lucro).
- **Ponto de equilíbrio** = custo operacional do mês ÷ comissão líquida média por venda (arredondado para cima).
  - Mês encerrado: custo lançado. Mês em curso: o maior entre o já lançado e a média dos 3 meses anteriores.
  - Comissão média: últimos 12 meses.
  - Sem histórico suficiente (menos de 2 meses de custos ou menos de 3 vendas), usa `custo_fixo_estimado` e
    `comissao_media_esperada` das configurações. A tela sempre informa de onde veio cada número.
- **Meta de vendas**: meta anual de **VGV vendido** (tabela `metas_anuais`), editada na aba Metas. Alcançado = soma
  do VGV das vendas do ano; o ritmo compara com a meta proporcional aos dias já passados do ano.
- **Propostas** (tabela `propostas`) acompanham as negociações e **não entram no financeiro**. Quando a venda
  se concretiza (NF emitida), o botão "Registrar venda" abre o lançamento de comissão já preenchido; ao salvar, a
  proposta vira "fechada" e passa a apontar para o lançamento. Propostas perdidas guardam data e motivo. A aba mostra
  VGV em negociação, líquido potencial (pelos percentuais padrão), propostas paradas há mais de 30 dias e a
  conversão dos últimos 12 meses.
- **Projeção (3 meses)**: média móvel simples das entradas e saídas do caixa dos últimos 3 meses encerrados,
  somada ao caixa atual. Sem histórico, projeta só o custo estimado, sem receita (cenário prudente).
- **Exportação**: CSV com `;`, vírgula decimal e BOM UTF-8, para abrir direto no Excel em português. Gerado no navegador.

## Design

Visual neutro de app financeiro: cinzas, um azul de destaque e a fonte Inter com algarismos tabulares.
- **Navegação:** menu lateral agrupado (Análises, Registros, Administração); no celular vira uma gaveta, com botão de novo lançamento sempre à mão.
- **Organização:** indicadores e seções em cards com bordas suaves; campos de formulário com borda e foco visível.
- **Cores com significado:** verde-azulado e vermelho só marcam valores positivos e negativos, sempre com sinal ou seta (a cor nunca é o único sinal).
- **Tema:** claro por padrão, escuro conforme o sistema ou pelo botão no menu.
- **Acessibilidade:** as cores dos gráficos foram validadas para daltonismo nos dois temas, e os textos passam de 4,5:1 de contraste.
