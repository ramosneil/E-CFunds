-- Fix (found 2026-11-26 while updating the diagrams; Neil approved): Insights "Budget vs actual" showed a liquidation
-- the treasurer had sent (fund_requests.liquidation_status = 'submitted') as "Waiting for liquidation". Migration 47
-- tested for 'pending', a value the liquidation never has. Only that test changes in private.finance_json.
do $$
declare def text;
begin
  select pg_get_functiondef('private.finance_json(bigint,bigint,boolean,boolean)'::regprocedure) into def;
  if position($q$when r.liquidation_status = 'pending' then 'liquidation_sent'$q$ in def) = 0 then
    raise exception 'liquidation_sent test not found in finance_json';
  end if;
  def := replace(def, $q$when r.liquidation_status = 'pending' then 'liquidation_sent'$q$,
                      $q$when r.liquidation_status = 'submitted' then 'liquidation_sent'$q$);
  execute def;
end $$;
