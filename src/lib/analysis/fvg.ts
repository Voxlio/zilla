import { Candle, FVG } from "./types";

/**
 * Detect Fair Value Gaps (FVGs) in candle data
 * @param candles Array of candles
 * @returns Array of FVG objects
 */
export function detectFVGs(candles: Candle[]): FVG[] {
  if (candles.length < 3) {
    return [];
  }

  const fvgs: FVG[] = [];

  // An FVG is a 3-candle pattern. The middle candle moves far enough that the
  // first and third candles do not overlap, leaving a price band that never
  // traded - the "gap". We index the FVG by the middle candle.
  //
  //   BULLISH (price gapped UP, the gap is unfilled support BELOW price):
  //     candles[i+1].low > candles[i-1].high
  //     gap band = prev.high (bottom) .. next.low (top)
  //
  //   BEARISH (price gapped DOWN, the gap is unfilled resistance ABOVE price):
  //     candles[i+1].high < candles[i-1].low
  //     gap band = next.high (bottom) .. prev.low (top)
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const current = candles[i];
    const next = candles[i + 1];

    // Bullish FVG: the third candle's whole range sits ABOVE the first candle's
    // high, so price jumped up and left a void beneath it.
    if (next.low > prev.high) {
      fvgs.push({
        index: i,
        time: current.time,
        top: next.low,
        bottom: prev.high,
        type: "bullish",
        mitigated: false,
      });
    }

    // Bearish FVG: the third candle's whole range sits BELOW the first candle's
    // low, so price dropped and left a void above it.
    if (next.high < prev.low) {
      fvgs.push({
        index: i,
        time: current.time,
        top: prev.low,
        bottom: next.high,
        type: "bearish",
        mitigated: false,
      });
    }
  }

  // Mark FVGs as mitigated if price has returned to the gap area
  return mitigateFVGs(fvgs, candles);
}

/**
 * Mitigate FVGs based on price action.
 *
 * "Mitigated" here means FULLY filled: price has traded all the way back
 * through the gap band. A bullish gap is filled when price trades down to its
 * bottom; a bearish gap is filled when price trades up to its top. A gap that
 * has only been partially entered still counts as unmitigated, so it remains
 * available as a reaction zone.
 *
 * @param fvgs Array of FVG objects
 * @param candles Array of candles
 * @returns Array of FVG objects with mitigation status updated
 */
export function mitigateFVGs(fvgs: FVG[], candles: Candle[]): FVG[] {
  // Create a copy to avoid mutating the original array
  const result = [...fvgs];

  // For each FVG, check if any subsequent candle has penetrated the gap
  for (let i = 0; i < result.length; i++) {
    const fvg = result[i];
    if (fvg.mitigated) continue; // Skip if already mitigated

    // Check candles after the FVG formation
    for (let j = fvg.index + 2; j < candles.length; j++) {
      const candle = candles[j];

      // For bullish FVG: check if price has dropped below the bottom of the gap
      if (fvg.type === "bullish" && candle.low <= fvg.bottom) {
        result[i] = {
          ...fvg,
          mitigated: true,
          mitigationIndex: j,
        };
        break;
      }

      // For bearish FVG: check if price has risen above the top of the gap
      if (fvg.type === "bearish" && candle.high >= fvg.top) {
        result[i] = {
          ...fvg,
          mitigated: true,
          mitigationIndex: j,
        };
        break;
      }
    }
  }

  return result;
}

/**
 * Get unmitigated FVGs
 * @param fvgs Array of FVG objects
 * @returns Array of unmitigated FVG objects
 */
export function getUnmitigatedFVGs(fvgs: FVG[]): FVG[] {
  return fvgs.filter(fvg => !fvg.mitigated);
}

/**
 * Get the nearest unmitigated FVG above or below a price
 * @param fvgs Array of FVG objects
 * @param price Current price
 * @param direction "above" or "below"
 * @returns Nearest FVG or null
 */
export function getNearestFVG(
  fvgs: FVG[],
  price: number,
  direction: "above" | "below"
): FVG | null {
  const unmitigated = getUnmitigatedFVGs(fvgs);
  
  if (direction === "above") {
    // Find FVGs where the bottom is above the price
    const above = unmitigated.filter(fvg => fvg.bottom > price);
    if (above.length === 0) return null;
    // Return the one with the smallest bottom (closest above)
    return above.reduce((closest, current) => 
      current.bottom < closest.bottom ? current : closest
    );
  } else {
    // Find FVGs where the top is below the price
    const below = unmitigated.filter(fvg => fvg.top < price);
    if (below.length === 0) return null;
    // Return the one with the largest top (closest below)
    return below.reduce((closest, current) => 
      current.top > closest.top ? current : closest
    );
  }
}