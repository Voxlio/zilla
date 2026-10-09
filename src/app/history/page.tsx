"use client";

import { useState, useEffect, useCallback } from "react";
import { RotateCw, Check, X, Loader, Loader2, RefreshCw, TrendingUp, TrendingDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getAllHistory, getFilteredHistory, updateTradeOutcome, clearHistory, getHistoryStats } from "@/lib/history/utils";
import type { HistoryEntry } from "@/lib/history/types";
import { candleApi } from "@/lib/api/candles";
import { TradeIdea } from "@/lib/analysis/types";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<{ 
    symbol?: string; 
    direction?: "buy" | "sell"; 
    outcome?: "tp1" | "tp2" | "sl" | "pending" | "expired";
    startDate?: string;
    endDate?: string;
    minConfidence?: number;
  }>({});
  const [stats, setStats] = useState<{
    totalTrades: number;
    closedTrades: number;
    winRate: number;
    totalR: number;
    avgR: number;
    bestR: number;
  }>({
    totalTrades: 0,
    closedTrades: 0,
    winRate: 0,
    totalR: 0,
    avgR: 0,
    bestR: 0,
  });

  // Fetch history and stats
  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const historyData = await getFilteredHistory(filters);
      setHistory(historyData);
      
      // Update outcomes based on latest candle data
      await updateOutcomes(historyData);
      
      const statsData = await getHistoryStats();
      setStats(statsData);
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Update trade outcomes with latest candle data
  const updateOutcomes = useCallback(async (trades: HistoryEntry[]) => {
    try {
      // For each trade, we need to fetch candles since the trade was made
      // This is simplified - in production you'd want to batch these requests
      for (const trade of trades) {
        if (trade.outcome === "pending") {
          // Fetch D1 candles since trade timestamp to check outcomes
          const fromTime = Math.floor(trade.timestamp / 1000);
          const toTime = Math.floor(Date.now() / 1000);
          
          // We'll use a simplified approach - in reality you'd need to fetch
          // the appropriate timeframe candles and check for SL/TP hits
          // For now, we'll just simulate some outcomes for demonstration
          await updateTradeOutcome(trade.id, []); // Pass empty array for now
        }
      }
    } catch (error) {
      console.error("Error updating outcomes:", error);
    }
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback(async (filters: any) => {
    setFilters(filters);
    await fetchHistory();
  }, [fetchHistory]);

  // Handle clear history
  const handleClearHistory = useCallback(async () => {
    if (window.confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      await clearHistory();
      await fetchHistory();
    }
  }, [fetchHistory]);

  // Fetch initial data
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Refetch when filters change
  useEffect(() => {
    fetchHistory();
  }, [filters, fetchHistory]);

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get outcome badge
  const getOutcomeBadge = (outcome: HistoryEntry["outcome"] | undefined) => {
    switch (outcome) {
      case "tp1":
        return <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">TP1</Badge>;
      case "tp2":
        return <Badge variant="outline" className="text-emerald-500 border-emerald-500/50">TP2</Badge>;
      case "sl":
        return <Badge variant="outline" className="text-red-500 border-red-500/50">SL</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-muted-foreground border-muted/50">Pending</Badge>;
      case "expired":
        return <Badge variant="outline" className="text-amber-500 border-amber-500/50">Expired</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground border-muted/50">Unknown</Badge>;
    }
  };

  // Get direction badge
  const getDirectionBadge = (direction: "buy" | "sell") => (
    <Badge className={`gap-1 ${direction === "buy" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
      {direction === "buy" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {direction.toUpperCase()}
    </Badge>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                <span className="text-white font-bold text-lg">Z</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight">History</h1>
            </div>
            <nav className="flex items-center gap-4">
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Home
              </a>
              <a href="/scorecard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Scorecard
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Section */}
        <section className="mb-8">
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Trades</p>
                  <p className="text-2xl font-bold">{stats.totalTrades}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Closed Trades</p>
                  <p className="text-2xl font-bold">{stats.closedTrades}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Win Rate</p>
                  <p className="text-2xl font-bold">{stats.winRate}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total R</p>
                  <p className="text-2xl font-bold text-emerald-400">+{stats.totalR}R</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Average R</p>
                  <p className="text-2xl font-bold">{stats.avgR}R</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Best R</p>
                  <p className="text-2xl font-bold text-emerald-400">+{stats.bestR}R</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Filters Section */}
        <section className="mb-8">
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="symbol-filter" className="block text-sm font-medium text-muted-foreground mb-2">
                      Symbol
                    </label>
                    <Select defaultValue="XAUUSD" onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, symbol: value || undefined }));
                      fetchHistory();
                    }}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XAUUSD">XAU/USD</SelectItem>
                        <SelectItem value="">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="direction-filter" className="block text-sm font-medium text-muted-foreground mb-2">
                      Direction
                    </label>
                    <Select defaultValue="" onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, direction: value as any || undefined }));
                      fetchHistory();
                    }}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="outcome-filter" className="block text-sm font-medium text-muted-foreground mb-2">
                      Outcome
                    </label>
                    <Select defaultValue="" onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, outcome: value as any || undefined }));
                      fetchHistory();
                    }}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        <SelectItem value="tp1">TP1</SelectItem>
                        <SelectItem value="tp2">TP2</SelectItem>
                        <SelectItem value="sl">SL</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="min-confidence-filter" className="block text-sm font-medium text-muted-foreground mb-2">
                      Min Confidence
                    </label>
                    <Select defaultValue="" onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, minConfidence: value ? parseInt(value) : undefined }));
                      fetchHistory();
                    }}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        <SelectItem value="50">50%</SelectItem>
                        <SelectItem value="70">70%</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setFilters({})}
                    className="h-10 px-4"
                  >
                    Reset Filters
                  </Button>
                  <Button
                    onClick={handleClearHistory}
                    className="h-10 px-4 bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30 hover:border-destructive/40"
                  >
                    Clear History
                  </Button>
                  <Button
                    onClick={fetchHistory}
                    className="h-10 px-4"
                  >
                    <RotateCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* History Table */}
        <section className="mb-8">
          {isLoading ? (
            <Card className="bg-card/50 border-border/30">
              <CardContent className="p-12 text-center">
                <Loader2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Loading history...</p>
              </CardContent>
            </Card>
          ) : history.length === 0 ? (
            <Card className="bg-card/50 border-border/30">
              <CardContent className="p-12 text-center">
                <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No trades found matching your filters.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card/50 border-border/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Trade History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border/50">
                    <thead>
                      <tr className="bg-background/50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Symbol
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Direction
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Entry
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          SL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          TP1
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          TP2
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          RR
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Conf
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Outcome
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          R
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {history.map((trade, index) => (
                        <tr key={trade.id} className="hover:bg-background/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {formatDate(trade.date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {formatTimestamp(trade.timestamp)}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {trade.symbol}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {getDirectionBadge(trade.direction as "buy" | "sell")}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            ${trade.entry.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            ${trade.stopLoss.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            ${trade.takeProfit1.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            ${trade.takeProfit2.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            1:{trade.riskReward.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground">
                            {trade.confidence}%
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {getOutcomeBadge(trade.outcome)}
                          </td>
                          <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                            {trade.outcomeR !== undefined ? 
                              (trade.outcomeR > 0 ? `+${trade.outcomeR.toFixed(2)}R` : `${trade.outcomeR.toFixed(2)}R`) : 
                              "-"
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Educational only, not financial advice. Trading carries risk.
        </div>
      </footer>
    </div>
  );
}