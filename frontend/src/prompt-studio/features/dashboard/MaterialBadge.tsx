import type { SVGProps } from "react";
import {
  ClothIcon,
  IceIcon,
  LeatherIcon,
  MetalIcon,
  SnowIcon,
  StoneIcon,
  WoodIcon,
} from "../../components/icons";
import { MATERIAL_BADGE_LABELS, type MaterialBadgeId } from "./dashboardCatalog";
import styles from "./MaterialBadge.module.css";

const materialIcons = {
  wood: WoodIcon,
  stone: StoneIcon,
  snow: SnowIcon,
  ice: IceIcon,
  metal: MetalIcon,
  cloth: ClothIcon,
  leather: LeatherIcon,
} as const satisfies Record<MaterialBadgeId, (props: SVGProps<SVGSVGElement>) => React.JSX.Element>;

export interface MaterialBadgeProps {
  readonly material: MaterialBadgeId;
}

export function MaterialBadge({ material }: MaterialBadgeProps) {
  const Icon = materialIcons[material];
  return (
    <span className={styles.badge} data-material={material}>
      <Icon className={styles.icon} />
      {MATERIAL_BADGE_LABELS[material]}
    </span>
  );
}
