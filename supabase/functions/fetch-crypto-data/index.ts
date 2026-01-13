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

// Static fallback data for when all APIs fail
const STATIC_FALLBACK_DATA = {
  cryptoData: [
    { name: "Bitcoin", symbol: "BTC", price: "95000.00", change: "+2.50%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1.png", currencySymbol: "$", high24h: "96000.00", low24h: "93000.00", id: 1 },
    { name: "Ethereum", symbol: "ETH", price: "3200.00", change: "+3.20%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png", currencySymbol: "$", high24h: "3300.00", low24h: "3100.00", id: 1027 },
    { name: "Tether USDt", symbol: "USDT", price: "1.00", change: "+0.01%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png", currencySymbol: "$", high24h: "1.00", low24h: "1.00", id: 825 },
    { name: "XRP", symbol: "XRP", price: "2.30", change: "+5.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/52.png", currencySymbol: "$", high24h: "2.40", low24h: "2.20", id: 52 },
    { name: "BNB", symbol: "BNB", price: "650.00", change: "+1.80%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1839.png", currencySymbol: "$", high24h: "660.00", low24h: "640.00", id: 1839 },
    { name: "Solana", symbol: "SOL", price: "180.00", change: "+4.50%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png", currencySymbol: "$", high24h: "185.00", low24h: "175.00", id: 5426 },
    { name: "USDC", symbol: "USDC", price: "1.00", change: "0.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png", currencySymbol: "$", high24h: "1.00", low24h: "1.00", id: 3408 },
    { name: "Dogecoin", symbol: "DOGE", price: "0.15", change: "+8.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/74.png", currencySymbol: "$", high24h: "0.16", low24h: "0.14", id: 74 },
    { name: "Cardano", symbol: "ADA", price: "0.50", change: "+6.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/2010.png", currencySymbol: "$", high24h: "0.52", low24h: "0.48", id: 2010 },
    { name: "Chainlink", symbol: "LINK", price: "15.00", change: "+4.00%", isPositive: true, logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png", currencySymbol: "$", high24h: "15.50", low24h: "14.50", id: 1975 },
  ]
};

// Track rate-limited keys with their cooldown expiry time (in-memory for this edge function instance)
const rateLimitedKeys: Map<string, number> = new Map();
const RATE_LIMIT_COOLDOWN_MS = 60000; // 1 minute cooldown for rate-limited keys

async function getActiveApiKey(serviceName: string, excludeKeys: string[] = []) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // First, re-enable any keys that have completed their cooldown period
  await reEnableExpiredKeys(serviceName);
  
  // Get all keys for this service, ordered by priority
  const { data: allKeys, error } = await supabase
    .from('api_keys')
    .select('api_key, is_active, priority, last_used_at')
    .eq('service_name', serviceName)
    .order('priority', { ascending: true });
  
  if (error) {
    console.error('Error fetching API keys:', error);
    return null;
  }
  
  if (!allKeys || allKeys.length === 0) {
    return null;
  }
  
  // Find the first active key that's not in excludeKeys and not in cooldown
  const now = Date.now();
  for (const key of allKeys) {
    if (!key.api_key) continue;
    if (excludeKeys.includes(key.api_key)) continue;
    
    // Check if key is in cooldown
    const cooldownExpiry = rateLimitedKeys.get(key.api_key);
    if (cooldownExpiry && now < cooldownExpiry) {
      console.log(`Key is in cooldown, ${Math.ceil((cooldownExpiry - now) / 1000)}s remaining`);
      continue;
    }
    
    // If key was in cooldown but now expired, remove from map
    if (cooldownExpiry) {
      rateLimitedKeys.delete(key.api_key);
    }
    
    // If key is active, use it
    if (key.is_active) {
      // Update last_used_at
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('service_name', serviceName)
        .eq('api_key', key.api_key);
      
      return key.api_key;
    }
  }
  
  // If no active keys found, try to re-enable the first inactive key that's not in cooldown
  for (const key of allKeys) {
    if (!key.api_key) continue;
    if (excludeKeys.includes(key.api_key)) continue;
    
    const cooldownExpiry = rateLimitedKeys.get(key.api_key);
    if (cooldownExpiry && now < cooldownExpiry) continue;
    
    // Re-enable this key
    console.log(`Re-enabling inactive key (priority ${key.priority})`);
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ is_active: true, last_used_at: new Date().toISOString() })
      .eq('service_name', serviceName)
      .eq('api_key', key.api_key);
    
    if (!updateError) {
      return key.api_key;
    }
  }
  
  return null;
}

