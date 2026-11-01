import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SalesNavigationDrawer } from '@/features/sales/components/sales-navigation-drawer';
import { SalesTableSkeleton } from '@/features/sales/components/sales-skeletons';
import { formatAmount, formatEntryDate, getBalanceColor } from '@/features/sales/sales-formatters';
import { listSalesEntries, type SalesEntry } from '@/services/sales-api';
import { useSalesTheme } from '@/features/sales/sales-theme';
import { downloadLedgerPdf, type LedgerPdfParty } from '@/features/sales/ledger-pdf';

type LedgerRow = SalesEntry & { runningOutstanding: number };

function dateValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseDate(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(); }
function uniqueParties(entries: SalesEntry[]) { return [...new Map(entries.filter((entry) => entry.party.trim()).map((entry) => [entry.party.trim().toLocaleLowerCase(), entry.party.trim()])).values()].sort((a, b) => a.localeCompare(b)); }
function amount(value: number | '') { return value === '' ? 0 : value; }

function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === 'web') return <View style={styles.filterField}><Text style={styles.filterLabel}>{label}</Text><TextInput onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor="#87948D" style={styles.filterInput} value={value} /></View>;
  return <View style={styles.filterField}><Text style={styles.filterLabel}>{label}</Text><Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.dateTrigger}><Text style={[styles.dateText, !value && styles.datePlaceholder]}>{value || 'Any date'}</Text><Text style={styles.calendar}>▣</Text></Pressable>{open && <DateTimePicker display="default" mode="date" onChange={(_, selectedDate) => { setOpen(false); if (selectedDate) onChange(dateValue(selectedDate)); }} value={parseDate(value)} />}</View>;
}

