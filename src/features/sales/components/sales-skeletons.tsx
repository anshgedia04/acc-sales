import { ScrollView, StyleSheet, View } from 'react-native';
import { useSalesTheme } from '@/features/sales/sales-theme';

function Bone({ style }: { style?: object }) {
  const { isDark } = useSalesTheme();
  return <View style={[styles.bone, isDark && darkStyles.bone, style]} />;
}

export function SalesCardsSkeleton() {
  const { isDark } = useSalesTheme();
  return <View accessibilityLabel="Loading sales entries" accessibilityRole="progressbar" style={styles.cards}>
    {[0, 1, 2].map((index) => <View key={index} style={[styles.card, isDark && darkStyles.surface]}><View style={styles.cardTop}><Bone style={styles.dateBlock} /><View><Bone style={styles.partyLine} /><Bone style={styles.subLine} /></View></View><View style={[styles.divider, isDark && darkStyles.divider]} /><View style={styles.amounts}><Bone style={styles.amountLine} /><Bone style={styles.amountLine} /><Bone style={styles.amountLine} /></View></View>)}
  </View>;
}

export function SalesTableSkeleton() {
  const { isDark } = useSalesTheme();
  return <View accessibilityLabel="Loading sales entries" accessibilityRole="progressbar" style={[styles.table, isDark && darkStyles.surface]}><View style={[styles.tableHeader, isDark && darkStyles.tableHeader]}><Bone style={styles.tableHeaderBone} /><Bone style={styles.tableHeaderBone} /><Bone style={styles.tableHeaderBone} /></View>{[0, 1, 2, 3, 4].map((index) => <View key={index} style={[styles.tableRow, isDark && darkStyles.tableRow]}><Bone style={styles.tableDate} /><Bone style={styles.tableParty} /><Bone style={styles.tableAmount} /></View>)}</View>;
}

export function FormSkeleton() {
  const { isDark } = useSalesTheme();
  return <ScrollView accessibilityLabel="Loading sales entry" accessibilityRole="progressbar" contentContainerStyle={[styles.form, isDark && darkStyles.form]} showsVerticalScrollIndicator={false}>
    <View style={styles.formTopBar}><Bone style={styles.backButton} /><Bone style={styles.navTitle} /><View style={styles.topBarSpacer} /></View>
    <View style={styles.formIntro}><Bone style={styles.eyebrow} /><Bone style={styles.formTitle} /><Bone style={styles.formSubtitle} /></View>
    <View style={[styles.formCard, isDark && darkStyles.surface]}>
      <Bone style={styles.sectionTitle} />
      {[0, 1, 2, 3, 4].map((index) => <View key={index} style={styles.field}><Bone style={index === 1 || index === 3 ? styles.optionLabel : styles.label} /><Bone style={index === 1 || index === 3 ? styles.selectionInput : styles.input} /></View>)}
    </View>
    <View style={[styles.formCard, isDark && darkStyles.surface]}>
      <Bone style={styles.sectionTitle} />
      {[0, 1, 2, 3, 4].map((index) => <View key={index} style={styles.field}><Bone style={index === 4 ? styles.optionLabel : styles.label} /><Bone style={index === 4 ? styles.selectionInput : styles.input} /></View>)}
    </View>
    <View style={[styles.previewCard, isDark && darkStyles.previewCard]}><Bone style={styles.previewTitle} />{[0, 1, 2, 3].map((index) => <View key={index} style={styles.previewRow}><Bone style={styles.previewLabel} /><Bone style={styles.previewValue} /></View>)}</View>
    <Bone style={styles.saveButton} />
    <Bone style={styles.saveHint} />
  </ScrollView>;
}

export function OptionRowsSkeleton() {
  const { isDark } = useSalesTheme();
  return <View accessibilityLabel="Loading saved options" accessibilityRole="progressbar" style={styles.optionRows}>{[0, 1, 2, 3].map((index) => <View key={index} style={[styles.optionRow, isDark && darkStyles.tableRow]}><Bone style={index % 2 ? styles.optionShort : styles.optionLong} /></View>)}</View>;
}

