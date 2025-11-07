import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate realistic fallback data when TAAPI is unavailable
function generateFallbackCandles(symbol: string, interval: string, count: number = 20) {
  console.log(`Generating fallback data for ${symbol}`);
  
  const now = Date.now();
  const intervalMs = getIntervalMilliseconds(interval);
  const basePrice = getBasePrice(symbol);
  
  const candles = [];
  let prevClose = basePrice;
  
  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - (i * intervalMs);
    const volatility = prevClose * 0.02; // 2% volatility
    
    const open = prevClose;
    const close = open + (Math.random() - 0.5) * volatility * 2;
    const high = Math.max(open, close) + Math.random() * volatility;
    const low = Math.min(open, close) - Math.random() * volatility;
    const volume = Math.random() * 1000000;
    
    candles.push({
      timestamp: Math.floor(timestamp / 1000),
      timestampHuman: new Date(timestamp).toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(2))
    });
    
    prevClose = close;
  }
  
  return candles;
}

function getIntervalMilliseconds(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return map[interval] || 60 * 60 * 1000;
}

function getBasePrice(symbol: string): number {
  const prices: Record<string, number> = {
    'BTC': 102000,
    'ETH': 3350,
    'BNB': 970,
    'SOL': 158,
    'XRP': 2.23,
    'ADA': 0.55,
    'DOGE': 0.17,
    'TRX': 0.29,
    'DOT': 4.50,
    'MATIC': 0.40,
  };
  return prices[symbol.toUpperCase()] || 100;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, interval = '1h' } = await req.json();
    const TAAPI_API_KEY = Deno.env.get('TAAPI_API_KEY');

    if (!TAAPI_API_KEY) {
      console.log('TAAPI_API_KEY not configured, using fallback data');
      const fallbackCandles = generateFallbackCandles(symbol, interval);
      const currentPrice = fallbackCandles[fallbackCandles.length - 1].close;
      
      return new Response(
        JSON.stringify({ 
          candles: fallbackCandles,
          currentPrice,
          symbol,
          source: 'fallback'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Attempting to fetch TAAPI data for ${symbol} with interval ${interval}`);

    try {
      // Try to fetch from TAAPI with reduced candles
      const candleResponse = await fetch(
        `https://api.taapi.io/candles?secret=${TAAPI_API_KEY}&exchange=binance&symbol=${symbol}/USDT&interval=${interval}&backtracks=10`,
        { signal: AbortSignal.timeout(5000) } // 5 second timeout
      );

      if (!candleResponse.ok) {
        if (candleResponse.status === 429) {
          console.log('TAAPI rate limit hit, using fallback data');
          throw new Error('RATE_LIMIT');
        } else if (candleResponse.status === 401) {
          console.log('TAAPI authentication failed, using fallback data');
          throw new Error('AUTH_ERROR');
        }
        throw new Error(`TAAPI_ERROR_${candleResponse.status}`);
      }

      const candles = await candleResponse.json();

      // Try to fetch current price
      let currentPrice = candles[candles.length - 1]?.close || 0;
      try {
        const priceResponse = await fetch(
          `https://api.taapi.io/price?secret=${TAAPI_API_KEY}&exchange=binance&symbol=${symbol}/USDT`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          currentPrice = priceData.value || currentPrice;
        }
      } catch {
        console.log('Could not fetch current price, using last candle close');
      }

      console.log(`Successfully fetched ${candles.length} candles from TAAPI for ${symbol}`);

      return new Response(
        JSON.stringify({ 
          candles: candles.reverse(),
          currentPrice,
          symbol,
          source: 'taapi'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (taapiError) {
      // If TAAPI fails for any reason, use fallback
      const errorMessage = taapiError instanceof Error ? taapiError.message : 'UNKNOWN';
      console.log(`TAAPI error (${errorMessage}), using fallback data`);
      
      const fallbackCandles = generateFallbackCandles(symbol, interval);
      const currentPrice = fallbackCandles[fallbackCandles.length - 1].close;
      
      return new Response(
        JSON.stringify({ 
          candles: fallbackCandles,
          currentPrice,
          symbol,
          source: 'fallback',
          reason: errorMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    
    // Even on unexpected errors, return fallback data
    const fallbackCandles = generateFallbackCandles('BTC', '1h');
    return new Response(
      JSON.stringify({ 
        candles: fallbackCandles,
        currentPrice: fallbackCandles[fallbackCandles.length - 1].close,
        symbol: 'BTC',
        source: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 200, // Return 200 even on error so app works
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
