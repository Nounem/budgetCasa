import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg';

export interface Segment {
  valeur: number;
  couleur: string;
  label: string;
}

function polaire(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function DonutChart({
  segments,
  taille = 180,
  couleurFond = '#111827',
}: {
  segments: Segment[];
  taille?: number;
  couleurFond?: string;
}) {
  const cx = taille / 2;
  const cy = taille / 2;
  const rExt = taille * 0.44;
  const rInt = taille * 0.26;

  const total = segments.reduce((s, seg) => s + Math.max(0, seg.valeur), 0);
  if (total === 0) return null;

  let angle = -90;
  const chemins = segments
    .filter(s => s.valeur > 0)
    .map(seg => {
      const sweep = (seg.valeur / total) * 360;
      const debut = angle;
      const fin = angle + sweep - 1; // -1 pour laisser un petit gap
      angle += sweep;

      const p1 = polaire(cx, cy, rExt, debut);
      const p2 = polaire(cx, cy, rExt, fin);
      const grand = sweep > 180 ? 1 : 0;

      const chemin = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${rExt} ${rExt} 0 ${grand} 1 ${p2.x} ${p2.y} Z`;
      return { ...seg, chemin, pct: Math.round((seg.valeur / total) * 100) };
    });

  return (
    <Svg width={taille} height={taille}>
      {chemins.map((c, i) => (
        <Path key={i} d={c.chemin} fill={c.couleur} />
      ))}
      {/* Cercle intérieur pour l'effet donut */}
      <Circle cx={cx} cy={cy} r={rInt} fill={couleurFond} />
    </Svg>
  );
}
