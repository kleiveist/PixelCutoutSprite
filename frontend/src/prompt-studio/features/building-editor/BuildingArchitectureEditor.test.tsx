import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type DefaultValues, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { getDefaultBuildingType, type BuildingSubtype } from "../../domain/buildings";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { BuildingArchitectureEditor } from ".";

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

function BuildingEditorHarness({
  defaultValues,
  formRef,
  onRead,
  subtype = "gate",
}: Readonly<{
  defaultValues?: DefaultValues<WizardCoreFormValues>;
  formRef?: { current: UseFormReturn<WizardCoreFormValues> | null };
  onRead?: (values: WizardCoreFormValues) => void;
  subtype?: BuildingSubtype;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Nordtor",
      category: "building",
      subtype,
      buildingType: getDefaultBuildingType(subtype),
      ...defaultValues,
    },
  });

  if (formRef) formRef.current = form;

  return (
    <form>
      <BuildingArchitectureEditor
        form={form}
        notifyProgrammaticChange={() => undefined}
        subtype={subtype}
      />
      {onRead ? (
        <button type="button" onClick={() => onRead(form.getValues())}>
          Formularwerte lesen
        </button>
      ) : null}
    </form>
  );
}

describe("BuildingArchitectureEditor", () => {
  it("offers footprint, facade, openings, mapping, and light as native RHF controls", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    render(
      <BuildingEditorHarness
        defaultValues={{
          tileSize: 32,
          perspectiveType: "threeQuarter",
          cameraAngle: 60,
          projectionType: "orthographic",
        }}
        onRead={onRead}
      />,
    );

    expect(screen.getByRole("heading", { name: "Tor gestalten" })).toBeVisible();
    for (const group of [
      "Nutzung und Baukörper",
      "Footprint und Mapping-Kompatibilität",
      "Material, Dach und Fassade",
      "Türen und Fenster",
      "Zustand, Belegung und Licht",
      "Weitere Architekturdetails",
    ]) {
      expect(screen.getByRole("group", { name: group })).toBeVisible();
    }
    expect(screen.getByRole("status", { name: "Gebäudetyp" })).toHaveTextContent("Torbau");
    expect(screen.getByRole("status", { name: "Wirksame Tilegröße" })).toHaveTextContent(
      "32 × 32 px",
    );
    expect(screen.getByRole("status", { name: "Wirksame Weltgeometrie" })).toHaveTextContent(
      "3/4-RPG · 60° · Orthografisch",
    );

    await user.selectOptions(screen.getByLabelText("Bauform / Grundriss"), "rectangular");
    await user.selectOptions(screen.getByLabelText("Größenklasse"), "large");
    await user.type(screen.getByLabelText("Stockwerke"), "2");
    await user.type(screen.getByLabelText("Gesamthöhe in Pixeln"), "192");
    await user.type(
      await chooseCustomText(user, "Nutzung und Bewohnerrolle"),
      "Bewachter Stadteingang",
    );
    await user.type(
      await chooseCustomText(user, "Kurze Gebäudebeschreibung"),
      "Massiver Torbau mit klarer Durchfahrt",
    );
    await user.type(screen.getByLabelText("Footprint · Breite in Tiles"), "4");
    await user.type(screen.getByLabelText("Footprint · Tiefe in Tiles"), "2");
    await user.selectOptions(screen.getByLabelText("Mapping-Modus"), "modularSet");
    await user.selectOptions(screen.getByLabelText("Kollisionslesbarkeit"), "walkableEntrance");
    await user.selectOptions(screen.getByLabelText("Modularer Ausgabesatz"), "true");
    await user.selectOptions(screen.getByLabelText("Hauptmaterial"), "stone");
    await user.selectOptions(screen.getByLabelText("Sekundärmaterial"), "wood");
    await user.selectOptions(screen.getByLabelText("Dachform"), "gable");
    await user.selectOptions(screen.getByLabelText("Dachmaterial"), "slate");
    await user.selectOptions(screen.getByLabelText("Fassadenaufbau"), "fortified");
    await user.type(screen.getByLabelText("Anzahl Türen / Tore"), "1");
    await user.selectOptions(screen.getByLabelText("Tür- oder Tortyp"), "reinforced");
    await user.selectOptions(screen.getByLabelText("Türzustand"), "closed");
    await user.type(screen.getByLabelText("Anzahl Fenster"), "4");
    await user.selectOptions(screen.getByLabelText("Fensterform"), "narrowSlit");
    await user.selectOptions(screen.getByLabelText("Fensterlicht"), "warmLit");
    await user.selectOptions(screen.getByLabelText("Gebäudezustand"), "weathered");
    await user.selectOptions(screen.getByLabelText("Bewohnt / verlassen"), "active");
    await user.selectOptions(screen.getByLabelText("Umgebungskontext"), "city");
    await user.selectOptions(screen.getByLabelText("Lokale Gebäudebeleuchtung"), "visibleSources");
    await user.type(
      await chooseCustomText(user, "Sichtbare Lichtquellen"),
      "Zwei warme Laternen am Durchgang",
    );
    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));

    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        buildingType: "gate",
        buildingPurpose: "Bewachter Stadteingang",
        buildingPlanShape: "rectangular",
        buildingSize: "large",
        buildingFootprintWidthTiles: 4,
        buildingFootprintDepthTiles: 2,
        buildingHeightPixels: 192,
        buildingFloors: 2,
        buildingPrimaryMaterial: "stone",
        buildingSecondaryMaterial: "wood",
        buildingRoofShape: "gable",
        buildingRoofMaterial: "slate",
        buildingFacadeStyle: "fortified",
        buildingDoorCount: 1,
        buildingDoorType: "reinforced",
        buildingDoorState: "closed",
        buildingWindowCount: 4,
        buildingWindowShape: "narrowSlit",
        buildingWindowLighting: "warmLit",
        buildingCondition: "weathered",
        buildingOccupancy: "active",
        buildingEnvironment: "city",
        buildingMappingMode: "modularSet",
        buildingCollisionMode: "walkableEntrance",
        buildingModular: true,
        buildingLighting: "visibleSources",
        buildingLightSourceDetails: "Zwei warme Laternen am Durchgang",
        tileSize: 32,
        perspectiveType: "threeQuarter",
        cameraAngle: 60,
        projectionType: "orthographic",
      }),
    );
    expect(onRead.mock.calls[0]?.[0]).not.toHaveProperty("directionCount");
    expect(onRead.mock.calls[0]?.[0]).not.toHaveProperty("characterHeight");
    expect(onRead.mock.calls[0]?.[0]).not.toHaveProperty("animationType");
  });

  it("shows inherited geometry read-only without eagerly writing derived values", () => {
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = {
      current: null,
    };
    render(
      <BuildingEditorHarness
        defaultValues={{
          buildingType: undefined,
          tileSize: undefined,
          perspectiveType: undefined,
          cameraAngle: undefined,
          projectionType: undefined,
        }}
        formRef={formRef}
      />,
    );

    expect(screen.getByRole("status", { name: "Gebäudetyp" })).toHaveTextContent("Torbau");
    expect(screen.getByRole("status", { name: "Wirksame Tilegröße" })).toHaveTextContent(
      "Nicht festgelegt",
    );
    expect(screen.getByRole("status", { name: "Wirksame Weltgeometrie" })).toHaveTextContent(
      "Nicht festgelegt",
    );
    expect(formRef.current?.getValues("buildingType")).toBeUndefined();
    expect(formRef.current?.getValues("tileSize")).toBeUndefined();
    expect(screen.queryByRole("combobox", { name: "Gebäudetyp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /Tilegröße/i })).not.toBeInTheDocument();
  });

  it("exposes modular mapping only for capable subtypes and animation only as a separate hint", () => {
    const { rerender } = render(<BuildingEditorHarness subtype="gate" />);

    expect(screen.getByText("Modularität verfügbar")).toBeVisible();
    expect(screen.getByText("Animation separat verfügbar")).toBeVisible();
    expect(screen.getByLabelText("Modularer Ausgabesatz")).toBeVisible();
    expect(screen.getByRole("option", { name: "Modularer Bauteilsatz" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Animation/i })).not.toBeInTheDocument();

    rerender(<BuildingEditorHarness subtype="house" />);
    expect(screen.getByText("Komplettbau")).toBeVisible();
    expect(screen.queryByText("Animation separat verfügbar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Modularer Ausgabesatz")).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Modularer Bauteilsatz" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Modular aufgebaut" })).not.toBeInTheDocument();
  });

  it("never renders character scale or direction controls", () => {
    render(<BuildingEditorHarness />);

    expect(screen.getByText("Keine Richtungsansichten")).toBeVisible();
    expect(
      screen.queryByLabelText(/Richtungsanzahl|Richtungsset|4 Richtungen|8 Richtungen/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Figurenhöhe/i)).not.toBeInTheDocument();
  });

  it("shows a bounded partial footprint warning until both axes exist", async () => {
    const user = userEvent.setup();
    render(<BuildingEditorHarness />);

    const width = screen.getByLabelText("Footprint · Breite in Tiles");
    const depth = screen.getByLabelText("Footprint · Tiefe in Tiles");
    expect(width).toHaveAttribute("min", "1");
    expect(width).toHaveAttribute("max", "64");
    expect(depth).toHaveAttribute("min", "1");
    expect(depth).toHaveAttribute("max", "64");

    await user.type(width, "4");
    expect(screen.getByRole("status", { name: "Gebäude-Footprint-Hinweis" })).toHaveTextContent(
      "Gebäude-Footprint ist unvollständig",
    );

    await user.type(depth, "2");
    expect(screen.queryByText(/Gebäude-Footprint ist unvollständig/)).not.toBeInTheDocument();
  });
});
