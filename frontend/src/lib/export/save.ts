// Saves an exported file. Browser: a normal download. Android app: Android's in-app browser can't download, so the
// file is written to the app's cache and handed to the share sheet (Save to Files, Drive, Messenger, Gmail, …).
import { isNative } from '../native';

export async function saveFile(filename: string, blob: Blob) {
  if (!isNative) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  await Share.share({ title: filename, files: [uri], dialogTitle: 'Save or share the report' });
}
