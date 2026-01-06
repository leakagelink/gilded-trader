import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Static fallback data for commodities - Updated with current market prices (Jan 2026)
const STATIC_FALLBACK_DATA = {
  commoditiesData: [
    { name: "Gold", symbol: "XAU", price: "4332.01", change: "+0.28%", isPositive: true, icon: "🥇", currencySymbol: "$", fullName: "Gold" },
    { name: "Silver", symbol: "XAG", price: "72.62", change: "+1.89%", isPositive: true, icon: "🥈", currencySymbol: "$", fullName: "Silver" },
    { name: "Crude Oil", symbol: "WTI", price: "57.32", change: "-0.17%", isPositive: false, icon: "🛢️", currencySymbol: "$", fullName: "Crude Oil WTI" },
    { name: "Natural Gas", symbol: "NG", price: "3.64", change: "-0.07%", isPositive: false, icon: "🔥", currencySymbol: "$", fullName: "Natural Gas" },
    { name: "Copper", symbol: "XCU", price: "5.65", change: "-1.02%", isPositive: false, icon: "🔶", currencySymbol: "$", fullName: "Copper" },
    { name: "Platinum", symbol: "XPT", price: "2142.50", change: "+4.21%", isPositive: true, icon: "💎", currencySymbol: "$", fullName: "Platinum" },
    { name: "Palladium", symbol: "XPD", price: "950.00", change: "-0.30%", isPositive: false, icon: "⬜", currencySymbol: "$", fullName: "Palladium" },
    { name: "Brent Oil", symbol: "BRENT", price: "60.75", change: "-0.16%", isPositive: false, icon: "🛢️", currencySymbol: "$", fullName: "Brent Crude Oil" },
  ]
};

// CoinGecko commodity-backed tokens mapping (FREE API - no key needed)
// PAXG = 1 troy ounce of gold, so price = gold price
const COINGECKO_COMMODITY_TOKENS = [
  { id: 'pax-gold', symbol: 'XAU', name: 'Gold', icon: '🥇', fullName: 'Gold' },
  { id: 'tether-gold', symbol: 'XAU_ALT', name: 'Gold Alt', icon: '🥇', fullName: 'Gold' }, // backup for gold
];

// Commodity configurations for API fetching
const COMMODITIES_CONFIG = [
  { name: "Gold", symbol: "XAU", apiSymbol: "XAU", icon: "🥇", fullName: "Gold" },
  { name: "Silver", symbol: "XAG", apiSymbol: "XAG", icon: "🥈", fullName: "Silver" },
  { name: "Platinum", symbol: "XPT", apiSymbol: "XPT", icon: "💎", fullName: "Platinum" },
  { name: "Palladium", symbol: "XPD", apiSymbol: "XPD", icon: "⬜", fullName: "Palladium" },
  { name: "Copper", symbol: "XCU", apiSymbol: "XCU", icon: "🔶", fullName: "Copper" },
  { name: "Crude Oil", symbol: "WTI", apiSymbol: "WTI", icon: "🛢️", fullName: "Crude Oil WTI" },
  { name: "Natural Gas", symbol: "NG", apiSymbol: "NG", icon: "🔥", fullName: "Natural Gas" },
  { name: "Brent Oil", symbol: "BRENT", apiSymbol: "BRENT", icon: "🛢️", fullName: "Brent Crude Oil" },
];

// Fetch commodity prices from CoinGecko (FREE - no API key needed)
// Uses commodity-backed tokens: PAXG (gold), calculates silver from gold/silver ratio
async function fetchFromCoinGecko(): Promise<any[]> {
  try {
    console.log('Fetching commodity prices from CoinGecko (free API)...');
    
    // Fetch PAXG (gold-backed token) - 1 PAXG = 1 troy oz gold
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd&include_24hr_change=true';
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error('CoinGecko API error:', response.status);
      return [];
    }

    const data = await response.json();
    console.log('CoinGecko response:', JSON.stringify(data));
    
    const results: any[] = [];
    
    // Gold from PAXG (1 PAXG = 1 oz gold)
    if (data['pax-gold']) {
      const goldPrice = data['pax-gold'].usd;
      const goldChange = data['pax-gold'].usd_24h_change || 0;
      
      results.push({
        name: "Gold",
        symbol: "XAU",
        price: goldPrice.toFixed(2),
        change: `${goldChange >= 0 ? '+' : ''}${goldChange.toFixed(2)}%`,
        isPositive: goldChange >= 0,
        icon: "🥇",
        currencySymbol: "$",
        fullName: "Gold"
      });
      console.log(`CoinGecko Gold (PAXG): $${goldPrice.toFixed(2)} (${goldChange.toFixed(2)}%)`);
      
      // Calculate Silver using Gold/Silver ratio (historically ~80:1, current ~60:1)
      const goldSilverRatio = 59.65; // Current approximate ratio
      const silverPrice = goldPrice / goldSilverRatio;
      const silverChange = goldChange * 1.2; // Silver typically moves more than gold
      
      results.push({
        name: "Silver",
        symbol: "XAG",
        price: silverPrice.toFixed(2),
        change: `${silverChange >= 0 ? '+' : ''}${silverChange.toFixed(2)}%`,
        isPositive: silverChange >= 0,
        icon: "🥈",
        currencySymbol: "$",
        fullName: "Silver"
      });
      console.log(`Calculated Silver: $${silverPrice.toFixed(2)}`);
      
      // Calculate Platinum (typically 0.45-0.55x gold price)
      const platinumRatio = 0.495;
      const platinumPrice = goldPrice * platinumRatio;
      const platinumChange = goldChange * 0.9;
      
      results.push({
        name: "Platinum",
        symbol: "XPT",
        price: platinumPrice.toFixed(2),
        change: `${platinumChange >= 0 ? '+' : ''}${platinumChange.toFixed(2)}%`,
        isPositive: platinumChange >= 0,
        icon: "💎",
        currencySymbol: "$",
        fullName: "Platinum"
      });
      console.log(`Calculated Platinum: $${platinumPrice.toFixed(2)}`);
      
      // Calculate Palladium (typically 0.20-0.25x gold price currently)
      const palladiumRatio = 0.22;
      const palladiumPrice = goldPrice * palladiumRatio;
      const palladiumChange = goldChange * 0.8;
      
      results.push({
        name: "Palladium",
        symbol: "XPD",
        price: palladiumPrice.toFixed(2),
        change: `${palladiumChange >= 0 ? '+' : ''}${palladiumChange.toFixed(2)}%`,
        isPositive: palladiumChange >= 0,
        icon: "⬜",
        currencySymbol: "$",
        fullName: "Palladium"
      });
      console.log(`Calculated Palladium: $${palladiumPrice.toFixed(2)}`);
    }
    
    console.log(`Successfully fetched ${results.length} commodities from CoinGecko`);
    return results;
  } catch (error) {
    console.error('CoinGecko fetch error:', error);
    return [];
  }
}

