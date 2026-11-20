// PDF engine for exports. jsPDF is loaded only when someone exports (separate chunk), with the Inter font embedded
// so "₱" and "−" render (standard PDF fonts have neither). Letterhead: OMSC seal + school + office + report title.
import type { jsPDF as JsPDF } from 'jspdf';
import { supabase, logoUrl } from '../supabase';
import { saveFile } from './save';

export type Doc = JsPDF;
export const PAGE = { w: 210, h: 297, m: 16 } as const;               // A4 portrait, millimetres
export const INK = '#0D1530', MUTED = '#566080', LINE = '#DDE2EE', SOFT = '#F4F6FB', HERO = '#13297A';

let libs: Promise<{ jsPDF: typeof JsPDF; autoTable: typeof import('jspdf-autotable').default }> | null = null;
function loadLibs() {
  libs ??= Promise.all([import('jspdf'), import('jspdf-autotable')]).then(([a, b]) => ({ jsPDF: a.jsPDF, autoTable: b.default }));
  return libs;
}

const b64cache = new Map<string, Promise<string>>();
function fontB64(file: string) {
  if (!b64cache.has(file)) {
    b64cache.set(file, fetch(`/fonts/${file}`).then(async (r) => {
      if (!r.ok) throw new Error(`Could not load the report font (${r.status}).`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    }));
  }
  return b64cache.get(file)!;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('image'));
    img.src = src;
  });
}

/** Draws (part of) an image into a white circle and returns a PNG data URL. */
async function circleImage(src: string, crop?: { cx: number; cy: number; r: number }): Promise<string | null> {
  try {
    const img = await loadImage(src);
    const size = 360, c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2); g.clip();
    if (crop) {
      g.drawImage(img, crop.cx - crop.r, crop.cy - crop.r, crop.r * 2, crop.r * 2, 0, 0, size, size);
    } else {
      const s = Math.min(size / img.width, size / img.height) * 0.94;
      g.drawImage(img, (size - img.width * s) / 2, (size - img.height * s) / 2, img.width * s, img.height * s);
    }
    g.restore();
    return c.toDataURL('image/png');
  } catch { return null; }
}

// The OMSC seal sits in the top part of the 1000×1000 source poster (logos/brand/omsc-seal-source.jpg).
const SEAL = { path: 'brand/omsc-seal-source.jpg', crop: { cx: 506, cy: 237, r: 206 } };
let sealCache: Promise<string | null> | null = null;

/** A blank document of any size (mm) with Inter loaded — for forms with their own layout (Financial Report, Folio). */
export async function createDoc(format: [number, number]) {
  const [{ jsPDF, autoTable }, reg, bold] = await Promise.all([loadLibs(), fontB64('Inter-Regular.ttf'), fontB64('Inter-Bold.ttf')]);
  const doc = new jsPDF({ unit: 'mm', format, orientation: 'portrait', compress: true });
  doc.addFileToVFS('Inter-Regular.ttf', reg); doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFileToVFS('Inter-Bold.ttf', bold); doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
  doc.setFont('Inter', 'normal');
  return { doc, autoTable };
}
/** OMSC seal and an org/club logo as round PNG data URLs (null if they can't load). */
export function sealImage() { sealCache ??= circleImage(logoUrl(SEAL.path)!, SEAL.crop); return sealCache; }
export function logoImage(path: string | null | undefined) { return path ? circleImage(logoUrl(path)!) : Promise.resolve(null); }

