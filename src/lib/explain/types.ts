// Explanation engine types

import { TradeIdea, Reason } from "@/lib/analysis/types";

export interface DailyThesis {
  badge: "bullish" | "bearish";
  title: string;
  summary: string;
}

export interface PriceActionSection {
  title: string;
  content: string;
}

export interface M15Breakdown {
  title: string;
  items: string[];
}

export interface LiquidityLevelsSection {
  buySide: string[];
  sellSide: string[];
}

export interface WhatToWatch {
  invalidationLevel: number;
  liquidityDraw: number;
  note?: string;
}

export interface AnalysisReport {
  dailyThesis: DailyThesis;
  currentPriceAction: PriceActionSection;
  m15Breakdown: M15Breakdown;
  liquidityLevels: LiquidityLevelsSection;
  whatToWatch: WhatToWatch;
  timestamp: string;
  price: number;
}

export interface WhyThisTrade {
  reason: string;
  weight: number;
  category: string;
  variant?: string; // Different phrasing variant
}

export interface SimpleSummary {
  sentences: string[];
}

export interface FullReport {
  analysisReport: AnalysisReport;
  whyThisTrade: WhyThisTrade[];
  simpleSummary: SimpleSummary;
  disclaimer: string;
}

export interface PhrasingVariant {
  bullish: string[];
  bearish: string[];
  neutral: string[];
}

export interface ExplanationConfig {
  phrasingVariants: {
    [key: string]: PhrasingVariant;
  };
}

// Default phrasing variants for different reasons
export const defaultPhrasingVariants: ExplanationConfig["phrasingVariants"] = {
  "Market Structure Trend": {
    bullish: [
      "Price is printing higher highs and higher lows, confirming a bullish structure.",
      "The market structure has shifted bullish with clear HH/HL formation.",
      "Uptrend intact: each pullback finds support above the prior low.",
    ],
    bearish: [
      "Price is printing lower highs and lower lows, confirming a bearish structure.",
      "The market structure has shifted bearish with clear LH/LL formation.",
      "Downtrend intact: each rally fails below the prior high.",
    ],
    neutral: [
      "Price is ranging with no clear structural direction.",
      "Market structure is choppy - neither bulls nor bears have control.",
      "Consolidation phase: waiting for a clear break of structure.",
    ],
  },
  "Break of Structure": {
    bullish: [
      "A bullish BOS confirms the uptrend continuation.",
      "Price broke above the recent swing high, signaling strength.",
      "Break of structure to the upside validates the bullish bias.",
    ],
    bearish: [
      "A bearish BOS confirms the downtrend continuation.",
      "Price broke below the recent swing low, signaling weakness.",
      "Break of structure to the downside validates the bearish bias.",
    ],
    neutral: [],
  },
  "Change of Character": {
    bullish: [
      "A bullish CHoCH signals a potential trend reversal to the upside.",
      "Change of character confirms the shift from bearish to bullish structure.",
      "CHoCH to the upside suggests the downtrend has ended.",
    ],
    bearish: [
      "A bearish CHoCH signals a potential trend reversal to the downside.",
      "Change of character confirms the shift from bullish to bearish structure.",
      "CHoCH to the downside suggests the uptrend has ended.",
    ],
    neutral: [],
  },
  "Unmitigated Bullish FVG": {
    bullish: [
      "An unmitigated bullish FVG sits below current price - a potential support zone to buy a pullback into.",
      "Fresh bullish FVG waiting to be tested, offering a discount entry.",
      "Unfilled imbalance beneath price remains untouched, and price tends to come back for it.",
    ],
    bearish: [],
    neutral: [],
  },
  "Unmitigated Bearish FVG": {
    bearish: [
      "An unmitigated bearish FVG sits above current price - a potential resistance zone to sell a rally into.",
      "Fresh bearish FVG waiting to be tested, offering a premium entry.",
      "Unfilled imbalance above price remains untouched, and price tends to come back for it.",
    ],
    bullish: [],
    neutral: [],
  },
  "Buy-Side Liquidity": {
    bullish: [
      "Buy-side liquidity rests above - a magnet for price discovery.",
      "Untested buy-side liquidity acts as a target for upside moves.",
      "Swing highs hold stops that could fuel a continuation higher.",
    ],
    bearish: [],
    neutral: [],
  },
  "Sell-Side Liquidity": {
    bearish: [
      "Sell-side liquidity rests below - a magnet for price discovery.",
      "Untested sell-side liquidity acts as a target for downside moves.",
      "Swing lows hold stops that could fuel a continuation lower.",
    ],
    bullish: [],
    neutral: [],
  },
  "Price Location": {
    bullish: [
      "Price sits in the discount zone - favorable for long entries.",
      "Trading below equilibrium offers better risk-reward for buys.",
      "Discount zone entry aligns with institutional buy programs.",
    ],
    bearish: [
      "Price sits in the premium zone - favorable for short entries.",
      "Trading above equilibrium offers better risk-reward for sells.",
      "Premium zone entry aligns with institutional sell programs.",
    ],
    neutral: [
      "Price hovers near equilibrium - no clear zone advantage.",
      "Fair value area: neither premium nor discount dominates.",
    ],
  },
  "Session Position": {
    bullish: [
      "Price near session lows suggests potential for a bounce.",
      "Session low holds as support - bullish for intraday bias.",
    ],
    bearish: [
      "Price near session highs suggests potential for a rejection.",
      "Session high acts as resistance - bearish for intraday bias.",
    ],
    neutral: [
      "Price mid-session range - no session-level edge.",
    ],
  },
  "London/NY Overlap": {
    bullish: [
      "London/NY overlap liquidity pool below - potential draw target.",
      "Overlap low holds - bullish for the session.",
    ],
    bearish: [
      "London/NY overlap liquidity pool above - potential draw target.",
      "Overlap high holds - bearish for the session.",
    ],
    neutral: [],
  },
  "Calendar": {
    bullish: [
      "{event} came in {diff} vs forecast - USD weakening, gold bullish.",
      "Weaker {event} data supports the case for lower yields and higher gold.",
      "{event} miss signals potential Fed dovishness - bullish for gold.",
    ],
    bearish: [
      "{event} came in {diff} vs forecast - USD strengthening, gold bearish.",
      "Stronger {event} data supports higher yields and a stronger dollar.",
      "{event} beat signals potential Fed hawkishness - bearish for gold.",
    ],
    neutral: [],
  },
  "News Sentiment": {
    bullish: [
      "Headlines lean bullish: dovish Fed talk and safe-haven demand dominate.",
      "Media narrative favors gold: rate cut expectations and geopolitical tension.",
      "News flow supports bullish bias with {bullishScore} vs {bearishScore} sentiment score.",
    ],
    bearish: [
      "Headlines lean bearish: hawkish Fed rhetoric and strong dollar narrative.",
      "Media narrative weighs on gold: tightening cycle and risk-on sentiment.",
      "News flow supports bearish bias with {bearishScore} vs {bullishScore} sentiment score.",
    ],
    neutral: [
      "Mixed headlines - no clear fundamental narrative emerges.",
    ],
  },
  "Volatility Warning": {
    bullish: [],
    bearish: [],
    neutral: [
      "⚠️ High-impact USD event within 4 hours - expect volatility.",
      "⚠️ Major news pending - avoid new entries until after release.",
      "⚠️ NFP/CPI/FOMC upcoming - spreads may widen, SL risk increases.",
    ],
  },
};

