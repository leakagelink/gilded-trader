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

// FMP API commodity symbols mapping (legacy API uses different symbols)
const FMP_COMMODITIES = [
  { name: "Gold", symbol: "XAU", fmpSymbols: ["GCUSD", "XAUUSD"], icon: "🥇", fullName: "Gold" },
  { name: "Silver", symbol: "XAG", fmpSymbols: ["SIUSD", "XAGUSD"], icon: "🥈", fullName: "Silver" },
  { name: "Platinum", symbol: "XPT", fmpSymbols: ["PLUSD", "XPTUSD"], icon: "💎", fullName: "Platinum" },
  { name: "Palladium", symbol: "XPD", fmpSymbols: ["PAUSD", "XPDUSD"], icon: "⬜", fullName: "Palladium" },
  { name: "Copper", symbol: "XCU", fmpSymbols: ["HGUSD", "XCUUSD"], icon: "🔶", fullName: "Copper" },
  { name: "Crude Oil", symbol: "WTI", fmpSymbols: ["CLUSD", "WTIUSD"], icon: "🛢️", fullName: "Crude Oil WTI" },
  { name: "Natural Gas", symbol: "NG", fmpSymbols: ["NGUSD"], icon: "🔥", fullName: "Natural Gas" },
  { name: "Brent Oil", symbol: "BRENT", fmpSymbols: ["BZUSD", "BRENTUSD"], icon: "🛢️", fullName: "Brent Crude Oil" },
];

// Fetch from FMP API (Financial Modeling Prep) - Legacy v3 endpoint
async function fetchFromFMP(apiKey: string): Promise<any[]> {
  try {
    console.log('Fetching commodities from FMP API (legacy v3)...');
    
    // Use the legacy v3 endpoint that lists all commodities
    const url = `https://financialmodelingprep.com/api/v3/quotes/commodity?apikey=${apiKey}`;
    
    console.log('FMP URL:', url.replace(apiKey, '***'));
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FMP API error:', response.status, errorText);
      return [];
    }

    const data = await response.json();
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('FMP: No results or invalid response');
      return [];
    }

    console.log(`FMP API returned ${data.length} commodities`);

    const results: any[] = [];
    
    for (const config of FMP_COMMODITIES) {
      // Find matching commodity from FMP data
      const quote = data.find((q: any) => config.fmpSymbols.includes(q.symbol));
      
      if (!quote) {
        console.log(`No FMP data for ${config.name} (${config.fmpSymbols.join(', ')})`);
        continue;
      }
      
      const price = quote.price || 0;
      const changePercent = quote.changesPercentage || 0;
      
      console.log(`FMP ${config.name}: $${price.toFixed(2)} (${changePercent.toFixed(2)}%)`);
      
      results.push({
        name: config.name,
        symbol: config.symbol,
        price: price.toFixed(2),
        change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
        isPositive: changePercent >= 0,
        icon: config.icon,
        currencySymbol: "$",
        fullName: config.fullName
      });
    }
    
    console.log(`Successfully fetched ${results.length} commodities from FMP`);
    return results;
  } catch (error) {
    console.error('FMP fetch error:', error);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let commoditiesData: any[] = [];

    // Try FMP API (primary source)
    const fmpApiKey = Deno.env.get('FMP_API_KEY');
    
    if (fmpApiKey) {
      commoditiesData = await fetchFromFMP(fmpApiKey);
    } else {
      console.log('FMP_API_KEY not configured');
    }

    const fmpSuccess = commoditiesData.length > 0;

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

    console.log(`Returning ${commoditiesData.length} commodities (${fmpSuccess ? 'FMP API' : 'fallback'})`);
    
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
