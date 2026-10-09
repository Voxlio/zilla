import { detectSwingPoints, detectMarketStructure } from "../structure";
import { Candle } from "../types";

describe("Market Structure Detection", () => {
  describe("detectSwingPoints", () => {
    it("should detect swing highs and lows in trending data", () => {
      const candles: Candle[] = [
        { time: 1, open: 10, high: 12, low: 9, close: 11 },
        { time: 2, open: 11, high: 13, low: 10, close: 12 }, // High
        { time: 3, open: 12, high: 14, low: 11, close: 13 },
        { time: 4, open: 13, high: 15, low: 12, close: 14 }, // Higher High
        { time: 5, open: 14, high: 13, low: 11, close: 12 },
        { time: 6, open: 13, high: 12, low: 10, close: 11 }, // Low
        { time: 7, open: 12, high: 11, low: 9, close: 10 },
        { time: 8, open: 11, high: 10, low: 8, close: 9 }, // Lower Low
      ];

      const swings = detectSwingPoints(candles, 1);

      // Should detect swing points
      expect(swings.length).toBeGreaterThan(0);
      
      // Check that we have both high and low swings
      const highs = swings.filter(s => s.type === "high");
      const lows = swings.filter(s => s.type === "low");
      
      expect(highs.length).toBeGreaterThan(0);
      expect(lows.length).toBeGreaterThan(0);
      
      // Check that prices make sense
      expect(highs[0].price).toBeGreaterThan(lows[0].price);
    });

    it("should return empty array for insufficient data", () => {
      const candles: Candle[] = [
        { time: 1, open: 10, high: 12, low: 9, close: 11 },
        { time: 2, open: 11, high: 13, low: 10, close: 12 },
      ];

      const swings = detectSwingPoints(candles, 2);
      expect(swings.length).toBe(0);
    });
  });

  describe("detectMarketStructure", () => {
    it("should detect bullish trend with HH/HL", () => {
      // Create candles that form a clear uptrend
      const candles: Candle[] = [
        { time: 1, open: 100, high: 105, low: 99, close: 104 },
        { time: 2, open: 104, high: 106, low: 103, close: 105 }, // HL
        { time: 3, open: 105, high: 107, low: 104, close: 106 },
        { time: 4, open: 106, high: 108, low: 105, close: 107 }, // HH
        { time: 5, open: 107, high: 109, low: 106, close: 108 },
        { time: 6, open: 108, high: 110, low: 107, close: 109 }, // HL
        { time: 7, open: 109, high: 111, low: 108, close: 110 },
        { time: 8, open: 110, high: 112, low: 109, close: 111 }, // HH
      ];

      const swings = detectSwingPoints(candles, 1);
      const structure = detectMarketStructure(candles, swings);

      expect(structure.trend).toBe("bullish");
      expect(structure.higherHighs.length).toBeGreaterThan(0);
      expect(structure.higherLows.length).toBeGreaterThan(0);
      expect(structure.lowerHighs.length).toBe(0);
      expect(structure.lowerLows.length).toBe(0);
    });

    it("should detect bearish trend with LH/LL", () => {
      // Create candles that form a clear downtrend
      const candles: Candle[] = [
        { time: 1, open: 110, high: 112, low: 108, close: 109 },
        { time: 2, open: 109, high: 110, low: 107, close: 108 }, // LH
        { time: 3, open: 108, high: 109, low: 106, close: 107 },
        { time: 4, open: 107, high: 108, low: 105, close: 106 }, // LH
        { time: 5, open: 106, high: 107, low: 104, close: 105 },
        { time: 6, open: 105, high: 106, low: 103, close: 104 }, // LL
        { time: 7, open: 104, high: 105, low: 102, close: 103 },
        { time: 8, open: 103, high: 104, low: 101, close: 102 }, // LL
      ];

      const swings = detectSwingPoints(candles, 1);
      const structure = detectMarketStructure(candles, swings);

      expect(structure.trend).toBe("bearish");
      expect(structure.lowerHighs.length).toBeGreaterThan(0);
      expect(structure.lowerLows.length).toBeGreaterThan(0);
      expect(structure.higherHighs.length).toBe(0);
      expect(structure.higherLows.length).toBe(0);
    });

    it("should detect BOS and CHoCH", () => {
      // Create data with a clear BOS and CHoCH
      const candles: Candle[] = [
        // Initial uptrend
        { time: 1, open: 100, high: 105, low: 99, close: 104 },
        { time: 2, open: 104, high: 106, low: 103, close: 105 },
        { time: 3, open: 105, high: 108, low: 104, close: 107 }, // HH
        { time: 4, open: 107, high: 109, low: 106, close: 108 },
        { time: 5, open: 108, high: 110, low: 107, close: 109 }, // HH
        // Pullback forming potential CHoCH
        { time: 6, open: 109, high: 109, low: 102, close: 103 },
        { time: 7, open: 103, high: 105, low: 101, close: 104 },
        { time: 8, open: 104, high: 106, low: 102, close: 105 },
        // Break below previous low (BOS to downside)
        { time: 9, open: 105, high: 106, low: 100, close: 101 },
        { time: 10, open: 101, high: 102, low: 99, close: 100 },
        { time: 11, open: 100, high: 101, low: 98, close: 99 },
      ];

      const swings = detectSwingPoints(candles, 1);
      const structure = detectMarketStructure(candles, swings);

      expect(structure.bos.length).toBeGreaterThan(0);
      expect(structure.choch.length).toBeGreaterThan(0);
      
      // Last BOS should be bearish (break below previous low)
      const lastBOS = structure.bos[structure.bos.length - 1];
      expect(lastBOS.direction).toBe("bearish");
    });
  });
});