"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RotateCw, Check, X, Loader, Loader2, Download, Share2, Image, User, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { getHistoryStats, getFilteredHistory } from "@/lib/history/utils";
import type { HistoryEntry } from "@/lib/history/types";
import { toPng } from "html-to-image";

export default function ScorecardPage() {
  const [username, setUsername] = useState("Trader");
  const [range, setRange] = useState<"7d" | "30d" | "90d">("90d");
  const [referralCode, setReferralCode] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
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
  const [equityCurve, setEquityCurve] = useState<number[]>([0]);
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [mascotImage, setMascotImage] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const scorecardRef = useRef<HTMLDivElement>(null);

  // Fetch stats and history based on filters
  const fetchData = useCallback(async () => {
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (range) {
        case "7d":
          startDate.setDate(endDate.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "90d":
          startDate.setDate(endDate.getDate() - 90);
          break;
      }

      // Get filtered history
      const history = await getFilteredHistory({
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      });
      
      setHistoryData(history);
      
      // Get stats
      const statsData = await getHistoryStats();
      setStats(statsData);
      
      // Generate equity curve
      const equity = generateEquityCurve(history);
      setEquityCurve(equity);
    } catch (error) {
      console.error("Error fetching scorecard data:", error);
    }
  }, [range]);

  // Generate equity curve from history
  const generateEquityCurve = (trades: HistoryEntry[]): number[] => {
    if (trades.length === 0) return [0];
    
    // Sort trades by timestamp
    const sortedTrades = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    
    const equity = [0]; // Start at 0
    let current = 0;
    
    for (const trade of sortedTrades) {
      if (trade.outcomeR !== undefined) {
        current += trade.outcomeR;
        equity.push(current);
      }
    }
    
    return equity;
  };

  // Handle username change
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  // Handle range change
  const handleRangeChange = (value: "7d" | "30d" | "90d") => {
    setRange(value);
  };

  // Handle referral code change
  const handleReferralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setReferralCode(e.target.value);
  };

  // Handle mascot image upload
  const handleMascotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setMascotImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Generate and download scorecard image
  const generateScorecardImage = async () => {
    if (!scorecardRef.current) return;
    
    setIsGenerating(true);
    try {
      // Convert the scorecard div to an image
      const dataUrl = await toPng(scorecardRef.current, {
        quality: 0.95,
        backgroundColor: "#0d0d0d", // Match our dark background
        width: 1200,
        height: 800,
      });
      
      // Trigger download
      const link = document.createElement("a");
      link.download = `zilla-scorecard-${username}-${range}.png`;
      link.href = dataUrl;
      link.click();
      
      // Also set for sharing
      setShareImageUrl(dataUrl);
      setIsShareModalOpen(true);
    } catch (error) {
      console.error("Error generating scorecard image:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle share modal close
  const handleShareClose = () => {
    setIsShareModalOpen(false);
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch when range changes
  useEffect(() => {
    fetchData();
  }, [range]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center">
                <div className="w-5 h-5 bg-emerald-500 rounded-full" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Zilla Scorecard</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => window.print()}
                className="h-10 px-4"
              >
                <Download className="h-4 w-4 mr-2" />
                Print / Save
              </Button>
              <Button 
                onClick={generateScorecardImage}
                disabled={isGenerating}
                className="h-10 px-4"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4 mr-2" />
                )}
                {isGenerating ? "Generating..." : "Generate Image"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Settings Panel */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Scorecard Settings
            </CardTitle>
            <CardDescription>
              Customize your scorecard before generating the shareable image
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex-1">
                <label htmlFor="username" className="block text-sm font-medium text-muted-foreground mb-2">
                  Username
                </label>
                <Input
                  id="username"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Enter your username"
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="range" className="block text-sm font-medium text-muted-foreground mb-2">
                  Time Range
                </label>
                <Select value={range} onValueChange={handleRangeChange}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">7 Days</SelectItem>
                    <SelectItem value="30d">30 Days</SelectItem>
                    <SelectItem value="90d">90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label htmlFor="referral" className="block text-sm font-medium text-muted-foreground mb-2">
                  Referral Code (Optional)
                </label>
                <Input
                  id="referral"
                  value={referralCode}
                  onChange={handleReferralChange}
                  placeholder="Enter referral code"
                  className="w-full"
                />
              </div>
              <div className="flex-1 flex-col sm:flex-row">
                <label htmlFor="mascot" className="block text-sm font-medium text-muted-foreground mb-2">
                  Mascot/Image (Optional)
                </label>
                <label className="block cursor-pointer">
                  <input
                    id="mascot"
                    type="file"
                    accept="image/*"
                    onChange={handleMascotUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2 border border-border/50 hover:bg-muted transition-colors">
                    <User className="h-4 w-4" />
                    Upload Image
                  </div>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setUsername("Trader")}
                className="h-10 px-4"
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Reset Username
              </Button>
              <Button
                variant="outline"
                onClick={() => setRange("90d")}
                className="h-10 px-4"
              >
                <RotateCw className="h-4 w-4 mr-2" />
                Reset Range
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scorecard Preview */}
        <div className="space-y-6">
          {/* Main Scorecard */}
          <div ref={scorecardRef} className="relative bg-card rounded-xl border border-border/50 overflow-hidden">
            {/* Header */}
            <div className="relative p-6 border-b border-border/50 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">@{username}</h2>
                    <p className="text-sm text-muted-foreground">Zilla Trading Scorecard</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="text-xs">
                    {range.toUpperCase()} Period
                  </Badge>
                  {referralCode && (
                    <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/50">
                      {referralCode}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Mascot/Logo Panel */}
              <div className="absolute top-4 right-4">
                <div className="w-24 h-24 rounded-lg bg-border/50 overflow-hidden flex items-center justify-center">
                  {mascotImage ? (
                    <img src={mascotImage} alt="Mascot" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground/50 text-xs">
                      No Image
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Trades</span>
                  <div className="w-3 h-3 bg-emerald-500/20 rounded-full" />
                </div>
                <div className="text-3xl font-bold text-foreground">{stats.totalTrades}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Closed Trades</span>
                  <div className="w-3 h-3 bg-emerald-500/20 rounded-full" />
                </div>
                <div className="text-3xl font-bold text-foreground">{stats.closedTrades}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                  <div className="w-3 h-3 bg-emerald-500/20 rounded-full" />
                </div>
                <div className="text-3xl font-bold text-emerald-400">{stats.winRate}%</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total R</span>
                  <div className="w-3 h-3 bg-emerald-500/20 rounded-full" />
                </div>
                <div className="text-3xl font-bold text-foreground">{stats.totalR.toFixed(1)}R</div>
              </div>
            </div>

            {/* Advanced Stats */}
            <div className="px-6 pb-4 grid grid-cols-3 gap-4">
              <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 bg-emerald-500/20 rounded flex items-center justify-center">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span className="text-sm text-muted-foreground">Avg R per Trade</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400">{stats.avgR.toFixed(2)}</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 bg-emerald-500/20 rounded flex items-center justify-center">
                    <Star className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span className="text-sm text-muted-foreground">Best Trade</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400">{stats.bestR.toFixed(2)}R</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 bg-emerald-500/20 rounded flex items-center justify-center">
                    <Image className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span className="text-sm text-muted-foreground">Expectancy</span>
                </div>
                <div className="text-2xl font-bold text-foreground">{(stats.avgR * stats.winRate / 100).toFixed(2)}R</div>
              </div>
            </div>

            {/* Equity Curve */}
            <div className="px-6 pb-6 border-b border-border/50">
              <h3 className="text-lg font-semibold text-foreground mb-4">Equity Curve</h3>
              <div className="h-40 bg-muted/30 rounded-lg border border-border/30 relative">
                {/* Simple SVG-based equity curve */}
                <svg width="100%" height="100%" viewBox="0 0 600 160" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="equityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {equityCurve.length > 1 && (
                    <>
                      {/* Area under curve */}
                      <path
                        d={`M 0 160 ${equityCurve.map((v, i) => {
                          const x = (i / (equityCurve.length - 1)) * 600;
                          const y = 160 - Math.max(0, Math.min(160, (v + Math.abs(Math.min(...equityCurve))) + 1) * 40);
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ')} L 600 160 Z`}
                        fill="url(#equityGradient)"
                      />
                      {/* Line */}
                      <path
                        d={equityCurve.map((v, i) => {
                          const x = (i / (equityCurve.length - 1)) * 600;
                          const y = 160 - Math.max(0, Math.min(160, (v + Math.abs(Math.min(...equityCurve))) + 1) * 40);
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ')}
                        stroke="#10b981"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  )}
                  {/* Zero line */}
                  <line 
                    x1="0" 
                    y1="160" 
                    x2="600" 
                    y2="160" 
                    stroke="currentColor" 
                    strokeOpacity="0.1" 
                    strokeDasharray="5,5"
                  />
                </svg>
              </div>
            </div>

            {/* Performance Breakdown */}
            <div className="p-6 border-b border-border/50">
              <h3 className="text-lg font-semibold text-foreground mb-4">Performance Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-emerald-500/20 rounded flex items-center justify-center">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span>Win Rate: {stats.winRate}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-emerald-500/20 rounded flex items-center justify-center">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span>Avg R: {stats.avgR.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-emerald-500/20 rounded flex items-center justify-center">
                    <Star className="h-3 w-3 text-emerald-400" />
                  </div>
                  <span>Best R: {stats.bestR.toFixed(2)}</span>
                </div>
              </div>
            </div>
            
            {/* Mascot/Logo Panel */}
            <div className="absolute top-4 right-4">
              <div className="w-24 h-24 rounded-lg bg-border/50 overflow-hidden flex items-center justify-center">
                {mascotImage ? (
                  <img src={mascotImage} alt="Mascot" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-muted-foreground/50 text-xs">
                    No Image
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground/70">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  <span>@{username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Powered by Zilla</span>
                  {referralCode && (
                    <>
                      <span className="mx-2">|</span>
                      <span className="text-emerald-400">{referralCode}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Trade History Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Trade History
              </CardTitle>
              <CardDescription>
                Trades within the selected date range
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No trades found for the selected period
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left p-3 text-muted-foreground">Date</th>
                        <th className="text-left p-3 text-muted-foreground">Direction</th>
                        <th className="text-left p-3 text-muted-foreground">Entry</th>
                        <th className="text-left p-3 text-muted-foreground">SL</th>
                        <th className="text-left p-3 text-muted-foreground">TP1</th>
                        <th className="text-left p-3 text-muted-foreground">TP2</th>
                        <th className="text-left p-3 text-muted-foreground">Outcome</th>
                        <th className="text-left p-3 text-muted-foreground">R</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((trade, index) => (
                        <tr key={trade.id} className="border-b border-border/30 hover:bg-muted/30">
                          <td className="p-3">{new Date(trade.timestamp).toLocaleDateString()}</td>
                          <td className="p-3">
                            <Badge 
                              variant={trade.direction === "buy" ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {trade.direction.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono">{trade.entry.toFixed(2)}</td>
                          <td className="p-3 font-mono">{trade.stopLoss.toFixed(2)}</td>
                          <td className="p-3 font-mono">{trade.takeProfit1.toFixed(2)}</td>
                          <td className="p-3 font-mono">{trade.takeProfit2.toFixed(2)}</td>
                          <td className="p-3">
                            <Badge 
                              variant={
                                !trade.outcome ? "secondary" :
                                trade.outcome === "tp1" || trade.outcome === "tp2" ? "default" :
                                trade.outcome === "sl" || trade.outcome === "expired" ? "destructive" :
                                "secondary"
                              }
                              className="text-xs"
                            >
                              {!trade.outcome ? "Pending" :
                               trade.outcome === "tp1" ? "TP1" : 
                               trade.outcome === "tp2" ? "TP2" : 
                               trade.outcome === "sl" ? "SL" : 
                               trade.outcome === "expired" ? "Expired" : "BE"}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-emerald-400">
                            {trade.outcomeR !== undefined ? trade.outcomeR.toFixed(2) + "R" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Share Modal */}
      {isShareModalOpen && shareImageUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border/50 max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Share Scorecard</h3>
              <Button variant="ghost" size="icon" onClick={handleShareClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-4">
              <img src={shareImageUrl} alt="Scorecard" className="w-full max-h-[70vh] object-contain rounded-lg border border-border/50" />
              <div className="flex justify-end space-x-3 mt-4">
                <Button variant="outline" onClick={handleShareClose} className="h-10 px-4">
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    const link = document.createElement("a");
                    link.download = `zilla-scorecard-${username}-${range}.png`;
                    link.href = shareImageUrl;
                    link.click();
                  }}
                  className="h-10 px-4"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Educational only, not financial advice. Trading carries risk.
        </div>
      </footer>
    </div>
  );
}

// Star component (since we don't have it in lucide-react by default)
function Star({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 13.53 13.76 16.96 20.09 12 16.58 7.04 20.09 10.47 13.76 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  );
}