// Analogy templates for simple summary
export const analogyTemplates = {
  bullish: [
    "Think of gold like a ball bouncing up stairs - it pauses on each step (support) before jumping to the next. Right now it's on a step at {entry} and could bounce up to {tp1} or even {tp2}. But if the stairs break below {sl}, the ball rolls down.",
    "Imagine gold climbing a ladder. Each rung is a level of support. It's currently holding at {entry} and reaching for {tp1} then {tp2}. If the rung at {sl} snaps, it falls.",
    "Gold is like a spring being compressed at {entry}. When released, it aims for {tp1} then {tp2}. The safety catch is at {sl} - if that breaks, the spring uncoils the other way.",
  ],
  bearish: [
    "Think of gold like a ball rolling down a hill - it picks up speed as it goes. Right now it's at {entry} and could roll to {tp1} then {tp2}. But if it hits a bump at {sl}, it might bounce back up.",
    "Imagine gold sliding down a slide. It starts at {entry} and accelerates toward {tp1} then {tp2}. The only thing stopping it is a barrier at {sl}.",
    "Gold is like a rock falling off a cliff at {entry}. It targets {tp1} then {tp2} on the way down. A ledge at {sl} could catch it, but that's unlikely.",
  ],
  neutral: [
    "Gold is like a car idling at a stoplight - it could go either way when the light changes. We're positioning at {entry} with a tight stop at {sl}, targeting {tp1} if it moves our way.",
    "Think of gold as a coiled spring at {entry} - it's storing energy but hasn't decided which way to release. We watch {sl} for the signal.",
    "Gold is resting at {entry}, like a cat deciding whether to pounce or walk away. Our plan: risk {sl} to catch a move to {tp1}.",
  ],
};