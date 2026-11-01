import { Asset } from 'expo-asset';
import { documentDirectory, readAsStringAsync, writeAsStringAsync, EncodingType, StorageAccessFramework } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Platform } from 'react-native';

import { formatAmount, formatEntryDate, getBalanceColor } from '@/features/sales/sales-formatters';
import type { SalesEntry } from '@/services/sales-api';

export type LedgerPdfRow = SalesEntry & { runningOutstanding: number };
export type LedgerPdfParty = { name: string; rows: LedgerPdfRow[] };

const amount = (value: number | '') => value === '' ? 0 : value;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
const filePart = (value: string) => value.trim().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'Party';

function ledgerFileName(parties: LedgerPdfParty[], from: string, to: string, allParties: boolean) {
  const scope = allParties ? 'All-Parties' : filePart(parties[0].name);
  const period = from && to && from === to ? from : from || to ? `${from || 'Beginning'}-to-${to || 'Present'}` : 'All-Dates';
  return `Accurate-Polymers-Ledger-${scope}-${filePart(period)}`;
}

async function logoDataUri() {
  const asset = Asset.fromModule(require('@/assets/images/my-image.jpeg'));
  await asset.downloadAsync();
  if (Platform.OS !== 'web') {
    return `data:image/jpeg;base64,${await readAsStringAsync(asset.localUri || asset.uri, { encoding: EncodingType.Base64 })}`;
  }
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not load the company logo.'));
    reader.readAsDataURL(blob);
  });
}

