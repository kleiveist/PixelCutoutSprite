import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type DefaultValues, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { getDefaultStaticObjectClass, type StaticObjectSubtype } from "../../domain/static-objects";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { StaticWorldObjectEditor } from ".";

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

function StaticObjectEditorHarness({
  defaultValues,
  formRef,
  onRead,
  subtype = "chest",
}: Readonly<{
  defaultValues?: DefaultValues<WizardCoreFormValues>;
  formRef?: { current: UseFormReturn<WizardCoreFormValues> | null };
  onRead?: (values: WizardCoreFormValues) => void;
  subtype?: StaticObjectSubtype;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Alte Truhe",
      category: "staticObject",
      subtype,
      staticObjectClass: getDefaultStaticObjectClass(subtype),
      ...defaultValues,
    },
  });

  if (formRef) formRef.current = form;

  return (
    <form>
      <StaticWorldObjectEditor
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

describe("StaticWorldObjectEditor", () => {
  it("offers the complete static-object workflow with native RHF controls", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    render(<StaticObjectEditorHarness defaultValues={{ tileSize: 32 }} onRead={onRead} />);

    expect(screen.getByRole("heading", { name: "Truhe gestalten" })).toBeVisible();

    for (const group of [
      "Funktion und Grundform",
      "Material, Zustand und Details",
      "Inhalt, Interaktion und Schatten",
      "Standfläche und Varianten",
      "Weitere Objektdetails",
    ]) {
      expect(screen.getByRole("group", { name: group })).toBeVisible();
    }

    expect(screen.getByRole("status", { name: "Objektklasse" })).toHaveTextContent("Behälter");
    expect(screen.getByRole("status", { name: "Wirksame Tilegröße" })).toHaveTextContent(
      "32 × 32 px",
    );

    await user.selectOptions(screen.getByLabelText("Funktion / Zweck"), "interactive");
    await user.selectOptions(screen.getByLabelText("Grundform"), "boxy");
    await user.selectOptions(screen.getByLabelText("Proportion"), "compact");
    await user.selectOptions(screen.getByLabelText("Symmetrie"), "bilateral");
    await user.type(
      await chooseCustomText(user, "Kurze Objektbeschreibung"),
      "Eine schwere Schatztruhe mit klar lesbarem Deckel",
    );
    await user.selectOptions(screen.getByLabelText("Hauptmaterial"), "wood");
    await user.selectOptions(screen.getByLabelText("Sekundärmaterial"), "metal");
    await user.selectOptions(screen.getByLabelText("Zustand"), "weathered");
    await user.type(
      await chooseCustomText(user, "Materialaufbau und Oberfläche"),
      "Breite Eichenplanken mit dunklen Eisenbändern",
    );
    await user.type(
      await chooseCustomText(user, "Lesbare Detail-Elemente"),
      "Großes Schloss und zwei seitliche Griffe",
    );
    await user.type(
      await chooseCustomText(user, "Sichtbarer Inhalt"),
      "Goldmünzen und ein gefaltetes Tuch",
    );
    await user.selectOptions(screen.getByLabelText("Interaktion"), "open");
    await user.selectOptions(screen.getByLabelText("Schatten"), "contact");
    await user.type(screen.getByLabelText("Standfläche · Breite in Tiles"), "2");
    await user.type(screen.getByLabelText("Standfläche · Tiefe in Tiles"), "1");
    await user.type(screen.getByLabelText("Verwandte Varianten"), "4");
    await user.type(
      await chooseCustomText(user, "Weitere Objektdetails"),
      "Für einen düsteren Dungeon, frontal gut erkennbar",
    );
    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));

    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        staticObjectClass: "container",
        staticObjectPurpose: "interactive",
        staticObjectBasicShape: "boxy",
        staticObjectProportion: "compact",
        staticObjectSymmetry: "bilateral",
        staticObjectDescription: "Eine schwere Schatztruhe mit klar lesbarem Deckel",
        staticObjectPrimaryMaterial: "wood",
        staticObjectSecondaryMaterial: "metal",
        staticObjectMaterialDetails: "Breite Eichenplanken mit dunklen Eisenbändern",
        staticObjectCondition: "weathered",
        staticObjectDetailElements: "Großes Schloss und zwei seitliche Griffe",
        staticObjectContents: "Goldmünzen und ein gefaltetes Tuch",
        staticObjectInteraction: "open",
        staticObjectShadowMode: "contact",
        staticObjectFootprintWidthTiles: 2,
        staticObjectFootprintDepthTiles: 1,
        staticObjectVariantCount: 4,
        staticObjectExtraDetails: "Für einen düsteren Dungeon, frontal gut erkennbar",
        tileSize: 32,
      }),
    );
    expect(onRead.mock.calls[0]?.[0]).not.toHaveProperty("directionCount");
    expect(onRead.mock.calls[0]?.[0]).not.toHaveProperty("animationType");
  });

  it("keeps class and inherited tile size read-only without eager writes", () => {
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = {
      current: null,
    };
    render(
      <StaticObjectEditorHarness
        defaultValues={{ staticObjectClass: undefined, tileSize: undefined }}
        formRef={formRef}
      />,
    );

    expect(screen.getByRole("status", { name: "Objektklasse" })).toHaveTextContent("Behälter");
    expect(screen.getByRole("status", { name: "Wirksame Tilegröße" })).toHaveTextContent(
      "Nicht festgelegt",
    );
    expect(formRef.current?.getValues("staticObjectClass")).toBeUndefined();
    expect(formRef.current?.getValues("tileSize")).toBeUndefined();
    expect(screen.queryByRole("combobox", { name: "Objektklasse" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /Tilegröße/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Basisprofil-Vererbung/)).toBeVisible();
  });

  it("keeps animation informational and never renders direction controls", () => {
    render(<StaticObjectEditorHarness subtype="chest" />);

    expect(
      screen.getByRole("heading", {
        name: "Interaktion und Animation bleiben getrennt",
      }),
    ).toBeVisible();
    expect(screen.getByText(/Capability-Schritt gewählt/)).toBeVisible();
    expect(screen.queryByRole("combobox", { name: /Animation/i })).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Richtungsanzahl|Richtungsset|4 Richtungen|8 Richtungen/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Keine Richtungsansichten")).toBeVisible();
  });

  it("derives a non-animated pillar and retains its relevant object fields", () => {
    render(<StaticObjectEditorHarness subtype="pillar" />);

    expect(screen.getByRole("heading", { name: "Säule gestalten" })).toBeVisible();
    expect(screen.getByRole("status", { name: "Objektklasse" })).toHaveTextContent("Säule");
    expect(screen.getByText("Statisches Einzelasset")).toBeVisible();
    expect(screen.getByText(/Dieser Untertyp erhält hier keine Animationsauswahl/)).toBeVisible();
    expect(screen.getByLabelText("Grundform")).toBeVisible();
    expect(screen.getByLabelText("Hauptmaterial")).toBeVisible();
    expect(screen.getByLabelText("Standfläche · Breite in Tiles")).toBeVisible();
  });

  it("shows a partial bounded footprint until both axes exist", async () => {
    const user = userEvent.setup();
    render(<StaticObjectEditorHarness />);

    const width = screen.getByLabelText("Standfläche · Breite in Tiles");
    const depth = screen.getByLabelText("Standfläche · Tiefe in Tiles");
    const variants = screen.getByLabelText("Verwandte Varianten");

    expect(width).toHaveAttribute("min", "1");
    expect(width).toHaveAttribute("max", "64");
    expect(depth).toHaveAttribute("min", "1");
    expect(depth).toHaveAttribute("max", "64");
    expect(variants).toHaveAttribute("min", "1");
    expect(variants).toHaveAttribute("max", "12");

    await user.type(width, "2");
    expect(screen.getByRole("status", { name: "Footprint-Hinweis" })).toHaveTextContent(
      "Der Footprint ist unvollständig",
    );

    await user.type(depth, "3");
    expect(screen.queryByText(/Der Footprint ist unvollständig/)).not.toBeInTheDocument();

    await user.clear(width);
    expect(screen.getByRole("status", { name: "Footprint-Hinweis" })).toHaveTextContent(
      "Der Footprint ist unvollständig",
    );

    await user.clear(depth);
    expect(screen.queryByText(/Der Footprint ist unvollständig/)).not.toBeInTheDocument();
  });
});
