import { Link } from 'react-router';

/** Required on sign-up (and Google's first-time screen). */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-[14px] cursor-pointer select-none">
      <input type="checkbox" required checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 accent-[var(--primary)] cursor-pointer" />
      <span>
        I agree to the <Link to="/terms" target="_blank" className="text-primary font-semibold underline-offset-2 hover:underline">Terms and Conditions</Link>{' '}
        and the <Link to="/privacy" target="_blank" className="text-primary font-semibold underline-offset-2 hover:underline">Privacy Notice</Link>.
      </span>
    </label>
  );
}

/** Small line under the sign-in button. */
export function TermsNote({ action }: { action: string }) {
  return (
    <p className="text-[12.5px] text-muted text-center">
      By {action} you agree to the <Link to="/terms" className="text-primary font-semibold">Terms</Link> and{' '}
      <Link to="/privacy" className="text-primary font-semibold">Privacy Notice</Link>.
    </p>
  );
}
