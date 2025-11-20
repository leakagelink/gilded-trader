import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache to prevent hitting CoinMarketCap API rate limits
let cachedData: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 60000; // 60 seconds cache to match API rate limit

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

    const COINMARKETCAP_API_KEY = Deno.env.get('COINMARKETCAP_API_KEY');
    
    if (!COINMARKETCAP_API_KEY) {
      throw new Error('COINMARKETCAP_API_KEY not configured');
    }

    console.log('Fetching fresh crypto data from CoinMarketCap...');

    // Fetch latest cryptocurrency listings
    const response = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=20',
      {
        headers: {
          'X-CMC_PRO_API_KEY': COINMARKETCAP_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CoinMarketCap API error:', response.status, errorText);
      
      // If we have cached data and hit rate limit, return stale cache
      if (response.status === 429 && cachedData) {
        console.log('Rate limit hit, returning stale cached data');
        return new Response(
          JSON.stringify(cachedData),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      throw new Error(`CoinMarketCap API error: ${response.status}`);
    }

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
