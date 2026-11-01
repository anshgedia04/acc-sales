import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SalesNavigationDrawer } from '@/features/sales/components/sales-navigation-drawer';
import { SalesTableSkeleton } from '@/features/sales/components/sales-skeletons';
import { formatQuantity } from '@/features/sales/sales-formatters';
import { listSalesEntries, type SalesEntry } from '@/services/sales-api';
import { useSalesTheme } from '@/features/sales/sales-theme';

function quantity(value: number | '') { return value === '' ? 0 : value; }

export function ProductSummaryScreen() {
  const { isDark } = useSalesTheme();
  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => { setLoading(true); setError(null); try { setEntries(await listSalesEntries()); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load the product summary.'); } finally { setLoading(false); } };
  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      try { const result = await listSalesEntries(); if (active) setEntries(result); }
      catch (loadError) { if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load the product summary.'); }
      finally { if (active) setLoading(false); }
    };
    void loadInitial();
    return () => { active = false; };
  }, []);
  const products = useMemo(() => {
    const grouped = new Map<string, { name: string; value: number }>();
    entries.forEach((entry) => {
      const name = entry.product.trim();
      if (!name) return;
      const key = name.toLocaleLowerCase();
      const previous = grouped.get(key);
      grouped.set(key, { name: previous?.name ?? name, value: (previous?.value ?? 0) + quantity(entry.quantity) });
    });
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries]);
  const total = products.reduce((sum, product) => sum + product.value, 0);
  return <SafeAreaView edges={['top']} style={[styles.safeArea, isDark && darkStyles.safeArea]}><ScrollView contentContainerStyle={styles.content}><View style={styles.topBar}><SalesNavigationDrawer current="products" /><Text style={[styles.topTitle, isDark && darkStyles.mainText]}>Product summary</Text><View style={styles.spacer} /></View><View style={styles.hero}><Text style={styles.eyebrow}>PRODUCT SUMMARY</Text><Text style={[styles.title, isDark && darkStyles.mainText]}>Live quantity by product</Text><Text style={[styles.subtitle, isDark && darkStyles.mutedText]}>Every product shown here comes from your saved Google Sheet entries.</Text></View>{loading ? <SalesTableSkeleton /> : error ? <View style={[styles.state, isDark && darkStyles.surface]}><Text style={styles.errorTitle}>Could not load products</Text><Text style={[styles.stateBody, isDark && darkStyles.mutedText]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : !products.length ? <View style={[styles.state, isDark && darkStyles.surface]}><Text style={[styles.stateTitle, isDark && darkStyles.mainText]}>No product entries yet</Text><Text style={[styles.stateBody, isDark && darkStyles.mutedText]}>Add a sale with a product to see it in this live summary.</Text></View> : <><View style={[styles.totalCard, isDark && darkStyles.totalCard]}><Text style={styles.totalLabel}>TOTAL QUANTITY</Text><Text style={[styles.totalValue, isDark && darkStyles.mainText]}>{formatQuantity(total)}</Text><Text style={[styles.totalHint, isDark && darkStyles.mutedText]}>{products.length} {products.length === 1 ? 'product' : 'products'} in live entries</Text></View><View style={[styles.table, isDark && darkStyles.surface]}><View style={[styles.header, isDark && darkStyles.header]}><Text style={[styles.headerCell, styles.productColumn, isDark && darkStyles.mutedText]}>PRODUCT</Text><Text style={[styles.headerCell, isDark && darkStyles.mutedText]}>QUANTITY</Text></View>{products.map((product) => <View key={product.name.toLocaleLowerCase()} style={[styles.row, isDark && darkStyles.row]}><Text style={[styles.cell, styles.productColumn, isDark && darkStyles.mainText]}>{product.name}</Text><Text style={[styles.cell, styles.quantity, isDark && darkStyles.mainText]}>{formatQuantity(product.value)}</Text></View>)}<View style={[styles.row, styles.totalRow, isDark && darkStyles.totalRow]}><Text style={[styles.cell, styles.productColumn, styles.strong, isDark && darkStyles.mainText]}>TOTAL</Text><Text style={[styles.cell, styles.quantity, styles.strong, isDark && darkStyles.mainText]}>{formatQuantity(total)}</Text></View></View></>}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  cell: { color: '#263B44', fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '600', paddingHorizontal: 15 }, content: { padding: 16, paddingBottom: 36 }, errorTitle: { color: '#B42318', fontSize: 17, fontWeight: '800', textAlign: 'center' }, eyebrow: { color: '#159A5A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, header: { alignItems: 'center', backgroundColor: '#E7EEE9', flexDirection: 'row', minHeight: 43 }, headerCell: { color: '#52635C', fontSize: 10, fontWeight: '800', letterSpacing: .4, paddingHorizontal: 15 }, hero: { marginTop: 19, paddingHorizontal: 2 }, productColumn: { flex: 1 }, quantity: { minWidth: 115, textAlign: 'right' }, retry: { alignSelf: 'center', backgroundColor: '#159A5A', borderRadius: 10, marginTop: 17, paddingHorizontal: 18, paddingVertical: 11 }, retryText: { color: '#FFFFFF', fontWeight: '800' }, row: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: '#E8EEEA', borderBottomWidth: 1, flexDirection: 'row', minHeight: 55 }, safeArea: { backgroundColor: '#F4F6F3', flex: 1 }, spacer: { width: 39 }, state: { backgroundColor: '#FFFFFF', borderColor: '#E0E7E3', borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 28 }, stateBody: { color: '#66756E', fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' }, stateTitle: { color: '#10233F', fontSize: 17, fontWeight: '800', textAlign: 'center' }, strong: { color: '#10233F', fontWeight: '900' }, subtitle: { color: '#62716B', fontSize: 14, lineHeight: 20, marginTop: 6 }, table: { borderColor: '#DCE6E0', borderRadius: 15, borderWidth: 1, marginTop: 18, overflow: 'hidden' }, title: { color: '#10233F', fontSize: 25, fontWeight: '900', letterSpacing: -.5, marginTop: 4 }, topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, topTitle: { color: '#10233F', fontSize: 16, fontWeight: '800' }, totalCard: { backgroundColor: '#EAF7EF', borderColor: '#CDEAD8', borderRadius: 16, borderWidth: 1, marginTop: 20, padding: 17 }, totalHint: { color: '#536B5D', fontSize: 12, fontWeight: '700', marginTop: 5 }, totalLabel: { color: '#2E6E4A', fontSize: 11, fontWeight: '900', letterSpacing: .8 }, totalRow: { backgroundColor: '#EAF7EF' }, totalValue: { color: '#10233F', fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '900', marginTop: 5 },
});

const darkStyles = StyleSheet.create({
  header: { backgroundColor: '#26364A' }, mainText: { color: '#F3F7F5' }, mutedText: { color: '#A7B6C4' }, row: { backgroundColor: '#16253A', borderBottomColor: '#314259' }, safeArea: { backgroundColor: '#0B1626' }, surface: { backgroundColor: '#16253A', borderColor: '#314259' }, totalCard: { backgroundColor: '#12352E', borderColor: '#1C5F4A' }, totalRow: { backgroundColor: '#183E37' },
});
