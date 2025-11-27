import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache to prevent hitting CoinMarketCap API rate limits
let cachedData: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 60000; // 60 seconds cache to match API rate limit

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

async function fetchCryptoData(apiKey: string) {
  const response = await fetch(
    'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=20',
    {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        'Accept': 'application/json',
      },
    }
  );

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = Date.now();
    
    // Return cached data if still fresh
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION_MS) {
      console.log('Returning cached crypto data (age:', Math.floor((now - cacheTimestamp) / 1000), 'seconds)');
      return new Response(
        JSON.stringify(cachedData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('Fetching fresh crypto data from CoinMarketCap...');
    
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    let lastError: any = null;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const apiKey = await getActiveApiKey('coinmarketcap');
      
      if (!apiKey) {
        console.error('No active CoinMarketCap API key available');
        break;
      }

      console.log(`Attempt ${attempts}: Using CoinMarketCap API key`);
      
      try {
        const response = await fetchCryptoData(apiKey);

        if (response.ok) {
          const data = await response.json();
          console.log('Successfully fetched fresh crypto data from CoinMarketCap');

          // Transform the data to match our app's format
          const cryptoData = data.data.map((coin: any) => {
            const currentPrice = coin.quote.USD.price;
            const changePercent = coin.quote.USD.percent_change_24h / 100;
            
            // Calculate approximate 24h high/low based on current price and 24h change
            const high24h = currentPrice / (1 + changePercent);
            const low24h = currentPrice * (1 - Math.abs(changePercent) * 0.8);
            
            return {
              name: coin.name,
              symbol: coin.symbol,
              price: currentPrice.toFixed(2),
              change: `${coin.quote.USD.percent_change_24h >= 0 ? '+' : ''}${coin.quote.USD.percent_change_24h.toFixed(2)}%`,
              isPositive: coin.quote.USD.percent_change_24h >= 0,
              logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`,
              currencySymbol: '$',
              high24h: high24h.toFixed(2),
              low24h: low24h.toFixed(2),
              id: coin.id,
            };
          });

          // Update cache
          cachedData = { cryptoData };
          cacheTimestamp = now;

          return new Response(
            JSON.stringify(cachedData),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            }
          );
        }

        // Check if rate limit error
        if (response.status === 429) {
          const errorText = await response.text();
          console.error(`Rate limit hit for key, status ${response.status}:`, errorText);
          
          // Mark this key as inactive
          await markKeyAsInactive('coinmarketcap', apiKey);
          
          // Try next key
          console.log('Trying next available API key...');
          continue;
        }

        // Other errors
        const errorText = await response.text();
        lastError = `API error ${response.status}: ${errorText}`;
        console.error(lastError);
        break;

      } catch (error) {
        lastError = error;
        console.error(`Error with key attempt ${attempts}:`, error);
        break;
      }
    }

    // If all attempts failed, return cached data if available
    if (cachedData) {
      console.log('All API attempts failed, returning stale cached data');
      return new Response(
        JSON.stringify(cachedData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    throw new Error(lastError || 'Failed to fetch crypto data from all available API keys');

  } catch (error) {
    console.error('Error in fetch-crypto-data function:', error);
    
    // Return cached data as last resort if available
    if (cachedData) {
      console.log('Error occurred, returning cached data as fallback');
      return new Response(
        JSON.stringify(cachedData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
