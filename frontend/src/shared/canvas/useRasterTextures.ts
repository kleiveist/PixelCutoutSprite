import { useEffect, useState } from "react";
interface Raster {
  readonly partId: string;
  readonly width: number;
  readonly height: number;
}
/** One disposable texture per loaded asset, shared by canvas and thumbnails. */
export function useRasterTextures(
  assets: readonly Raster[],
  pixels: ReadonlyMap<string, Uint8ClampedArray>,
) {
  const [textures, setTextures] = useState<ReadonlyMap<string, HTMLCanvasElement>>(new Map());
  useEffect(() => {
    const next = new Map<string, HTMLCanvasElement>();
    for (const asset of assets) {
      const rgba = pixels.get(asset.partId);
      if (!rgba) continue;
      const canvas = document.createElement("canvas");
      canvas.width = asset.width;
      canvas.height = asset.height;
      const context = canvas.getContext("2d");
      if (context)
        context.putImageData(
          new ImageData(new Uint8ClampedArray(rgba), asset.width, asset.height),
          0,
          0,
        );
      next.set(asset.partId, canvas);
    }
    setTextures(next);
    return () => {
      next.forEach((texture) => {
        texture.width = 0;
        texture.height = 0;
      });
      next.clear();
    };
  }, [assets, pixels]);
  return textures;
}
