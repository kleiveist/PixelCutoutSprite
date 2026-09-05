export interface PreviewActivity {
  visible: boolean;
  hovered: boolean;
  focused: boolean;
  activated: boolean;
  reducedMotion: boolean;
}

export function shouldAnimatePreview(activity: PreviewActivity): boolean {
  return (
    activity.visible &&
    !activity.reducedMotion &&
    (activity.hovered || activity.focused || activity.activated)
  );
}
