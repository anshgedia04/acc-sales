import { useLocalSearchParams } from 'expo-router';

import { AddEntryScreen } from '@/features/sales/components/add-entry-screen';

export default function EditEntryRoute() {
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  return <AddEntryScreen entryId={entryId} />;
}
