import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatAmount, formatEntryDate, formatQuantity, getBalanceColor } from '@/features/sales/sales-formatters';
import type { SalesEntry } from '@/services/sales-api';

type SalesEntryTableProps = {
  entries: SalesEntry[];
  isDark: boolean;
  isUpdating: boolean;
  refreshing: boolean;
  selectedEntryId: string | null;
  onRefresh: () => void;
  onSelectEntry: (entryId: string) => void;
};

type Column = { key: string; label: string; width: number; value: (entry: SalesEntry) => string };

const columns: Column[] = [
  { key: 'date', label: 'DATE', width: 108, value: (entry) => formatEntryDate(entry.date) },
  { key: 'party', label: 'PARTY', width: 154, value: (entry) => entry.party || '—' },
  { key: 'billNo', label: 'BILL NO.', width: 96, value: (entry) => entry.billNo || '—' },
  { key: 'product', label: 'PRODUCT', width: 146, value: (entry) => entry.product || '—' },
  { key: 'quantity', label: 'QUANTITY', width: 84, value: (entry) => formatQuantity(entry.quantity) },
  { key: 'billRate', label: 'BILL RATE', width: 104, value: (entry) => formatAmount(entry.billRate) },
  { key: 'billAmount', label: 'BILL AMOUNT', width: 114, value: (entry) => formatAmount(entry.billAmount) },
  { key: 'withoutBillRate', label: 'WITHOUT BILL RATE', width: 148, value: (entry) => formatAmount(entry.withoutBillRate) },
  { key: 'withoutBillAmount', label: 'WITHOUT BILL AMOUNT', width: 166, value: (entry) => formatAmount(entry.withoutBillAmount) },
  { key: 'billPaid', label: 'BILL PAID', width: 104, value: (entry) => formatAmount(entry.billPaid) },
  { key: 'withoutBillPaid', label: 'WITHOUT BILL PAID', width: 154, value: (entry) => formatAmount(entry.withoutBillPaid) },
  { key: 'paymentType', label: 'PAYMENT TYPE', width: 128, value: (entry) => entry.paymentType || '—' },
  { key: 'totalPaid', label: 'TOTAL PAID', width: 112, value: (entry) => formatAmount(entry.totalPaid) },
  { key: 'balance', label: 'BALANCE', width: 110, value: (entry) => formatAmount(entry.balance) },
];

const tableWidth = columns.reduce((total, column) => total + column.width, 0);

export function SalesEntryTable({ entries, isDark, isUpdating, refreshing, selectedEntryId, onRefresh, onSelectEntry }: SalesEntryTableProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.hint, isDark && darkStyles.mutedText]}>Swipe sideways to view every column</Text>
      {isUpdating && <View accessibilityLabel="Updating table" accessibilityRole="progressbar" style={styles.updateStatus}><View style={styles.updateSkeletonShort} /><View style={styles.updateSkeletonLong} /></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.horizontalScroll} contentContainerStyle={styles.scrollContent}>
        <FlatList
          data={entries}
          getItemLayout={(_, index) => ({ index, length: 52, offset: index * 52 })}
          initialNumToRender={12}
          keyExtractor={(entry) => entry.entryId}
          ListHeaderComponent={<View style={[styles.header, isDark && darkStyles.header]}>{columns.map((column) => <Text key={column.key} style={[styles.headerText, isDark && darkStyles.mutedText, { width: column.width }]}>{column.label}</Text>)}</View>}
          maxToRenderPerBatch={16}
          onRefresh={onRefresh}
          renderItem={({ item: entry }) => {
            const isSelected = entry.entryId === selectedEntryId;
            return (
              <Pressable accessibilityHint="Selects this live sales entry for editing" accessibilityRole="button" onPress={() => onSelectEntry(entry.entryId)} style={({ pressed }) => [styles.row, isDark && darkStyles.row, isSelected && styles.selectedRow, pressed && styles.pressedRow]}>
                {columns.map((column) => <Text key={column.key} numberOfLines={1} style={[styles.cell, isDark && darkStyles.mainText, { width: column.width }, column.key === 'balance' && { color: getBalanceColor(entry.balance), fontWeight: '800' }]}>{column.value(entry)}</Text>)}
              </Pressable>
            );
          }}
          removeClippedSubviews
          refreshing={refreshing}
          style={[styles.table, isDark && darkStyles.table, { width: tableWidth }]}
          stickyHeaderIndices={[0]}
          windowSize={7}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { color: '#263B44', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '600', paddingHorizontal: 12 },
  container: { flex: 1 },
  header: { alignItems: 'center', backgroundColor: '#E7EEE9', flexDirection: 'row', minHeight: 42 },
  headerText: { color: '#52635C', fontSize: 10, fontWeight: '800', letterSpacing: 0.35, paddingHorizontal: 12 },
  hint: { color: '#62716B', fontSize: 12, fontWeight: '600', marginBottom: 8, paddingHorizontal: 2 },
  horizontalScroll: { flex: 1 },
  pressedRow: { backgroundColor: '#F6FBF8' },
  row: { alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomColor: '#E8EEEA', borderBottomWidth: 1, flexDirection: 'row', minHeight: 52 },
  scrollContent: { flexGrow: 1, paddingBottom: 12 },
  selectedRow: { backgroundColor: '#F2FBF5', borderLeftColor: '#159A5A', borderLeftWidth: 3 },
  table: { borderColor: '#DCE6E0', borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  updateSkeletonLong: { backgroundColor: '#DCEAE1', borderRadius: 5, height: 11, width: 88 },
  updateSkeletonShort: { backgroundColor: '#BEDCCB', borderRadius: 5, height: 11, width: 38 },
  updateStatus: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 8, minHeight: 18 },
});

const darkStyles = StyleSheet.create({
  header: { backgroundColor: '#26364A' },
  mainText: { color: '#EAF1ED' },
  mutedText: { color: '#B4C3CE' },
  row: { backgroundColor: '#16253A', borderBottomColor: '#314259' },
  table: { borderColor: '#314259' },
});
