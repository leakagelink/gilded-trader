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
    const { symbol, interval = '1h' } = await req.json();
    const TAAPI_API_KEY = Deno.env.get('TAAPI_API_KEY');

    if (!TAAPI_API_KEY) {
      throw new Error('TAAPI_API_KEY not configured');
    }

    console.log(`Fetching TAAPI data for ${symbol} with interval ${interval}`);

    // Fetch candle data from TAAPI (reduced to 20 candles to avoid rate limits)
    const candleResponse = await fetch(
      `https://api.taapi.io/candles?secret=${TAAPI_API_KEY}&exchange=binance&symbol=${symbol}/USDT&interval=${interval}&backtracks=20`
    );

    if (!candleResponse.ok) {
      const errorText = await candleResponse.text();
      console.error('TAAPI Error:', errorText);
      
      // Provide user-friendly error messages
      if (candleResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (candleResponse.status === 401) {
        throw new Error('Invalid TAAPI API key. Please check your configuration.');
      } else {
        throw new Error(`TAAPI API error: ${candleResponse.status}`);
      }
    }

    const candles = await candleResponse.json();

    // Fetch current price
    const priceResponse = await fetch(
      `https://api.taapi.io/price?secret=${TAAPI_API_KEY}&exchange=binance&symbol=${symbol}/USDT`
    );

    let currentPrice = 0;
    if (priceResponse.ok) {
      const priceData = await priceResponse.json();
      currentPrice = priceData.value || 0;
    }

    console.log(`Successfully fetched ${candles.length} candles for ${symbol}`);

    return new Response(
      JSON.stringify({ 
        candles: candles.reverse(), // Reverse to get chronological order
        currentPrice,
        symbol
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error fetching TAAPI data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
