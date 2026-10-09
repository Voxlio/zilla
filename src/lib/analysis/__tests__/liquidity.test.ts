import { 
  detectLiquidityFromSwings, 
  detectIntermediateLiquidity, 
  detectSessionRanges, 
  sessionRangesToLiquidity,
  combineLiquidityLevels,
  updateLiquidityTestedStatus,
  getLiquidityInDirection,
  getNearestLiquidity
} from "../liquidity";
import { Candle, SwingPoint, LiquidityLevel, SessionRange } from "../types";

describe("Liquidity Detection", () => {
  describe("detectLiquidityFromSwings", () => {
    it("should create buy-side liquidity at swing highs and sell-side at swing lows", () => {
      const swings: SwingPoint[] = [
        { index: 1, time: 1000, price: 105, type: "high" },
        { index: 3, time: 1002, price: 99, type: "low" },
        { index: 5, time: 1004, price: 107, type: "high" },
        { index: 7, time: 1006, price: 97, type: "low" },
      ];

      const levels = detectLiquidityFromSwings(swings);
      
      expect(levels.length).toBe(4);
      
      const buySide = levels.filter(l => l.type === "buy-side");
      const sellSide = levels.filter(l => l.type === "sell-side");
      
      expect(buySide.length).toBe(2);
      expect(sellSide.length).toBe(2);
      
      expect(buySide[0].price).toBe(105);
      expect(buySide[1].price).toBe(107);
      expect(sellSide[0].price).toBe(99);
      expect(sellSide[1].price).toBe(97);
    });
  });

  describe("detectIntermediateLiquidity", () => {
    it("should detect intermediate levels between swings", () => {
      const candles: Candle[] = [
        { time: 1000, open: 100, high: 105, low: 99, close: 104 },
        { time: 1001, open: 104, high: 106, low: 103, close: 105 }, // Swing high at 106
        { time: 1002, open: 105, high: 107, low: 102, close: 106 },
        { time: 1003, open: 106, high: 108, low: 104, close: 107 }, // Intermediate high at 108
        { time: 1004, open: 107, high: 109, low: 105, close: 108 },
        { time: 1005, open: 108, high: 110, low: 106, close: 109 }, // Swing high at 110
      ];

      const swings: SwingPoint[] = [
        { index: 1, time: 1001, price: 106, type: "high" },
        { index: 5, time: 1005, price: 110, type: "high" },
      ];

      const levels = detectIntermediateLiquidity(candles, swings);
      
      // Should detect the intermediate high between the two swing highs
      expect(levels.length).toBeGreaterThanOrEqual(1);
      
      const intermediate = levels.find(l => l.source === "intermediate");
      expect(intermediate).toBeDefined();
      expect(intermediate?.price).toBeGreaterThanOrEqual(107);
      expect(intermediate?.price).toBeLessThanOrEqual(110);
    });
  });

  describe("detectSessionRanges", () => {
    it("should detect session highs and lows", () => {
      // Create candles for one day with known session times
      const baseTime = new Date("2024-01-15T00:00:00Z").getTime() / 1000;
      
      const candles: Candle[] = [
        // Asia session (00:00-08:00)
        { time: baseTime + 3600, open: 2000, high: 2010, low: 1995, close: 2005 }, // 01:00
        { time: baseTime + 7200, open: 2005, high: 2015, low: 2000, close: 2010 }, // 02:00
        { time: baseTime + 10800, open: 2010, high: 2020, low: 2005, close: 2015 }, // 03:00
        // London session (07:00-16:00)
        { time: baseTime + 25200, open: 2015, high: 2025, low: 2010, close: 2020 }, // 07:00
        { time: baseTime + 32400, open: 2020, high: 2030, low: 2015, close: 2025 }, // 09:00
        { time: baseTime + 39600, open: 2025, high: 2035, low: 2020, close: 2030 }, // 11:00
        // NY session (12:00-20:00)
        { time: baseTime + 43200, open: 2030, high: 2040, low: 2025, close: 2035 }, // 12:00
        { time: baseTime + 50400, open: 2035, high: 2045, low: 2030, close: 2040 }, // 14:00
        { time: baseTime + 57600, open: 2040, high: 2050, low: 2035, close: 2045 }, // 16:00
      ];

      const sessions = detectSessionRanges(candles);
      
      expect(sessions.length).toBeGreaterThanOrEqual(3);
      
      // Check each session
      const asia = sessions.find(s => s.session === "asia");
      const london = sessions.find(s => s.session === "london");
      const ny = sessions.find(s => s.session === "ny");
      
      expect(asia).toBeDefined();
      expect(london).toBeDefined();
      expect(ny).toBeDefined();
      
      if (asia) {
        expect(asia.high).toBe(2020);
        expect(asia.low).toBe(1995);
      }
      if (london) {
        expect(london.high).toBe(2035);
        expect(london.low).toBe(2010);
      }
      if (ny) {
        expect(ny.high).toBe(2050);
        expect(ny.low).toBe(2025);
      }
    });
  });

  describe("sessionRangesToLiquidity", () => {
    it("should convert session ranges to liquidity levels", () => {
      const sessions: SessionRange[] = [
        { session: "asia", high: 2020, low: 1995, highTime: 1000, lowTime: 1001 },
        { session: "london", high: 2035, low: 2010, highTime: 1002, lowTime: 1003 },
      ];

      const levels = sessionRangesToLiquidity(sessions);
      
      expect(levels.length).toBe(4); // 2 sessions * 2 levels each
      
      const buySide = levels.filter(l => l.type === "buy-side");
      const sellSide = levels.filter(l => l.type === "sell-side");
      
      expect(buySide.length).toBe(2);
      expect(sellSide.length).toBe(2);
      
      // Session low = buy-side liquidity
      expect(buySide.map(l => l.price)).toContain(1995);
      expect(buySide.map(l => l.price)).toContain(2010);
      
      // Session high = sell-side liquidity
      expect(sellSide.map(l => l.price)).toContain(2020);
      expect(sellSide.map(l => l.price)).toContain(2035);
    });
  });

  describe("combineLiquidityLevels", () => {
    it("should merge nearby levels", () => {
      const swing: LiquidityLevel[] = [
        { price: 2000, time: 1000, type: "buy-side", source: "swing", strength: 1.0, tested: false },
        { price: 2050, time: 1001, type: "sell-side", source: "swing", strength: 1.0, tested: false },
      ];
      
      const intermediate: LiquidityLevel[] = [
        { price: 2000.05, time: 1002, type: "buy-side", source: "intermediate", strength: 0.7, tested: false }, // Very close to 2000
      ];
      
      const session: LiquidityLevel[] = [
        { price: 2050.02, time: 1003, type: "sell-side", source: "session", session: "london", strength: 0.8, tested: false }, // Very close to 2050
      ];

      const combined = combineLiquidityLevels(swing, intermediate, session, 0.1);
      
      // Should merge the nearby levels
      expect(combined.length).toBe(2); // 2000 and 2050 merged
      
      // Check merged level properties
      const buyLevel = combined.find(l => l.type === "buy-side");
      const sellLevel = combined.find(l => l.type === "sell-side");
      
      expect(buyLevel).toBeDefined();
      expect(sellLevel).toBeDefined();
      
      // Strength should be the max
      expect(buyLevel?.strength).toBe(1.0);
      expect(sellLevel?.strength).toBe(1.0);
    });
  });

  describe("updateLiquidityTestedStatus", () => {
    it("should mark levels as tested when price touches them", () => {
      const levels: LiquidityLevel[] = [
        { price: 2000, time: 1000, type: "buy-side", source: "swing", strength: 1.0, tested: false },
        { price: 2050, time: 1001, type: "sell-side", source: "swing", strength: 1.0, tested: false },
      ];

      const candles: Candle[] = [
        { time: 1002, open: 1999, high: 2000.02, low: 1995, close: 1998 }, // Touches 2000
        { time: 1003, open: 2048, high: 2052, low: 2045, close: 2050 }, // Touches 2050
      ];

      const updated = updateLiquidityTestedStatus(levels, candles);
      
      expect(updated[0].tested).toBe(true);
      expect(updated[1].tested).toBe(true);
    });

    it("should not mark levels tested if price doesn't touch", () => {
      const levels: LiquidityLevel[] = [
        { price: 2000, time: 1000, type: "buy-side", source: "swing", strength: 1.0, tested: false },
      ];

      const candles: Candle[] = [
        { time: 1002, open: 1990, high: 1995, low: 1985, close: 1992 }, // Far from 2000
      ];

      const updated = updateLiquidityTestedStatus(levels, candles);
      
      expect(updated[0].tested).toBe(false);
    });
  });

  describe("getLiquidityInDirection", () => {
    it("should return levels above price for 'above' direction", () => {
      const levels: LiquidityLevel[] = [
        { price: 1990, time: 1000, type: "buy-side", source: "swing", strength: 1.0, tested: false },
        { price: 2010, time: 1001, type: "buy-side", source: "swing", strength: 1.0, tested: false },
        { price: 2020, time: 1002, type: "buy-side", source: "swing", strength: 1.0, tested: false },
      ];

      const above = getLiquidityInDirection(levels, 2000, "above");
      
      expect(above.length).toBe(2);
      expect(above[0].price).toBe(2010);
      expect(above[1].price).toBe(2020);
    });

    it("should return levels below price for 'below' direction", () => {
      const levels: LiquidityLevel[] = [
        { price: 2020, time: 1000, type: "sell-side", source: "swing", strength: 1.0, tested: false },
        { price: 2010, time: 1001, type: "sell-side", source: "swing", strength: 1.0, tested: false },
        { price: 1990, time: 1002, type: "sell-side", source: "swing", strength: 1.0, tested: false },
      ];

      const below = getLiquidityInDirection(levels, 2000, "below");
      
      expect(below.length).toBe(2);
      // Should be sorted descending (closest first)
      expect(below[0].price).toBe(1990);
      expect(below[1].price).toBe(2010);
    });
  });

  describe("getNearestLiquidity", () => {
    it("should return nearest level above price", () => {
      const levels: LiquidityLevel[] = [
        { price: 2020, time: 1000, type: "buy-side", source: "swing", strength: 1.0, tested: false },
        { price: 2010, time: 1001, type: "buy-side", source: "swing", strength: 1.0, tested: false }, // Closest
        { price: 2030, time: 1002, type: "buy-side", source: "swing", strength: 1.0, tested: false },
      ];

      const nearest = getNearestLiquidity(levels, 2000, "above");
      
      expect(nearest).not.toBeNull();
      expect(nearest?.price).toBe(2010); // Closest above
    });

    it("should return nearest level below price", () => {
      const levels: LiquidityLevel[] = [
        { price: 1980, time: 1000, type: "sell-side", source: "swing", strength: 1.0, tested: false },
        { price: 1990, time: 1001, type: "sell-side", source: "swing", strength: 1.0, tested: false }, // Closest
        { price: 1970, time: 1002, type: "sell-side", source: "swing", strength: 1.0, tested: false },
      ];

      const nearest = getNearestLiquidity(levels, 2000, "below");
      
      expect(nearest).not.toBeNull();
      expect(nearest?.price).toBe(1990); // Closest below
    });
  });
});