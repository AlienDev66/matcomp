# MatComp

Plataforma multi-academia para competições de Jiu-Jitsu (estilo Smoothcomp).
Stack: **TanStack Start** + **Supabase** + **Vercel**.

Pasta: `~/Coding/personal/matcomp`  
A app de mensalidades Team FS continua em `~/Coding/personal/teamfs/payment-system`.

## Funcionalidades (MVP)

- Conta de organizador + criar academia (tenant)
- Roster de atletas por academia
- Competições → divisões → inscrições → chave single-elim
- Página pública `/c/:id` com refresh ao vivo
- Layout e visual alinhados ao Team FS (escuro, tipografia Syne + DM Sans)

## Setup rápido

### 1. Supabase (projeto **novo**)

1. Cria um projeto em [supabase.com](https://supabase.com)
2. SQL Editor → cola e corre `supabase/migrations/20260619000000_matcomp_core.sql`
3. Authentication → Providers → Email ligado
4. Copia URL + anon key

### 2. Env local

```bash
cp .env.example .env.local
```

Preenche:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

(Aliases `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` também funcionam no SSR.)

### 3. Dev

```bash
npm install
npm run dev
```

### 4. Vercel

1. Importa o repo `matcomp`
2. Framework: Vite / TanStack
3. Env vars: as mesmas do `.env.local`
4. Deploy

## Fluxo de uso

1. Criar conta em `/auth`
2. Criar academia em `/onboarding`
3. Adicionar atletas → criar competição → divisões → inscrever → **Gerar chave**
4. Abrir página pública e tocar no vencedor no painel admin

## Próximos passos naturais

- Inscrição pública / pagamento de fee
- Vários tatâmis + fila
- Ranking por academia / temporada
- Branding por academia (logo + cor)
- Remover módulo de competições do `payment-system` quando MatComp estiver estável
