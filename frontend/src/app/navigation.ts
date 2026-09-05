export const workspaceRoutes = [
  "welcome",
  "projects",
  "areas",
  "animations",
  "dummy-editor",
  "outfit",
  "characters",
  "export",
] as const;

export type WorkspaceRoute = (typeof workspaceRoutes)[number];

export interface NavigationItem {
  route: WorkspaceRoute;
  label: string;
  eyebrow: string;
  description: string;
  available: boolean;
}

export const navigationItems: readonly NavigationItem[] = [
  {
    route: "welcome",
    label: "Studio home",
    eyebrow: "Start",
    description: "Choose a vault and continue a local pixel-art workspace.",
    available: true,
  },
  {
    route: "projects",
    label: "Projects",
    eyebrow: "Organize",
    description: "Browse project cards, labels, and recent work.",
    available: false,
  },
  {
    route: "areas",
    label: "Areas",
    eyebrow: "Set up",
    description: "Define body profiles and pixel dimensions.",
    available: false,
  },
  {
    route: "animations",
    label: "Animations",
    eyebrow: "Animate",
    description: "Manage reusable motion templates and revisions.",
    available: false,
  },
  {
    route: "dummy-editor",
    label: "Dummy editor",
    eyebrow: "Pose",
    description: "Create readable key poses on the pixel grid.",
    available: false,
  },
  {
    route: "outfit",
    label: "Outfit",
    eyebrow: "Dress",
    description: "Fit imported pixel parts to the animated dummy.",
    available: false,
  },
  {
    route: "characters",
    label: "Characters",
    eyebrow: "Bind",
    description: "Keep NPC identity, appearance, and motion together.",
    available: false,
  },
  {
    route: "export",
    label: "Export",
    eyebrow: "Ship",
    description: "Build portable PNG, JSON, and optional Godot packages.",
    available: false,
  },
];

export function isWorkspaceRoute(value: string): value is WorkspaceRoute {
  return workspaceRoutes.includes(value as WorkspaceRoute);
}

export function routeDetails(route: WorkspaceRoute): NavigationItem {
  return navigationItems.find((item) => item.route === route) ?? navigationItems[0];
}

export function routeBreadcrumbs(route: WorkspaceRoute): readonly string[] {
  const details = routeDetails(route);
  return route === "welcome" ? ["Workspace"] : ["Workspace", details.label];
}
