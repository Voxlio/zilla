import { detectFVGs, mitigateFVGs, getUnmitigatedFVGs, getNearestFVG } from "../fvg";
import { Candle, FVG } from "../types";

/**
 * A fair value gap is a 3-candle pattern. The middle candle runs far enough
 * that candle 1 and candle 3 do not overlap, leaving a band of price that never
 * traded.
 *
 *   BULLISH (gap up):   candles[2].low  > candles[0].high
 *                       band = candles[0].high .. candles[2].low
 *   BEARISH (gap down): candles[2].high < candles[0].low
 *                       band = candles[2].high .. candles[0].low
 *
 * Every candle below is a valid candle: low <= open <= high and
 * low <= close <= high. If a test needs an impossible candle to pass, the
 * implementation is wrong, not the test.
 */

/** Build a valid candle, deriving open/close from the range if not given. */
function candle(
  time: number,
  low: number,
  high: number,
  open = low + (high - low) * 0.25,
  close = low + (high - low) * 0.75
): Candle {
  if (low > high) throw new Error(`invalid candle: low ${low} > high ${high}`);
  return { time, open, high, low, close };
}

describe("FVG Detection", () => {
  describe("detectFVGs", () => {
    it("labels a gap UP as bullish and spans prev.high to next.low", () => {
      // c0 tops out at 101. c1 runs hard up. c2 bottoms at 105.
      // Nothing ever traded between 101 and 105 -> bullish FVG.
      const candles: Candle[] = [
        candle(1, 99, 101),
        candle(2, 100.8, 110),
        candle(3, 105, 112),
      ];

      const fvgs = detectFVGs(candles);

      expect(fvgs.length).toBe(1);
      expect(fvgs[0].type).toBe("bullish");
      expect(fvgs[0].bottom).toBe(101); // candles[0].high
      expect(fvgs[0].top).toBe(105); // candles[2].low
      expect(fvgs[0].index).toBe(1); // indexed by the middle candle
      expect(fvgs[0].top).toBeGreaterThan(fvgs[0].bottom);
    });

    it("labels a gap DOWN as bearish and spans next.high to prev.low", () => {
      // c0 bottoms at 109. c1 runs hard down. c2 tops out at 105.
      // Nothing ever traded between 105 and 109 -> bearish FVG.
      const candles: Candle[] = [
        candle(1, 109, 112),
        candle(2, 100, 109.2),
        candle(3, 99, 105),
      ];

      const fvgs = detectFVGs(candles);

      expect(fvgs.length).toBe(1);
      expect(fvgs[0].type).toBe("bearish");
      expect(fvgs[0].bottom).toBe(105); // candles[2].high
      expect(fvgs[0].top).toBe(109); // candles[0].low
      expect(fvgs[0].index).toBe(1);
      expect(fvgs[0].top).toBeGreaterThan(fvgs[0].bottom);
    });

    it("does not report a gap when candle 1 and candle 3 overlap", () => {
      // c2 low (100) is below c0 high (101), so the ranges touch - no void.
      const candles: Candle[] = [
        candle(1, 99, 101),
        candle(2, 100, 108),
        candle(3, 100, 107),
      ];

      expect(detectFVGs(candles).length).toBe(0);
    });

    it("treats an exactly-touching range as no gap (strict inequality)", () => {
      // c2.low === c0.high === 101. Price did trade at 101, so there is no void.
      const candles: Candle[] = [
        candle(1, 99, 101),
        candle(2, 100.5, 108),
        candle(3, 101, 107),
      ];

      expect(detectFVGs(candles).length).toBe(0);
    });

    it("returns an empty array when there are fewer than 3 candles", () => {
      expect(detectFVGs([candle(1, 99, 105), candle(2, 103, 106)]).length).toBe(0);
      expect(detectFVGs([]).length).toBe(0);
    });

    it("finds every gap in a series, including overlapping windows", () => {
      const candles: Candle[] = [
        candle(1, 99, 101),
        candle(2, 100.8, 110),
        candle(3, 105, 112),
        candle(4, 111.5, 120),
        candle(5, 115, 122),
      ];

      const fvgs = detectFVGs(candles);

      // Three sliding windows each leave a void, and they are allowed to
      // overlap - window (c1,c2,c3) gaps 110->111.5 just as (c0,c1,c2) gaps
      // 101->105 and (c2,c3,c4) gaps 112->115.
      expect(fvgs.length).toBe(3);
      expect(fvgs.every(f => f.type === "bullish")).toBe(true);
      expect(fvgs.map(f => [f.bottom, f.top])).toEqual([
        [101, 105],
        [110, 111.5],
        [112, 115],
      ]);
    });
  });

  describe("mitigateFVGs", () => {
    it("mitigates a bullish gap once price trades down through its bottom", () => {
      // Gap indexed at 1, so candles 0-2 formed it; filling can only start at 3.
      const fvgs: FVG[] = [
        { index: 1, time: 1000, top: 105, bottom: 100, type: "bullish", mitigated: false },
      ];

      const candles: Candle[] = [
        candle(1000, 101, 104),
        candle(1001, 102, 105),
        candle(1002, 103, 106),
        candle(1003, 99, 106), // low 99 <= bottom 100 -> filled
        candle(1004, 102, 107),
      ];

      const [result] = mitigateFVGs(fvgs, candles);
      expect(result.mitigated).toBe(true);
      expect(result.mitigationIndex).toBe(3);
    });

    it("mitigates a bearish gap once price trades up through its top", () => {
      const fvgs: FVG[] = [
        { index: 1, time: 1000, top: 105, bottom: 100, type: "bearish", mitigated: false },
      ];

      const candles: Candle[] = [
        candle(1000, 95, 99),
        candle(1001, 96, 101),
        candle(1002, 97, 102),
        candle(1003, 98, 106), // high 106 >= top 105 -> filled
        candle(1004, 100, 108),
      ];

      const [result] = mitigateFVGs(fvgs, candles);
      expect(result.mitigated).toBe(true);
      expect(result.mitigationIndex).toBe(3);
    });

    it("leaves a gap unmitigated when price only partially enters it", () => {
      // Bullish gap 100-105. Price dips to 102, inside the band but not through it.
      const fvgs: FVG[] = [
        { index: 1, time: 1000, top: 105, bottom: 100, type: "bullish", mitigated: false },
      ];

      const candles: Candle[] = [
        candle(1000, 104, 108),
        candle(1001, 103, 107),
        candle(1002, 102, 106),
        candle(1003, 103, 109),
      ];

      const [result] = mitigateFVGs(fvgs, candles);
      expect(result.mitigated).toBe(false);
      expect(result.mitigationIndex).toBeUndefined();
    });

    it("ignores candles at or before the gap's own formation", () => {
      // The gap is indexed at 3, so candles 0-4 formed it and cannot fill it.
      // Only candle 5 onward counts.
      const fvgs: FVG[] = [
        { index: 3, time: 1003, top: 105, bottom: 100, type: "bullish", mitigated: false },
      ];

      const candles: Candle[] = [
        candle(1000, 90, 95), // would "fill" it, but predates the gap
        candle(1001, 91, 96),
        candle(1002, 99, 104),
        candle(1003, 101, 110),
        candle(1004, 106, 112),
        candle(1005, 107, 113),
      ];

      const [result] = mitigateFVGs(fvgs, candles);
      expect(result.mitigated).toBe(false);
    });

    it("does not mutate the array it was given", () => {
      const fvgs: FVG[] = [
        { index: 1, time: 1000, top: 105, bottom: 100, type: "bullish", mitigated: false },
      ];
      const candles: Candle[] = [
        candle(1000, 101, 104),
        candle(1001, 102, 105),
        candle(1002, 99, 106),
      ];

      mitigateFVGs(fvgs, candles);
      expect(fvgs[0].mitigated).toBe(false);
    });
  });

  describe("getUnmitigatedFVGs", () => {
    it("returns only unmitigated FVGs", () => {
      const fvgs: FVG[] = [
        { index: 1, time: 1000, top: 105, bottom: 100, type: "bullish", mitigated: false },
        { index: 3, time: 1002, top: 110, bottom: 105, type: "bearish", mitigated: true },
        { index: 5, time: 1004, top: 115, bottom: 110, type: "bullish", mitigated: false },
      ];

      const unmitigated = getUnmitigatedFVGs(fvgs);
      expect(unmitigated.length).toBe(2);
      expect(unmitigated.map(f => f.index)).toEqual([1, 5]);
    });
  });

  describe("getNearestFVG", () => {
    const fvgs: FVG[] = [
      { index: 1, time: 1000, top: 95, bottom: 90, type: "bullish", mitigated: false },
      { index: 2, time: 1001, top: 105, bottom: 100, type: "bullish", mitigated: false },
      { index: 3, time: 1002, top: 125, bottom: 120, type: "bearish", mitigated: false },
      { index: 4, time: 1003, top: 145, bottom: 140, type: "bearish", mitigated: false },
      { index: 5, time: 1004, top: 115, bottom: 110, type: "bullish", mitigated: true },
    ];

    it("returns the closest gap above the price", () => {
      // From 108: gaps above are 120-125 and 140-145. Closest bottom is 120.
      expect(getNearestFVG(fvgs, 108, "above")?.bottom).toBe(120);
    });

    it("returns the closest gap below the price", () => {
      // From 108: gaps below are 90-95 and 100-105. Closest top is 105.
      expect(getNearestFVG(fvgs, 108, "below")?.top).toBe(105);
    });

    it("skips mitigated gaps", () => {
      // 110-115 is mitigated, so searching below 118 must skip past it to 105.
      expect(getNearestFVG(fvgs, 118, "below")?.top).toBe(105);
    });

    it("returns null when nothing lies in that direction", () => {
      expect(getNearestFVG(fvgs, 200, "above")).toBeNull();
      expect(getNearestFVG(fvgs, 10, "below")).toBeNull();
    });
  });

  describe("end to end", () => {
    it("detects and mitigates in one pass via detectFVGs", () => {
      // A gap up from 101 to 105, then price comes all the way back down
      // through 101 and fills it.
      const candles: Candle[] = [
        candle(1, 99, 101),
        candle(2, 100.8, 110),
        candle(3, 105, 112),
        candle(4, 102, 106),
        candle(5, 98, 103), // low 98 <= bottom 101 -> filled
      ];

      const fvgs = detectFVGs(candles);
      const bullish = fvgs.filter(f => f.type === "bullish" && f.bottom === 101);

      expect(bullish.length).toBe(1);
      expect(bullish[0].mitigated).toBe(true);
    });
  });
});
