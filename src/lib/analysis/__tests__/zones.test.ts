import { 
  calculatePremiumDiscountZones, 
  getPriceZone, 
  calculateFibLevels, 
  determineBias 
} from "../zones";
import { Candle, MarketStructure, PremiumDiscountZones } from "../types";

describe("Zone Calculations", () => {
  describe("calculatePremiumDiscountZones", () => {
    it("should calculate correct zones from candle range", () => {
      const candles: Candle[] = [
        { time: 1, open: 2000, high: 2050, low: 1990, close: 2040 },
        { time: 2, open: 2040, high: 2060, low: 2030, close: 2050 },
        { time: 3, open: 2050, high: 2070, low: 2040, close: 2060 },
        { time: 4, open: 2060, high: 2080, low: 2050, close: 2070 },
        { time: 5, open: 2070, high: 2090, low: 2060, close: 2080 },
      ];

      const zones = calculatePremiumDiscountZones(candles, 5);
      
      expect(zones.rangeHigh).toBe(2090);
      expect(zones.rangeLow).toBe(1990);
      expect(zones.equilibrium).toBe(2040);
      expect(zones.premium.top).toBe(2090);
      expect(zones.premium.bottom).toBe(2040);
      expect(zones.discount.top).toBe(2040);
      expect(zones.discount.bottom).toBe(1990);
    });

    it("should handle edge case with minimal candles", () => {
      const candles: Candle[] = [
        { time: 1, open: 2000, high: 2010, low: 1995, close: 2005 },
      ];

      const zones = calculatePremiumDiscountZones(candles, 1);
      
      expect(zones.rangeHigh).toBe(2010);
      expect(zones.rangeLow).toBe(1995);
      expect(zones.equilibrium).toBe(2002.5);
    });
  });

  describe("getPriceZone", () => {
    it("should correctly identify premium zone", () => {
      const zones: PremiumDiscountZones = {
        rangeHigh: 2090,
        rangeLow: 1990,
        premium: { top: 2090, bottom: 2040 },
        equilibrium: 2040,
        discount: { top: 2040, bottom: 1990 },
      };

      expect(getPriceZone(2050, zones)).toBe("premium");
      expect(getPriceZone(2090, zones)).toBe("premium");
    });

    it("should correctly identify discount zone", () => {
      const zones: PremiumDiscountZones = {
        rangeHigh: 2090,
        rangeLow: 1990,
        premium: { top: 2090, bottom: 2040 },
        equilibrium: 2040,
        discount: { top: 2040, bottom: 1990 },
      };

      expect(getPriceZone(2000, zones)).toBe("discount");
      expect(getPriceZone(1990, zones)).toBe("discount");
    });

    it("should correctly identify equilibrium zone", () => {
      const zones: PremiumDiscountZones = {
        rangeHigh: 2090,
        rangeLow: 1990,
        premium: { top: 2090, bottom: 2040 },
        equilibrium: 2040,
        discount: { top: 2040, bottom: 1990 },
      };

      expect(getPriceZone(2040, zones)).toBe("equilibrium");
      expect(getPriceZone(2039, zones)).toBe("discount"); // Just below equilibrium
      expect(getPriceZone(2041, zones)).toBe("premium"); // Just above equilibrium
    });
  });

  describe("calculateFibLevels", () => {
    it("should calculate correct Fibonacci levels", () => {
      const fib = calculateFibLevels(2090, 1990);
      
      expect(fib["0"]).toBe(2090);
      expect(fib["1"]).toBe(1990);
      expect(fib["0.5"]).toBe(2040); // 50% retracement
      expect(fib["0.618"]).toBeCloseTo(2028.2, 0.1); // 61.8% retracement
      expect(fib["0.382"]).toBeCloseTo(2051.8, 0.1); // 38.2% retracement
    });
  });

  describe("determineBias", () => {
    it("should favor bullish bias when in discount with bullish structure", () => {
      const structure: MarketStructure = {
        swings: [],
        trend: "bullish",
        bos: [],
        choch: [],
        higherHighs: [],
        higherLows: [],
        lowerHighs: [],
        lowerLows: [],
      };

      const zones: PremiumDiscountZones = {
        rangeHigh: 2090,
        rangeLow: 1990,
        premium: { top: 2090, bottom: 2040 },
        equilibrium: 2040,
        discount: { top: 2040, bottom: 1990 },
      };

      // Price in discount (below equilibrium)
      const bias = determineBias(structure, zones, 2000);
      expect(bias).toBe("bullish");
    });

    it("should favor bearish bias when in premium with bearish structure", () => {
      const structure: MarketStructure = {
        swings: [],
        trend: "bearish",
        bos: [],
        choch: [],
        higherHighs: [],
        higherLows: [],
        lowerHighs: [],
        lowerLows: [],
      };

      const zones: PremiumDiscountZones = {
        rangeHigh: 2090,
        rangeLow: 1990,
        premium: { top: 2090, bottom: 2040 },
        equilibrium: 2040,
        discount: { top: 2040, bottom: 1990 },
      };

      // Price in premium (above equilibrium)
      const bias = determineBias(structure, zones, 2070);
      expect(bias).toBe("bearish");
    });

    it("should return neutral when structure and zone conflict", () => {
      const structure: MarketStructure = {
        swings: [],
        trend: "bullish",
        bos: [],
        choch: [],
        higherHighs: [],
        higherLows: [],
        lowerHighs: [],
        lowerLows: [],
      };

      const zones: PremiumDiscountZones = {
        rangeHigh: 2090,
        rangeLow: 1990,
        premium: { top: 2090, bottom: 2040 },
        equilibrium: 2040,
        discount: { top: 2040, bottom: 1990 },
      };

      // Bullish structure but price in premium
      const bias = determineBias(structure, zones, 2070);
      expect(bias).toBe("neutral");
    });
  });
});