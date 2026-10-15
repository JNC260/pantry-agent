// Shared by the header row and item rows so the columns line up. The
// actions column is fixed (not auto) so every row resolves the same widths;
// compact rows only need room for the "⋯" menu button.
export function tableColumns(compact: boolean): string {
  return compact
    ? "sm:grid-cols-[minmax(0,1fr)_90px_175px_32px]"
    : "sm:grid-cols-[minmax(0,1fr)_90px_175px_190px]";
}
