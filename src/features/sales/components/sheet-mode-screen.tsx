import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SalesEntryCard } from '@/features/sales/components/sales-entry-card';
import { SalesEntryTable } from '@/features/sales/components/sales-entry-table';
import { SalesNavigationDrawer } from '@/features/sales/components/sales-navigation-drawer';
import { SalesCardsSkeleton, SalesTableSkeleton } from '@/features/sales/components/sales-skeletons';
import { useSalesEntries } from '@/features/sales/hooks/use-sales-entries';
import { useSalesTheme } from '@/features/sales/sales-theme';

type ViewMode = 'cards' | 'table';
type SortOption = 'newest' | 'oldest' | 'party' | 'balance-high' | 'balance-low';

const sortOptions: { key: SortOption; label: string }[] = [
  { key: 'newest', label: 'Newest date' }, { key: 'oldest', label: 'Oldest date' }, { key: 'party', label: 'Party A–Z' }, { key: 'balance-high', label: 'Highest balance' }, { key: 'balance-low', label: 'Lowest balance' },
];
const amount = (value: number | '') => value === '' ? 0 : value;
const uniqueValues = (values: string[]) => [...new Map(values.filter(Boolean).map((value) => [value.trim().toLocaleLowerCase(), value.trim()])).values()].sort((left, right) => left.localeCompare(right));

export function SheetModeScreen() {
  const { isDark } = useSalesTheme();
  const { entries, error, isLoading, isRefreshing, isSearching, query, refresh, setQuery } = useSalesEntries();
  const { saved, updated } = useLocalSearchParams<{ saved?: string; updated?: string }>();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [sort, setSort] = useState<SortOption>('newest');
  const [partyFilter, setPartyFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const filteredEntries = useMemo(() => entries.filter((entry) => (!partyFilter || entry.party.toLocaleLowerCase() === partyFilter.toLocaleLowerCase()) && (!productFilter || entry.product.toLocaleLowerCase() === productFilter.toLocaleLowerCase())).sort((left, right) => {
    if (sort === 'party') return left.party.localeCompare(right.party);
    if (sort === 'balance-high') return amount(right.balance) - amount(left.balance);
    if (sort === 'balance-low') return amount(left.balance) - amount(right.balance);
    return sort === 'newest' ? right.date.localeCompare(left.date) : left.date.localeCompare(right.date);
  }), [entries, partyFilter, productFilter, sort]);
  const activeFilterCount = Number(Boolean(partyFilter)) + Number(Boolean(productFilter));
  const openEditor = (entryId: string) => {
    setSelectedEntryId(entryId);
    router.push({ pathname: '/edit-entry', params: { entryId } });
  };

  const header = <SheetHeader isDark={isDark} entriesCount={filteredEntries.length} error={error} isLoading={isLoading} onAdd={() => router.push('/add-entry')} onRefresh={() => void refresh()} onSetQuery={setQuery} query={query} notice={updated === '1' ? 'Entry updated in Google Sheets.' : saved === '1' ? 'Entry saved to Google Sheets.' : null} viewMode={viewMode} onViewModeChange={setViewMode} activeFilterCount={activeFilterCount} onOpenFilters={() => setFilterOpen(true)} />;

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, isDark && darkStyles.safeArea]}>
      {viewMode === 'table' ? (
        <View style={styles.tableMode}>
          <View style={styles.tableModeHeader}>{header}</View>
          {isLoading ? <View style={styles.tableModeContent}><SalesTableSkeleton /></View> : filteredEntries.length > 0 ? <View style={styles.tableModeContent}><SalesEntryTable isDark={isDark} entries={filteredEntries} isUpdating={isSearching} refreshing={isRefreshing} selectedEntryId={selectedEntryId} onRefresh={() => void refresh()} onSelectEntry={openEditor} /></View> : <ListState isDark={isDark} error={error} hasQuery={Boolean(query.trim())} onRetry={() => void refresh()} />}
        </View>
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContent, isDark && darkStyles.listContent]}
          data={filteredEntries}
          keyExtractor={(entry) => entry.entryId}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh()} tintColor="#159A5A" />}
          renderItem={({ item }) => <SalesEntryCard isDark={isDark} entry={item} isSelected={selectedEntryId === item.entryId} onPress={() => openEditor(item.entryId)} />}
          ListHeaderComponent={header}
          ListEmptyComponent={isLoading ? <SalesCardsSkeleton /> : <ListState isDark={isDark} error={error} hasQuery={Boolean(query.trim())} onRetry={() => void refresh()} />}
          showsVerticalScrollIndicator={false}
        />
      )}
      <FilterSortSheet parties={uniqueValues(entries.map((entry) => entry.party))} products={uniqueValues(entries.map((entry) => entry.product))} party={partyFilter} product={productFilter} sort={sort} visible={filterOpen} onClose={() => setFilterOpen(false)} onApply={(nextSort, nextParty, nextProduct) => { setSort(nextSort); setPartyFilter(nextParty); setProductFilter(nextProduct); setFilterOpen(false); }} />
    </SafeAreaView>
  );
}

