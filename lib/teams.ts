/**
 * Nation display metadata (FIFA 3-letter code + a representative dot colour)
 * for every team that appears in the TxLINE World Cup feed (competition 72).
 *
 * Purely cosmetic , it drives the coloured dots + abbreviations in the lobby
 * and results list. Scores, winners and everything factual come from the feed.
 * The four teams the app already featured keep their original colours so the
 * Final + semis look identical to before.
 */

export interface TeamMeta {
  name: string;
  abbr: string;
  color: string;
}

const NATIONS: Record<string, { abbr: string; color: string }> = {
  // Original four , unchanged from lib/txline-fixtures.ts.
  Spain: { abbr: "ESP", color: "#E11D2A" },
  Argentina: { abbr: "ARG", color: "#75AADB" },
  France: { abbr: "FRA", color: "#1E50C8" },
  England: { abbr: "ENG", color: "#152A57" },
  // The rest of the field.
  Mexico: { abbr: "MEX", color: "#008E5A" },
  "South Africa": { abbr: "RSA", color: "#007749" },
  "South Korea": { abbr: "KOR", color: "#0047A0" },
  "Czech Republic": { abbr: "CZE", color: "#2A6EBB" },
  Canada: { abbr: "CAN", color: "#FF3B30" },
  "Bosnia & Herzegovina": { abbr: "BIH", color: "#4C6EF5" },
  USA: { abbr: "USA", color: "#4657CE" },
  Paraguay: { abbr: "PAR", color: "#DA2032" },
  Qatar: { abbr: "QAT", color: "#8A1538" },
  Switzerland: { abbr: "SUI", color: "#E63946" },
  Brazil: { abbr: "BRA", color: "#009C3B" },
  Morocco: { abbr: "MAR", color: "#C1272D" },
  Haiti: { abbr: "HAI", color: "#2140C4" },
  Scotland: { abbr: "SCO", color: "#0065BD" },
  Australia: { abbr: "AUS", color: "#00843D" },
  Turkey: { abbr: "TUR", color: "#E30A17" },
  Germany: { abbr: "GER", color: "#DEA000" },
  Curacao: { abbr: "CUW", color: "#0033A0" },
  Netherlands: { abbr: "NED", color: "#F36C21" },
  Japan: { abbr: "JPN", color: "#BC002D" },
  "Ivory Coast": { abbr: "CIV", color: "#F77F00" },
  Ecuador: { abbr: "ECU", color: "#F2C200" },
  Sweden: { abbr: "SWE", color: "#4A90D9" },
  Tunisia: { abbr: "TUN", color: "#E70013" },
  "Cape Verde": { abbr: "CPV", color: "#1C4F9C" },
  Belgium: { abbr: "BEL", color: "#EF3340" },
  Egypt: { abbr: "EGY", color: "#CE1126" },
  "Saudi Arabia": { abbr: "KSA", color: "#0A8A45" },
  Uruguay: { abbr: "URU", color: "#5CB8E4" },
  Iran: { abbr: "IRN", color: "#239F40" },
  "New Zealand": { abbr: "NZL", color: "#3057B5" },
  Senegal: { abbr: "SEN", color: "#00853F" },
  Iraq: { abbr: "IRQ", color: "#1B9E4B" },
  Norway: { abbr: "NOR", color: "#BA0C2F" },
  Algeria: { abbr: "ALG", color: "#0A8A45" },
  Austria: { abbr: "AUT", color: "#ED2939" },
  Jordan: { abbr: "JOR", color: "#1F9E52" },
  Portugal: { abbr: "POR", color: "#DA291C" },
  "Congo DR": { abbr: "COD", color: "#2E8BE6" },
  Croatia: { abbr: "CRO", color: "#FF4136" },
  Panama: { abbr: "PAN", color: "#1D5FB8" },
  Ghana: { abbr: "GHA", color: "#1AA84A" },
  Uzbekistan: { abbr: "UZB", color: "#1EB53A" },
  Colombia: { abbr: "COL", color: "#F2C200" },
};

// Deterministic fallback colour so an unmapped nation is never a dull grey.
const PALETTE = [
  "#E11D2A", "#1E50C8", "#009C3B", "#F36C21", "#8A1538",
  "#4C6EF5", "#DEA000", "#00853F", "#BC002D", "#5CB8E4",
];
function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function teamMeta(name: string): TeamMeta {
  const hit = NATIONS[name];
  if (hit) return { name, abbr: hit.abbr, color: hit.color };
  return { name, abbr: name.slice(0, 3).toUpperCase(), color: hashColor(name) };
}
