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

// Fetch from GoldPricez API (primary source for metals)
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

// Alternative: Fetch all rates at once
async function fetchAllFromGoldPricez(apiKey: string): Promise<any[]> {
  try {
    console.log('Fetching all rates from GoldPricez API...');
    
    // Try the all rates endpoint
    const url = `https://goldpricez.com/api/rates?api_key=${apiKey}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GoldPricez all rates error:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    console.log('GoldPricez all rates response:', JSON.stringify(data).substring(0, 500));
    
    const results: any[] = [];
    
    if (data && typeof data === 'object') {
      // Handle different response formats
      const rates = data.rates || data.data || data;
      
      for (const config of COMMODITIES_CONFIG) {
        const metalData = rates[config.apiSymbol] || rates[config.apiSymbol.toLowerCase()];
        if (metalData) {
          const price = metalData.price || metalData.usd || metalData.rate || metalData;
          const changePercent = metalData.change_percent || metalData.ch_pct || metalData.change || 0;
          
          const priceValue = typeof price === 'number' ? price : parseFloat(String(price));
          if (!isNaN(priceValue)) {
            results.push({
              name: config.name,
              symbol: config.symbol,
              price: priceValue.toFixed(2),
              change: `${parsePercent(changePercent) >= 0 ? '+' : ''}${parsePercent(changePercent).toFixed(2)}%`,
              isPositive: parsePercent(changePercent) >= 0,
              icon: config.icon,
              currencySymbol: "$",
              fullName: config.fullName
            });
            console.log(`GoldPricez ${config.name}: $${price}`);
          }
        }
      }
    }
    
    console.log(`Fetched ${results.length} commodities from GoldPricez all rates`);
    return results;
  } catch (error) {
    console.error('GoldPricez all rates error:', error);
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

    // Try GoldPricez API (primary source)
    const goldPricezApiKey = Deno.env.get('GOLDPRICEZ_API_KEY');
    
    if (goldPricezApiKey) {
      // First try fetching all rates
      commoditiesData = await fetchAllFromGoldPricez(goldPricezApiKey);
      
      // If that didn't work, try individual metals
      if (commoditiesData.length === 0) {
        commoditiesData = await fetchFromGoldPricez(goldPricezApiKey);
      }
    } else {
      console.log('GOLDPRICEZ_API_KEY not configured');
    }

    const apiSuccess = commoditiesData.length > 0;

    // Add static data for commodities we couldn't fetch
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

    console.log(`Returning ${commoditiesData.length} commodities (${apiSuccess ? 'GoldPricez API' : 'fallback'})`);
    
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