function SheetHeader({ isDark, entriesCount, error, isLoading, onAdd, onRefresh, onSetQuery, query, notice, viewMode, onViewModeChange, activeFilterCount, onOpenFilters }: { isDark: boolean; entriesCount: number; error: string | null; isLoading: boolean; onAdd: () => void; onRefresh: () => void; onSetQuery: (query: string) => void; query: string; notice: string | null; viewMode: ViewMode; onViewModeChange: (mode: ViewMode) => void; activeFilterCount: number; onOpenFilters: () => void }) {
  return (
    <View>
      <View style={styles.hero}>
        <View>
          <Text style={styles.eyebrow}>SALES REGISTER</Text>
          <Text style={styles.title}>Sheet mode</Text>
          <Text style={styles.subtitle}>Your live Google Sheets entries</Text>
        </View>
        <View style={styles.heroActions}>
          <SalesNavigationDrawer current="entries" />
          <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.refreshButton}><Text style={styles.refreshButtonText}>Refresh</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onAdd} style={styles.addButton}><Text style={styles.addButtonText}>Add entry</Text></Pressable>
        </View>
      </View>
      {notice && <View style={styles.successBanner}><Text style={styles.successText}>{notice}</Text></View>}
      {error && entriesCount > 0 && <View style={styles.inlineError}><Text style={styles.inlineErrorText}>{error}</Text></View>}
      <View style={[styles.searchWrap, isDark && darkStyles.searchWrap]}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput accessibilityLabel="Search sales entries" autoCapitalize="words" autoCorrect={false} onChangeText={onSetQuery} placeholder="Search party or bill number" placeholderTextColor="#93A4B2" returnKeyType="search" style={[styles.searchInput, isDark && darkStyles.searchInput]} value={query} />
        {query.length > 0 && <Pressable accessibilityLabel="Clear search" onPress={() => onSetQuery('')} hitSlop={12} style={styles.clearSearchButton}><Text style={styles.clearSearch}>×</Text></Pressable>}
      </View>
      <View style={styles.viewToolbar}>
        <Text style={[styles.viewLabel, isDark && darkStyles.mutedText]}>VIEW</Text>
        <View style={[styles.modeToggle, isDark && darkStyles.modeToggle]}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: viewMode === 'cards' }} onPress={() => onViewModeChange('cards')} style={[styles.modeButton, viewMode === 'cards' && styles.modeButtonActive, viewMode === 'cards' && isDark && darkStyles.modeButtonActive]}><Text style={[styles.modeButtonText, isDark && darkStyles.mutedText, viewMode === 'cards' && styles.modeButtonTextActive]}>Cards</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: viewMode === 'table' }} onPress={() => onViewModeChange('table')} style={[styles.modeButton, viewMode === 'table' && styles.modeButtonActive, viewMode === 'table' && isDark && darkStyles.modeButtonActive]}><Text style={[styles.modeButtonText, isDark && darkStyles.mutedText, viewMode === 'table' && styles.modeButtonTextActive]}>Table</Text></Pressable>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onOpenFilters} style={styles.filterButton}><Text style={styles.filterButtonText}>⇅  Filter & Sort</Text>{activeFilterCount > 0 && <View style={styles.filterCount}><Text style={styles.filterCountText}>{activeFilterCount}</Text></View>}</Pressable>
      {!isLoading && !error && <Text style={[styles.resultSummary, isDark && darkStyles.mutedText]}>{entriesCount} {entriesCount === 1 ? 'live entry' : 'live entries'}</Text>}
    </View>
  );
}

function ListState({ isDark, error, hasQuery, onRetry }: { isDark: boolean; error: string | null; hasQuery: boolean; onRetry: () => void }) {
  if (error) return <View style={[styles.stateCard, isDark && darkStyles.stateCard]}><Text style={styles.errorTitle}>Could not load entries</Text><Text style={[styles.stateBody, isDark && darkStyles.mutedText]}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable></View>;
  return <View style={[styles.stateCard, isDark && darkStyles.stateCard]}><Text style={[styles.stateTitle, isDark && darkStyles.mainText]}>{hasQuery ? 'No matching entries' : 'No sales entries yet'}</Text><Text style={[styles.stateBody, isDark && darkStyles.mutedText]}>{hasQuery ? 'Try a different party name or bill number.' : 'New records added to Google Sheets will appear here.'}</Text></View>;
}

