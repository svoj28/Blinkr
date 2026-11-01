import QRCode from 'qrcode';
import { useMemo } from 'react';
import { View } from 'react-native';

type QrCodeProps = {
  value: string;
  /** Roughly how wide to draw it; rounded down so every module is whole pixels. */
  size: number;
  accessibilityLabel?: string;
};

/**
 * A QR code drawn with plain Views (no SVG needed). Always dark on white, even in dark
 * mode, because that's what camera scanners read best. Leave padding around it for the
 * quiet zone.
 */
export function QrCode({ value, size, accessibilityLabel }: QrCodeProps) {
  const runs = useMemo(() => {
    const modules = QRCode.create(value, { errorCorrectionLevel: 'M' }).modules;
    // Merge neighbouring dark modules in each row into one bar, to keep the view count low.
    const bars: { row: number; col: number; length: number }[] = [];
    for (let row = 0; row < modules.size; row++) {
      let start = -1;
      for (let col = 0; col <= modules.size; col++) {
        const dark = col < modules.size && modules.get(row, col);
        if (dark && start < 0) start = col;
        if (!dark && start >= 0) {
          bars.push({ row, col: start, length: col - start });
          start = -1;
        }
      }
    }
    return { count: modules.size, bars };
  }, [value]);

  const cell = Math.max(1, Math.floor(size / runs.count));
  const side = cell * runs.count;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: side, height: side, backgroundColor: '#FFFFFF' }}>
      {runs.bars.map((bar) => (
        <View
          key={`${bar.row}-${bar.col}`}
          style={{
            position: 'absolute',
            top: bar.row * cell,
            left: bar.col * cell,
            width: bar.length * cell,
            height: cell,
            backgroundColor: '#15171A',
          }}
        />
      ))}
    </View>
  );
}
