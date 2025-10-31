import { Button } from "@/components/ui/button";
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
    <div className="space-y-3">
      {data.map((item, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <span className="text-sm font-bold">{item.symbol.slice(0, 2)}</span>
            </div>
            <div>
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm text-muted-foreground">{item.symbol}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="font-semibold text-lg">{item.price}</div>
              <div className={`text-sm flex items-center gap-1 ${item.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {item.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {item.change}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="hover:bg-green-600/10 hover:text-green-600 hover:border-green-600">
                Buy
              </Button>
              <Button size="sm" variant="outline" className="hover:bg-red-600/10 hover:text-red-600 hover:border-red-600">
                Sell
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TradingList;
