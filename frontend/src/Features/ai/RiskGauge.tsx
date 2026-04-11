"use client";

import { riskScoreColor } from "@/lib/utils";

interface RiskGaugeProps {
  score: number;
  size?: number;
}

export function RiskGauge({ score, size = 160 }: RiskGaugeProps) {
  const color = riskScoreColor(score);
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score, 100) / 100;
  const dashOffset = circumference * (1 - progress);
  const center = size / 2;

  const riskLabel =
    score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted border"
          strokeWidth={10}
        />
        {/* Colored arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center text */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-4xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
      <span
        className="text-sm font-semibold"
        style={{ color }}
      >
        {riskLabel} RISK
      </span>
    </div>
  );
}
