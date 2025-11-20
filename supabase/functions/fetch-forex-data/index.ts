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
    const FOREX_API_KEY = '771a6df812534a988b65f88bc25d6fea';
    const BASE_CURRENCY = 'USD';
    
    // Major forex pairs to fetch
    const currencies = 'EUR,GBP,JPY,AUD,CAD,CHF,CNY,INR,NZD,SGD';
    
    const response = await fetch(
      `https://api.currencyfreaks.com/v2.0/rates/latest?apikey=${FOREX_API_KEY}&base=${BASE_CURRENCY}&symbols=${currencies}`
    );

    if (!response.ok) {
      throw new Error(`Forex API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // CurrencyFreaks API doesn't have a success field, just check if rates exist
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
      
      // Calculate a mock change percentage (in real app, you'd compare with previous data)
      const changePercent = (Math.random() - 0.5) * 2; // Random between -1% and +1%
      
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
