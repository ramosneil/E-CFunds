import { useEffect } from 'react';
import { useSearchParams } from 'react-router';

// Opening a notification lands on the exact item (Neil, 2026-11-19): the link carries ?request=12 / ?id=12 / ?user=…;
// the page marks each item with data-focus="req-12" / "user-…", and this scrolls to it and outlines it briefly.
export function useFocusFromParam(param: string, prefix: string) {
  const [params] = useSearchParams();
  const id = params.get(param);
  useEffect(() => {
    if (!id) return;
    let tries = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-focus="${prefix}-${CSS.escape(id)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('focus-flash');
        timer = setTimeout(() => el.classList.remove('focus-flash'), 3500);
        return;
      }
      if (++tries < 40) timer = setTimeout(find, 150);   // data may still be loading (up to 6 s)
    };
    find();
    return () => clearTimeout(timer);
  }, [id, prefix]);
}
