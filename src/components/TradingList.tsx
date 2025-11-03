import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

interface TradingItem {
  name: string;
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
  icon: LucideIcon;
}

interface TradingListProps {
  data: TradingItem[];
}

const TradingList = ({ data }: TradingListProps) => {
  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const IconComponent = item.icon;
        return (
          <div
            key={index}
            className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-md"
          >
            {/* Left: Icon and Name */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                <IconComponent className="h-6 w-6 text-primary" />
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