const styles = StyleSheet.create({
  amounts: { flexDirection: 'row', gap: 10, paddingTop: 14 },
  amountLine: { flex: 1, height: 14 },
  backButton: { borderRadius: 18, height: 31, width: 31 },
  bone: { backgroundColor: '#E3ECE6', borderRadius: 7 },
  card: { backgroundColor: '#FFFFFF', borderColor: '#E0E7E3', borderRadius: 17, borderWidth: 1, marginTop: 12, padding: 16 },
  cards: { paddingBottom: 18 },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  dateBlock: { height: 42, width: 43 },
  divider: { backgroundColor: '#EDF2EF', height: 1, marginTop: 15 },
  field: { marginTop: 16 },
  eyebrow: { height: 10, width: 62 },
  form: { backgroundColor: '#F4F6F3', flexGrow: 1, padding: 16, paddingBottom: 36 },
  formCard: { backgroundColor: '#FFFFFF', borderColor: '#E0E7E3', borderRadius: 16, borderWidth: 1, marginTop: 16, padding: 16 },
  formIntro: { marginBottom: 4, marginTop: 21, paddingHorizontal: 2 },
  formSubtitle: { height: 13, marginTop: 9, width: '74%' },
  formTitle: { height: 28, marginTop: 9, width: 216 },
  formTopBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  input: { height: 48, marginTop: 8, width: '100%' },
  label: { height: 12, width: 74 },
  navTitle: { height: 15, width: 74 },
  optionLong: { height: 17, width: '66%' },
  optionLabel: { height: 12, width: 87 },
  optionRow: { borderBottomColor: '#E8EFEB', borderBottomWidth: 1, minHeight: 58, paddingTop: 20 },
  optionRows: { paddingBottom: 18, paddingHorizontal: 4, paddingTop: 8 },
  optionShort: { height: 17, width: '42%' },
  partyLine: { height: 16, width: 132 },
  subLine: { height: 12, marginTop: 7, width: 92 },
  table: { backgroundColor: '#FFFFFF', borderColor: '#DCE6E0', borderRadius: 14, borderWidth: 1, marginTop: 4, overflow: 'hidden' },
  tableAmount: { height: 14, width: 60 },
  tableDate: { height: 14, width: 72 },
  tableHeader: { alignItems: 'center', backgroundColor: '#E7EEE9', flexDirection: 'row', gap: 20, minHeight: 42, paddingHorizontal: 12 },
  tableHeaderBone: { height: 10, width: 70 },
  tableParty: { height: 14, width: 140 },
  tableRow: { alignItems: 'center', borderBottomColor: '#E8EFEB', borderBottomWidth: 1, flexDirection: 'row', gap: 22, minHeight: 52, paddingHorizontal: 12 },
  previewCard: { backgroundColor: '#EAF7EF', borderColor: '#CDEAD8', borderRadius: 16, borderWidth: 1, marginTop: 16, padding: 16 },
  previewLabel: { height: 12, width: 93 },
  previewRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  previewTitle: { height: 15, width: 132 },
  previewValue: { height: 13, width: 66 },
  saveButton: { backgroundColor: '#B8DBC5', borderRadius: 13, height: 52, marginTop: 20, width: '100%' },
  saveHint: { alignSelf: 'center', height: 11, marginTop: 13, width: '70%' },
  sectionTitle: { height: 16, marginTop: 1, width: 112 },
  selectionInput: { height: 56, marginTop: 8, width: '100%' },
  topBarSpacer: { width: 31 },
});

const darkStyles = StyleSheet.create({
  bone: { backgroundColor: '#314259' },
  divider: { backgroundColor: '#314259' },
  form: { backgroundColor: '#0B1626' },
  previewCard: { backgroundColor: '#12352E', borderColor: '#1C5F4A' },
  surface: { backgroundColor: '#16253A', borderColor: '#314259' },
  tableHeader: { backgroundColor: '#26364A' },
  tableRow: { backgroundColor: '#16253A', borderBottomColor: '#314259' },
});
