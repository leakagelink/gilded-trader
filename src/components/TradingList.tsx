import { TrendingUp, TrendingDown } from "lucide-react";

interface TradingItem {
  name: string;
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
}

interface TradingListProps {
  data: TradingItem[];
}

const TradingList = ({ data }: TradingListProps) => {
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-border/50 bg-gradient-to-r from-card/80 to-card/50 hover:from-card hover:to-card/80 transition-all duration-300 hover:shadow-lg hover:scale-[1.01]"
        >
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
              <span className="text-xs sm:text-sm font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                {item.symbol.slice(0, 2)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm sm:text-base truncate">{item.name}</div>
              <div className="text-xs text-muted-foreground">{item.symbol}</div>
            </div>
          </div>
          
          <div className="text-right flex-shrink-0 ml-2">
            <div className="font-bold text-base sm:text-lg mb-0.5">{item.price}</div>
            <div className={`text-xs sm:text-sm flex items-center justify-end gap-1 font-medium ${
              item.isPositive 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-red-600 dark:text-red-400'
            }`}>
              {item.isPositive ? (
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" />
              ) : (
                <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
              {item.change}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TradingList;
