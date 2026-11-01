import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatAmount, formatEntryDate, formatQuantity, getBalanceColor } from '@/features/sales/sales-formatters';
import type { SalesEntry } from '@/services/sales-api';

type SalesEntryCardProps = {
  entry: SalesEntry;
  isDark: boolean;
  isSelected: boolean;
  onPress: () => void;
};

function Amount({ isDark, label, value, balance = false }: { isDark: boolean; label: string; value: number | ''; balance?: boolean }) {
  return (
    <View style={styles.amountItem}>
      <Text style={[styles.amountLabel, isDark && darkStyles.mutedText]}>{label}</Text>
      <Text style={[styles.amountValue, isDark && darkStyles.mainText, balance && { color: getBalanceColor(value) }]}>{formatAmount(value)}</Text>
    </View>
  );
}

export function SalesEntryCard({ entry, isDark, isSelected, onPress }: SalesEntryCardProps) {
  return (
    <Pressable
      accessibilityHint="Selects this live sales entry for editing"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, isDark && darkStyles.card, isSelected && styles.selectedCard, pressed && styles.pressedCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.partyBlock}>
          <Text numberOfLines={1} style={[styles.party, isDark && darkStyles.mainText]}>{entry.party || 'Unnamed party'}</Text>
          <Text numberOfLines={1} style={[styles.product, isDark && darkStyles.mutedText]}>{entry.product || 'Product not set'}</Text>
        </View>
        <View style={styles.dateBlock}>
          {isSelected && <Text style={styles.readyLabel}>READY TO EDIT</Text>}
          <Text style={[styles.date, isDark && darkStyles.mutedText]}>{formatEntryDate(entry.date)}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.metaText, isDark && darkStyles.mutedText]}>Bill no. {entry.billNo || '—'}</Text>
        <View style={[styles.metaDivider, isDark && darkStyles.divider]} />
        <Text style={[styles.metaText, isDark && darkStyles.mutedText]}>Qty {formatQuantity(entry.quantity)}</Text>
      </View>

      <View style={[styles.amountGrid, isDark && darkStyles.amountGrid]}>
        <Amount isDark={isDark} label="Bill amount" value={entry.billAmount} />
        <Amount isDark={isDark} label="Without bill" value={entry.withoutBillAmount} />
        <Amount isDark={isDark} label="Total paid" value={entry.totalPaid} />
        <Amount isDark={isDark} label="Balance" value={entry.balance} balance />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  amountGrid: { borderTopColor: '#E7ECEA', borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, paddingTop: 12, rowGap: 14 },
  amountItem: { width: '50%' },
  amountLabel: { color: '#6A7772', fontSize: 12, fontWeight: '500' },
  amountValue: { color: '#233842', fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '700', marginTop: 3 },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E0E7E3', borderRadius: 18, borderWidth: 1, marginBottom: 12, padding: 16, shadowColor: '#10233F', shadowOffset: { height: 3, width: 0 }, shadowOpacity: 0.045, shadowRadius: 10 },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  date: { color: '#62716B', fontSize: 12, fontWeight: '600', marginTop: 4, textAlign: 'right' },
  dateBlock: { alignItems: 'flex-end', marginLeft: 12 },
  metaDivider: { backgroundColor: '#D8E0DC', height: 13, marginHorizontal: 9, width: 1 },
  metaRow: { alignItems: 'center', flexDirection: 'row', marginTop: 13 },
  metaText: { color: '#53645D', fontSize: 12, fontWeight: '600' },
  party: { color: '#10233F', fontSize: 17, fontWeight: '800', letterSpacing: -0.25 },
  partyBlock: { flex: 1 },
  pressedCard: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  product: { color: '#62716B', fontSize: 13, fontWeight: '500', marginTop: 4 },
  readyLabel: { backgroundColor: '#E5F5EB', borderRadius: 6, color: '#146C43', fontSize: 9, fontWeight: '800', letterSpacing: 0.7, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 4 },
  selectedCard: { borderColor: '#159A5A', borderWidth: 1.5 },
});

const darkStyles = StyleSheet.create({
  amountGrid: { borderTopColor: '#314259' },
  card: { backgroundColor: '#16253A', borderColor: '#314259', shadowOpacity: 0 },
  divider: { backgroundColor: '#40556B' },
  mainText: { color: '#F3F7F5' },
  mutedText: { color: '#A7B6C4' },
});
