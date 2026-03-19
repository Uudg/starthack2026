import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────────────

interface AssetRow {
  id: string;
  name: string;
  asset_class: string;
  region: string;
  ticker?: string;
  description: string;
  risk_level: number;
}

interface WeeklyPriceRow {
  asset_id: string;
  week_index: number;
  date: string; // ISO date string YYYY-MM-DD
  price: number;
}

interface SeedRow {
  id: string;
  name: string;
  start_week: number;
  end_week: number;
  start_date: string;
  end_date: string;
  difficulty: 'easy' | 'medium' | 'hard';
  description: string;
  reveal_title: string;
  reveal_text: string;
  historical_events: Array<{ week: number; name: string; type: string }>;
  crash_weeks: number[];
}

// ── Parsers ────────────────────────────────────────────────────────────────

/** Parse European-formatted number: " 7,917.1 " → 7917.1 | null */
function parseNum(raw: string): number | null {
  const s = raw.trim();
  if (!s || s === '#N/A') return null;
  // Comma = thousands separator, period = decimal
  const cleaned = s.replace(/,/g, '').replace(/\s/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Parse d/m/yyyy → Date object (midnight UTC) */
function parseDate(raw: string): Date {
  const parts = raw.trim().split('/');
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const year = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month, day));
}

/** Format Date → ISO string YYYY-MM-DD */
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Week Index ─────────────────────────────────────────────────────────────

// Week 0 anchor = Friday 2006-02-17
const WEEK0_FRIDAY = new Date(Date.UTC(2006, 1, 17));

/** Get the Friday of the week containing the given date (Mon–Sun week) */
function fridayOfWeek(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
  // For Sun (0): go forward 5 days to Fri
  // For Mon–Fri (1–5): go forward (5 - day) days
  // For Sat (6): go forward 6 days to next Fri
  const daysToFriday = day <= 5 ? 5 - day : 6;
  const fri = new Date(d);
  fri.setUTCDate(d.getUTCDate() + daysToFriday);
  return fri;
}

/** Calculate global week_index (0 = week containing 2006-02-17) */
function weekIndex(d: Date): number {
  const fri = fridayOfWeek(d);
  const ms = fri.getTime() - WEEK0_FRIDAY.getTime();
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000));
}

// ── CSV Reader ─────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function readCSV(filePath: string): string[][] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => parseCSVLine(line));
}

// ── Weekly Resampling ──────────────────────────────────────────────────────

/**
 * Given a list of {date, price} daily rows, resample to weekly.
 * Uses Friday as the representative day. If no Friday in a week,
 * uses the last available trading day of that week.
 */
function resampleToWeekly(
  assetId: string,
  dailyRows: Array<{ date: Date; price: number }>
): WeeklyPriceRow[] {
  const byWeek = new Map<number, Array<{ date: Date; price: number }>>();
  for (const row of dailyRows) {
    const wi = weekIndex(row.date);
    if (wi < 0) continue;
    if (!byWeek.has(wi)) byWeek.set(wi, []);
    byWeek.get(wi)!.push(row);
  }

  const result: WeeklyPriceRow[] = [];
  for (const [wi, days] of byWeek) {
    const friday = days.find(d => d.date.getUTCDay() === 5);
    const chosen = friday ?? days[days.length - 1];
    result.push({
      asset_id: assetId,
      week_index: wi,
      date: toISO(chosen.date),
      price: chosen.price,
    });
  }

  return result.sort((a, b) => a.week_index - b.week_index);
}

// ── CSV Parsers per Asset Group ────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');

