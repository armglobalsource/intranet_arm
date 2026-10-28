import type {Paleta} from '@/hooks/usePaletas';

export function OutfitPalettePreview({palette}: {palette: Paleta}) {
  return <div className="sheet-outfit" aria-label={`Paleta de outfit: ${palette.name}`}>
    <strong>{palette.name}</strong>
    <div className="sheet-swatches">{palette.colors.map((color, i) => <div key={`${color.hex}-${i}`}>
      <span className="sheet-swatch" role="img" aria-label={`${color.name}: ${color.hex}`} style={{backgroundColor: /^#[0-9a-f]{3,8}$/i.test(color.hex) ? color.hex : '#fff'}} />
      <span>{color.name}</span>
    </div>)}</div>
  </div>;
}
