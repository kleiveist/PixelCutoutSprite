import { describe, expect, it } from "vitest";

import { isWorkspaceRoute, navigationItems, routeBreadcrumbs, routeDetails } from "./navigation";

describe("workspace navigation", () => {
  it("keeps every route unique and resolvable", () => {
    const routes = navigationItems.map((item) => item.route);

    expect(new Set(routes).size).toBe(routes.length);
    expect(routes.every(isWorkspaceRoute)).toBe(true);
    expect(routeDetails("dummy-editor").label).toBe("Dummy editor");
  });

  it("builds concise breadcrumbs", () => {
    expect(routeBreadcrumbs("welcome")).toEqual(["Workspace"]);
    expect(routeBreadcrumbs("animations")).toEqual(["Workspace", "Animations"]);
  });
});