function parseEquityIndices(): Map<string, WeeklyPriceRow[]> {
  const rows = readCSV(path.join(DATA_DIR, 'Market_Data - Equity Indices.csv'));
  // col 0=date, 1=SMI, 2=EuroStoxx50, 3=DJIA (Nikkei=4, DAX=5 — skipped)
  const assetCols: Array<[string, number]> = [
    ['smi', 1],
    ['eurostoxx50', 2],
    ['djia', 3],
  ];

  const daily = new Map<string, Array<{ date: Date; price: number }>>();
  for (const [id] of assetCols) daily.set(id, []);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]?.trim()) continue;
    const date = parseDate(row[0]);
    for (const [id, col] of assetCols) {
      const price = parseNum(row[col] ?? '');
      if (price !== null) daily.get(id)!.push({ date, price });
    }
  }

  const result = new Map<string, WeeklyPriceRow[]>();
  for (const [id] of assetCols) {
    result.set(id, resampleToWeekly(id, daily.get(id)!));
  }
  return result;
}

function parseBonds(): Map<string, WeeklyPriceRow[]> {
  const rows = readCSV(path.join(DATA_DIR, 'Market_Data - Bonds.csv'));
  // col 1 = Swiss Bond AAA-BBB Total Return Index (has #N/A early)
  const daily: Array<{ date: Date; price: number }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]?.trim()) continue;
    const date = parseDate(row[0]);
    const price = parseNum(row[1] ?? '');
    if (price !== null) daily.push({ date, price });
  }

  return new Map([['ch_bond', resampleToWeekly('ch_bond', daily)]]);
}

function parseGold(): Map<string, WeeklyPriceRow[]> {
  const rows = readCSV(path.join(DATA_DIR, 'Market_Data - Gold.csv'));
  // Row 0 = header, col 0 = date, col 2 = CHF price
  const daily: Array<{ date: Date; price: number }> = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]?.trim()) continue;
    const date = parseDate(row[0]);
    const price = parseNum(row[2] ?? '');
    if (price !== null) daily.push({ date, price });
  }

  return new Map([['gold_chf', resampleToWeekly('gold_chf', daily)]]);
}

/**
 * Generic parser for SMI and DJIA stock files.
 * Row 0 = company names, Row 1 = tickers, Row 2+ = date + prices
 */
function parseSingleStocks(
  fileName: string,
  includeIds: Record<string, string> // ticker → assetId
): Map<string, WeeklyPriceRow[]> {
  const rows = readCSV(path.join(DATA_DIR, fileName));
  const tickerRow = rows[1];

  const tickerToCol = new Map<string, number>();
  for (let col = 1; col < tickerRow.length; col++) {
    const ticker = tickerRow[col]?.trim();
    if (ticker && includeIds[ticker]) {
      tickerToCol.set(ticker, col);
    }
  }

  const daily = new Map<string, Array<{ date: Date; price: number }>>();
  for (const ticker of tickerToCol.keys()) daily.set(ticker, []);

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]?.trim()) continue;
    const date = parseDate(row[0]);
    for (const [ticker, col] of tickerToCol) {
      const price = parseNum(row[col] ?? '');
      if (price !== null) daily.get(ticker)!.push({ date, price });
    }
  }

  const result = new Map<string, WeeklyPriceRow[]>();
  for (const [ticker, assetId] of Object.entries(includeIds)) {
    const dailyData = daily.get(ticker);
    if (dailyData) result.set(assetId, resampleToWeekly(assetId, dailyData));
  }
  return result;
}

function parseSMIStocks(): Map<string, WeeklyPriceRow[]> {
  return parseSingleStocks('Market_Data - SMI_Single Stocks.csv', {
    'NESN-CH': 'nestle',
    'UBSG-CH': 'ubs',
    'NOVN-CH': 'novartis',
    'ROG-CH': 'roche',
    'ABBN-CH': 'abb',
    'ZURN-CH': 'zurich',
    'LOGN-CH': 'logitech',
    'CFR-CH': 'richemont',
    'LONN-CH': 'lonza',
    'SIKA-CH': 'sika',
  });
}

