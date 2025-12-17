import { TrendingUp, TrendingDown, Activity, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

interface TradingItem {
  name: string;
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
  icon?: LucideIcon | string;
  logo?: string;
  currencySymbol?: string;
  high24h?: string;
  low24h?: string;
}

interface TradingListProps {
  data: TradingItem[];
}

const TradingList = ({ data }: TradingListProps) => {
  const navigate = useNavigate();
  const [itemMomentum, setItemMomentum] = useState<Record<number, 'up' | 'down' | 'neutral'>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Simulate real-time momentum updates every second
    intervalRef.current = setInterval(() => {
      const newMomentum: Record<number, 'up' | 'down' | 'neutral'> = {};
      data.forEach((_, index) => {
        const rand = Math.random();
        if (rand > 0.55) {
          newMomentum[index] = 'up';
        } else if (rand < 0.45) {
          newMomentum[index] = 'down';
        } else {
          newMomentum[index] = 'neutral';
        }
      });
      setItemMomentum(newMomentum);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [data.length]);

  const handleClick = (item: TradingItem) => {
    navigate(`/trading/${item.symbol.toLowerCase()}`, {
      state: { 
        price: item.price,
        name: item.name,
        logo: item.logo,
        icon: item.icon,
        currencySymbol: item.currencySymbol || '$'
      }
    });
  };

  return (
    <div className="space-y-2 sm:space-y-3">
      {data.map((item, index) => {
        const IconComponent = item.icon;
        return (
          <div
            key={index}
            onClick={() => handleClick(item)}
            className="flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-md cursor-pointer active:scale-[0.98]"
          >
            {/* Left: Icon and Name */}
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 overflow-hidden">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 relative">
                {item.logo ? (
                  <img src={item.logo} alt={item.name} className="h-6 w-6 sm:h-8 sm:w-8" />
                ) : typeof item.icon === 'string' ? (
                  <span className="text-xl sm:text-2xl">{item.icon}</span>
                ) : IconComponent ? (
                  <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                ) : null}
                {/* Live momentum indicator */}
                {itemMomentum[index] && itemMomentum[index] !== 'neutral' && (
                  <div className={`absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full animate-pulse ${
                    itemMomentum[index] === 'up' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                )}
              </div>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="font-bold text-sm sm:text-base truncate flex items-center gap-1">
                  <span className="truncate">{item.name}</span>
                  <Activity className={`h-3 w-3 flex-shrink-0 transition-all duration-300 ${
                    itemMomentum[index] === 'up' ? 'text-green-500 animate-pulse' :
                    itemMomentum[index] === 'down' ? 'text-red-500 animate-pulse' :
                    'text-muted-foreground opacity-50'
                  }`} />
                </div>
                <div className={`text-xs sm:text-sm font-medium flex items-center gap-1 ${
                  item.isPositive 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {item.change}
                  {itemMomentum[index] && (
                    <span className={`text-xs transition-all duration-300 ${
                      itemMomentum[index] === 'up' ? 'text-green-500' :
                      itemMomentum[index] === 'down' ? 'text-red-500' :
                      'text-muted-foreground'
                    }`}>
                      {itemMomentum[index] === 'up' ? '↗' : itemMomentum[index] === 'down' ? '↘' : '→'}
                    </span>
                  )}
                </div>
                {item.high24h && item.low24h && (
                  <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 flex gap-1.5 sm:gap-2">
                    <span className="text-green-600 dark:text-green-400">H: {item.currencySymbol || '$'}{item.high24h}</span>
                    <span className="text-red-600 dark:text-red-400">L: {item.currencySymbol || '$'}{item.low24h}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Right: Price and Percentage */}
            <div className="text-right flex-shrink-0 ml-2 sm:ml-3">
              <div className={`font-bold text-sm sm:text-lg mb-0.5 sm:mb-1 transition-all duration-300 ${
                itemMomentum[index] === 'up' ? 'text-green-500 scale-105' :
                itemMomentum[index] === 'down' ? 'text-red-500 scale-105' :
                ''
              }`}>
                {item.currencySymbol || '$'}{item.price}
              </div>
              <div className={`text-xs sm:text-sm font-semibold flex items-center justify-end gap-0.5 sm:gap-1 ${
                item.isPositive 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {item.isPositive ? (
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
                ) : (
                  <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
                <span className="hidden xs:inline">{item.change}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TradingList;
