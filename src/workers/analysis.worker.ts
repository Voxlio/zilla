// Web Worker for analysis engine

import type { WorkerMessage, WorkerResponse, TradeIdea } from "@/lib/analysis/types";
import { Candle, Timeframe } from "@/lib/analysis/types";
import { detectSwingPoints } from "@/lib/analysis/structure";
import { detectMarketStructure } from "@/lib/analysis/structure";
import { detectFVGs, mitigateFVGs } from "@/lib/analysis/fvg";
import { 
  detectLiquidityFromSwings, 
  detectIntermediateLiquidity, 
  detectSessionRanges, 
  sessionRangesToLiquidity,
  combineLiquidityLevels,
  updateLiquidityTestedStatus 
} from "@/lib/analysis/liquidity";
import { calculatePremiumDiscountZones } from "@/lib/analysis/zones";
import { buildTradeIdea } from "@/lib/analysis/trade";
import { generateReasons } from "@/lib/analysis/reasons";
import { scoreFundamentals } from "@/lib/fundamentals/scorer";
import { FundamentalData, CalendarEvent, NewsHeadline } from "@/lib/fundamentals/types";
import { AssetConfig } from "@/lib/analysis/types";

// Mock asset config for XAUUSD
const XAUUSD_CONFIG: AssetConfig = {
  symbol: "XAUUSD",
  name: "XAU/USD",
  displayName: "Gold",
  pipSize: 0.01,
  contractSize: 100,
  marginCurrency: "USD",
};

// Type for analysis data in worker
interface AnalysisData {
  candles: Record<Timeframe, Candle[]>;
  fundamentalData: FundamentalData;
  assetConfig: AssetConfig;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type !== "analyze") return;

  try {
    const { candles, fundamentalData, assetConfig } = event.data.payload;
    const tradeIdea = await performAnalysis(candles, fundamentalData, assetConfig || XAUUSD_CONFIG);
    
    const response: WorkerResponse = {
      type: "result",
      payload: tradeIdea,
    };
    
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      type: "error",
      error: error instanceof Error ? error.message : "Unknown analysis error",
    };
    
    self.postMessage(response);
  }
};

async function performAnalysis(
  candles: Record<Timeframe, Candle[]>,
  fundamentalData: FundamentalData,
  assetConfig: AssetConfig
): Promise<TradeIdea> {
  // Use M15 as the primary timeframe for analysis
  const m15Candles = candles.M15 || [];
  const h1Candles = candles.H1 || [];
  const h4Candles = candles.H4 || [];
  const d1Candles = candles.D1 || [];

  if (m15Candles.length < 50) {
    throw new Error("Insufficient M15 candle data for analysis");
  }

  // 1. Market Structure Detection (on M15)
  const swings = detectSwingPoints(m15Candles, 2);
  const structure = detectMarketStructure(m15Candles, swings);

  // 2. FVG Detection (on M15)
  const fvgs = detectFVGs(m15Candles);
  const mitigatedFVGs = mitigateFVGs(fvgs, m15Candles);

  // 3. Liquidity Detection (from M15 swings + sessions)
  const swingLiquidity = detectLiquidityFromSwings(swings);
  const intermediateLiquidity = detectIntermediateLiquidity(m15Candles, swings);
  const sessions = detectSessionRanges(m15Candles);
  const sessionLiquidity = sessionRangesToLiquidity(sessions);
  
  // Combine all liquidity sources
  const combinedLiquidity = combineLiquidityLevels(
    swingLiquidity,
    intermediateLiquidity,
    sessionLiquidity,
    0.1 // proximity threshold for gold
  );
  
  // Update tested status
  const updatedLiquidity = updateLiquidityTestedStatus(combinedLiquidity, m15Candles);

  // 4. Premium/Discount Zones (from H4 or D1 for larger range)
  const zones = calculatePremiumDiscountZones(h4Candles.length > 0 ? h4Candles : d1Candles, 50);

  // 5. Current price (last M15 close)
  const currentPrice = m15Candles[m15Candles.length - 1]?.close || 0;

  // 6. Score fundamentals
  const scoredFundamentals = scoreFundamentals(fundamentalData.calendar, fundamentalData.headlines);

  // 7. Generate reasons
  const reasons = generateReasons({
    structure,
    fvgs: mitigatedFVGs,
    liquidity: updatedLiquidity,
    sessions,
    zones,
    fundamentalData: scoredFundamentals,
    currentPrice,
  });

  // 8. Build trade idea
  const tradeIdea = buildTradeIdea({
    symbol: assetConfig.symbol,
    currentPrice,
    structure,
    fvgs: mitigatedFVGs,
    liquidity: updatedLiquidity,
    sessions,
    zones,
    fundamentalData: scoredFundamentals,
    assetConfig,
    reasons,
  });

  return tradeIdea;
}

// Export for type checking
export type { WorkerMessage, WorkerResponse };