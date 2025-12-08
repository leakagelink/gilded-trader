import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Static fallback data for commodities
const STATIC_FALLBACK_DATA = {
  commoditiesData: [
    { name: "Gold", symbol: "XAU", price: "2650.00", change: "+0.50%", isPositive: true, icon: "🥇", currencySymbol: "$", fullName: "Gold" },
    { name: "Silver", symbol: "XAG", price: "31.50", change: "+0.80%", isPositive: true, icon: "🥈", currencySymbol: "$", fullName: "Silver" },
    { name: "Crude Oil", symbol: "WTI", price: "71.50", change: "-0.50%", isPositive: false, icon: "🛢️", currencySymbol: "$", fullName: "Crude Oil WTI" },
    { name: "Natural Gas", symbol: "NG", price: "3.25", change: "+2.10%", isPositive: true, icon: "🔥", currencySymbol: "$", fullName: "Natural Gas" },
    { name: "Copper", symbol: "XCU", price: "4.15", change: "+1.50%", isPositive: true, icon: "🔶", currencySymbol: "$", fullName: "Copper" },
    { name: "Platinum", symbol: "XPT", price: "980.00", change: "+0.45%", isPositive: true, icon: "💎", currencySymbol: "$", fullName: "Platinum" },
    { name: "Palladium", symbol: "XPD", price: "1050.00", change: "-0.30%", isPositive: false, icon: "⬜", currencySymbol: "$", fullName: "Palladium" },
    { name: "Brent Oil", symbol: "BRENT", price: "74.50", change: "+0.65%", isPositive: true, icon: "🛢️", currencySymbol: "$", fullName: "Brent Crude Oil" },
  ]
};

// Commodity configurations for Gold API
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

async function fetchCommodityPrice(apiKey: string, symbol: string): Promise<any> {
  try {
    const response = await fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
      headers: {
        'x-access-token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`Fetched ${symbol} price:`, data.price);
      return { success: true, data };
    }

    if (response.status === 429) {
      return { success: false, rateLimited: true };
    }

    const errorText = await response.text();
    console.error(`Error fetching ${symbol}:`, response.status, errorText);
    return { success: false, error: errorText };
  } catch (error) {
    console.error(`Exception fetching ${symbol}:`, error);
    return { success: false, error };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let attempts = 0;
    const MAX_ATTEMPTS = 10;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const apiKey = await getActiveApiKey('goldapi');
      
      if (!apiKey) {
        console.log('No active Gold API key available, using fallback data');
        break;
      }

      console.log(`Attempt ${attempts}: Using Gold API key`);
      
      try {
        const commoditiesData: any[] = [];
        let rateLimited = false;

        // Fetch each commodity price from Gold API
        for (const commodity of COMMODITIES_CONFIG) {
          const result = await fetchCommodityPrice(apiKey, commodity.apiSymbol);
          
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
          
          // Small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (rateLimited) {
          console.log('Rate limited, marking key as inactive');
          await markKeyAsInactive('goldapi', apiKey);
          continue;
        }

        // If we got at least gold price, add static data for oil/gas (not available on Gold API)
        if (commoditiesData.length > 0) {
          // Add static data for commodities not available on Gold API
          commoditiesData.push(
            {
              name: "Crude Oil",
              symbol: "WTI",
              price: "71.50",
              change: "+0.35%",
              isPositive: true,
              icon: "🛢️",
              currencySymbol: "$",
              fullName: "Crude Oil WTI"
            },
            {
              name: "Natural Gas",
              symbol: "NG",
              price: "3.25",
              change: "+1.20%",
              isPositive: true,
              icon: "🔥",
              currencySymbol: "$",
              fullName: "Natural Gas"
            },
            {
              name: "Brent Oil",
              symbol: "BRENT",
              price: "74.50",
              change: "+0.45%",
              isPositive: true,
              icon: "🛢️",
              currencySymbol: "$",
              fullName: "Brent Crude Oil"
            }
          );

          console.log(`Successfully fetched ${commoditiesData.length} commodities`);
          return new Response(
            JSON.stringify({ commoditiesData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        break;
      } catch (error) {
        console.error(`Error with key attempt ${attempts}:`, error);
        break;
      }
    }

    // Return static fallback data
    console.log('Using static fallback data for commodities');
    return new Response(
      JSON.stringify(STATIC_FALLBACK_DATA),
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
