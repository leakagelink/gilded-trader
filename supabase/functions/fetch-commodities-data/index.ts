import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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

// Commodity configurations for Gold API (backup)
const COMMODITIES_CONFIG = [
  { name: "Gold", symbol: "XAU", apiSymbol: "XAU", icon: "🥇", fullName: "Gold" },
  { name: "Silver", symbol: "XAG", apiSymbol: "XAG", icon: "🥈", fullName: "Silver" },
  { name: "Platinum", symbol: "XPT", apiSymbol: "XPT", icon: "💎", fullName: "Platinum" },
  { name: "Palladium", symbol: "XPD", apiSymbol: "XPD", icon: "⬜", fullName: "Palladium" },
  { name: "Copper", symbol: "XCU", apiSymbol: "XCU", icon: "🔶", fullName: "Copper" },
];

async function getActiveApiKey(serviceName: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase.rpc('get_active_api_key', {
    p_service_name: serviceName
  });
  
  if (error) {
    console.error('Error fetching API key:', error);
    return null;
  }
  
  return data;
}

async function markKeyAsInactive(serviceName: string, apiKey: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('service_name', serviceName)
    .eq('api_key', apiKey);
  
  if (error) {
    console.error('Error marking key as inactive:', error);
  } else {
    console.log(`Marked ${serviceName} key as inactive due to rate limit`);
  }
}

// GoldPriceZ API - Primary source for Gold & Silver (44K req/month free)
async function fetchFromGoldPriceZ(): Promise<any> {
  const apiKey = Deno.env.get('GOLDPRICEZ_API_KEY');
  
  if (!apiKey) {
    console.log('GOLDPRICEZ_API_KEY not configured');
    return null;
  }

  try {
    console.log('Fetching from GoldPriceZ API...');
    
    // Fetch Gold & Silver prices in USD per ounce
    const response = await fetch('https://goldpricez.com/api/rates/currency/usd/measure/ounce/metal/all', {
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log('GoldPriceZ rate limited');
        return { rateLimited: true };
      }
      console.error('GoldPriceZ API error:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('GoldPriceZ response:', JSON.stringify(data).substring(0, 200));

    // Parse gold price
    const goldPrice = data.gold?.price || data.gold_price || data.XAU?.price;
    const goldChange = data.gold?.change_percent || data.gold?.chp || 0;
    
    // Parse silver price
    const silverPrice = data.silver?.price || data.silver_price || data.XAG?.price;
    const silverChange = data.silver?.change_percent || data.silver?.chp || 0;

    if (goldPrice) {
      console.log(`GoldPriceZ Gold: $${goldPrice}, Silver: $${silverPrice || 'N/A'}`);
      return {
        success: true,
        gold: { price: parseFloat(goldPrice), change: parseFloat(goldChange) || 0 },
        silver: silverPrice ? { price: parseFloat(silverPrice), change: parseFloat(silverChange) || 0 } : null
      };
    }

    return null;
  } catch (error) {
    console.error('GoldPriceZ fetch error:', error);
    return null;
  }
}

// Gold API - Backup source for all precious metals
async function fetchFromGoldAPI(apiKey: string, symbol: string): Promise<any> {
  try {
    const response = await fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
      headers: {
        'x-access-token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`Gold API ${symbol} price:`, data.price);
      return { success: true, data };
    }

    if (response.status === 429) {
      return { success: false, rateLimited: true };
    }

    const errorText = await response.text();
    console.error(`Gold API error fetching ${symbol}:`, response.status, errorText);
    return { success: false, error: errorText };
  } catch (error) {
    console.error(`Gold API exception fetching ${symbol}:`, error);
    return { success: false, error };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const commoditiesData: any[] = [];
    let goldPriceZSuccess = false;

    // Step 1: Try GoldPriceZ API first (high limit, free)
    const goldPriceZResult = await fetchFromGoldPriceZ();
    
    if (goldPriceZResult?.success) {
      goldPriceZSuccess = true;
      
      // Add Gold
      if (goldPriceZResult.gold) {
        const changePercent = goldPriceZResult.gold.change || 0;
        commoditiesData.push({
          name: "Gold",
          symbol: "XAU",
          price: goldPriceZResult.gold.price.toFixed(2),
          change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
          isPositive: changePercent >= 0,
          icon: "🥇",
          currencySymbol: "$",
          fullName: "Gold"
        });
      }
      
      // Add Silver
      if (goldPriceZResult.silver) {
        const changePercent = goldPriceZResult.silver.change || 0;
        commoditiesData.push({
          name: "Silver",
          symbol: "XAG",
          price: goldPriceZResult.silver.price.toFixed(2),
          change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
          isPositive: changePercent >= 0,
          icon: "🥈",
          currencySymbol: "$",
          fullName: "Silver"
        });
      }

      console.log('Successfully fetched Gold & Silver from GoldPriceZ');
    }

    // Step 2: Try Gold API for remaining metals (Platinum, Palladium, Copper) or all if GoldPriceZ failed
    const metalsToFetch = goldPriceZSuccess 
      ? COMMODITIES_CONFIG.filter(c => !['XAU', 'XAG'].includes(c.symbol))
      : COMMODITIES_CONFIG;

    if (metalsToFetch.length > 0) {
      let attempts = 0;
      const MAX_ATTEMPTS = 10;

      while (attempts < MAX_ATTEMPTS) {
        attempts++;
        const apiKey = await getActiveApiKey('goldapi');
        
        if (!apiKey) {
          console.log('No active Gold API key available');
          break;
        }

        console.log(`Gold API attempt ${attempts}`);
        let rateLimited = false;

        for (const commodity of metalsToFetch) {
          const result = await fetchFromGoldAPI(apiKey, commodity.apiSymbol);
          
          if (result.rateLimited) {
            rateLimited = true;
            break;
          }

          if (result.success && result.data) {
            const price = result.data.price || 0;
            const changePercent = result.data.chp || 0;
            
            commoditiesData.push({
              name: commodity.name,
              symbol: commodity.symbol,
              price: price.toFixed(2),
              change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
              isPositive: changePercent >= 0,
              icon: commodity.icon,
              currencySymbol: "$",
              fullName: commodity.fullName
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (rateLimited) {
          console.log('Gold API rate limited, marking key as inactive');
          await markKeyAsInactive('goldapi', apiKey);
          continue;
        }

        break;
      }
    }

    // Step 3: Add static data for metals we couldn't fetch
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

    console.log(`Returning ${commoditiesData.length} commodities (${goldPriceZSuccess ? 'GoldPriceZ' : 'fallback'} + Gold API/static)`);
    
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