import type { SVGProps } from "react";

export function ForgeMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M8 8h40v8h8v24h-8v8H32v8H16v-8H8V8Zm8 8v24h8V24h24v-8H16Zm16 16v8h16v-8H32Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