function parseDJIAStocks(): Map<string, WeeklyPriceRow[]> {
  return parseSingleStocks('Market_Data - DJIA_Single Stocks.csv', {
    'AAPL-US': 'apple',
    'MSFT-US': 'microsoft',
    'GS-US': 'goldman',
    'CAT-US': 'caterpillar',
    'MCD-US': 'mcdonalds',
    'JNJ-US': 'jnj',
  });
}

// ── Crash Detection ────────────────────────────────────────────────────────

/**
 * Detect crash periods for a seed window using SMI as reference.
 * Crash = drawdown > 15% from rolling high (not just 52-week, but all-time-in-window high).
 * Returns relative week indices (relative to seed start_week).
 * Pairs: [startWeek, troughWeek, startWeek2, troughWeek2, ...]
 */
function detectCrashes(
  smiPrices: WeeklyPriceRow[],
  startWeek: number,
  endWeek: number
): number[] {
  const window = smiPrices.filter(
    p => p.week_index >= startWeek && p.week_index <= endWeek
  );

  const crashWeeks: number[] = [];
  let rollingHigh = 0;
  let inCrash = false;
  let crashStartWeek = -1;
  let troughPrice = Infinity;
  let troughWeek = -1;

  for (const row of window) {
    const relWeek = row.week_index - startWeek;

    if (row.price > rollingHigh) {
      rollingHigh = row.price;
      // If we were in a crash and price now exceeds the old peak, crash is over
      if (inCrash) {
        crashWeeks.push(crashStartWeek, troughWeek);
        inCrash = false;
        troughPrice = Infinity;
      }
    }

    const drawdown = (row.price - rollingHigh) / rollingHigh;

    if (!inCrash && drawdown < -0.15) {
      inCrash = true;
      crashStartWeek = relWeek;
      troughPrice = row.price;
      troughWeek = relWeek;
    } else if (inCrash) {
      if (row.price < troughPrice) {
        troughPrice = row.price;
        troughWeek = relWeek;
      }
    }
  }

  // If still in crash at end of window
  if (inCrash) {
    crashWeeks.push(crashStartWeek, troughWeek);
  }

  return [...new Set(crashWeeks)].sort((a, b) => a - b);
}

// ── Asset Registry ─────────────────────────────────────────────────────────

