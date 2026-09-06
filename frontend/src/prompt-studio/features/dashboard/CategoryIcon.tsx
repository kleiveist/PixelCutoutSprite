import type { SVGProps } from "react";
import {
  ArtworkIcon,
  BuildingIcon,
  CharacterIcon,
  ItemIcon,
  MovingObjectIcon,
  NatureIcon,
  StaticObjectIcon,
  TextureIcon,
  TilesetIcon,
} from "../../components/icons";
import type { AssetCategory } from "../../domain/assets";

const categoryIcons = {
  character: CharacterIcon,
  movingObject: MovingObjectIcon,
  staticObject: StaticObjectIcon,
  texture: TextureIcon,
  nature: NatureIcon,
  building: BuildingIcon,
  tileset: TilesetIcon,
  item: ItemIcon,
  artwork: ArtworkIcon,
} as const satisfies Record<AssetCategory, (props: SVGProps<SVGSVGElement>) => React.JSX.Element>;

export interface CategoryIconProps extends SVGProps<SVGSVGElement> {
  readonly category: AssetCategory;
}

export function CategoryIcon({ category, ...props }: CategoryIconProps) {
  const Icon = categoryIcons[category];
  return <Icon {...props} />;
}
