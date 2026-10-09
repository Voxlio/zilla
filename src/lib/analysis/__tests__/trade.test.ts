import { buildTradeIdea, roundPrice } from "../trade";
import { 
  TradeDirection, 
  Reason, 
  MarketStructure, 
  FVG, 
  LiquidityLevel, 
  SessionRange, 
  PremiumDiscountZones, 
  FundamentalData,
  AssetConfig 
} from "../types";

describe("Trade Builder", () => {
  const mockAssetConfig: AssetConfig = {
    symbol: "XAUUSD",
    name: "XAU/USD",
    displayName: "Gold",
    pipSize: 0.01,
    contractSize: 100,
    marginCurrency: "USD",
  };

  const mockStructure: MarketStructure = {
    swings: [],
    trend: "bullish",
    bos: [],
    choch: [],
    higherHighs: [1, 3],
    higherLows: [2, 4],
    lowerHighs: [],
    lowerLows: [],
  };

  const mockFVGs: FVG[] = [
    { index: 2, time: 1000, top: 2045, bottom: 2040, type: "bullish", mitigated: false },
    { index: 4, time: 1002, top: 2030, bottom: 2025, type: "bullish", mitigated: false },
    { index: 6, time: 1004, top: 2060, bottom: 2055, type: "bearish", mitigated: true },
  ];

  const mockLiquidity: LiquidityLevel[] = [
    { price: 2000, time: 1000, type: "sell-side", source: "swing", strength: 1.0, tested: false },
    { price: 2010, time: 1001, type: "buy-side", source: "swing", strength: 1.0, tested: false },
    { price: 2080, time: 1002, type: "buy-side", source: "swing", strength: 1.0, tested: false },
    { price: 2090, time: 1003, type: "buy-side", source: "swing", strength: 1.0, tested: false },
  ];

  const mockSessions: SessionRange[] = [
    { session: "asia", high: 2030, low: 2010, highTime: 1000, lowTime: 1001 },
    { session: "london", high: 2060, low: 2020, highTime: 1002, lowTime: 1003 },
    { session: "ny", high: 2070, low: 2035, highTime: 1004, lowTime: 1005 },
  ];

  const mockZones: PremiumDiscountZones = {
    rangeHigh: 2090,
    rangeLow: 1990,
    premium: { top: 2090, bottom: 2040 },
    equilibrium: 2040,
    discount: { top: 2040, bottom: 1990 },
  };

  const mockFundamentalData: FundamentalData = {
    calendar: [],
    headlines: [],
    score: 10,
    warnings: [],
  };

  const mockReasons: Reason[] = [
    { category: "structure", label: "Trend", value: "Bullish", direction: "bullish", weight: 80 },
    { category: "fvg", label: "Bullish FVG", value: "In discount", direction: "bullish", weight: 75 },
    { category: "liquidity", label: "Buy-side", value: "At 2080", direction: "bullish", weight: 80 },
    { category: "fundamental", label: "News", value: "Dovish Fed", direction: "bullish", weight: 70 },
  ];

  describe("buildTradeIdea", () => {
    it("should create a buy trade idea with all required fields", () => {
      const trade = buildTradeIdea({
        symbol: "XAUUSD",
        currentPrice: 2035,
        structure: mockStructure,
        fvgs: mockFVGs,
        liquidity: mockLiquidity,
        sessions: mockSessions,
        zones: mockZones,
        fundamentalData: mockFundamentalData,
        assetConfig: mockAssetConfig,
        reasons: mockReasons,
      });

      expect(trade).toBeDefined();
      expect(trade.id).toMatch(/^trade_\d+_[a-z0-9]+$/);
      expect(trade.symbol).toBe("XAUUSD");
      expect(trade.direction).toBe("buy");
      expect(trade.entry).toBeGreaterThan(0);
      expect(trade.stopLoss).toBeLessThan(trade.entry);
      expect(trade.takeProfit1).toBeGreaterThan(trade.entry);
      expect(trade.takeProfit2).toBeGreaterThan(trade.takeProfit1);
      expect(trade.riskReward).toBeGreaterThan(0);
      expect(trade.confidence).toBeGreaterThanOrEqual(30);
      expect(trade.confidence).toBeLessThanOrEqual(95);
      expect(trade.reasons).toEqual(mockReasons);
      expect(trade.technicalScore).toBeDefined();
      expect(trade.fundamentalScore).toBe(10);
      expect(trade.disclaimer).toContain("Educational only");
    });

    it("should create a sell trade idea when fundamental score is bearish", () => {
      const bearishFundamentals: FundamentalData = {
        ...mockFundamentalData,
        score: -20,
      };

      const bearishReasons: Reason[] = [
        { category: "structure", label: "Trend", value: "Bearish", direction: "bearish", weight: 80 },
        { category: "fvg", label: "Bearish FVG", value: "In premium", direction: "bearish", weight: 75 },
        { category: "liquidity", label: "Sell-side", value: "At 2000", direction: "bearish", weight: 80 },
        { category: "fundamental", label: "News", value: "Hawkish Fed", direction: "bearish", weight: 70 },
      ];

      const bearishStructure: MarketStructure = {
        ...mockStructure,
        trend: "bearish",
        higherHighs: [],
        higherLows: [],
        lowerHighs: [1, 3],
        lowerLows: [2, 4],
      };

      const trade = buildTradeIdea({
        symbol: "XAUUSD",
        currentPrice: 2060,
        structure: bearishStructure,
        fvgs: mockFVGs,
        liquidity: mockLiquidity,
        sessions: mockSessions,
        zones: mockZones,
        fundamentalData: bearishFundamentals,
        assetConfig: mockAssetConfig,
        reasons: bearishReasons,
      });

      expect(trade.direction).toBe("sell");
      expect(trade.stopLoss).toBeGreaterThan(trade.entry);
      expect(trade.takeProfit1).toBeLessThan(trade.entry);
      expect(trade.takeProfit2).toBeLessThan(trade.takeProfit1);
    });

    it("should never return 'no trade' - always picks a direction", () => {
      const neutralReasons: Reason[] = [
        { category: "structure", label: "Trend", value: "Ranging", direction: "neutral", weight: 40 },
      ];

      const neutralFundamentals: FundamentalData = {
        ...mockFundamentalData,
        score: 0,
      };

      const neutralStructure: MarketStructure = {
        ...mockStructure,
        trend: "ranging",
      };

      const trade = buildTradeIdea({
        symbol: "XAUUSD",
        currentPrice: 2040,
        structure: neutralStructure,
        fvgs: mockFVGs,
        liquidity: mockLiquidity,
        sessions: mockSessions,
        zones: mockZones,
        fundamentalData: neutralFundamentals,
        assetConfig: mockAssetConfig,
        reasons: neutralReasons,
      });

      // Should still pick a direction (buy when score >= 0)
      expect(trade.direction).toBe("buy");
      expect(trade.confidence).toBeGreaterThanOrEqual(30);
    });

    it("should ensure minimum 1:2 risk-reward ratio", () => {
      const trade = buildTradeIdea({
        symbol: "XAUUSD",
        currentPrice: 2035,
        structure: mockStructure,
        fvgs: mockFVGs,
        liquidity: mockLiquidity,
        sessions: mockSessions,
        zones: mockZones,
        fundamentalData: mockFundamentalData,
        assetConfig: mockAssetConfig,
        reasons: mockReasons,
      });

      expect(trade.riskReward).toBeGreaterThanOrEqual(2);
    });
  });

  describe("roundPrice", () => {
    it("should round to nearest pip", () => {
      expect(roundPrice(2035.123, 0.01)).toBe(2035.12);
      expect(roundPrice(2035.125, 0.01)).toBe(2035.13);
      expect(roundPrice(2035.127, 0.01)).toBe(2035.13);
    });

    it("should work with different pip sizes", () => {
      // For JPY pairs
      expect(roundPrice(150.12345, 0.001)).toBe(150.123);
      // For standard forex
      expect(roundPrice(1.23456, 0.0001)).toBe(1.2346);
    });
  });
});