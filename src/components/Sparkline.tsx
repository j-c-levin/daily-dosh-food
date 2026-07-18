import { colors } from "../theme";

const WIDTH = 300;
const HEIGHT = 60;
const PAD = 0.1;

interface SparklineProps {
  values: number[];
}

export default function Sparkline({ values }: SparklineProps) {
  if (values.length === 0) {
    return <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" />;
  }

  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const padded = range * PAD;
  const scaledMin = min - padded;
  const scaledMax = max + padded;
  const scaledRange = scaledMax - scaledMin || 1;

  const toY = (v: number) => HEIGHT - ((v - scaledMin) / scaledRange) * HEIGHT;
  const zeroY = toY(0);

  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? 0 : (i / (values.length - 1)) * WIDTH;
      return `${x},${toY(v)}`;
    })
    .join(" ");

  const last = values[values.length - 1];
  const stroke = last >= 0 ? colors.positive : colors.negative;

  return (
    <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
      <polyline
        points={`0,${zeroY} ${WIDTH},${zeroY}`}
        fill="none"
        stroke="#3A3F47"
        strokeWidth="1.5"
        strokeDasharray="4,4"
      />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}
