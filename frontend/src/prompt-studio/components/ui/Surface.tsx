import type { HTMLAttributes } from "react";
import styles from "./Surface.module.css";

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  readonly as?: "div" | "section";
  readonly tone?: "default" | "raised" | "soft";
}

export function Surface({
  as: Component = "div",
  className,
  tone = "default",
  ...props
}: SurfaceProps) {
  const classes = [styles.surface, styles[tone], className].filter(Boolean).join(" ");
  return <Component className={classes} {...props} />;
}
