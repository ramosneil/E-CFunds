import { supabase, errorText } from './supabase';

/** Open a file from the private "receipts" bucket (resolution, receipts, liquidation files) with a 5-minute link.
 *  The tab is opened during the click itself (phones block tabs opened after an await), then pointed at the file. */
export async function openPrivateFile(path: string): Promise<string | null> {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300);
  if (error || !data) { tab?.close(); return errorText(error); }
  if (tab) tab.location.href = data.signedUrl; else window.location.assign(data.signedUrl);
  return null;
}

/** Upload one file into this org/club's private folder; returns its storage path. */
export async function uploadOrgFile(entityId: number, folder: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-60);
  const path = `${entityId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safe}`;
  const up = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (up.error) throw up.error;
  return path;
}

/** "Resolution_No_5.pdf" from a stored path ("7/res/1731…-ab12-Resolution_No_5.pdf"). */
export const fileLabel = (path: string) => (path.split('/').pop() ?? path).replace(/^\d+-(?:[a-z0-9]{4}-)?/, '');