const ASSETS: AssetRow[] = [
  // Equity Indices
  { id: 'smi', name: 'Swiss Market Index', asset_class: 'equity_index', region: 'CH', risk_level: 3, description: 'Top 20 Swiss companies. Stable, pharma-heavy.' },
  { id: 'eurostoxx50', name: 'Euro Stoxx 50', asset_class: 'equity_index', region: 'EU', risk_level: 3, description: '50 largest Eurozone companies. Cyclical, export-driven.' },
  { id: 'djia', name: 'Dow Jones Industrial', asset_class: 'equity_index', region: 'US', risk_level: 3, description: '30 major US companies. Tech and growth oriented.' },
  // Bond
  { id: 'ch_bond', name: 'Swiss Bond Index', asset_class: 'bond', region: 'CH', risk_level: 1, description: 'Swiss investment-grade bonds. Low risk, steady returns.' },
  // Gold
  { id: 'gold_chf', name: 'Gold (CHF)', asset_class: 'gold', region: 'global', risk_level: 2, description: 'Physical gold priced in Swiss francs. Crisis hedge.' },
  // Swiss Stocks
  { id: 'nestle', name: 'Nestlé', asset_class: 'stock', region: 'CH', ticker: 'NESN-CH', risk_level: 2, description: "World's largest food company. Defensive, stable dividends." },
  { id: 'ubs', name: 'UBS', asset_class: 'stock', region: 'CH', ticker: 'UBSG-CH', risk_level: 4, description: 'Global investment bank. Highly cyclical, volatile.' },
  { id: 'novartis', name: 'Novartis', asset_class: 'stock', region: 'CH', ticker: 'NOVN-CH', risk_level: 2, description: 'Pharma giant. Defensive, consistent earnings.' },
  { id: 'roche', name: 'Roche', asset_class: 'stock', region: 'CH', ticker: 'ROG-CH', risk_level: 2, description: 'Pharma and diagnostics leader. Stable, innovation-driven.' },
  { id: 'abb', name: 'ABB', asset_class: 'stock', region: 'CH', ticker: 'ABBN-CH', risk_level: 3, description: 'Industrial automation. Cyclical, tied to global economy.' },
  { id: 'zurich', name: 'Zurich Insurance', asset_class: 'stock', region: 'CH', ticker: 'ZURN-CH', risk_level: 2, description: 'Insurance giant. Defensive, strong dividends.' },
  { id: 'logitech', name: 'Logitech', asset_class: 'stock', region: 'CH', ticker: 'LOGN-CH', risk_level: 4, description: 'Tech peripherals. Growth stock, higher volatility.' },
  { id: 'richemont', name: 'Richemont', asset_class: 'stock', region: 'CH', ticker: 'CFR-CH', risk_level: 3, description: 'Luxury goods (Cartier). Cyclical, consumer sentiment driven.' },
  { id: 'lonza', name: 'Lonza', asset_class: 'stock', region: 'CH', ticker: 'LONN-CH', risk_level: 3, description: 'Pharma manufacturing. Growth-oriented, volatile.' },
  { id: 'sika', name: 'Sika', asset_class: 'stock', region: 'CH', ticker: 'SIKA-CH', risk_level: 3, description: 'Construction chemicals. Steady grower, moderately cyclical.' },
  // US Stocks
  { id: 'apple', name: 'Apple', asset_class: 'stock', region: 'US', ticker: 'AAPL-US', risk_level: 3, description: "World's most valuable company. Growth with mega-cap stability." },
  { id: 'microsoft', name: 'Microsoft', asset_class: 'stock', region: 'US', ticker: 'MSFT-US', risk_level: 3, description: 'Software and cloud giant. Strong growth, lower vol than peers.' },
  { id: 'goldman', name: 'Goldman Sachs', asset_class: 'stock', region: 'US', ticker: 'GS-US', risk_level: 4, description: 'Top investment bank. Very cyclical, volatile.' },
  { id: 'caterpillar', name: 'Caterpillar', asset_class: 'stock', region: 'US', ticker: 'CAT-US', risk_level: 3, description: 'Heavy machinery. Cyclical, tracks global construction.' },
  { id: 'mcdonalds', name: "McDonald's", asset_class: 'stock', region: 'US', ticker: 'MCD-US', risk_level: 2, description: 'Fast food giant. Defensive, recession-resistant.' },
  { id: 'jnj', name: 'Johnson & Johnson', asset_class: 'stock', region: 'US', ticker: 'JNJ-US', risk_level: 2, description: 'Healthcare conglomerate. Ultra-defensive, dividend king.' },
];

// ── Seed Definitions ───────────────────────────────────────────────────────

