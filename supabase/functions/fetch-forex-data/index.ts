import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

async function fetchForexData(apiKey: string, currencies: string) {
  const BASE_CURRENCY = 'USD';
  const response = await fetch(
    `https://api.currencyfreaks.com/v2.0/rates/latest?apikey=${apiKey}&base=${BASE_CURRENCY}&symbols=${currencies}`
  );
  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BASE_CURRENCY = 'USD';
    const currencies = 'EUR,GBP,JPY,AUD,CAD,CHF,CNY,INR,NZD,SGD';
    
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    let lastError: any = null;

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const apiKey = await getActiveApiKey('currencyfreaks');
      
      if (!apiKey) {
        console.error('No active CurrencyFreaks API key available');
        break;
      }

      console.log(`Attempt ${attempts}: Using CurrencyFreaks API key`);
      
      try {
        const response = await fetchForexData(apiKey, currencies);

        if (response.ok) {
          const data = await response.json();
          
          if (!data.rates) {
            throw new Error('Failed to fetch forex data');
          }

          // Currency symbols and flags
          const currencyInfo: Record<string, { symbol: string; flag: string; name: string }> = {
            'EUR': { symbol: '€', flag: '🇪🇺', name: 'Euro' },
            'GBP': { symbol: '£', flag: '🇬🇧', name: 'British Pound' },
            'JPY': { symbol: '¥', flag: '🇯🇵', name: 'Japanese Yen' },
            'AUD': { symbol: 'A$', flag: '🇦🇺', name: 'Australian Dollar' },
            'CAD': { symbol: 'C$', flag: '🇨🇦', name: 'Canadian Dollar' },
            'CHF': { symbol: 'CHF', flag: '🇨🇭', name: 'Swiss Franc' },
            'CNY': { symbol: '¥', flag: '🇨🇳', name: 'Chinese Yuan' },
            'INR': { symbol: '₹', flag: '🇮🇳', name: 'Indian Rupee' },
            'NZD': { symbol: 'NZ$', flag: '🇳🇿', name: 'New Zealand Dollar' },
            'SGD': { symbol: 'S$', flag: '🇸🇬', name: 'Singapore Dollar' },
          };

          // Transform the data into the format expected by the frontend
          const forexData = Object.entries(data.rates).map(([currency, rate]) => {
            const info = currencyInfo[currency] || { symbol: currency, flag: '💱', name: currency };
            const rateNum = typeof rate === 'number' ? rate : parseFloat(rate as string);
            
            // Calculate a mock change percentage
            const changePercent = (Math.random() - 0.5) * 2;
            
            return {
              name: `${currency}/${BASE_CURRENCY}`,
              symbol: currency,
              price: rateNum.toFixed(4),
              change: `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
              isPositive: changePercent >= 0,
              icon: info.flag,
              currencySymbol: info.symbol,
              fullName: info.name,
            };
          });

          return new Response(
            JSON.stringify({ forexData }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if rate limit error
        if (response.status === 429) {
          const errorText = await response.text();
          console.error(`Rate limit hit for key, status ${response.status}:`, errorText);
          
          // Mark this key as inactive
          await markKeyAsInactive('currencyfreaks', apiKey);
          
          // Try next key
          console.log('Trying next available API key...');
          continue;
        }

        // Other errors
        const errorText = await response.text();
        lastError = `Forex API error ${response.status}: ${errorText}`;
        console.error(lastError);
        break;

      } catch (error) {
        lastError = error;
        console.error(`Error with key attempt ${attempts}:`, error);
        break;
      }
    }

    throw new Error(lastError || 'Failed to fetch forex data from all available API keys');

  } catch (error) {
    console.error('Error in fetch-forex-data function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
