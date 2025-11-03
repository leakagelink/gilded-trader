import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const COINMARKETCAP_API_KEY = Deno.env.get('COINMARKETCAP_API_KEY');
    
    if (!COINMARKETCAP_API_KEY) {
      throw new Error('COINMARKETCAP_API_KEY not configured');
    }

    console.log('Fetching crypto data from CoinMarketCap...');

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
      throw new Error(`CoinMarketCap API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Successfully fetched crypto data');

    // Transform the data to match our app's format
    const cryptoData = data.data.map((coin: any) => ({
      name: coin.name,
      symbol: coin.symbol,
      price: `$${coin.quote.USD.price.toFixed(2)}`,
      change: `${coin.quote.USD.percent_change_24h >= 0 ? '+' : ''}${coin.quote.USD.percent_change_24h.toFixed(2)}%`,
      isPositive: coin.quote.USD.percent_change_24h >= 0,
      logo: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`,
      id: coin.id,
    }));

    return new Response(
      JSON.stringify({ cryptoData }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in fetch-crypto-data function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