const SEED_DEFS = [
  {
    id: 'alpine-storm',
    name: 'Alpine Storm',
    start_week: 0,
    end_week: 520,
    difficulty: 'hard' as const,
    description: '2006–2016: 2008 crash hits within first 2 years. Tests panic selling.',
    reveal_title: 'You invested through 2006–2016',
    reveal_text:
      'You experienced the worst financial crisis since the Great Depression. The SMI fell over 50% from peak to trough. Investors who stayed the course recovered within 5 years. Those who panic-sold often locked in their losses permanently.',
    historical_events: [
      { week: 90, name: 'Subprime mortgage fears emerge', type: 'warning' },
      { week: 130, name: 'Lehman Brothers collapses — global financial crisis', type: 'crash' },
      { week: 160, name: 'Market bottom — recovery begins', type: 'recovery' },
      { week: 245, name: 'European debt crisis — Greece, Italy fears', type: 'warning' },
      { week: 350, name: 'Fed taper tantrum', type: 'warning' },
      { week: 430, name: 'Swiss National Bank removes EUR/CHF floor', type: 'shock' },
    ],
  },
  {
    id: 'long-summer',
    name: 'Long Summer',
    start_week: 208,
    end_week: 728,
    difficulty: 'medium' as const,
    description: '2010–2020: Long bull market then COVID crash at the end.',
    reveal_title: 'You invested through 2010–2020',
    reveal_text:
      'You rode the longest bull market in history — then COVID hit. Markets dropped 30% in weeks. But investors who held on saw a complete recovery within months. This decade proved that time in the market beats timing the market.',
    historical_events: [
      { week: 0, name: 'Recovery from financial crisis underway', type: 'recovery' },
      { week: 70, name: 'European debt crisis rattles markets', type: 'warning' },
      { week: 260, name: 'SNB shock — Swiss franc surges', type: 'shock' },
      { week: 400, name: 'Global trade war fears', type: 'warning' },
      { week: 500, name: 'All-time highs across major indices', type: 'milestone' },
      { week: 510, name: 'COVID-19 pandemic crashes global markets', type: 'crash' },
    ],
  },
  {
    id: 'the-whiplash',
    name: 'The Whiplash',
    start_week: 104,
    end_week: 624,
    difficulty: 'hard' as const,
    description: '2008–2018: Starts right as the 2008 crash unfolds.',
    reveal_title: 'You invested through 2008–2018',
    reveal_text:
      'You started investing at the worst possible time — right before the biggest crash in 80 years. But this window actually produced strong returns for patient investors. Those who bought during the crisis at discounted prices did exceptionally well.',
    historical_events: [
      { week: 0, name: 'Markets already falling from 2007 highs', type: 'warning' },
      { week: 30, name: 'Lehman collapse', type: 'crash' },
      { week: 55, name: 'The bottom — everything is on sale', type: 'recovery' },
      { week: 270, name: 'Markets finally surpass pre-crisis highs', type: 'milestone' },
      { week: 420, name: 'Brexit shock', type: 'shock' },
      { week: 510, name: 'Volatility returns — Fed rate hikes', type: 'warning' },
    ],
  },
  {
    id: 'steady-climb',
    name: 'Steady Climb',
    start_week: 312,
    end_week: 832,
    difficulty: 'easy' as const,
    description: '2012–2022: Mostly growth with moderate corrections until 2022 rate shock.',
    reveal_title: 'You invested through 2012–2022',
    reveal_text:
      'You invested during a mostly favorable decade. Even COVID was just a blip — markets recovered in months. The real test came at the end with rising inflation and interest rates. Diversified portfolios with bonds handled this much better than pure equity.',
    historical_events: [
      { week: 0, name: 'Post-crisis recovery gaining momentum', type: 'recovery' },
      { week: 160, name: 'SNB removes EUR/CHF floor', type: 'shock' },
      { week: 310, name: 'Trade war volatility', type: 'warning' },
      { week: 410, name: 'COVID crash', type: 'crash' },
      { week: 420, name: 'Fastest recovery in history', type: 'recovery' },
      { week: 500, name: 'Inflation surge, interest rate shock', type: 'shock' },
    ],
  },
];

// ── Supabase Client ────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Batch Insert Helper ────────────────────────────────────────────────────

