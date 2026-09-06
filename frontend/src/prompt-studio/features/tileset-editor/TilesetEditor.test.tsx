import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type DefaultValues, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { getDefaultTilesetType, type TilesetSubtype } from "../../domain/tilesets";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { TilesetEditor } from ".";

async function chooseCustomText(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<HTMLElement> {
  const select = screen.getByRole("combobox", { name: label });
  await user.selectOptions(select, within(select).getByRole("option", { name: "Eigene Eingabe" }));
  return screen.getByRole("textbox", {
    name: `Eigene Eingabe für ${label}`,
  });
}

function TilesetEditorHarness({
  defaultValues,
  formRef,
  onRead,
  subtype = "autotile",
}: Readonly<{
  defaultValues?: DefaultValues<WizardCoreFormValues>;
  formRef?: { current: UseFormReturn<WizardCoreFormValues> | null };
  onRead?: (values: WizardCoreFormValues) => void;
  subtype?: TilesetSubtype;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Wiesen-Autotile",
      category: "tileset",
      subtype,
      tilesetType: getDefaultTilesetType(subtype),
      ...defaultValues,
    },
  });

  if (formRef) formRef.current = form;

  return (
    <form>
      <TilesetEditor form={form} notifyProgrammaticChange={() => undefined} subtype={subtype} />
      {onRead ? (
        <button type="button" onClick={() => onRead(form.getValues())}>
          Formularwerte lesen
        </button>
      ) : null}
    </form>
  );
}

