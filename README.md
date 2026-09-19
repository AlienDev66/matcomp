# MatComp

Plataforma multi-academia para competições de Jiu-Jitsu (estilo Smoothcomp).
Stack: **TanStack Start** + **Supabase** + **Vercel** + **Stripe**.

## Funcionalidades (produção V1+)

- Landing marketing + home discovery (Upcoming / Past / Yours)
- URLs `/{lang}/event/:id` (+ redirect `/c/:id`)
- Conta universal, join academia, eventos user-owned
- Capa via Supabase Storage, bracket visual, ETA schedule, medalhas
- Stripe Checkout (early bird −20%), página `/payments`
- Rankings por temporada (`/rankings` + recalc)
- Scoreboard IBJJF-like (`/scoreboard/:matchId`) + mesas por tatâmi (`/mesa/:id/:mat`) + TV (`/tv/:id`)
- Check-in QR (`/check-in/:code` + `/check-in/scan`)
- Federações path `/f/:slug` (subdomínio `*.matcomp.com` → redirect)

## Setup

### 1. Supabase

SQL Editor → corre **por ordem**:

1. `supabase/migrations/20260619000000_matcomp_core.sql`
2. `supabase/migrations/20260919180000_smoothcomp_memberships.sql`
3. `supabase/migrations/20260919190000_event_richness.sql`
4. `supabase/migrations/20260919200000_production_features.sql`
5. `supabase/migrations/20260919210000_athlete_account_roster.sql`
6. `supabase/migrations/20260919220000_register_wizard.sql`
7. `supabase/migrations/20260919230000_multi_entry_mesa.sql`
8. `supabase/migrations/20260919240000_win_method_no_show.sql`
9. `supabase/migrations/20260919250000_mats_count.sql`
10. `supabase/migrations/20260919260000_sides_swapped.sql`

As migrations 4–5 acrescentam pagamentos, rankings, federações, bucket de capas, e roster só com contas MatComp (add by email / remove). A 9 define `mats_count` (N tatâmis → N mesas independentes). A 10 sincroniza trocar lados mesa ↔ display.

### 2. Env

```bash
cp .env.example .env.local
```

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_PUBLISHABLE_KEY=…
STRIPE_SECRET_KEY=sk_test_…   # opcional até beta pagos
APP_URL=http://localhost:3000
```

### 3. Dev

```bash
bun install
bun run dev
```

### 4. Dados demo (opcional)

No Dashboard Supabase → **Settings → API**, copia a chave **service_role** para o `.env`:

```
SUPABASE_SERVICE_ROLE_KEY=eyJ…
```

Depois:

```bash
bun run seed
```

Cria (idempotente) federações, academias, ~100 atletas, 4 eventos com cenários distintos, e contas:

| Email | Password | Papel |
|-------|----------|--------|
| `organizador@matcomp.demo` | `MatCompDemo1!` | Owner Alien + Lisboa · Barcelos LIVE |
| `coach@matcomp.demo` | `MatCompDemo1!` | Owner Porto + Braga |
| `referee@matcomp.demo` | `MatCompDemo1!` | Staff Alien |
| `atleta1@matcomp.demo` … `atleta8@` | `MatCompDemo1!` | Atletas com conta |
| `pendente@matcomp.demo` | `MatCompDemo1!` | Pedido de adesão pendente |

Eventos seed: **Barcelos LIVE** (4 tatâmis + muitas lutas), **Porto** (inscrições), **Lisboa** (finished), **Braga** (draft).

## Fluxos principais

1. `/` marketing → login → `/home` discovery
2. Criar evento → upload capa → divisões com preço → Inscrições
3. Atleta regista-se → Stripe (se preço > 0) → `/payments`
4. Definir nº de tatâmis → gerar chave → abrir `/mesa/:id/1` … `/mesa/:id/N` (um PC por mesa) → scoreboard / TV
5. `/rankings` → Recalcular após eventos `finished`
6. Federação demo: `/f/matcomp` (seed na migration)