function FilterSortSheet({ parties, products, party, product, sort, visible, onClose, onApply }: { parties: string[]; products: string[]; party: string; product: string; sort: SortOption; visible: boolean; onClose: () => void; onApply: (sort: SortOption, party: string, product: string) => void }) {
  const [draftSort, setDraftSort] = useState(sort);
  const [draftParty, setDraftParty] = useState(party);
  const [draftProduct, setDraftProduct] = useState(product);
  const reset = () => { setDraftSort('newest'); setDraftParty(''); setDraftProduct(''); };
  return <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}><View style={styles.filterBackdrop}><Pressable accessibilityLabel="Close filter and sort" onPress={onClose} style={StyleSheet.absoluteFill} /><View style={styles.filterSheet}><View style={styles.filterHandle} /><View style={styles.filterHeader}><View><Text style={styles.filterEyebrow}>SHEET MODE</Text><Text style={styles.filterTitle}>Filter & Sort</Text></View><Pressable accessibilityLabel="Close filter and sort" onPress={onClose} style={styles.filterClose}><Text style={styles.filterCloseText}>×</Text></Pressable></View><Text style={styles.filterSectionLabel}>SORT BY</Text><View style={styles.sortList}>{sortOptions.map((option) => <Pressable accessibilityRole="button" key={option.key} onPress={() => setDraftSort(option.key)} style={[styles.sortRow, draftSort === option.key && styles.sortRowActive]}><Text style={[styles.sortText, draftSort === option.key && styles.sortTextActive]}>{option.label}</Text>{draftSort === option.key && <Text style={styles.sortCheck}>✓</Text>}</Pressable>)}</View><Text style={styles.filterSectionLabel}>FILTER</Text><Choice label="Party" options={parties} value={draftParty} onChange={setDraftParty} /><Choice label="Product" options={products} value={draftProduct} onChange={setDraftProduct} /><View style={styles.filterActions}><Pressable accessibilityRole="button" onPress={reset} style={styles.clearFilters}><Text style={styles.clearFiltersText}>Clear all</Text></Pressable><Pressable accessibilityRole="button" onPress={() => onApply(draftSort, draftParty, draftProduct)} style={styles.applyFilters}><Text style={styles.applyFiltersText}>Apply</Text></Pressable></View></View></View></Modal>;
}

function Choice({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return <View style={styles.choice}><Text style={styles.choiceLabel}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceChips}><Pressable accessibilityRole="button" onPress={() => onChange('')} style={[styles.choiceChip, !value && styles.choiceChipActive]}><Text style={[styles.choiceChipText, !value && styles.choiceChipTextActive]}>All</Text></Pressable>{options.map((option) => <Pressable accessibilityRole="button" key={option} onPress={() => onChange(option)} style={[styles.choiceChip, value === option && styles.choiceChipActive]}><Text style={[styles.choiceChipText, value === option && styles.choiceChipTextActive]}>{option}</Text></Pressable>)}</ScrollView></View>;
}