function reportHtml(parties: LedgerPdfParty[], from: string, to: string, logo: string, fileName: string) {
  const period = from || to ? `${from || 'Beginning'} to ${to || 'Present'}` : 'All dates';
  const totals = parties.reduce((sum, party) => {
    party.rows.forEach((row) => { sum.sale += amount(row.billAmount) + amount(row.withoutBillAmount); sum.paid += amount(row.totalPaid); });
    return sum;
  }, { sale: 0, paid: 0 });
  const sections = parties.map(({ name, rows }) => {
    const visible = rows.filter((row) => (!from || row.date >= from) && (!to || row.date <= to));
    const sale = rows.reduce((sum, row) => sum + amount(row.billAmount) + amount(row.withoutBillAmount), 0);
    const paid = rows.reduce((sum, row) => sum + amount(row.totalPaid), 0);
    const outstanding = rows.at(-1)?.runningOutstanding || 0;
    return `<section class="party"><div class="party-head"><div><span class="eyebrow">PARTY LEDGER</span><h2>${escapeHtml(name)}</h2></div><span class="badge">${visible.length} ${visible.length === 1 ? 'entry' : 'entries'} shown</span></div>
      <div class="metrics"><div><label>Total sale <small>all dates</small></label><strong>${formatAmount(sale)}</strong></div><div><label>Total paid <small>all dates</small></label><strong>${formatAmount(paid)}</strong></div><div><label>Closing outstanding <small>all dates</small></label><strong style="color:${getBalanceColor(outstanding)}">${formatAmount(outstanding)}</strong></div></div>
      <table><thead><tr><th>Date</th><th>Bill no.</th><th>Product</th><th class="num">Qty</th><th class="num">Bill sale</th><th class="num">Without bill</th><th class="num">Total sale</th><th class="num">Bill paid</th><th class="num">Without paid</th><th class="num">Total paid</th><th class="num">Outstanding</th></tr></thead><tbody>${visible.length ? visible.map((row) => `<tr><td>${escapeHtml(formatEntryDate(row.date))}</td><td>${escapeHtml(row.billNo || '-')}</td><td>${escapeHtml(row.product || '-')}</td><td class="num">${row.quantity === '' ? '-' : row.quantity}</td><td class="num">${formatAmount(row.billAmount)}</td><td class="num">${formatAmount(row.withoutBillAmount)}</td><td class="num">${formatAmount(amount(row.billAmount) + amount(row.withoutBillAmount))}</td><td class="num">${formatAmount(row.billPaid)}</td><td class="num">${formatAmount(row.withoutBillPaid)}</td><td class="num">${formatAmount(row.totalPaid)}</td><td class="num bold" style="color:${getBalanceColor(row.runningOutstanding)}">${formatAmount(row.runningOutstanding)}</td></tr>`).join('') : '<tr><td colspan="11" class="empty">No transactions in the selected period.</td></tr>'}</tbody></table>
      <p class="note">Running outstanding includes all earlier transactions for this party. Summary totals include the full party history.</p></section>`;
  }).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(fileName)}</title><style>
    @page { size: A4 landscape; margin: 16mm 12mm; } * { box-sizing: border-box; } body { margin: 0; color: #173043; font-family: Arial, sans-serif; font-size: 10px; } .masthead { background: #102c29; color: white; padding: 20px 24px; border-radius: 14px; display: flex; align-items: center; gap: 18px; } .logo { width: 64px; height: 64px; object-fit: contain; background: white; border-radius: 12px; padding: 4px; } .masthead h1 { margin: 0; font-size: 23px; letter-spacing: .3px; } .masthead p { margin: 5px 0 0; color: #bcebd2; font-size: 12px; } .report-meta { margin: 16px 0 20px; display: flex; gap: 12px; } .report-meta div { flex: 1; border: 1px solid #d9e8e0; border-radius: 9px; padding: 10px 12px; background: #f5faf7; } label, .eyebrow { display: block; color: #60766b; text-transform: uppercase; font-size: 9px; font-weight: 700; letter-spacing: .8px; } .report-meta b { display: block; margin-top: 5px; font-size: 12px; } .party { margin: 0 0 24px; break-inside: auto; } .party-head { display: flex; justify-content: space-between; align-items: end; border-bottom: 2px solid #169d61; padding-bottom: 8px; margin-bottom: 12px; break-after: avoid; } h2 { font-size: 18px; margin: 4px 0 0; } .badge { color: #126b46; background: #e6f6ec; border-radius: 20px; padding: 6px 10px; font-weight: bold; } .metrics { display: flex; gap: 10px; margin-bottom: 14px; break-inside: avoid; } .metrics div { flex: 1; background: #edf7f1; padding: 11px 13px; border-radius: 9px; } .metrics strong { display: block; margin-top: 6px; font-size: 15px; } small { text-transform: none; letter-spacing: 0; } table { border-collapse: collapse; width: 100%; table-layout: fixed; font-size: 8px; } thead { display: table-header-group; } th { background: #e4eee8; color: #385749; text-align: left; padding: 8px 4px; } td { padding: 7px 4px; border-bottom: 1px solid #e3ece7; overflow-wrap: anywhere; } tr { break-inside: avoid; } tbody tr:nth-child(even) { background: #f8fbf9; } .num { text-align: right; } .bold { font-weight: bold; } .empty { text-align: center; padding: 20px; color: #697b72; } .note { color: #718077; font-size: 9px; margin-top: 9px; } .footer { border-top: 1px solid #dce8e1; color: #73847a; padding-top: 10px; font-size: 9px; }
  </style></head><body><header class="masthead"><img class="logo" src="${logo}"/><div><h1>ACCURATE POLYMERS</h1><p>Party ledger statement</p></div></header><div class="report-meta"><div><label>Scope</label><b>${parties.length === 1 ? escapeHtml(parties[0].name) : `All parties (${parties.length})`}</b></div><div><label>Transaction period</label><b>${escapeHtml(period)}</b></div><div><label>All-time total sale</label><b>${formatAmount(totals.sale)}</b></div><div><label>All-time total paid</label><b>${formatAmount(totals.paid)}</b></div></div>${sections}<footer class="footer">Accurate Polymers · Party ledger statement · Balances are calculated from complete transaction history.</footer></body></html>`;
}

export async function downloadLedgerPdf(parties: LedgerPdfParty[], from: string, to: string, allParties: boolean) {
  const fileName = ledgerFileName(parties, from, to, allParties);
  const html = reportHtml(parties, from, to, await logoDataUri(), fileName);
  if (Platform.OS === 'web') {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const frameDocument = frame.contentDocument;
    if (!frameDocument || !frame.contentWindow) { frame.remove(); throw new Error('Could not open the PDF print dialog.'); }
    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();
    await new Promise<void>((resolve) => { frame.contentWindow!.onload = () => resolve(); setTimeout(resolve, 500); });
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60_000);
    return 'Use Save as PDF in the print dialog to download the report.';
  }
  const result = await Print.printToFileAsync({ html, width: 842, height: 595, base64: true });
  if (!result.base64) throw new Error('Could not save the generated PDF.');
  if (Platform.OS === 'android') {
    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync(
      StorageAccessFramework.getUriForDirectoryInRoot('Download'),
    );
    if (!permission.granted) return null;
    const fileUri = await StorageAccessFramework.createFileAsync(permission.directoryUri, fileName, 'application/pdf');
    await writeAsStringAsync(fileUri, result.base64, { encoding: EncodingType.Base64 });
    return 'PDF downloaded to the selected folder.';
  }
  if (!documentDirectory) throw new Error('Could not access the app documents folder.');
  await writeAsStringAsync(`${documentDirectory}${fileName}.pdf`, result.base64, { encoding: EncodingType.Base64 });
  return 'PDF saved in Files > On My iPhone > Accurate Sales.';
}