function PartyPicker({ parties, value, onChange }: { parties: string[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const matches = parties.filter((party) => party.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <View style={styles.partyField}><Text style={styles.filterLabel}>Party</Text><Pressable accessibilityRole="button" onPress={() => { setQuery(value); setOpen(true); }} style={[styles.partyTrigger, value && styles.partyTriggerSelected]}><View><Text numberOfLines={1} style={[styles.partyValue, !value && styles.datePlaceholder]}>{value || 'Select a party'}</Text><Text style={styles.partyHint}>{value ? 'Tap to change' : `${parties.length} saved parties`}</Text></View><Text style={styles.chevron}>›</Text></Pressable><Modal animationType="slide" transparent visible={open} onRequestClose={() => setOpen(false)}><View style={styles.sheetBackdrop}><Pressable onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} /><View style={styles.sheet}><View style={styles.handle} /><View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>PARTY LEDGER</Text><Text style={styles.sheetTitle}>Select a party</Text></View><Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View><View style={styles.search}><Text style={styles.searchIcon}>⌕</Text><TextInput autoFocus autoCapitalize="words" autoCorrect={false} onChangeText={setQuery} placeholder="Search party" placeholderTextColor="#87948D" style={styles.searchInput} value={query} /></View><ScrollView contentContainerStyle={styles.partyList} keyboardShouldPersistTaps="handled">{matches.map((party) => <Pressable accessibilityRole="button" key={party} onPress={() => { onChange(party); setOpen(false); }} style={[styles.partyRow, party === value && styles.partyRowSelected]}><Text style={styles.partyRowText}>{party}</Text>{party === value && <Text style={styles.check}>✓</Text>}</Pressable>)}{matches.length === 0 && <Text style={styles.noParties}>No saved party matches this search.</Text>}</ScrollView></View></View></Modal></View>;
}

export function PartyLedgerScreen() {
  const { isDark } = useSalesTheme();
  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [party, setParty] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const load = async () => { setLoading(true); setError(null); try { setEntries(await listSalesEntries()); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load the party ledger.'); } finally { setLoading(false); } };
  useEffect(() => {
    let active = true;
    const loadInitialLedger = async () => {
      try {
        const result = await listSalesEntries();
        if (active) setEntries(result);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load the party ledger.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadInitialLedger();
    return () => { active = false; };
  }, []);
  const parties = useMemo(() => uniqueParties(entries), [entries]);
  // Calculate balances and summary values from the party's complete history.
  // Date filters only control which already-calculated rows are visible.
  const fullLedgerRows = useMemo(() => {
    const partyEntries = entries
      .map((entry, sourceIndex) => ({ entry, sourceIndex }))
      .filter(({ entry }) => entry.party.trim().toLocaleLowerCase() === party.trim().toLocaleLowerCase())
      .sort((left, right) => left.entry.date.localeCompare(right.entry.date) || left.sourceIndex - right.sourceIndex);
    return partyEntries.reduce<LedgerRow[]>((currentRows, { entry }) => {
      const previousOutstanding = currentRows.length ? currentRows[currentRows.length - 1].runningOutstanding : 0;
      return [...currentRows, { ...entry, runningOutstanding: previousOutstanding + amount(entry.billAmount) + amount(entry.withoutBillAmount) - amount(entry.totalPaid) }];
    }, []);
  }, [entries, party]);
  const ledgerRows = useMemo(() => fullLedgerRows.filter((entry) => (!from || entry.date >= from) && (!to || entry.date <= to)), [from, fullLedgerRows, to]);
  const totals = useMemo(() => fullLedgerRows.reduce((current, entry) => ({ billed: current.billed + amount(entry.billAmount) + amount(entry.withoutBillAmount), paid: current.paid + amount(entry.totalPaid) }), { billed: 0, paid: 0 }), [fullLedgerRows]);
  const closingOutstanding = fullLedgerRows.length ? fullLedgerRows[fullLedgerRows.length - 1].runningOutstanding : 0;
  const exportPdf = async (allParties: boolean) => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const names = allParties ? parties : [party];
      const reports: LedgerPdfParty[] = names.map((name) => {
        const rows = entries.map((entry, sourceIndex) => ({ entry, sourceIndex }))
          .filter(({ entry }) => entry.party.trim().toLocaleLowerCase() === name.toLocaleLowerCase())
          .sort((left, right) => left.entry.date.localeCompare(right.entry.date) || left.sourceIndex - right.sourceIndex);
        let outstanding = 0;
        return { name, rows: rows.map(({ entry }) => ({ ...entry, runningOutstanding: outstanding += amount(entry.billAmount) + amount(entry.withoutBillAmount) - amount(entry.totalPaid) })) };
      });
      const message = await downloadLedgerPdf(reports, from, to, allParties);
      if (message) setExportSuccess(message);
    } catch (exportError) {
      setExportError(exportError instanceof Error ? exportError.message : 'Could not create the PDF.');
    } finally { setExporting(false); }
  };
  const clearDates = () => { setFrom(''); setTo(''); };
  return <SafeAreaView edges={['top']} style={[styles.safeArea, isDark && darkStyles.safeArea]}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.topBar}><SalesNavigationDrawer current="ledger" /><Text style={[styles.topTitle, isDark && darkStyles.mainText]}>Party ledger</Text><View style={styles.spacer} /></View><View style={styles.hero}><Text style={styles.eyebrow}>PARTY LEDGER</Text><Text style={[styles.title, isDark && darkStyles.mainText]}>Track party activity</Text><Text style={[styles.subtitle, isDark && darkStyles.mutedText]}>Choose a party and date range to view live entries from Google Sheets.</Text></View><View style={[styles.filters, isDark && darkStyles.surface]}><PartyPicker parties={parties} value={party} onChange={setParty} /><View style={styles.dateFilters}><DateFilter label="From" value={from} onChange={setFrom} /><DateFilter label="To" value={to} onChange={setTo} /></View>{(from || to) && <Pressable accessibilityRole="button" onPress={clearDates} style={styles.clearDates}><Text style={styles.clearDatesText}>Clear date filters</Text></Pressable>}</View>{!loading && !error && parties.length > 0 && <View style={styles.exportActions}>{!!party && <Pressable accessibilityRole="button" disabled={exporting} onPress={() => void exportPdf(false)} style={styles.exportButton}><Text style={styles.exportText}>{exporting ? 'Preparing PDF…' : 'Download party PDF'}</Text></Pressable>}<Pressable accessibilityRole="button" disabled={exporting} onPress={() => void exportPdf(true)} style={styles.exportButton}><Text style={styles.exportText}>{exporting ? 'Preparing PDF…' : 'Download all parties PDF'}</Text></Pressable></View>}{exportError && <Text style={styles.exportError}>{exportError}</Text>}{exportSuccess && <Text style={styles.exportSuccess}>{exportSuccess}</Text>}{loading ? <SalesTableSkeleton /> : error ? <View style={[styles.state, isDark && darkStyles.surface]}><Text style={styles.errorTitle}>Could not load ledger</Text><Text style={[styles.stateBody, isDark && darkStyles.mutedText]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : !party ? <View style={[styles.state, isDark && darkStyles.surface]}><Text style={[styles.stateTitle, isDark && darkStyles.mainText]}>Select a party to open its ledger</Text><Text style={[styles.stateBody, isDark && darkStyles.mutedText]}>Your saved Google Sheet parties appear in the selector above.</Text></View> : <><View style={[styles.summary, isDark && darkStyles.summary]}><Summary label="Total sale" value={formatAmount(totals.billed)} /><Summary label="Total paid" value={formatAmount(totals.paid)} /><Summary label="Closing outstanding" value={formatAmount(closingOutstanding)} balance={closingOutstanding} /></View><Text style={[styles.resultCount, isDark && darkStyles.mutedText]}>{ledgerRows.length} {ledgerRows.length === 1 ? 'entry' : 'entries'} for {party}</Text>{ledgerRows.length ? <LedgerTable entries={ledgerRows} /> : <View style={[styles.state, isDark && darkStyles.surface]}><Text style={[styles.stateTitle, isDark && darkStyles.mainText]}>No entries in this date range</Text><Text style={[styles.stateBody, isDark && darkStyles.mutedText]}>Change the dates or clear the filters to view this party’s saved activity.</Text></View>}</>}</ScrollView></SafeAreaView>;
}

function Summary({ label, value, balance }: { label: string; value: string; balance?: number }) { return <View style={styles.summaryItem}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, balance !== undefined && { color: getBalanceColor(balance) }]}>{value}</Text></View>; }
function LedgerTable({ entries }: { entries: LedgerRow[] }) { return <View style={styles.tableWrap}><Text style={styles.tableHint}>Entries are ordered by date. Swipe sideways to view every ledger column.</Text><ScrollView horizontal showsHorizontalScrollIndicator><View style={styles.table}><View style={styles.tableHeader}>{['DATE', 'BILL AMOUNT', 'WITHOUT BILL', 'TOTAL SALE', 'BILL PAID', 'WITHOUT PAID', 'TOTAL PAID', 'RUNNING OUTSTANDING'].map((label) => <Text key={label} style={[styles.headerCell, { width: widthFor(label) }]}>{label}</Text>)}</View>{entries.map((entry) => <View key={entry.entryId} style={styles.tableRow}><Text style={[styles.cell, { width: 108 }]}>{formatEntryDate(entry.date)}</Text><Text style={[styles.cell, { width: 120 }]}>{formatAmount(entry.billAmount)}</Text><Text style={[styles.cell, { width: 126 }]}>{formatAmount(entry.withoutBillAmount)}</Text><Text style={[styles.cell, { width: 116 }]}>{formatAmount(amount(entry.billAmount) + amount(entry.withoutBillAmount))}</Text><Text style={[styles.cell, { width: 106 }]}>{formatAmount(entry.billPaid)}</Text><Text style={[styles.cell, { width: 124 }]}>{formatAmount(entry.withoutBillPaid)}</Text><Text style={[styles.cell, { width: 112 }]}>{formatAmount(entry.totalPaid)}</Text><Text style={[styles.cell, { color: getBalanceColor(entry.runningOutstanding), fontWeight: '800', width: 166 }]}>{formatAmount(entry.runningOutstanding)}</Text></View>)}</View></ScrollView></View>; }
function widthFor(label: string) { return ({ DATE: 108, 'BILL AMOUNT': 120, 'WITHOUT BILL': 126, 'TOTAL SALE': 116, 'BILL PAID': 106, 'WITHOUT PAID': 124, 'TOTAL PAID': 112, 'RUNNING OUTSTANDING': 166 } as Record<string, number>)[label]; }

const styles = StyleSheet.create({
  exportActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }, exportButton: { backgroundColor: '#146C43', borderRadius: 11, paddingHorizontal: 16, paddingVertical: 12 }, exportText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, exportError: { color: '#B42318', marginTop: 8, fontSize: 13 }, exportSuccess: { color: '#146C43', marginTop: 8, fontSize: 13 },
  back: { minWidth: 42, paddingVertical: 3 }, backText: { color: '#146C43', fontSize: 28, lineHeight: 30 }, cell: { color: '#263B44', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '600', paddingHorizontal: 12 }, calendar: { color: '#146C43', fontSize: 18 }, check: { color: '#159A5A', fontSize: 19, fontWeight: '900' }, chevron: { color: '#146C43', fontSize: 28 }, clearDates: { alignSelf: 'flex-start', marginTop: 13, paddingVertical: 4 }, clearDatesText: { color: '#146C43', fontSize: 13, fontWeight: '800' }, close: { alignItems: 'center', backgroundColor: '#EEF3F0', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 }, closeText: { color: '#30483D', fontSize: 25, lineHeight: 28 }, content: { padding: 16, paddingBottom: 36 }, dateFilters: { flexDirection: 'row', gap: 10, marginTop: 15 }, datePlaceholder: { color: '#87948D' }, dateText: { color: '#10233F', fontSize: 14, fontWeight: '700' }, dateTrigger: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DCE6E0', borderRadius: 11, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, paddingHorizontal: 12, paddingVertical: 12 }, errorTitle: { color: '#B42318', fontSize: 17, fontWeight: '800', textAlign: 'center' }, eyebrow: { color: '#159A5A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, filterField: { flex: 1 }, filterInput: { backgroundColor: '#FFFFFF', borderColor: '#DCE6E0', borderRadius: 11, borderWidth: 1, color: '#10233F', fontSize: 14, fontWeight: '700', marginTop: 7, paddingHorizontal: 12, paddingVertical: 12 }, filterLabel: { color: '#41544B', fontSize: 13, fontWeight: '800' }, filters: { backgroundColor: '#FFFFFF', borderColor: '#E0E7E3', borderRadius: 16, borderWidth: 1, marginTop: 18, padding: 16 }, handle: { alignSelf: 'center', backgroundColor: '#CBD7D0', borderRadius: 3, height: 5, marginBottom: 15, width: 42 }, headerCell: { color: '#52635C', fontSize: 10, fontWeight: '800', letterSpacing: .35, paddingHorizontal: 12 }, hero: { marginTop: 19, paddingHorizontal: 2 }, noParties: { color: '#718078', fontSize: 14, padding: 22, textAlign: 'center' }, partyField: {}, partyHint: { color: '#718078', fontSize: 11, fontWeight: '700', marginTop: 3 }, partyList: { paddingBottom: 22 }, partyRow: { alignItems: 'center', borderBottomColor: '#E8EFEB', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 4 }, partyRowSelected: { backgroundColor: '#F0F9F3', marginHorizontal: -8, paddingHorizontal: 12 }, partyRowText: { color: '#1B324B', fontSize: 16, fontWeight: '700' }, partyTrigger: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DCE6E0', borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, minHeight: 58, paddingHorizontal: 13 }, partyTriggerSelected: { borderColor: '#B7D9C5' }, partyValue: { color: '#10233F', fontSize: 16, fontWeight: '800', maxWidth: 270 }, resultCount: { color: '#62716B', fontSize: 13, fontWeight: '700', marginBottom: 9, marginTop: 18, paddingHorizontal: 2 }, retry: { alignSelf: 'center', backgroundColor: '#159A5A', borderRadius: 10, marginTop: 17, paddingHorizontal: 18, paddingVertical: 11 }, retryText: { color: '#FFFFFF', fontWeight: '800' }, safeArea: { backgroundColor: '#F4F6F3', flex: 1 }, search: { alignItems: 'center', backgroundColor: '#F4F7F5', borderColor: '#DCE6E0', borderRadius: 13, borderWidth: 1, flexDirection: 'row', marginTop: 17, paddingHorizontal: 13 }, searchIcon: { color: '#5A6F65', fontSize: 23, marginRight: 7 }, searchInput: { color: '#10233F', flex: 1, fontSize: 16, fontWeight: '600', minHeight: 48 }, sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '82%', paddingHorizontal: 18, paddingTop: 10 }, sheetBackdrop: { backgroundColor: 'rgba(7, 21, 40, .52)', flex: 1, justifyContent: 'flex-end' }, sheetEyebrow: { color: '#159A5A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 }, sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, sheetTitle: { color: '#10233F', fontSize: 22, fontWeight: '900', marginTop: 3 }, spacer: { minWidth: 42 }, state: { backgroundColor: '#FFFFFF', borderColor: '#E0E7E3', borderRadius: 18, borderWidth: 1, marginTop: 16, padding: 28 }, stateBody: { color: '#66756E', fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' }, stateTitle: { color: '#10233F', fontSize: 17, fontWeight: '800', textAlign: 'center' }, subtitle: { color: '#62716B', fontSize: 14, lineHeight: 20, marginTop: 6 }, summary: { backgroundColor: '#EAF7EF', borderColor: '#CDEAD8', borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginTop: 16, padding: 14 }, summaryItem: { flex: 1 }, summaryLabel: { color: '#52655D', fontSize: 11, fontWeight: '700' }, summaryValue: { color: '#10233F', fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '900', marginTop: 5 }, table: { borderColor: '#DCE6E0', borderRadius: 14, borderWidth: 1, overflow: 'hidden' }, tableHeader: { alignItems: 'center', backgroundColor: '#E7EEE9', flexDirection: 'row', minHeight: 42 }, tableHint: { color: '#62716B', fontSize: 12, fontWeight: '600', marginBottom: 8, paddingHorizontal: 2 }, tableRow: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: '#E8EEEA', borderBottomWidth: 1, flexDirection: 'row', minHeight: 52 }, tableWrap: { marginBottom: 10 }, title: { color: '#10233F', fontSize: 25, fontWeight: '900', letterSpacing: -.5, marginTop: 4 }, topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, topTitle: { color: '#10233F', fontSize: 16, fontWeight: '800' },
});

const darkStyles = StyleSheet.create({ mainText: { color: '#F3F7F5' }, mutedText: { color: '#A7B6C4' }, safeArea: { backgroundColor: '#0B1626' }, summary: { backgroundColor: '#12352E', borderColor: '#1C5F4A' }, surface: { backgroundColor: '#16253A', borderColor: '#314259' } });
