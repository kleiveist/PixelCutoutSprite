import type { ComponentPropsWithoutRef } from "react";
import styles from "./Badge.module.css";

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  readonly tone?: "accent" | "success" | "neutral";
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  const classes = [styles.badge, styles[tone], className].filter(Boolean).join(" ");
  return <span className={classes} {...props} />;
}