export async function newDoc(opts: { title: string; subtitle?: string; orgLogoPath?: string | null; generatedBy?: string | null; landscape?: boolean }) {
  const [{ jsPDF, autoTable }, reg, bold] = await Promise.all([loadLibs(), fontB64('Inter-Regular.ttf'), fontB64('Inter-Bold.ttf')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: opts.landscape ? 'landscape' : 'portrait', compress: true });
  doc.addFileToVFS('Inter-Regular.ttf', reg); doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
  doc.addFileToVFS('Inter-Bold.ttf', bold); doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
  doc.setFont('Inter', 'normal');
  doc.setProperties({ title: `E-CFunds — ${opts.title}`, creator: 'E-CFunds', subject: opts.subtitle ?? '' });

  sealCache ??= circleImage(logoUrl(SEAL.path)!, SEAL.crop);
  const [seal, org] = await Promise.all([sealCache, opts.orgLogoPath ? circleImage(logoUrl(opts.orgLogoPath)!) : Promise.resolve(null)]);

  const W = doc.internal.pageSize.getWidth(), m = PAGE.m;
  // Letterhead
  if (seal) doc.addImage(seal, 'PNG', m, 12, 18, 18);
  const tx = seal ? m + 22 : m;
  text(doc, 'OCCIDENTAL MINDORO STATE COLLEGE', tx, 18, { size: 11, bold: true, color: HERO });
  text(doc, 'Mamburao Campus · Office of Student Affairs and Services', tx, 23.5, { size: 8.5, color: MUTED });
  text(doc, 'E-CFunds — Student Organization Fund Monitoring', tx, 28, { size: 8.5, color: MUTED });
  if (org) doc.addImage(org, 'PNG', W - m - 18, 12, 18, 18);
  doc.setDrawColor(HERO); doc.setLineWidth(0.6); doc.line(m, 34, W - m, 34);
  text(doc, opts.title, m, 44, { size: 17, bold: true });
  if (opts.subtitle) text(doc, opts.subtitle, m, 50, { size: 9.5, color: MUTED });
  const stamp = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  text(doc, `Generated ${stamp}${opts.generatedBy ? ` by ${opts.generatedBy}` : ''}`, m, opts.subtitle ? 55 : 50, { size: 7.5, color: MUTED });
  return { doc, autoTable, top: opts.subtitle ? 62 : 57 };
}

export function text(doc: Doc, s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: string; align?: 'left' | 'right' | 'center'; maxWidth?: number } = {}) {
  doc.setFont('Inter', o.bold ? 'bold' : 'normal');
  doc.setFontSize(o.size ?? 9);
  doc.setTextColor(o.color ?? INK);
  doc.text(s, x, y, { align: o.align ?? 'left', maxWidth: o.maxWidth, baseline: 'alphabetic' });
}

/** Keeps a block together: starts a new page if fewer than `need` mm remain. Returns the y to draw at. */
export function room(doc: Doc, y: number, need: number) {
  if (y + need > doc.internal.pageSize.getHeight() - 18) { doc.addPage(); return 20; }
  return y;
}

export function sectionTitle(doc: Doc, s: string, y: number) {
  text(doc, s, PAGE.m, y, { size: 11.5, bold: true });
  return y + 5;
}

/** Shared table look: Inter, hairline rows, repeated header on every page. */
export function tableStyle() {
  return {
    styles: { font: 'Inter', fontSize: 8.5, textColor: INK, cellPadding: { top: 2, bottom: 2, left: 2.2, right: 2.2 }, lineColor: LINE, lineWidth: 0.1 },
    headStyles: { font: 'Inter', fontStyle: 'bold' as const, fillColor: SOFT, textColor: MUTED, fontSize: 7.5 },
    alternateRowStyles: { fillColor: '#FAFBFD' },
    margin: { left: PAGE.m, right: PAGE.m, top: 20, bottom: 18 },
    showHead: 'everyPage' as const,
    theme: 'grid' as const,
  };
}

export function finish(doc: Doc, filename: string) {
  const n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(LINE); doc.setLineWidth(0.2); doc.line(PAGE.m, H - 12, W - PAGE.m, H - 12);
    text(doc, 'E-CFunds · Office of Student Affairs and Services · Occidental Mindoro State College', PAGE.m, H - 7.5, { size: 7, color: MUTED });
    text(doc, `Page ${i} of ${n}`, W - PAGE.m, H - 7.5, { size: 7, color: MUTED, align: 'right' });
  }
  return saveFile(filename, doc.output('blob'));
}

/** Who is exporting (for the "Generated by" line). */
export async function myName(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const p = await supabase.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
  return p.data?.full_name ?? data.user.email ?? null;
}
