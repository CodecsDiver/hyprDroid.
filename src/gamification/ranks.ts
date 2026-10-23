const RANK_TITLES: ReadonlyArray<{ minimumLevel: number; title: string }> = [
  { minimumLevel: 1, title: 'Script Kiddie' },
  { minimumLevel: 3, title: 'Syntax Scout' },
  { minimumLevel: 5, title: 'Loop Runner' },
  { minimumLevel: 8, title: 'Function Forger' },
  { minimumLevel: 12, title: 'Data Wrangler' },
  { minimumLevel: 16, title: 'Pythonic Adept' },
  { minimumLevel: 22, title: 'Grid Sovereign' },
]

export function rankTitleForLevel(level: number): string {
  let title = RANK_TITLES[0].title
  for (const rank of RANK_TITLES) {
    if (level >= rank.minimumLevel) title = rank.title
  }
  return title
}
