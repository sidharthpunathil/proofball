/**
 * FIFA 3-letter code → flagcdn.com region code (ISO 3166-1 alpha-2, or a GB
 * subdivision for the home nations). Drives the <Flag> chips that replaced the
 * coloured team dots in the lobby, results list, match pill and score header.
 *
 * Purely the flag art , scores, winners and everything factual still come from
 * the feed. Keyed on `abbr` (available on every TeamMeta) so neither TeamMeta
 * table needs an extra field. Any nation missing here falls back to its dot.
 */
const FLAG: Record<string, string> = {
  // Original four.
  ESP: "es", ARG: "ar", FRA: "fr", ENG: "gb-eng",
  // The rest of the field.
  MEX: "mx", RSA: "za", KOR: "kr", CZE: "cz", CAN: "ca",
  BIH: "ba", USA: "us", PAR: "py", QAT: "qa", SUI: "ch",
  BRA: "br", MAR: "ma", HAI: "ht", SCO: "gb-sct", AUS: "au",
  TUR: "tr", GER: "de", CUW: "cw", NED: "nl", JPN: "jp",
  CIV: "ci", ECU: "ec", SWE: "se", TUN: "tn", CPV: "cv",
  BEL: "be", EGY: "eg", KSA: "sa", URU: "uy", IRN: "ir",
  NZL: "nz", SEN: "sn", IRQ: "iq", NOR: "no", ALG: "dz",
  AUT: "at", JOR: "jo", POR: "pt", COD: "cd", CRO: "hr",
  PAN: "pa", GHA: "gh", UZB: "uz", COL: "co",
};

export function flagCode(abbr: string): string | null {
  return (abbr && FLAG[abbr.toUpperCase()]) || null;
}
