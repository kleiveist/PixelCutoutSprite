import type { ReactNode, SVGProps } from "react";

interface MaterialIconCanvasProps extends SVGProps<SVGSVGElement> {
  readonly children: ReactNode;
  readonly iconId: string;
}

function MaterialIconCanvas({ children, iconId, ...props }: MaterialIconCanvasProps) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      data-material-icon={iconId}
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function WoodIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MaterialIconCanvas iconId="wood" {...props}>
      <path d="M3 5h18v14H3zM7 5c3 3 3 11 0 14M14 5c-2 4-2 10 1 14M9 10h3M16 14h3" />
    </MaterialIconCanvas>
  );
}

export function StoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MaterialIconCanvas iconId="stone" {...props}>
      <path d="m5 6 5-3 7 2 4 7-4 7H7l-4-6 2-7Z" />
      <path d="m5 6 6 5 6-6M11 11l-4 8M11 11l6 8M3 13l8-2 10 1" />
    </MaterialIconCanvas>
  );
}

export function SnowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MaterialIconCanvas iconId="snow" {...props}>
      <path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10M9 5l3 2 3-2M9 19l3-2 3 2M5 10l.5 3-3 1M19 10l-.5 3 3 1" />
    </MaterialIconCanvas>
  );
}

export function IceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MaterialIconCanvas iconId="ice" {...props}>
      <path d="m12 2 8 7-4 12H8L4 9l8-7Z" />
      <path d="m4 9 8 3 8-3M12 2v10M8 21l4-9 4 9" />
    </MaterialIconCanvas>
  );
}

export function MetalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MaterialIconCanvas iconId="metal" {...props}>
      <path d="m5 7 4-4h9l2 4-4 13H6L3 16 5 7Z" />
      <path d="M5 7h15M3 16h14M9 3l3 4 6-4M12 7 9 16" />
    </MaterialIconCanvas>
  );
}

export function ClothIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MaterialIconCanvas iconId="cloth" {...props}>
      <path d="M4 3h16v18H4zM4 8c4-3 12 3 16 0M4 15c4-3 12 3 16 0M9 3c-3 5 3 13 0 18M15 3c-3 5 3 13 0 18" />
    </MaterialIconCanvas>
  );
}

export function LeatherIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MaterialIconCanvas iconId="leather" {...props}>
      <path d="M7 3h10l1 4 3 3-3 4 1 6H5l1-6-3-4 3-3 1-4Z" />
      <path d="M9 7h6M8 11h8M9 15h6" />
    </MaterialIconCanvas>
  );
}
