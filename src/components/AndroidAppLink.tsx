import { Download } from 'lucide-react';
import { isNative } from '../lib/native';

/** Always the newest signed APK: every version tag publishes a GitHub Release with this fixed-name file. */
export const APK_URL = 'https://github.com/ramosneil/E-CFunds/releases/latest/download/E-CFunds.apk';

const onAndroidBrowser = () => !isNative && /Android/i.test(navigator.userAgent);

/** "Get the Android app" — shown only in Android phone browsers (not inside the app, not on iPhone/computers). */
export function AndroidAppLink({ always = false }: { always?: boolean }) {
  if (isNative || (!always && !onAndroidBrowser())) return null;
  return (
    <a href={APK_URL} rel="noopener"
      className="mt-6 flex items-center gap-3 rounded-[16px] border border-line bg-surface p-4 hover:bg-surface2 transition-colors">
      <span className="size-10 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0"><Download className="size-5" aria-hidden /></span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-[14px]">Get the Android app</span>
        <span className="block text-[12.5px] text-muted">Free download. If your phone asks, allow installing from your browser.</span>
      </span>
    </a>
  );
}
