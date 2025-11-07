import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                {item.logo ? (
                  <img src={item.logo} alt={item.name} className="h-8 w-8" />
                ) : IconComponent ? (
                  <IconComponent className="h-6 w-6 text-primary" />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base truncate">{item.name}</div>
                <div className={`text-sm font-medium ${
                  item.isPositive 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {item.change}
                </div>
              </div>
            </div>
            
            {/* Right: Price and Percentage */}
            <div className="text-right flex-shrink-0 ml-3">
              <div className="font-bold text-lg mb-1">{item.price}</div>
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
