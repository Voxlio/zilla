import { 
  generateReasons, 
  sortReasonsByWeight, 
  getTopReasons 
} from "../reasons";
import { 
  MarketStructure, 
  FVG, 
  LiquidityLevel, 
  SessionRange, 
  PremiumDiscountZones, 
  FundamentalData,
  Reason 
} from "../types";

describe("Reason Generation", () => {
  const mockStructure: MarketStructure = {
    swings: [
      { index: 1, time: 1000, price: 105, type: "high" },
      { index: 2, time: 1001, price: 102, type: "low" },
      { index: 3, time: 1002, price: 107, type: "high" },
      { index: 4, time: 1003, price: 104, type: "low" },
    ],
    trend: "bullish",
    bos: [
      { index: 3, time: 1002, price: 107, direction: "bullish", type: "BOS" },
    ],
    choch: [
      { index: 1, time: 1000, price: 105, direction: "bullish", type: "CHoCH" },
    ],
    higherHighs: [3],
    higherLows: [2, 4],
    lowerHighs: [],
    lowerLows: [],
  };

  // Fixtures are written for currentPrice = 103 and must describe a state that
  // can actually occur. An unmitigated bullish gap is unfilled support, so it
  // sits BELOW price; an unmitigated bearish gap is unfilled resistance, so it
  // sits ABOVE price. (A bullish gap whose bottom is above price would mean
  // price had already traded straight through it, i.e. it would be mitigated.)
  const mockFVGs: FVG[] = [
    { index: 1, time: 1000, top: 102, bottom: 100, type: "bullish", mitigated: false },
    { index: 3, time: 1002, top: 101, bottom: 99, type: "bullish", mitigated: true },
    { index: 5, time: 1004, top: 108, bottom: 105, type: "bearish", mitigated: false },
  ];

  const mockLiquidity: LiquidityLevel[] = [
    { price: 100, time: 1000, type: "buy-side", source: "swing", strength: 1.0, tested: false },
    { price: 105, time: 1001, type: "sell-side", source: "swing", strength: 1.0, tested: true },
    { price: 110, time: 1002, type: "buy-side", source: "intermediate", strength: 0.7, tested: false },
    { price: 115, time: 1003, type: "sell-side", source: "session", session: "london", strength: 0.8, tested: false },
  ];

  const mockSessions: SessionRange[] = [
    { session: "asia", high: 106, low: 100, highTime: 1000, lowTime: 1001 },
    { session: "london", high: 115, low: 108, highTime: 1002, lowTime: 1003 },
    { session: "ny", high: 118, low: 110, highTime: 1004, lowTime: 1005 },
  ];

  const mockZones: PremiumDiscountZones = {
    rangeHigh: 120,
    rangeLow: 90,
    premium: { top: 120, bottom: 105 },
    equilibrium: 105,
    discount: { top: 105, bottom: 90 },
  };

  const mockFundamentalData: FundamentalData = {
    calendar: [
      {
        time: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        currency: "USD",
        impact: "high",
        event: "CPI",
        actual: "3.2%",
        forecast: "3.0%",
        previous: "2.9%",
      },
      {
        time: Math.floor(Date.now() / 1000) + 7200, // 2 hours from now
        currency: "USD",
        impact: "high",
        event: "NFP",
        actual: "150K",
        forecast: "180K",
        previous: "175K",
      }
    ],
    headlines: [
      {
        headline: "Fed signals possible rate cut amid cooling inflation",
        source: "Reuters",
        time: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
      },
      {
        headline: "Strong jobs data supports dollar strength",
        source: "Bloomberg",
        time: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      }
    ],
    score: -15,
    warnings: ["High-impact NFP release in 2 hours"],
  };

  describe("generateReasons", () => {
    it("should generate reasons from all analysis components", () => {
      const reasons = generateReasons({
        structure: mockStructure,
        fvgs: mockFVGs,
        liquidity: mockLiquidity,
        sessions: mockSessions,
        zones: mockZones,
        fundamentalData: mockFundamentalData,
        currentPrice: 103,
      });

      expect(reasons.length).toBeGreaterThan(0);
      
      // Check that we have reasons from each category
      const categories = [...new Set(reasons.map(r => r.category))];
      expect(categories).toContain("structure");
      expect(categories).toContain("fvg");
      expect(categories).toContain("liquidity");
      expect(categories).toContain("session");
      expect(categories).toContain("premium-discount");
      expect(categories).toContain("fundamental");
    });

    it("should generate correct structure reasons", () => {
      const reasons = generateReasons({
        structure: mockStructure,
        fvgs: [],
        liquidity: [],
        sessions: [],
        zones: mockZones,
        fundamentalData: { calendar: [], headlines: [], score: 0, warnings: [] },
        currentPrice: 103,
      });

      const structureReasons = reasons.filter(r => r.category === "structure");
      expect(structureReasons.length).toBeGreaterThan(0);
      
      // Should have trend reason
      const trendReason = structureReasons.find(r => r.label === "Market Structure Trend");
      expect(trendReason).toBeDefined();
      expect(trendReason?.direction).toBe("bullish");
      
      // Should have BOS reason
      const bosReason = structureReasons.find(r => r.label === "Break of Structure");
      expect(bosReason).toBeDefined();
      expect(bosReason?.direction).toBe("bullish");
      
      // Should have CHoCH reason
      const chochReason = structureReasons.find(r => r.label === "Change of Character");
      expect(chochReason).toBeDefined();
      expect(chochReason?.direction).toBe("bullish");
    });

    it("should generate correct FVG reasons", () => {
      const reasons = generateReasons({
        structure: mockStructure,
        fvgs: mockFVGs,
        liquidity: [],
        sessions: [],
        zones: mockZones,
        fundamentalData: { calendar: [], headlines: [], score: 0, warnings: [] },
        currentPrice: 103,
      });

      const fvgReasons = reasons.filter(r => r.category === "fvg");
      expect(fvgReasons.length).toBeGreaterThan(0);
      
      // Should have unmitigated bullish FVG reason
      const bullishFVGReason = fvgReasons.find(r => 
        r.label === "Unmitigated Bullish FVG" && r.direction === "bullish"
      );
      expect(bullishFVGReason).toBeDefined();
      
      // Should have unmitigated bearish FVG reason
      const bearishFVGReason = fvgReasons.find(r => 
        r.label === "Unmitigated Bearish FVG" && r.direction === "bearish"
      );
      expect(bearishFVGReason).toBeDefined();
    });

    it("should generate correct liquidity reasons", () => {
      const reasons = generateReasons({
        structure: mockStructure,
        fvgs: [],
        liquidity: mockLiquidity,
        sessions: [],
        zones: mockZones,
        fundamentalData: { calendar: [], headlines: [], score: 0, warnings: [] },
        currentPrice: 103,
      });

      const liquidityReasons = reasons.filter(r => r.category === "liquidity");
      expect(liquidityReasons.length).toBeGreaterThan(0);
      
      // Should have buy-side liquidity reason
      const buySideReason = liquidityReasons.find(r => r.label === "Buy-Side Liquidity");
      expect(buySideReason).toBeDefined();
      
      // Should have sell-side liquidity reason
      const sellSideReason = liquidityReasons.find(r => r.label === "Sell-Side Liquidity");
      expect(sellSideReason).toBeDefined();
      
      // Should have untested liquidity reason
      const untestedReason = liquidityReasons.find(r => r.label === "Untested Liquidity Pools");
      expect(untestedReason).toBeDefined();
    });

    it("should generate correct session reasons", () => {
      const reasons = generateReasons({
        structure: mockStructure,
        fvgs: [],
        liquidity: [],
        sessions: mockSessions,
        zones: mockZones,
        fundamentalData: { calendar: [], headlines: [], score: 0, warnings: [] },
        currentPrice: 103,
      });

      const sessionReasons = reasons.filter(r => r.category === "session");
      expect(sessionReasons.length).toBeGreaterThan(0);
    });

    it("should generate correct premium/discount reasons", () => {
      const reasons = generateReasons({
        structure: mockStructure,
        fvgs: [],
        liquidity: [],
        sessions: [],
        zones: mockZones,
        fundamentalData: { calendar: [], headlines: [], score: 0, warnings: [] },
        currentPrice: 103,
      });

      const zoneReasons = reasons.filter(r => r.category === "premium-discount");
      expect(zoneReasons.length).toBeGreaterThan(0);
      
      // Price 103 is in discount zone (below equilibrium 105)
      const discountReason = zoneReasons.find(r => 
        r.label === "Price Location" && r.value === "Discount zone (below equilibrium)"
      );
      expect(discountReason).toBeDefined();
      expect(discountReason?.direction).toBe("bullish");
    });

    it("should generate correct fundamental reasons", () => {
      const reasons = generateReasons({
        structure: mockStructure,
        fvgs: [],
        liquidity: [],
        sessions: [],
        zones: mockZones,
        fundamentalData: mockFundamentalData,
        currentPrice: 103,
      });

      const fundamentalReasons = reasons.filter(r => r.category === "fundamental");
      expect(fundamentalReasons.length).toBeGreaterThan(0);
      
      // Should have calendar reason for CPI
      const cpiReason = fundamentalReasons.find(r => r.label.includes("CPI"));
      expect(cpiReason).toBeDefined();
      expect(cpiReason?.direction).toBe("bearish"); // Higher CPI = USD up = Gold down
      
      // Should have calendar reason for NFP
      const nfpReason = fundamentalReasons.find(r => r.label.includes("NFP"));
      expect(nfpReason).toBeDefined();
      expect(nfpReason?.direction).toBe("bullish"); // Lower NFP = USD down = Gold up
      
      // Should have news sentiment reason
      const newsReason = fundamentalReasons.find(r => r.label === "News Sentiment");
      expect(newsReason).toBeDefined();
      
      // Should have volatility warning
      const warningReason = fundamentalReasons.find(r => r.label === "Volatility Warning");
      expect(warningReason).toBeDefined();
    });
  });

  describe("sortReasonsByWeight", () => {
    it("should sort reasons by weight descending", () => {
      const reasons: Reason[] = [
        { category: "structure", label: "Low", value: "test", direction: "bullish", weight: 50 },
        { category: "structure", label: "High", value: "test", direction: "bullish", weight: 90 },
        { category: "structure", label: "Medium", value: "test", direction: "bullish", weight: 70 },
      ];

      const sorted = sortReasonsByWeight(reasons);
      
      expect(sorted[0].weight).toBe(90);
      expect(sorted[1].weight).toBe(70);
      expect(sorted[2].weight).toBe(50);
    });
  });

  describe("getTopReasons", () => {
    it("should return top N reasons by weight", () => {
      const reasons: Reason[] = [
        { category: "structure", label: "One", value: "test", direction: "bullish", weight: 90 },
        { category: "structure", label: "Two", value: "test", direction: "bullish", weight: 80 },
        { category: "structure", label: "Three", value: "test", direction: "bullish", weight: 70 },
        { category: "structure", label: "Four", value: "test", direction: "bullish", weight: 60 },
      ];

      const top2 = getTopReasons(reasons, 2);
      expect(top2.length).toBe(2);
      expect(top2[0].label).toBe("One");
      expect(top2[1].label).toBe("Two");
      
      const top5 = getTopReasons(reasons, 5);
      expect(top5.length).toBe(4); // Only 4 reasons available
    });
  });
});