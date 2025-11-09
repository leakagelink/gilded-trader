import { TrendingUp, TrendingDown, Activity, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

interface TradingItem {
  name: string;
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
  icon?: LucideIcon;
  logo?: string;
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

  const handleClick = (symbol: string) => {
    navigate(`/trading/${symbol.toLowerCase()}`);
  };

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const IconComponent = item.icon;
        return (
          <div
            key={index}
            onClick={() => handleClick(item.symbol)}
            className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-md cursor-pointer active:scale-[0.98]"
          >
            {/* Left: Icon and Name */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0 relative">
                {item.logo ? (
                  <img src={item.logo} alt={item.name} className="h-8 w-8" />
                ) : IconComponent ? (
                  <IconComponent className="h-6 w-6 text-primary" />
                ) : null}
                {/* Live momentum indicator */}
                {itemMomentum[index] && itemMomentum[index] !== 'neutral' && (
                  <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full animate-pulse ${
                    itemMomentum[index] === 'up' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base truncate flex items-center gap-1">
                  {item.name}
                  <Activity className={`h-3 w-3 transition-all duration-300 ${
                    itemMomentum[index] === 'up' ? 'text-green-500 animate-pulse' :
                    itemMomentum[index] === 'down' ? 'text-red-500 animate-pulse' :
                    'text-muted-foreground opacity-50'
                  }`} />
                </div>
                <div className={`text-sm font-medium flex items-center gap-1 ${
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
              </div>
            </div>
            
            {/* Right: Price and Percentage */}
            <div className="text-right flex-shrink-0 ml-3">
              <div className={`font-bold text-base sm:text-lg mb-1 transition-all duration-300 ${
                itemMomentum[index] === 'up' ? 'text-green-500 scale-105' :
                itemMomentum[index] === 'down' ? 'text-red-500 scale-105' :
                ''
              }`}>
                {item.price}
              </div>
              <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${
                item.isPositive 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {item.isPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {item.change}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TradingList;