const styles = StyleSheet.create({
  addButton: { backgroundColor: '#159A5A', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  clearSearch: { color: '#146C43', fontSize: 26, fontWeight: '500', lineHeight: 26 },
  clearSearchButton: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },
  eyebrow: { color: '#93E5BA', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  errorTitle: { color: '#B3261E', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  applyFilters: { alignItems: 'center', backgroundColor: '#159A5A', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 49 }, applyFiltersText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, choice: { marginTop: 16 }, choiceChip: { backgroundColor: '#F0F4F1', borderColor: '#DCE6E0', borderRadius: 18, borderWidth: 1, marginRight: 8, paddingHorizontal: 14, paddingVertical: 9 }, choiceChipActive: { backgroundColor: '#EAF7EF', borderColor: '#159A5A' }, choiceChipText: { color: '#4F6259', fontSize: 13, fontWeight: '800' }, choiceChipTextActive: { color: '#146C43' }, choiceChips: { paddingTop: 7 }, choiceLabel: { color: '#41544B', fontSize: 13, fontWeight: '800' }, clearFilters: { alignItems: 'center', borderColor: '#BDD1C5', borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 49 }, clearFiltersText: { color: '#146C43', fontSize: 15, fontWeight: '800' }, filterActions: { flexDirection: 'row', gap: 10, marginTop: 24 }, filterBackdrop: { backgroundColor: 'rgba(7,21,40,.52)', flex: 1, justifyContent: 'flex-end' }, filterButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#FFFFFF', borderColor: '#BCD7C7', borderRadius: 11, borderWidth: 1, flexDirection: 'row', marginBottom: 13, paddingHorizontal: 13, paddingVertical: 10 }, filterButtonText: { color: '#146C43', fontSize: 13, fontWeight: '900' }, filterClose: { alignItems: 'center', backgroundColor: '#EEF3F0', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 }, filterCloseText: { color: '#30483D', fontSize: 25, lineHeight: 28 }, filterCount: { alignItems: 'center', backgroundColor: '#159A5A', borderRadius: 10, height: 20, justifyContent: 'center', marginLeft: 7, width: 20 }, filterCountText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, filterEyebrow: { color: '#159A5A', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, filterHandle: { alignSelf: 'center', backgroundColor: '#CBD7D0', borderRadius: 3, height: 5, marginBottom: 16, width: 42 }, filterHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, filterSectionLabel: { color: '#62716B', fontSize: 11, fontWeight: '900', letterSpacing: .8, marginTop: 20 }, filterSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88%', padding: 18, paddingTop: 10 }, filterTitle: { color: '#10233F', fontSize: 23, fontWeight: '900', marginTop: 3 },
  hero: { alignItems: 'center', backgroundColor: '#10233F', borderRadius: 22, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, padding: 20 },
  heroActions: { alignItems: 'flex-end', gap: 8 },
  inlineError: { backgroundColor: '#FEF0EE', borderColor: '#F6C8C1', borderRadius: 12, borderWidth: 1, marginBottom: 12, padding: 12 },
  inlineErrorText: { color: '#B42318', fontSize: 13, fontWeight: '700' },
  listContent: { backgroundColor: '#F4F6F3', flexGrow: 1, paddingBottom: 32, paddingHorizontal: 16, paddingTop: 12 },
  modeButton: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  modeButtonActive: { backgroundColor: '#FFFFFF', shadowColor: '#10233F', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.12, shadowRadius: 3 },
  modeButtonText: { color: '#64736C', fontSize: 12, fontWeight: '800' },
  modeButtonTextActive: { color: '#146C43' },
  modeToggle: { backgroundColor: '#E7EEE9', borderRadius: 10, flexDirection: 'row', padding: 3 },
  refreshButton: { borderColor: '#5ABF84', borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  refreshButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  resultSummary: { color: '#62716B', fontSize: 13, fontWeight: '700', marginBottom: 10, paddingHorizontal: 2 },
  retryButton: { alignItems: 'center', alignSelf: 'center', backgroundColor: '#159A5A', borderRadius: 10, marginTop: 18, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  safeArea: { backgroundColor: '#F4F6F3', flex: 1 },
  searchIcon: { color: '#52655D', fontSize: 26, fontWeight: '300', lineHeight: 24, marginRight: 8, transform: [{ rotate: '-18deg' }] },
  searchInput: { color: '#10233F', flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 14 },
  searchWrap: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DDE6E1', borderRadius: 14, borderWidth: 1, flexDirection: 'row', marginBottom: 12, paddingHorizontal: 14 },
  sortCheck: { color: '#159A5A', fontSize: 19, fontWeight: '900' }, sortList: { marginTop: 8 }, sortRow: { alignItems: 'center', borderBottomColor: '#E8EFEB', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 47, paddingHorizontal: 3 }, sortRowActive: { backgroundColor: '#F0F9F3', marginHorizontal: -8, paddingHorizontal: 11 }, sortText: { color: '#30483D', fontSize: 15, fontWeight: '700' }, sortTextActive: { color: '#146C43', fontWeight: '900' },
  stateBody: { color: '#66756E', fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  stateCard: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderColor: '#E0E7E3', borderRadius: 18, borderWidth: 1, margin: 16, padding: 28 },
  stateTitle: { color: '#10233F', fontSize: 17, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  subtitle: { color: '#D2DFD8', fontSize: 13, fontWeight: '500', marginTop: 5 },
  successBanner: { backgroundColor: '#E5F5EB', borderColor: '#B7E5C9', borderRadius: 12, borderWidth: 1, marginBottom: 12, padding: 12 },
  successText: { color: '#146C43', fontSize: 14, fontWeight: '800' },
  tableMode: { flex: 1, paddingBottom: 12 },
  tableModeContent: { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  tableModeHeader: { paddingHorizontal: 16, paddingTop: 12 },
  title: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
  viewLabel: { color: '#62716B', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  viewToolbar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 2 },
});

const darkStyles = StyleSheet.create({
  listContent: { backgroundColor: '#0B1626' }, mainText: { color: '#F3F7F5' }, modeButtonActive: { backgroundColor: '#26364A', shadowOpacity: 0 }, modeToggle: { backgroundColor: '#1D2C40' }, mutedText: { color: '#A7B6C4' }, safeArea: { backgroundColor: '#0B1626' }, searchInput: { color: '#F3F7F5' }, searchWrap: { backgroundColor: '#16253A', borderColor: '#314259' }, stateCard: { backgroundColor: '#16253A', borderColor: '#314259' },
});