describe("TilesetEditor", () => {
  it("captures Autotile connections, seams, variants, and exact Atlas metrics in RHF", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    render(
      <TilesetEditorHarness
        defaultValues={{ tileSize: 32, pixelDensity: "modernHd" }}
        onRead={onRead}
      />,
    );

    expect(screen.getByRole("heading", { name: "Autotile strukturieren" })).toBeVisible();
    for (const group of [
      "Grid und Tiletyp",
      "Kanten, Übergänge und Ecken",
      "Seam-Regeln und Wiederholung",
      "Varianten",
      "Atlaslayout und Tilemetriken",
      "Weitere Tileset-Details",
    ]) {
      expect(screen.getByRole("group", { name: group })).toBeVisible();
    }
    expect(screen.getByRole("status", { name: "Tiletyp" })).toHaveTextContent(
      "Regelbasiertes Autotile",
    );
    expect(screen.getByRole("status", { name: "Wirksames Tile-Grid" })).toHaveTextContent(
      "32 × 32 px",
    );
    expect(screen.getByRole("status", { name: "Pixelmaßstab" })).toHaveTextContent("Modern-HD");

    await user.selectOptions(screen.getByLabelText("Einsatz im Mapping"), "transition");
    await user.type(await chooseCustomText(user, "Tileset-Beschreibung"), "Gras-zu-Erde-Autotile");
    await user.selectOptions(screen.getByLabelText("Kantenset"), "cardinalAndDiagonal");
    await user.type(await chooseCustomText(user, "Kantenregeln"), "Alle acht Nachbarzustände");
    await user.selectOptions(screen.getByLabelText("Innen-/Außenecken"), "innerAndOuter");
    await user.selectOptions(screen.getByLabelText("Übergangslogik"), "bidirectional");
    await user.type(await chooseCustomText(user, "Ausgangsmaterial"), "Gras");
    await user.type(await chooseCustomText(user, "Nachbarmaterial"), "Erde");
    await user.selectOptions(screen.getByLabelText("Kachelbare Achsen"), "both");
    await user.selectOptions(screen.getByLabelText("Seam-Regel"), "matchedEdges");
    await user.selectOptions(screen.getByLabelText("Wiederholungsmuster"), "randomized");
    await user.type(screen.getByLabelText("Varianten pro Zustand"), "6");
    await user.click(screen.getByLabelText("Saubere Basisvariante"));
    await user.click(screen.getByLabelText("Beschädigte Variante"));
    await user.click(screen.getByLabelText("Dekalvariante"));
    await user.type(screen.getByLabelText("Atlas-Tiles insgesamt"), "47");
    await user.selectOptions(screen.getByLabelText("Atlaslayout"), "fixedColumns");
    await user.type(screen.getByLabelText("Feste Spaltenzahl"), "8");
    await user.type(screen.getByLabelText("Zwischenraum in Pixeln"), "1");
    await user.type(screen.getByLabelText("Außenrand in Pixeln"), "2");

    const specification = screen.getByRole("region", {
      name: "Technische Atlas-Spezifikation",
    });
    expect(specification).toHaveTextContent("32 × 32 px");
    expect(specification).toHaveTextContent("8 × 6 Zellen");
    expect(specification).toHaveTextContent("267 × 201 px");
    expect(specification).toHaveTextContent("47 von 48 Slots");
    expect(specification).toHaveTextContent("1 Atlas-Slot bleibt frei");

    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));
    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        tilesetType: "autotile",
        tilesetUsage: "transition",
        tilesetDescription: "Gras-zu-Erde-Autotile",
        tilesetEdgeSet: "cardinalAndDiagonal",
        tilesetEdgeDetails: "Alle acht Nachbarzustände",
        tilesetCornerSet: "innerAndOuter",
        tilesetTransitionMode: "bidirectional",
        tilesetSourceMaterial: "Gras",
        tilesetTargetMaterial: "Erde",
        tilesetSeamMode: "matchedEdges",
        tileableAxes: "both",
        tilesetRepeatMode: "randomized",
        tilesetVariantCount: 6,
        tilesetVariantKinds: ["clean", "damaged", "decal"],
        tilesetAtlasLayout: "fixedColumns",
        tilesetAtlasTileCount: 47,
        tilesetAtlasColumns: 8,
        tilesetAtlasGutterPixels: 1,
        tilesetAtlasMarginPixels: 2,
        tileSize: 32,
        pixelDensity: "modernHd",
      }),
    );
  });

  it("shows inherited Grid values without eagerly writing the derived Tile type", () => {
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = {
      current: null,
    };
    render(
      <TilesetEditorHarness
        defaultValues={{
          tilesetType: undefined,
          tileSize: undefined,
          pixelDensity: undefined,
        }}
        formRef={formRef}
        subtype="groundTile"
      />,
    );

    expect(screen.getByRole("status", { name: "Tiletyp" })).toHaveTextContent("Boden");
    expect(screen.getByRole("status", { name: "Wirksames Tile-Grid" })).toHaveTextContent(
      "Nicht festgelegt",
    );
    expect(formRef.current?.getValues("tilesetType")).toBeUndefined();
    expect(formRef.current?.getValues("tileSize")).toBeUndefined();
    expect(screen.queryByRole("combobox", { name: "Tiletyp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /Tilegröße/i })).not.toBeInTheDocument();
    expect(screen.getByText(/kein separates Kanten-, Eck- oder Übergangsset/)).toBeVisible();
  });

  it("shows only subtype-relevant connection controls", () => {
    const { rerender } = render(<TilesetEditorHarness subtype="edge" />);

    expect(screen.getByLabelText("Kantenset")).toBeVisible();
    expect(screen.queryByLabelText("Innen-/Außenecken")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Übergangslogik")).not.toBeInTheDocument();

    rerender(<TilesetEditorHarness subtype="corner" />);
    expect(screen.getByLabelText("Kantenset")).toBeVisible();
    expect(screen.getByLabelText("Innen-/Außenecken")).toBeVisible();
    expect(screen.queryByLabelText("Übergangslogik")).not.toBeInTheDocument();

    rerender(<TilesetEditorHarness subtype="transition" />);
    expect(screen.getByLabelText("Kantenset")).toBeVisible();
    expect(screen.queryByLabelText("Innen-/Außenecken")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Übergangslogik")).toBeVisible();
  });

  it("calculates automatic layout and clears obsolete fixed columns on layout change", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    render(
      <TilesetEditorHarness
        defaultValues={{
          tileSize: 16,
          tilesetAtlasLayout: "fixedColumns",
          tilesetAtlasTileCount: 10,
          tilesetAtlasColumns: 5,
        }}
        onRead={onRead}
      />,
    );

    expect(screen.getByText("5 × 2 Zellen")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Atlaslayout"), "automatic");
    expect(screen.queryByLabelText("Feste Spaltenzahl")).not.toBeInTheDocument();
    expect(screen.getByText("4 × 3 Zellen")).toBeVisible();
    expect(screen.getByText("64 × 48 px")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));
    expect(onRead.mock.calls[0]?.[0].tilesetAtlasColumns).toBeUndefined();
  });

  it("never renders direction or character-scale controls and keeps animation separate", () => {
    render(<TilesetEditorHarness subtype="animatedTile" />);

    expect(screen.getByText("Keine Richtungsansichten")).toBeVisible();
    expect(screen.getByText("Animation separat")).toBeVisible();
    expect(
      screen.queryByLabelText(/Richtungsanzahl|Richtungsset|4 Richtungen|8 Richtungen/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Figurenhöhe/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Animation/i })).not.toBeInTheDocument();
  });
});
