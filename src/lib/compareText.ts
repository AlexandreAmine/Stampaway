// Same order as a.localeCompare(b), but with one collator built once:
// localeCompare sets up a new one per call, which adds up when sorting the
// few thousand destinations of the catalog.
const collator = new Intl.Collator();

export const compareText = (a: string, b: string): number => collator.compare(a, b);
