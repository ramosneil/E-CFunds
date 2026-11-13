-- Defence in depth: the first-admin list was already unreadable (no grants, private schema not exposed).
-- RLS on with no policies = nobody but the owner. private.promote_bootstrap_admin() is SECURITY DEFINER owned by
-- postgres (the table owner, RLS not forced), so first-admin promotion keeps working.
alter table private.bootstrap_admins enable row level security;