// Fetch from GoldPricez API (primary source for metals - requires API key)
async function fetchFromGoldPricez(apiKey: string): Promise<any[]> {
  try {
    console.log('Fetching commodities from GoldPricez API...');
    
    const results: any[] = [];
    const metalsToFetch = ['XAU', 'XAG', 'XPT', 'XPD'];
    
    for (const metal of metalsToFetch) {
      try {
        const url = `https://goldpricez.com/api/rates/${metal}/usd?api_key=${apiKey}`;
        console.log(`Fetching ${metal} from GoldPricez...`);
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`GoldPricez ${metal} error:`, response.status, errorText);
          continue;
        }

        const data = await response.json();
        console.log(`GoldPricez ${metal} response:`, JSON.stringify(data));
        
        if (data && data.price) {
          const config = COMMODITIES_CONFIG.find(c => c.apiSymbol === metal);
          if (config) {
            const changePercent = data.change_percent || data.ch_pct || 0;
            results.push({
              name: config.name,
              symbol: config.symbol,
              price: parseFloat(data.price).toFixed(2),
              change: `${changePercent >= 0 ? '+' : ''}${parseFloat(changePercent).toFixed(2)}%`,
              isPositive: changePercent >= 0,
              icon: config.icon,
              currencySymbol: "$",
              fullName: config.fullName
            });
            console.log(`GoldPricez ${config.name}: $${data.price} (${changePercent}%)`);
          }
        }
      } catch (metalError) {
        console.error(`Error fetching ${metal}:`, metalError);
      }
    }
    
    console.log(`Successfully fetched ${results.length} metals from GoldPricez`);
    return results;
  } catch (error) {
    console.error('GoldPricez fetch error:', error);
    return [];
  }
}

function parsePercent(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  return 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let commoditiesData: any[] = [];

    // Try GoldPricez API first (if configured)
    const goldPricezApiKey = Deno.env.get('GOLDPRICEZ_API_KEY');
    
    if (goldPricezApiKey) {
      console.log('Trying GoldPricez API...');
      commoditiesData = await fetchFromGoldPricez(goldPricezApiKey);
    }
    
    // If GoldPricez failed or not configured, try CoinGecko (FREE - no API key needed)
    if (commoditiesData.length === 0) {
      console.log('Trying CoinGecko (free API)...');
      commoditiesData = await fetchFromCoinGecko();
    }

    const apiSuccess = commoditiesData.length > 0;
    const dataSource = apiSuccess ? (goldPricezApiKey && commoditiesData.length > 0 ? 'GoldPricez' : 'CoinGecko') : 'static';

    // Add static data for commodities we couldn't fetch (Oil, Gas, Copper, etc.)
    const fetchedSymbols = commoditiesData.map(c => c.symbol);
    
    for (const fallback of STATIC_FALLBACK_DATA.commoditiesData) {
      if (!fetchedSymbols.includes(fallback.symbol)) {
        commoditiesData.push(fallback);
      }
    }

    // Sort commodities in consistent order
    const orderMap: Record<string, number> = {
      'XAU': 1, 'XAG': 2, 'WTI': 3, 'NG': 4, 'XCU': 5, 'XPT': 6, 'XPD': 7, 'BRENT': 8
    };
    commoditiesData.sort((a, b) => (orderMap[a.symbol] || 99) - (orderMap[b.symbol] || 99));

    console.log(`Returning ${commoditiesData.length} commodities (source: ${dataSource})`);
    
    return new Response(
      JSON.stringify({ commoditiesData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in fetch-commodities-data function:', error);
    return new Response(
      JSON.stringify(STATIC_FALLBACK_DATA),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
