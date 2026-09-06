import type { ReactNode, SVGProps } from "react";

interface IconCanvasProps extends SVGProps<SVGSVGElement> {
  readonly children: ReactNode;
  readonly iconId: string;
}

function IconCanvas({ children, iconId, ...props }: IconCanvasProps) {
  return (
    <svg
      {...props}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      data-category-icon={iconId}
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function CharacterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconCanvas iconId="character" {...props}>
      <path d="M17 7h14v13H17zM13 42V29l7-5h8l7 5v13M20 31v11M28 31v11M13 35h22" />
      <path d="M21 14h1M27 14h1" />
    </IconCanvas>
  );
}

export function MovingObjectIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconCanvas iconId="movingObject" {...props}>
      <path d="M8 14h21v18H8zM12 32v5h4M25 32v5h4M12 20h13M34 12h7l-3-3M41 12l-3 3M33 24h9l-3-3M42 24l-3 3" />
      <circle cx="15" cy="38" r="3" />
      <circle cx="29" cy="38" r="3" />
    </IconCanvas>
  );
}

export function StaticObjectIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconCanvas iconId="staticObject" {...props}>
      <path d="M9 15h30v26H9zM9 22h30M16 15V9h16v6M16 28h16v7H16z" />
      <path d="M24 28v7" />
    </IconCanvas>
  );
}

export function TextureIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconCanvas iconId="texture" {...props}>
      <path d="M7 7h34v34H7zM7 18h34M7 30h34M18 7v11M30 7v11M13 18v12M24 18v12M35 18v12M18 30v11M30 30v11" />
    </IconCanvas>
  );
}

export function NatureIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconCanvas iconId="nature" {...props}>
      <path d="M21 42V29M27 42V28M17 42h14M24 6l-9 12h5l-8 11h24l-8-11h5L24 6Z" />
      <path d="M18 25h12" />
    </IconCanvas>
  );
}

export function BuildingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconCanvas iconId="building" {...props}>
      <path d="M6 22 24 7l18 15M10 20v21h28V20M20 41V29h8v12M14 25h5v5h-5zM30 25h5v5h-5z" />
      <path d="M33 13V7h5v10" />
    </IconCanvas>
  );
}

export function TilesetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconCanvas iconId="tileset" {...props}>
      <path d="M7 7h14v14H7zM27 7h14v14H27zM7 27h14v14H7zM27 27h14v14H27z" />
      <path d="M14 11v6M31 14h6M11 34h6M31 31l6 6M37 31l-6 6" />
    </IconCanvas>
  );
}

export function ItemIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconCanvas iconId="item" {...props}>
      <path d="m34 6 8 8-19 19-8-8L34 6ZM12 28l8 8M8 32l8 8M8 40l-3 3M29 11l8 8" />
      <path d="M31 9 39 17" />
    </IconCanvas>
  );
}

export function ArtworkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconCanvas iconId="artwork" {...props}>
      <path d="M7 9h34v30H7zM12 34l9-10 6 6 4-4 5 8M31 15h4v4h-4z" />
      <path d="M4 6h6M4 6v6M44 6h-6M44 6v6M4 42h6M4 42v-6M44 42h-6M44 42v-6" />
    </IconCanvas>
  );
}
