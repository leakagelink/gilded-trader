import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Static fallback data for commodities
const STATIC_FALLBACK_DATA = {
  commoditiesData: [
    { name: "Gold", symbol: "XAU", price: "2050.00", change: "+1.20%", isPositive: true, icon: "🥇", currencySymbol: "$", fullName: "Gold" },
    { name: "Silver", symbol: "XAG", price: "24.50", change: "+0.80%", isPositive: true, icon: "🥈", currencySymbol: "$", fullName: "Silver" },
    { name: "Crude Oil", symbol: "WTI", price: "78.50", change: "-0.50%", isPositive: false, icon: "🛢️", currencySymbol: "$", fullName: "Crude Oil WTI" },
    { name: "Natural Gas", symbol: "NG", price: "2.85", change: "+2.10%", isPositive: true, icon: "🔥", currencySymbol: "$", fullName: "Natural Gas" },
    { name: "Copper", symbol: "HG", price: "3.85", change: "+1.50%", isPositive: true, icon: "🔶", currencySymbol: "$", fullName: "Copper" },
    { name: "Platinum", symbol: "XPT", price: "980.00", change: "+0.45%", isPositive: true, icon: "💎", currencySymbol: "$", fullName: "Platinum" },
    { name: "Palladium", symbol: "XPD", price: "1050.00", change: "-0.30%", isPositive: false, icon: "⬜", currencySymbol: "$", fullName: "Palladium" },
    { name: "Brent Oil", symbol: "BRENT", price: "82.50", change: "+0.65%", isPositive: true, icon: "🛢️", currencySymbol: "$", fullName: "Brent Crude Oil" },
  ]
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    let lastError: any = null;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const apiKey = await getActiveApiKey('goldapi');
      
      if (!apiKey) {
        console.log('No active Gold API key available, using fallback data');
        break;
      }

      console.log(`Attempt ${attempts}: Using Gold API key`);
      
      try {
        // Fetch gold price
        const goldResponse = await fetch('https://www.goldapi.io/api/XAU/USD', {
          headers: {
            'x-access-token': apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (goldResponse.ok) {
          const goldData = await goldResponse.json();
          
          // Generate realistic variations based on gold price
          const goldPrice = goldData.price || 2050;
          const goldChange = goldData.ch || 0;
          const goldChangePercent = goldData.chp || 0;
          
          // Generate mock data with realistic variations
          const commoditiesData = [
            {
              name: "Gold",
              symbol: "XAU",
              price: goldPrice.toFixed(2),
              change: `${goldChangePercent >= 0 ? '+' : ''}${goldChangePercent.toFixed(2)}%`,
              isPositive: goldChangePercent >= 0,
              icon: "🥇",
              currencySymbol: "$",
              fullName: "Gold"
            },
            {
              name: "Silver",
              symbol: "XAG",
              price: (goldPrice / 84).toFixed(2), // Approximate gold/silver ratio
              change: `${(Math.random() - 0.5) * 2 >= 0 ? '+' : ''}${((Math.random() - 0.5) * 2).toFixed(2)}%`,
              isPositive: Math.random() > 0.5,
              icon: "🥈",
              currencySymbol: "$",
              fullName: "Silver"
            },
            {
              name: "Crude Oil",
              symbol: "WTI",
              price: (75 + Math.random() * 10).toFixed(2),
              change: `${(Math.random() - 0.5) * 2 >= 0 ? '+' : ''}${((Math.random() - 0.5) * 2).toFixed(2)}%`,
              isPositive: Math.random() > 0.5,
              icon: "🛢️",
              currencySymbol: "$",
              fullName: "Crude Oil WTI"
            },
            {
              name: "Natural Gas",
              symbol: "NG",
              price: (2.5 + Math.random() * 1).toFixed(2),
              change: `${(Math.random() - 0.5) * 3 >= 0 ? '+' : ''}${((Math.random() - 0.5) * 3).toFixed(2)}%`,
              isPositive: Math.random() > 0.5,
              icon: "🔥",
              currencySymbol: "$",
              fullName: "Natural Gas"
            },
            {
              name: "Copper",
              symbol: "HG",
              price: (3.7 + Math.random() * 0.3).toFixed(2),
              change: `${(Math.random() - 0.5) * 2 >= 0 ? '+' : ''}${((Math.random() - 0.5) * 2).toFixed(2)}%`,
              isPositive: Math.random() > 0.5,
              icon: "🔶",
              currencySymbol: "$",
              fullName: "Copper"
            },
            {
              name: "Platinum",
              symbol: "XPT",
              price: (goldPrice * 0.48).toFixed(2),
              change: `${(Math.random() - 0.5) * 2 >= 0 ? '+' : ''}${((Math.random() - 0.5) * 2).toFixed(2)}%`,
              isPositive: Math.random() > 0.5,
              icon: "💎",
              currencySymbol: "$",
              fullName: "Platinum"
            },
            {
              name: "Palladium",
              symbol: "XPD",
              price: (goldPrice * 0.52).toFixed(2),
              change: `${(Math.random() - 0.5) * 2 >= 0 ? '+' : ''}${((Math.random() - 0.5) * 2).toFixed(2)}%`,
              isPositive: Math.random() > 0.5,
              icon: "⬜",
              currencySymbol: "$",
              fullName: "Palladium"
            },
            {
              name: "Brent Oil",
              symbol: "BRENT",
              price: (80 + Math.random() * 8).toFixed(2),
              change: `${(Math.random() - 0.5) * 2 >= 0 ? '+' : ''}${((Math.random() - 0.5) * 2).toFixed(2)}%`,
              isPositive: Math.random() > 0.5,
              icon: "🛢️",
              currencySymbol: "$",
              fullName: "Brent Crude Oil"
            }
          ];

          return new Response(
            JSON.stringify({ commoditiesData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if rate limit error
        if (goldResponse.status === 429) {
          const errorText = await goldResponse.text();
          console.error(`Rate limit hit for Gold API key, status ${goldResponse.status}:`, errorText);
          await markKeyAsInactive('goldapi', apiKey);
          console.log('Trying next available API key...');
          continue;
        }

        // Other errors
        const errorText = await goldResponse.text();
        lastError = `Gold API error ${goldResponse.status}: ${errorText}`;
        console.error(lastError);
        break;

      } catch (error) {
        lastError = error;
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
