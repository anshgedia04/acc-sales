import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatAmount } from '@/features/sales/sales-formatters';
import { FormSkeleton, OptionRowsSkeleton } from '@/features/sales/components/sales-skeletons';
import { addSalesEntryOption, createSalesEntry, listSalesEntryOptions, listSalesEntries, type SalesEntry, type SalesEntryInput, type SalesEntryOptions, type SalesOptionType, updateSalesEntry } from '@/services/sales-api';

type FormValues = { date: string; party: string; billNo: string; product: string; quantity: string; billRate: string; withoutBillRate: string; billPaid: string; withoutBillPaid: string; paymentType: string };
type AddEntryScreenProps = { entryId?: string };
type EntryOptions = SalesEntryOptions;

const emptyForm: FormValues = { date: '', party: '', billNo: '', product: '', quantity: '', billRate: '', withoutBillRate: '', billPaid: '', withoutBillPaid: '', paymentType: '' };

function asNumber(value: string) { const parsed = Number(value.trim()); return Number.isFinite(parsed) ? parsed : 0; }
function asFieldValue(value: number | '') { return value === '' ? '' : String(value); }
function formatDateValue(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date();
}
function isNonNegativeNumber(value: string) { return value.trim() === '' || (Number.isFinite(Number(value)) && Number(value) >= 0); }
function formFromEntry(entry: SalesEntry): FormValues {
  return { date: entry.date, party: entry.party, billNo: entry.billNo, product: entry.product, quantity: asFieldValue(entry.quantity), billRate: asFieldValue(entry.billRate), withoutBillRate: asFieldValue(entry.withoutBillRate), billPaid: asFieldValue(entry.billPaid), withoutBillPaid: asFieldValue(entry.withoutBillPaid), paymentType: entry.paymentType };
}
function uniqueOptions(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  }).sort((left, right) => left.localeCompare(right));
}
function validate(form: FormValues) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date.trim())) return 'Enter the date as YYYY-MM-DD.';
  if (!form.party.trim()) return 'Party is required.';
  const numbers = [form.quantity, form.billRate, form.withoutBillRate, form.billPaid, form.withoutBillPaid];
  if (!numbers.every(isNonNegativeNumber)) return 'Amounts and rates must be valid non-negative numbers.';
  return null;
}

function Field({ label, required = false, value, onChangeText, placeholder, numeric = false }: { label: string; required?: boolean; value: string; onChangeText: (value: string) => void; placeholder?: string; numeric?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text><TextInput autoCapitalize={numeric ? 'none' : 'words'} autoCorrect={false} keyboardType={numeric ? 'decimal-pad' : 'default'} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#87948D" style={styles.input} value={value} /></View>;
}

function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  if (Platform.OS === 'web') return <Field label="Date" required value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" />;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Date<Text style={styles.required}> *</Text></Text>
      <Pressable accessibilityLabel="Choose sale date" accessibilityRole="button" onPress={() => setIsPickerVisible(true)} style={styles.dateButton}>
        <Text style={[styles.dateButtonText, !value && styles.datePlaceholder]}>{value || 'Choose date'}</Text>
        <Text style={styles.calendarIcon}>▣</Text>
      </Pressable>
      {isPickerVisible && <DateTimePicker value={parseDateValue(value)} mode="date" display="default" onChange={(_, date) => { setIsPickerVisible(false); if (date) onChange(formatDateValue(date)); }} />}
    </View>
  );
}