async function reEnableExpiredKeys(serviceName: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const now = Date.now();
  
  // Check for keys that have been inactive for more than 1 minute
  const oneMinuteAgo = new Date(now - RATE_LIMIT_COOLDOWN_MS).toISOString();
  
  // Re-enable keys that were disabled more than 1 minute ago
  const { data: inactiveKeys, error } = await supabase
    .from('api_keys')
    .select('api_key, last_used_at')
    .eq('service_name', serviceName)
    .eq('is_active', false);
  
  if (error || !inactiveKeys) return;
  
  for (const key of inactiveKeys) {
    // Check if not in cooldown map or cooldown expired
    const cooldownExpiry = rateLimitedKeys.get(key.api_key);
    if (!cooldownExpiry || now >= cooldownExpiry) {
      // Check if last_used_at is more than 1 minute ago
      if (key.last_used_at && new Date(key.last_used_at).getTime() < now - RATE_LIMIT_COOLDOWN_MS) {
        console.log(`Re-enabling key after cooldown period`);
        await supabase
          .from('api_keys')
          .update({ is_active: true })
          .eq('service_name', serviceName)
          .eq('api_key', key.api_key);
        
        rateLimitedKeys.delete(key.api_key);
      }
    }
  }
}

async function markKeyAsRateLimited(serviceName: string, apiKey: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Add to in-memory cooldown map
  rateLimitedKeys.set(apiKey, Date.now() + RATE_LIMIT_COOLDOWN_MS);
  
  // Temporarily disable in database
  const { error } = await supabase
    .from('api_keys')
    .update({ 
      is_active: false,
      last_used_at: new Date().toISOString()
    })
    .eq('service_name', serviceName)
    .eq('api_key', apiKey);
  
  if (error) {
    console.error('Error marking key as rate-limited:', error);
  } else {
    console.log(`Marked ${serviceName} key as rate-limited for 60 seconds - will auto re-enable`);
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

async function fetchCryptoDataFromCoinGecko() {
  console.log('Attempting to fetch from CoinGecko API (free fallback)...');
  const response = await fetch(
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h'
  );

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Transform CoinGecko data to match our app's format
  const cryptoData = data.map((coin: any) => {
    const changePercent = coin.price_change_percentage_24h || 0;
    
    return {
      name: coin.name,
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price.toFixed(2),
      change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
      isPositive: changePercent >= 0,
      logo: coin.image,
      currencySymbol: '$',
      high24h: coin.high_24h?.toFixed(2) || coin.current_price.toFixed(2),
      low24h: coin.low_24h?.toFixed(2) || coin.current_price.toFixed(2),
      id: coin.id,
    };
  });

  return { cryptoData };
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
    const usedKeys: string[] = [];

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      let apiKey = await getActiveApiKey('coinmarketcap', usedKeys);
      
      // Fallback to secret if no database keys configured
      if (!apiKey) {
        apiKey = Deno.env.get('COINMARKETCAP_API_KEY');
        if (!apiKey) {
          console.error('No active CoinMarketCap API key available and no secret configured');
          lastError = 'No API key available';
          break;
        }
        console.log('Using fallback API key from secrets');
      } else {
        usedKeys.push(apiKey);
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
          
          // Mark the current key as rate-limited
          if (apiKey) {
            await markKeyAsRateLimited('coinmarketcap', apiKey);
          }
          
          // Try next key
          console.log('Trying next available API key...');
          continue;
        }

        // Other errors - log detailed info
        const errorText = await response.text();
        lastError = `API error ${response.status}: ${errorText}`;
        console.error('CoinMarketCap API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          attempt: attempts
        });
        
        // For non-rate-limit errors, break instead of continuing
        // This prevents exhausting all attempts on persistent errors
        break;

      } catch (error) {
        lastError = error;
        console.error(`Error with key attempt ${attempts}:`, error);
        break;
      }
    }

    // If all CoinMarketCap attempts failed, try CoinGecko as fallback
    console.log('All CoinMarketCap API attempts failed, trying CoinGecko fallback...');
    try {
      const coinGeckoData = await fetchCryptoDataFromCoinGecko();
      
      // Update cache with CoinGecko data
      cachedData = coinGeckoData;
      cacheTimestamp = now;
      
      console.log('Successfully fetched crypto data from CoinGecko fallback');
      return new Response(
        JSON.stringify(coinGeckoData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } catch (coinGeckoError) {
      console.error('CoinGecko fallback also failed:', coinGeckoError);
      
      // If CoinGecko also fails, return cached data if available
      if (cachedData) {
        console.log('All API sources failed, returning stale cached data');
        return new Response(
          JSON.stringify(cachedData),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
      
      // Return static fallback data as last resort
      console.log('All API sources failed, returning static fallback data');
      return new Response(
        JSON.stringify(STATIC_FALLBACK_DATA),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

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
    
    // Return static fallback data instead of error
    console.log('Error occurred, returning static fallback data');
    return new Response(
      JSON.stringify(STATIC_FALLBACK_DATA),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
