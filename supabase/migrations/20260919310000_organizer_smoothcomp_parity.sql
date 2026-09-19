-- Smoothcomp-parity organizer profile: billing, VAT, agreements, credits, public page

ALTER TABLE public.organizers
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS billing_name TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS billing_city TEXT,
  ADD COLUMN IF NOT EXISTS billing_postal TEXT,
  ADD COLUMN IF NOT EXISTS billing_country TEXT,
  ADD COLUMN IF NOT EXISTS vat_number TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS agreements_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credits_balance INT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS auto_refill BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_secret_key_ref TEXT,
  ADD COLUMN IF NOT EXISTS custom_payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended'));

-- Credit ledger (buy / use / gift / refund)
CREATE TABLE IF NOT EXISTS public.organizer_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT NOT NULL,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizer_credit_ledger_org_idx
  ON public.organizer_credit_ledger (organizer_id, created_at DESC);

ALTER TABLE public.organizer_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read credit ledger" ON public.organizer_credit_ledger;
CREATE POLICY "Org members read credit ledger" ON public.organizer_credit_ledger
  FOR SELECT TO authenticated
  USING (public.is_organizer_member(organizer_id));

DROP POLICY IF EXISTS "Org admins insert credit ledger" ON public.organizer_credit_ledger;
CREATE POLICY "Org admins insert credit ledger" ON public.organizer_credit_ledger
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_organizer(organizer_id));

-- Seed welcome credits for existing orgs that have 20 default already
INSERT INTO public.organizer_credit_ledger (organizer_id, delta, reason)
SELECT o.id, 20, 'welcome_gift'
FROM public.organizers o
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizer_credit_ledger l WHERE l.organizer_id = o.id
);

-- Public page: only public orgs for anon; members always see their own
DROP POLICY IF EXISTS "Public read organizers" ON public.organizers;
CREATE POLICY "Public read organizers" ON public.organizers
  FOR SELECT TO anon, authenticated
  USING (
    COALESCE(is_public, true) = true
    OR public.is_organizer_member(id)
    OR public.is_organizer_creator(id)
  );