function OptionField({ label, required = false, value, onChangeText, placeholder, options, optionType, onCreateOption, isLoading, loadError }: { label: string; required?: boolean; value: string; onChangeText: (value: string) => void; placeholder: string; options: string[]; optionType: SalesOptionType; onCreateOption: (type: SalesOptionType, value: string) => Promise<void>; isLoading: boolean; loadError: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingOptions = options.filter((option) => option.toLocaleLowerCase().includes(normalizedQuery)).slice(0, 50);
  const hasExactMatch = options.some((option) => option.toLocaleLowerCase() === normalizedQuery);
  const openPicker = () => {
    setQuery(value);
    setIsOpen(true);
  };
  const choose = (option: string) => {
    onChangeText(option);
    setIsOpen(false);
  };
  const add = async () => {
    const newValue = query.trim();
    if (!newValue || isAdding) return;
    setIsAdding(true);
    setAddError(null);
    try {
      await onCreateOption(optionType, newValue);
      onChangeText(newValue);
      setIsOpen(false);
    } catch (reason) {
      setAddError(reason instanceof Error ? reason.message : `Could not save this ${label.toLocaleLowerCase()}.`);
    } finally {
      setIsAdding(false);
    }
  };
  return <View style={styles.field}>
    <Text style={styles.label}>{label}{required && <Text style={styles.required}> *</Text>}</Text>
    <Pressable accessibilityLabel={`Choose or add ${label}`} accessibilityRole="button" onPress={openPicker} style={[styles.optionTrigger, value && styles.optionTriggerSelected]}>
      <View style={styles.optionTriggerTextWrap}><Text numberOfLines={1} style={[styles.optionTriggerValue, !value && styles.optionPlaceholder]}>{value || placeholder}</Text><Text style={styles.optionTriggerHint}>{value ? 'Tap to change' : 'Choose or add'}</Text></View>
      <Text style={styles.optionTriggerChevron}>›</Text>
    </Pressable>
    <Modal animationType="slide" transparent visible={isOpen} onRequestClose={() => setIsOpen(false)}>
      <View style={styles.sheetBackdrop}>
        <Pressable accessibilityLabel={`Close ${label} picker`} onPress={() => setIsOpen(false)} style={StyleSheet.absoluteFill} />
        <View style={styles.pickerSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>SELECT OR ADD</Text><Text style={styles.sheetTitle}>{label}</Text></View><Pressable accessibilityLabel={`Close ${label} picker`} accessibilityRole="button" onPress={() => setIsOpen(false)} style={styles.sheetClose}><Text style={styles.sheetCloseText}>×</Text></Pressable></View>
          <View style={styles.sheetSearch}><Text style={styles.searchIcon}>⌕</Text><TextInput autoCapitalize="words" autoCorrect={false} autoFocus onChangeText={setQuery} placeholder={`Search ${label.toLocaleLowerCase()}`} placeholderTextColor="#87948D" style={styles.sheetSearchInput} value={query} /></View>
          {isLoading ? <OptionRowsSkeleton /> : loadError ? <View style={styles.sheetNotice}><Text style={styles.sheetNoticeTitle}>Saved options could not load</Text><Text style={styles.sheetNoticeText}>You can still add a new {label.toLocaleLowerCase()} below.</Text></View> : null}
          {normalizedQuery && !hasExactMatch && <Pressable accessibilityRole="button" disabled={isAdding} onPress={() => void add()} style={[styles.addNewOption, isAdding && styles.addNewOptionDisabled]}><View style={styles.addNewIcon}><Text style={styles.addNewIconText}>{isAdding ? '…' : '+'}</Text></View><View style={styles.addNewCopy}><Text style={styles.addNewTitle}>{isAdding ? 'Saving…' : `Add “${query.trim()}”`}</Text><Text style={styles.addNewHint}>Saves to your dedicated options list</Text></View></Pressable>}
          {addError && <View style={styles.sheetNotice}><Text style={styles.sheetNoticeTitle}>Could not save option</Text><Text style={styles.sheetNoticeText}>{addError}</Text></View>}
          {!isLoading && <ScrollView bounces={false} contentContainerStyle={styles.optionList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.optionListScroll}>
            {matchingOptions.map((option) => <Pressable accessibilityRole="button" key={option} onPress={() => choose(option)} style={[styles.sheetOption, option === value && styles.sheetOptionSelected]}><View><Text numberOfLines={1} style={styles.sheetOptionText}>{option}</Text>{option === value && <Text style={styles.selectedHint}>Currently selected</Text>}</View>{option === value && <Text style={styles.checkMark}>✓</Text>}</Pressable>)}
            {!loadError && matchingOptions.length === 0 && <View style={styles.emptyOptions}><Text style={styles.emptyOptionsTitle}>{normalizedQuery ? `No matching ${label.toLocaleLowerCase()} found` : `No saved ${label.toLocaleLowerCase()} yet`}</Text><Text style={styles.emptyOptionsText}>{normalizedQuery ? 'Use the add action above to use this value.' : `Search or add your first ${label.toLocaleLowerCase()}.`}</Text></View>}
          </ScrollView>}
        </View>
      </View>
    </Modal>
  </View>;
}

export function AddEntryScreen({ entryId }: AddEntryScreenProps) {
  const isEditing = Boolean(entryId);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [isLoadingEntry, setIsLoadingEntry] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<EntryOptions>({ parties: [], products: [], paymentTypes: [] });
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<string | null>(null);
  const submissionLock = useRef(false);

  useEffect(() => {
    if (!entryId) return;
    let active = true;
    const loadEntry = async () => {
      setIsLoadingEntry(true);
      setError(null);
      try {
        const entries = await listSalesEntries();
        const entry = entries.find((item) => item.entryId === entryId);
        if (!entry) throw new Error('This sales entry is no longer available in Google Sheets.');
        if (active) {
          const loadedForm = formFromEntry(entry);
          setForm(loadedForm);
          setInitialFormSnapshot(JSON.stringify(loadedForm));
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load this sales entry.');
      } finally {
        if (active) setIsLoadingEntry(false);
      }
    };
    void loadEntry();
    return () => { active = false; };
  }, [entryId]);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      setIsLoadingOptions(true);
      setOptionsError(null);
      try {
        const savedOptions = await listSalesEntryOptions();
        if (active) setOptions({ parties: uniqueOptions(savedOptions.parties), products: uniqueOptions(savedOptions.products), paymentTypes: uniqueOptions(savedOptions.paymentTypes) });
      } catch (optionsLoadError) {
        if (active) setOptionsError(optionsLoadError instanceof Error ? optionsLoadError.message : 'Could not load saved options.');
      } finally {
        if (active) setIsLoadingOptions(false);
      }
    };
    void loadOptions();
    return () => { active = false; };
  }, []);

  const quantity = asNumber(form.quantity);
  const billRate = asNumber(form.billRate);
  const withoutBillRate = asNumber(form.withoutBillRate);
  const billPaid = asNumber(form.billPaid);
  const withoutBillPaid = asNumber(form.withoutBillPaid);
  const billAmount = quantity * billRate;
  const withoutBillAmount = quantity * withoutBillRate;
  const totalPaid = billPaid + withoutBillPaid;
  const balance = billAmount + withoutBillAmount - totalPaid;
  const isDirty = isEditing && initialFormSnapshot !== null && initialFormSnapshot !== JSON.stringify(form);
  const update = (field: keyof FormValues) => (value: string) => setForm((current) => ({ ...current, [field]: value }));
  const createOption = async (type: SalesOptionType, value: string) => {
    const savedOptions = await addSalesEntryOption(type, value);
    setOptions({ parties: uniqueOptions(savedOptions.parties), products: uniqueOptions(savedOptions.products), paymentTypes: uniqueOptions(savedOptions.paymentTypes) });
  };

  const cancel = () => {
    if (!isDirty) { router.back(); return; }
    Alert.alert('Discard changes?', 'Your edits have not been saved to Google Sheets.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const save = async () => {
    if (submissionLock.current || isSaving || isLoadingEntry) return;
    const validationError = validate(form);
    if (validationError) { setError(validationError); return; }
    submissionLock.current = true;
    setIsSaving(true);
    setError(null);
    const entry: SalesEntryInput = { date: form.date.trim(), party: form.party.trim(), billNo: form.billNo.trim(), product: form.product.trim(), quantity, billRate, withoutBillRate, billPaid, withoutBillPaid, paymentType: form.paymentType.trim() };
    try {
      if (entryId) {
        await updateSalesEntry(entryId, entry);
        router.replace({ pathname: '/sales-entries', params: { updated: '1' } });
      } else {
        await createSalesEntry(entry);
        setForm(emptyForm);
        router.replace({ pathname: '/sales-entries', params: { saved: '1' } });
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Could not ${isEditing ? 'update' : 'save'} this entry. Please try again.`);
    } finally {
      submissionLock.current = false;
      setIsSaving(false);
    }
  };

  if (isLoadingEntry) return <LoadingScreen />;
  if (isEditing && error && initialFormSnapshot === null) return <LoadFailure message={error} onBack={() => router.back()} />;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}><Pressable accessibilityLabel={isEditing ? 'Cancel editing' : 'Go back'} accessibilityRole="button" disabled={isSaving} onPress={cancel} style={styles.cancelButton}><Text style={styles.backIcon}>←</Text></Pressable><Text style={styles.topTitle}>{isEditing ? 'Edit entry' : 'Add entry'}</Text><View style={styles.topSpacer} /></View>
          <View style={styles.intro}><Text style={styles.eyebrow}>{isEditing ? 'EDIT SALE' : 'NEW SALE'}</Text><Text style={styles.title}>{isEditing ? 'Update sales entry' : 'Record a sales entry'}</Text><Text style={styles.subtitle}>Bill and without-bill values can be entered together.</Text></View>
          {error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}
          <View style={styles.section}><Text style={styles.sectionTitle}>Entry details</Text><DateField value={form.date} onChange={update('date')} /><OptionField label="Party" required value={form.party} onChangeText={update('party')} placeholder="Select or add party" options={options.parties} optionType="parties" onCreateOption={createOption} isLoading={isLoadingOptions} loadError={optionsError} /><Field label="Bill Number" value={form.billNo} onChangeText={update('billNo')} placeholder="Optional for without-bill sales" /><OptionField label="Product" value={form.product} onChangeText={update('product')} placeholder="Select or add product" options={options.products} optionType="products" onCreateOption={createOption} isLoading={isLoadingOptions} loadError={optionsError} /><Field label="Quantity" numeric value={form.quantity} onChangeText={update('quantity')} placeholder="0" /></View>
          <View style={styles.section}><Text style={styles.sectionTitle}>Amounts & payment</Text><Field label="Bill Rate" numeric value={form.billRate} onChangeText={update('billRate')} placeholder="0" /><Field label="Without Bill Rate" numeric value={form.withoutBillRate} onChangeText={update('withoutBillRate')} placeholder="0" /><Field label="Bill Paid" numeric value={form.billPaid} onChangeText={update('billPaid')} placeholder="0" /><Field label="Without Bill Paid" numeric value={form.withoutBillPaid} onChangeText={update('withoutBillPaid')} placeholder="0" /><OptionField label="Payment Type" value={form.paymentType} onChangeText={update('paymentType')} placeholder="Select or add payment type" options={options.paymentTypes} optionType="paymentTypes" onCreateOption={createOption} isLoading={isLoadingOptions} loadError={optionsError} /></View>
          <View style={styles.preview}><Text style={styles.previewTitle}>Calculated preview</Text><PreviewRow label="Bill Amount" value={formatAmount(billAmount)} /><PreviewRow label="Without Bill Amount" value={formatAmount(withoutBillAmount)} /><PreviewRow label="Total Paid" value={formatAmount(totalPaid)} /><PreviewRow label="Balance" value={formatAmount(balance)} emphasized /></View>
          <Pressable accessibilityRole="button" disabled={isSaving} onPress={() => void save()} style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}><Text style={styles.saveText}>{isSaving ? 'Saving to Google Sheets…' : isEditing ? 'Save changes' : 'Save to Google Sheets'}</Text></Pressable>
          <Text style={styles.saveHint}>Only the input fields are sent. Amounts above remain read-only calculated previews.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoadingScreen() { return <SafeAreaView edges={['top']} style={styles.loadingScreen}><FormSkeleton /></SafeAreaView>; }
function LoadFailure({ message, onBack }: { message: string; onBack: () => void }) { return <SafeAreaView edges={['top']} style={styles.loadingScreen}><Text style={styles.loadFailureTitle}>Could not open this entry</Text><Text style={styles.loadFailureMessage}>{message}</Text><Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}><Text style={styles.backButtonText}>Back to Sheet Mode</Text></Pressable></SafeAreaView>; }
function PreviewRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) { return <View style={styles.previewRow}><Text style={styles.previewLabel}>{label}</Text><Text style={[styles.previewValue, emphasized && styles.previewValueEmphasized]}>{value}</Text></View>; }

const styles = StyleSheet.create({
  backButton: { backgroundColor: '#159A5A', borderRadius: 12, marginTop: 18, paddingHorizontal: 18, paddingVertical: 12 },
  backButtonText: { color: '#FFFFFF', fontWeight: '800' },
  backIcon: { color: '#146C43', fontSize: 27, fontWeight: '500', lineHeight: 28 },
  cancelButton: { alignItems: 'flex-start', minWidth: 58, paddingVertical: 4 },
  calendarIcon: { color: '#146C43', fontSize: 21, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 36 },
  dateButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DCE6E0', borderRadius: 11, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, paddingHorizontal: 13, paddingVertical: 12 },
  dateButtonText: { color: '#10233F', fontSize: 16, fontWeight: '600' },
  datePlaceholder: { color: '#87948D' },
  addNewCopy: { flex: 1 },
  addNewHint: { color: '#527363', fontSize: 12, fontWeight: '600', marginTop: 2 },
  addNewIcon: { alignItems: 'center', backgroundColor: '#159A5A', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  addNewIconText: { color: '#FFFFFF', fontSize: 24, fontWeight: '400', lineHeight: 26 },
  addNewOption: { alignItems: 'center', backgroundColor: '#EAF7EF', borderColor: '#CDEAD8', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 11, marginTop: 14, padding: 12 },
  addNewOptionDisabled: { opacity: .65 },
  addNewTitle: { color: '#146C43', fontSize: 15, fontWeight: '800' },
  errorBanner: { backgroundColor: '#FEF0EE', borderColor: '#F6C8C1', borderRadius: 12, borderWidth: 1, marginBottom: 14, padding: 13 },
  errorText: { color: '#B42318', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  eyebrow: { color: '#159A5A', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  field: { marginTop: 15 },
  emptyOptions: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 30 },
  emptyOptionsText: { color: '#718078', fontSize: 13, lineHeight: 19, marginTop: 5, textAlign: 'center' },
  emptyOptionsTitle: { color: '#233842', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  input: { backgroundColor: '#FFFFFF', borderColor: '#DCE6E0', borderRadius: 11, borderWidth: 1, color: '#10233F', fontSize: 16, fontWeight: '600', marginTop: 7, paddingHorizontal: 13, paddingVertical: 12 },
  intro: { marginBottom: 20, paddingHorizontal: 2 },
  label: { color: '#41544B', fontSize: 13, fontWeight: '800' },
  loadFailureMessage: { color: '#62716B', fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  loadFailureTitle: { color: '#B42318', fontSize: 18, fontWeight: '800' },
  loadingScreen: { backgroundColor: '#F4F6F3', flex: 1 },
  checkMark: { color: '#159A5A', fontSize: 20, fontWeight: '900' },
  optionList: { paddingBottom: 18 },
  optionListScroll: { marginTop: 8, maxHeight: 310 },
  optionPlaceholder: { color: '#87948D', fontWeight: '600' },
  optionTrigger: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#DCE6E0', borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, minHeight: 59, paddingHorizontal: 13 },
  optionTriggerChevron: { color: '#146C43', fontSize: 29, fontWeight: '400', lineHeight: 28, paddingLeft: 10 },
  optionTriggerHint: { color: '#718078', fontSize: 11, fontWeight: '700', marginTop: 3 },
  optionTriggerSelected: { borderColor: '#B7D9C5' },
  optionTriggerTextWrap: { flex: 1, paddingVertical: 8 },
  optionTriggerValue: { color: '#10233F', fontSize: 16, fontWeight: '800' },
  pickerSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '84%', paddingHorizontal: 18, paddingTop: 10 },
  preview: { backgroundColor: '#EAF7EF', borderColor: '#CDEAD8', borderRadius: 16, borderWidth: 1, marginTop: 16, padding: 16 },
  previewLabel: { color: '#52655D', fontSize: 13, fontWeight: '600' },
  previewRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 13 },
  previewTitle: { color: '#10233F', fontSize: 15, fontWeight: '800' },
  previewValue: { color: '#233842', fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '800' },
  previewValueEmphasized: { color: '#146C43' },
  required: { color: '#B42318' },
  safeArea: { backgroundColor: '#F4F6F3', flex: 1 },
  searchIcon: { color: '#5A6F65', fontSize: 23, lineHeight: 23, marginRight: 7 },
  saveButton: { alignItems: 'center', backgroundColor: '#159A5A', borderRadius: 13, justifyContent: 'center', marginTop: 20, minHeight: 52, paddingHorizontal: 16 },
  saveButtonDisabled: { backgroundColor: '#78B99A' },
  saveHint: { color: '#718078', fontSize: 12, lineHeight: 18, marginTop: 10, paddingHorizontal: 8, textAlign: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  section: { backgroundColor: '#FFFFFF', borderColor: '#E0E7E3', borderRadius: 16, borderWidth: 1, marginTop: 14, padding: 16, paddingTop: 2 },
  sectionTitle: { color: '#10233F', fontSize: 16, fontWeight: '800', marginTop: 16 },
  selectedHint: { color: '#159A5A', fontSize: 11, fontWeight: '800', marginTop: 3 },
  sheetBackdrop: { backgroundColor: 'rgba(7, 21, 40, 0.52)', flex: 1, justifyContent: 'flex-end' },
  sheetClose: { alignItems: 'center', backgroundColor: '#EEF3F0', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  sheetCloseText: { color: '#30483D', fontSize: 25, fontWeight: '400', lineHeight: 28 },
  sheetEyebrow: { color: '#159A5A', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  sheetHandle: { alignSelf: 'center', backgroundColor: '#CBD7D0', borderRadius: 3, height: 5, marginBottom: 15, width: 42 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sheetNotice: { backgroundColor: '#FFF7E8', borderColor: '#F2D9A1', borderRadius: 12, borderWidth: 1, marginTop: 14, padding: 12 },
  sheetNoticeText: { color: '#806125', fontSize: 12, lineHeight: 18, marginTop: 3 },
  sheetNoticeTitle: { color: '#6E511C', fontSize: 13, fontWeight: '800' },
  sheetOption: { alignItems: 'center', borderBottomColor: '#E8EFEB', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, paddingHorizontal: 4, paddingVertical: 9 },
  sheetOptionSelected: { backgroundColor: '#F0F9F3', marginHorizontal: -8, paddingHorizontal: 12 },
  sheetOptionText: { color: '#1B324B', fontSize: 16, fontWeight: '700', maxWidth: 285 },
  sheetSearch: { alignItems: 'center', backgroundColor: '#F4F7F5', borderColor: '#DCE6E0', borderRadius: 13, borderWidth: 1, flexDirection: 'row', marginTop: 17, paddingHorizontal: 13 },
  sheetSearchInput: { color: '#10233F', flex: 1, fontSize: 16, fontWeight: '600', minHeight: 48, paddingVertical: 10 },
  sheetStatus: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'center', minHeight: 116 },
  sheetStatusText: { color: '#52655D', fontSize: 13, fontWeight: '700' },
  sheetTitle: { color: '#10233F', fontSize: 22, fontWeight: '900', letterSpacing: -0.3, marginTop: 3 },
  subtitle: { color: '#62716B', fontSize: 14, lineHeight: 20, marginTop: 6 },
  title: { color: '#10233F', fontSize: 25, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  topSpacer: { minWidth: 58 },
  topTitle: { color: '#10233F', fontSize: 16, fontWeight: '800' },
});
