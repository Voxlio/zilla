"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, RefreshCw, Download, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tradeApi, TradeResponse } from "@/lib/api/trade";
import { candleApi, CandleData } from "@/lib/api/candles";
import { Candle } from "@/lib/analysis/types";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, ColorType } from "lightweight-charts";
import { generateFullReport } from "@/lib/explain/generator";
import { TradeIdea } from "@/lib/analysis/types";
import { saveTradeToHistory } from "@/lib/history/utils";
import { format } from "date-fns";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("XAUUSD");
  const [trade, setTrade] = useState<TradeIdea | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<"M15" | "H1" | "H4" | "D1">("M15");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [activeTab, setActiveTab] = useState("report");
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current || chartInstance.current) return;

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: "#0d0d0d" },
        textColor: "#e0e0e0",
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      rightPriceScale: {
        borderColor: "#1a1a1a",
      },
      timeScale: {
        borderColor: "#1a1a1a",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 0,
      },
    });

    chartInstance.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    candleSeriesRef.current = candleSeries;

    // Handle resize
    const handleResize = () => {
      if (chartRef.current) {
        chart.applyOptions({
          width: chartRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartInstance.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  // Update chart with candles
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    // Convert our candle format to lightweight-charts format
    const chartData = candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(chartData);

    // Add trade lines if we have a trade
    if (trade && candleSeriesRef.current) {
      addTradeLines(trade);
    }
  }, [candles, trade]);

  // Add trade lines to chart
  const addTradeLines = (trade: TradeIdea) => {
    if (!candleSeriesRef.current) return;

    const { entry, stopLoss, takeProfit1, takeProfit2, direction } = trade;

    // Entry line
    candleSeriesRef.current.createPriceLine({
      price: entry,
      color: "#10b981",
      lineWidth: 2,
      lineStyle: 0,
      axisLabelVisible: true,
      title: `Entry: ${entry.toFixed(2)}`,
    });

    // Stop Loss line
    candleSeriesRef.current.createPriceLine({
      price: stopLoss,
      color: "#ef4444",
      lineWidth: 2,
      lineStyle: 1,
      axisLabelVisible: true,
      title: `SL: ${stopLoss.toFixed(2)}`,
    });

    // TP1 line
    candleSeriesRef.current.createPriceLine({
      price: takeProfit1,
      color: "#3b82f6",
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `TP1: ${takeProfit1.toFixed(2)}`,
    });

    // TP2 line
    candleSeriesRef.current.createPriceLine({
      price: takeProfit2,
      color: "#8b5cf6",
      lineWidth: 2,
      lineStyle: 2,
      axisLabelVisible: true,
      title: `TP2: ${takeProfit2.toFixed(2)}`,
    });
  };

  // Fetch candles for the selected timeframe
  const fetchCandles = useCallback(async (tf: "M15" | "H1" | "H4" | "D1") => {
    try {
      const intervalMap = {
        M15: "15min",
        H1: "1h",
        H4: "4h",
        D1: "daily",
      };

      const response = await candleApi.getCandles("XAU/USD", intervalMap[tf]);
      if (response.candles && response.candles.length > 0) {
        setCandles(response.candles);
      }
    } catch (err) {
      console.error("Error fetching candles:", err);
    }
  }, []);

  // Fetch candles when timeframe changes
  useEffect(() => {
    fetchCandles(timeframe);
  }, [timeframe, fetchCandles]);

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await tradeApi.generateTrade(searchQuery.trim());
      if (response.trade) {
        setTrade(response.trade);
        // Save to history
        await saveTradeToHistory(response.trade);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      setError("Failed to generate trade idea. Please try again.");
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle regenerate
  const handleRegenerate = async () => {
    if (!trade) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await tradeApi.generateTrade(searchQuery.trim(), true);
      if (response.trade) {
        setTrade(response.trade);
        await saveTradeToHistory(response.trade);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      setError("Failed to regenerate trade idea.");
      console.error("Regenerate error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Get direction badge
  const getDirectionBadge = (direction: "buy" | "sell") => (
    <Badge className={`gap-1 ${direction === "buy" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
      {direction === "buy" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {direction.toUpperCase()}
    </Badge>
  );

  // Get R-multiple display
  const getRMultipleDisplay = (trade: TradeIdea) => {
    const risk = Math.abs(trade.entry - trade.stopLoss);
    const r1 = Math.abs(trade.takeProfit1 - trade.entry) / risk;
    const r2 = Math.abs(trade.takeProfit2 - trade.entry) / risk;
    return { r1: r1.toFixed(2), r2: r2.toFixed(2) };
  };

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
              <h1 className="text-2xl font-bold tracking-tight">Zilla</h1>
            </div>
            <nav className="flex items-center gap-4">
              <a href="/history" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                History
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
        {/* Search Section */}
        <section className="mb-8">
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex-1">
                  <label htmlFor="search" className="block text-sm font-medium text-muted-foreground mb-2">
                    Search Asset
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        id="search"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="XAUUSD, Gold, XAU/USD..."
                        className="w-full pl-10 pr-4 py-3 bg-background border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                        disabled={isLoading}
                      />
                    </div>
                    <Button
                      onClick={handleSearch}
                      disabled={isLoading || !searchQuery.trim()}
                      className="h-11 px-6"
                      size="default"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Analyzing...
                        </span>
                      ) : (
                        "Analyze"
                      )}
                    </Button>
                  </div>
                </div>
                {trade && (
                  <Button
                    onClick={handleRegenerate}
                    variant="outline"
                    className="h-11 px-4"
                    size="default"
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Error Display */}
        {error && (
          <Card className="mb-8 border-destructive/50 bg-destructive/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-destructive">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trade Idea Card */}
        {trade && (
          <>
            <section className="mb-8">
              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-900/5 border-emerald-500/30">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Direction</p>
                      <div className="flex items-center gap-2">
                        {getDirectionBadge(trade.direction)}
                        <span className="text-2xl font-bold">
                          {trade.direction === "buy" ? "LONG" : "SHORT"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Entry</p>
                      <p className="text-2xl font-bold">${trade.entry.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Stop Loss</p>
                      <p className="text-2xl font-bold text-red-400">${trade.stopLoss.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Risk</p>
                      <p className="text-2xl font-bold">${Math.abs(trade.entry - trade.stopLoss).toFixed(2)}</p>
                    </div>
                    <div className="lg:col-span-2">
                      <p className="text-sm text-muted-foreground mb-1">Take Profits</p>
                      <div className="flex flex-wrap gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">TP1</p>
                          <p className="text-xl font-bold text-blue-400">${trade.takeProfit1.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">TP2</p>
                          <p className="text-xl font-bold text-purple-400">${trade.takeProfit2.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">R:R</p>
                      <p className="text-2xl font-bold text-emerald-400">1:{trade.riskReward.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Confidence</p>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${trade.confidence}%` }}
                          />
                        </div>
                        <span className="text-xl font-bold">{trade.confidence}%</span>
                      </div>
                    </div>
                    <div className="lg:col-span-4">
                      <Separator className="my-4" />
                      <p className="text-sm text-muted-foreground text-center">
                        {trade.disclaimer}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Chart Section */}
            <section className="mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="text-lg">Price Chart</CardTitle>
                  <Select value={timeframe} onValueChange={(v) => setTimeframe(v as any)}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M15">M15 (15 min)</SelectItem>
                      <SelectItem value="H1">H1 (1 hour)</SelectItem>
                      <SelectItem value="H4">H4 (4 hours)</SelectItem>
                      <SelectItem value="D1">D1 (Daily)</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    ref={chartRef}
                    className="w-full h-[500px]"
                    style={{ width: "100%", height: "500px" }}
                  />
                </CardContent>
              </Card>
            </section>

            {/* Report Section */}
            <section className="mb-8">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="report">Full Report</TabsTrigger>
                  <TabsTrigger value="why">Why This Trade</TabsTrigger>
                  <TabsTrigger value="simple">Simple Summary</TabsTrigger>
                </TabsList>
                
                <TabsContent value="report" className="mt-4 space-y-6">
                  {(() => {
                    const report = generateFullReport(trade);
                    const r = report.analysisReport;
                    return (
                      <div className="space-y-6">
                        {/* Daily Thesis */}
                        <Card className={`border-l-4 ${r.dailyThesis.badge === "bullish" ? "border-emerald-500" : "border-red-500"}`}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">
                                {r.dailyThesis.badge === "bullish" ? (
                                  <TrendingUp className="h-5 w-5 text-emerald-500 inline mr-2" />
                                ) : (
                                  <TrendingDown className="h-5 w-5 text-red-500 inline mr-2" />
                                )}
                                {r.dailyThesis.title}
                              </CardTitle>
                              <Badge variant="outline" className={r.dailyThesis.badge === "bullish" ? "border-emerald-500 text-emerald-400" : "border-red-500 text-red-400"}>
                                {r.dailyThesis.badge.toUpperCase()}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-muted-foreground">{r.dailyThesis.summary}</p>
                          </CardContent>
                        </Card>

                        {/* Current Price Action */}
                        <Card>
                          <CardHeader>
                            <CardTitle>{r.currentPriceAction.title}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-muted-foreground">{r.currentPriceAction.content}</p>
                          </CardContent>
                        </Card>

                        {/* M15 Breakdown */}
                        <Card>
                          <CardHeader>
                            <CardTitle>{r.m15Breakdown.title}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {r.m15Breakdown.items.map((item, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>

                        {/* Liquidity Levels */}
                        <Card>
                          <CardHeader>
                            <CardTitle>Liquidity Levels</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h4 className="text-sm font-medium text-emerald-400 mb-3">Buy-Side (Above)</h4>
                                <ul className="space-y-1 text-sm">
                                  {r.liquidityLevels.buySide.length === 0 ? (
                                    <li className="text-muted-foreground/50">No buy-side liquidity identified</li>
                                  ) : (
                                    r.liquidityLevels.buySide.map((level, i) => (
                                      <li key={i} className="flex justify-between text-muted-foreground">
                                        <span>{level}</span>
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-red-400 mb-3">Sell-Side (Below)</h4>
                                <ul className="space-y-1 text-sm">
                                  {r.liquidityLevels.sellSide.length === 0 ? (
                                    <li className="text-muted-foreground/50">No sell-side liquidity identified</li>
                                  ) : (
                                    r.liquidityLevels.sellSide.map((level, i) => (
                                      <li key={i} className="flex justify-between text-muted-foreground">
                                        <span>{level}</span>
                                      </li>
                                    ))
                                  )}
                                </ul>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* What to Watch */}
                        <Card className="border-emerald-500/30 bg-emerald-500/5">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              What to Watch
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Invalidation Level</p>
                                <p className="text-xl font-bold text-red-400">${r.whatToWatch.invalidationLevel.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Liquidity Draw Target</p>
                                <p className="text-xl font-bold text-emerald-400">${r.whatToWatch.liquidityDraw.toFixed(2)}</p>
                              </div>
                            </div>
                            {r.whatToWatch.note && (
                              <p className="text-sm text-muted-foreground">{r.whatToWatch.note}</p>
                            )}
                          </CardContent>
                        </Card>

                        {/* Timestamp */}
                        <div className="text-center text-sm text-muted-foreground/50 border-t border-border/30 pt-4">
                          Generated: {r.timestamp} | Price: ${r.price.toFixed(2)}
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="why" className="mt-4 space-y-4">
                  {(() => {
                    const report = generateFullReport(trade);
                    return (
                      <div className="space-y-3">
                        {report.whyThisTrade.map((item, i) => (
                          <Card key={i} className="border-emerald-500/20">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {item.category}
                                    </Badge>
                                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full"
                                        style={{ width: `${item.weight}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground">{item.weight}%</span>
                                  </div>
                                  <p className="text-muted-foreground">{item.reason}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    );
                  })()}
                </TabsContent>

                <TabsContent value="simple" className="mt-4">
                  {(() => {
                    const report = generateFullReport(trade);
                    return (
                      <Card className="bg-emerald-500/5 border-emerald-500/20">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Simple Summary (ELI8)
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {report.simpleSummary.sentences.map((sentence, i) => (
                              <p key={i} className="text-lg text-muted-foreground leading-relaxed">
                                {sentence}
                              </p>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            </section>
          </>
        )}

        {/* Empty State */}
        {!trade && !isLoading && !error && (
          <Card className="bg-card/50 border-border/30">
            <CardContent className="p-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Search for XAUUSD to Begin</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Enter "XAUUSD", "Gold", or "XAU/USD" to generate a premium trade idea with full technical and fundamental analysis.
              </p>
            </CardContent>
          </Card>
        )}
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