async function batchInsert<T extends object>(
  table: string,
  rows: T[],
  batchSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
    process.stdout.write(`  ${table}: ${Math.min(i + batchSize, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ✅ ${table}: ${rows.length} rows inserted`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting data preparation...\n');

  // ── 1. Truncate tables (idempotent, FK order) ───────────────────────────
  console.log('🗑️  Clearing tables...');
  // seed_assets has no simple id col, delete by seed_id >= ''
  let { error: e1 } = await supabase.from('seed_assets').delete().gte('seed_id', '');
  if (e1) throw new Error(`Clear seed_assets failed: ${e1.message}`);
  let { error: e2 } = await supabase.from('seeds').delete().gte('id', '');
  if (e2) throw new Error(`Clear seeds failed: ${e2.message}`);
  let { error: e3 } = await supabase.from('weekly_prices').delete().gte('id', 0);
  if (e3) throw new Error(`Clear weekly_prices failed: ${e3.message}`);
  let { error: e4 } = await supabase.from('assets').delete().gte('id', '');
  if (e4) throw new Error(`Clear assets failed: ${e4.message}`);
  console.log('✅ Tables cleared\n');

  // ── 2. Parse all CSVs ───────────────────────────────────────────────────
  console.log('📂 Parsing CSV files...');
  const allPrices = new Map<string, WeeklyPriceRow[]>();

  const sources = [
    parseEquityIndices(),
    parseBonds(),
    parseGold(),
    parseSMIStocks(),
    parseDJIAStocks(),
  ];

  for (const source of sources) {
    for (const [id, prices] of source) {
      allPrices.set(id, prices);
      console.log(`  ${id}: ${prices.length} weekly prices`);
    }
  }
  console.log(`✅ Parsed ${allPrices.size} assets\n`);

  // ── 3. Insert assets ────────────────────────────────────────────────────
  console.log('💾 Inserting assets...');
  await batchInsert('assets', ASSETS);
  console.log();

  // ── 4. Insert weekly prices ─────────────────────────────────────────────
  console.log('💾 Inserting weekly prices...');
  const allPriceRows: WeeklyPriceRow[] = [];
  for (const rows of allPrices.values()) allPriceRows.push(...rows);
  await batchInsert('weekly_prices', allPriceRows);
  console.log();

  // ── 5. Build seeds with crash detection ─────────────────────────────────
  console.log('🔍 Detecting crashes & building seeds...');
  const smiWeekly = allPrices.get('smi')!;
  const smiByIndex = new Map(smiWeekly.map(p => [p.week_index, p]));

  const seedRows: SeedRow[] = SEED_DEFS.map(def => {
    const crashWeeks = detectCrashes(smiWeekly, def.start_week, def.end_week);

    // Derive start_date and end_date from actual SMI weekly prices
    const startRow =
      smiByIndex.get(def.start_week) ??
      smiWeekly.find(p => p.week_index >= def.start_week)!;
    const endRow =
      smiByIndex.get(def.end_week) ??
      [...smiWeekly].reverse().find(p => p.week_index <= def.end_week)!;

    console.log(`  ${def.id}: crash_weeks=${JSON.stringify(crashWeeks)}`);

    return {
      id: def.id,
      name: def.name,
      start_week: def.start_week,
      end_week: def.end_week,
      start_date: startRow.date,
      end_date: endRow.date,
      difficulty: def.difficulty,
      description: def.description,
      reveal_title: def.reveal_title,
      reveal_text: def.reveal_text,
      historical_events: def.historical_events,
      crash_weeks: crashWeeks,
    };
  });

  // ── 6. Insert seeds ──────────────────────────────────────────────────────
  console.log('\n💾 Inserting seeds...');
  await batchInsert('seeds', seedRows);
  console.log();

  // ── 7. Insert seed_assets (all seeds × all assets) ──────────────────────
  console.log('💾 Inserting seed_assets...');
  const seedAssetRows = seedRows.flatMap(seed =>
    ASSETS.map(asset => ({ seed_id: seed.id, asset_id: asset.id }))
  );
  await batchInsert('seed_assets', seedAssetRows);
  console.log();

  // ── 8. Summary ───────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Inserted ${ASSETS.length} assets`);
  console.log(`✅ Inserted ${allPriceRows.length} weekly prices`);
  console.log(`✅ Inserted ${seedRows.length} seeds`);
  console.log(`✅ Inserted ${seedAssetRows.length} seed_assets`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
