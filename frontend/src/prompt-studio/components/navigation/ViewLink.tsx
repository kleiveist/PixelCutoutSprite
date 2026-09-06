import type { ComponentPropsWithoutRef } from "react";
import type { PromptView } from "../../domain/navigation";
import { useNavigation } from "../../store/navigation";

export interface ViewLinkProps extends Omit<ComponentPropsWithoutRef<"button">, "type"> {
  readonly indicateCurrent?: boolean;
  readonly onNavigate?: () => void;
  readonly view: PromptView;
}

export function ViewLink({
  indicateCurrent = false,
  onClick,
  onNavigate,
  view,
  ...props
}: ViewLinkProps) {
  const { activeView, navigate } = useNavigation();
  return (
    <button
      {...props}
      type="button"
      aria-current={indicateCurrent && activeView === view ? "page" : undefined}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        onNavigate?.();
        navigate(view);
      }}
    />
  );
}
