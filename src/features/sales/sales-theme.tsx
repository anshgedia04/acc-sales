/** A temporary no-op kept so existing screen imports remain valid during cleanup. */
export function useSalesTheme() {
  return { mode: 'light' as const, isDark: false, setMode: () => {} };
}
