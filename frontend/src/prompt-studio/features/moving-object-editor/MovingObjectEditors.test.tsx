import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import {
  MOVING_OBJECT_ANIMATION_TYPE_IDS,
  getDefaultMovingObjectClass,
  type MovingObjectSubtype,
} from "../../domain/moving-objects";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { MovingObjectAnimationEditor } from "./MovingObjectAnimationEditor";
import { MovingObjectDetailsEditor } from "./MovingObjectDetailsEditor";

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

function MovingObjectDetailsHarness({
  onRead,
  subtype = "cart",
}: Readonly<{
  onRead?: (values: WizardCoreFormValues) => void;
  subtype?: MovingObjectSubtype;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Händlerwagen",
      category: "movingObject",
      subtype,
      movingObjectClass: getDefaultMovingObjectClass(subtype),
    },
  });

  return (
    <form>
      <MovingObjectDetailsEditor
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

function MovingObjectAnimationHarness({
  defaultAnimationFrames,
  directionCount,
  formRef,
  notifyProgrammaticChange,
  subtype = "cart",
}: Readonly<{
  defaultAnimationFrames?: WizardCoreFormValues["movingObjectAnimationFrames"];
  directionCount?: 4 | 8;
  formRef?: { current: UseFormReturn<WizardCoreFormValues> | null };
  notifyProgrammaticChange: () => void;
  subtype?: MovingObjectSubtype;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Händlerwagen",
      category: "movingObject",
      subtype,
      movingObjectClass: getDefaultMovingObjectClass(subtype),
      ...(directionCount === undefined ? {} : { directionCount }),
      ...(defaultAnimationFrames === undefined
        ? {}
        : { movingObjectAnimationFrames: defaultAnimationFrames }),
    },
  });
  if (formRef) formRef.current = form;

  return (
    <MovingObjectAnimationEditor
      form={form}
      notifyProgrammaticChange={notifyProgrammaticChange}
      subtype={subtype}
    />
  );
}

describe("MovingObjectDetailsEditor", () => {
  it("renders every optional production group and projects native controls to RHF", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    render(<MovingObjectDetailsHarness onRead={onRead} />);

    for (const group of [
      "Objektkern",
      "Maßstab und Anker",
      "Bewegung und Mechanik",
      "Material und Zustand",
      "Licht und Bodenkontakt",
      "Weitere Produktionsdetails",
    ]) {
      expect(screen.getByRole("group", { name: group })).toBeVisible();
    }

    const labels = [
      "Zweck / Funktion",
      "Grundform",
      "Kurze Objektbeschreibung",
      "Standfläche · Breite in Tiles",
      "Standfläche · Tiefe in Tiles",
      "Objekthöhe in Pixel",
      "Ausrichtungsanker",
      "Bewegungsart",
      "Mechanik / Antrieb",
      "Hauptmaterial",
      "Zustand",
      "Materialdetails",
      "Lichtverhalten",
      "Bodenschatten",
      "Weitere Objektdetails",
    ];
    for (const label of labels) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }

    expect(screen.getByRole("status", { name: "Objektklasse" })).toHaveTextContent(
      "Karren / Wagen",
    );
    expect(screen.getByText("Richtungsset verfügbar")).toBeVisible();

    await user.type(await chooseCustomText(user, "Zweck / Funktion"), "  Handel  ");
    await user.type(await chooseCustomText(user, "Grundform"), "Breiter Kasten");
    await user.type(
      await chooseCustomText(user, "Kurze Objektbeschreibung"),
      "Überdachter Händlerwagen",
    );
    await user.type(screen.getByLabelText("Standfläche · Breite in Tiles"), "2");
    await user.type(screen.getByLabelText("Standfläche · Tiefe in Tiles"), "1");
    await user.type(screen.getByLabelText("Objekthöhe in Pixel"), "96");
    await user.selectOptions(screen.getByLabelText("Ausrichtungsanker"), "footprintCenter");
    await user.selectOptions(screen.getByLabelText("Bewegungsart"), "roll");
    await user.selectOptions(screen.getByLabelText("Mechanik / Antrieb"), "wheels");
    await user.selectOptions(screen.getByLabelText("Hauptmaterial"), "wood");
    await user.selectOptions(screen.getByLabelText("Zustand"), "used");
    await user.selectOptions(screen.getByLabelText("Lichtverhalten"), "neutral");
    await user.selectOptions(screen.getByLabelText("Bodenschatten"), "contact");
    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));

    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        movingObjectClass: "cart",
        movingObjectPurpose: "Handel",
        movingObjectBasicShape: "Breiter Kasten",
        movingObjectDescription: "Überdachter Händlerwagen",
        movingObjectFootprintWidthTiles: 2,
        movingObjectFootprintDepthTiles: 1,
        movingObjectHeightPixels: 96,
        movingObjectAnchorMode: "footprintCenter",
        movementType: "roll",
        movingObjectMechanism: "wheels",
        movingObjectMaterial: "wood",
        movingObjectCondition: "used",
        movingObjectLightingBehavior: "neutral",
        movingObjectShadowMode: "contact",
      }),
    );
  });

  it("derives a floating crystal class while exposing no direction control", () => {
    render(<MovingObjectDetailsHarness subtype="floatingCrystal" />);

    expect(screen.getByRole("status", { name: "Objektklasse" })).toHaveTextContent(
      "Schwebendes Objekt",
    );
    expect(
      screen.getByText(/Aus dem Untertyp Schwebender Kristall eindeutig abgeleitet/),
    ).toBeVisible();
    expect(screen.getByText("Keine Richtungsansichten")).toBeVisible();
    expect(screen.queryByRole("radio", { name: /Richtungen/ })).not.toBeInTheDocument();
  });

  it("exposes the documented native numeric bounds", () => {
    render(<MovingObjectDetailsHarness />);

    for (const label of ["Standfläche · Breite in Tiles", "Standfläche · Tiefe in Tiles"]) {
      expect(screen.getByRole("spinbutton", { name: label })).toHaveAttribute("min", "1");
      expect(screen.getByRole("spinbutton", { name: label })).toHaveAttribute("max", "64");
    }
    expect(screen.getByRole("spinbutton", { name: "Objekthöhe in Pixel" })).toHaveAttribute(
      "min",
      "16",
    );
    expect(screen.getByRole("spinbutton", { name: "Objekthöhe in Pixel" })).toHaveAttribute(
      "max",
      "2048",
    );
  });
});

describe("MovingObjectAnimationEditor", () => {
  it("offers every domain sequence and toggles four default frames by keyboard", async () => {
    const user = userEvent.setup();
    const notifyProgrammaticChange = vi.fn();
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = {
      current: null,
    };
    render(
      <MovingObjectAnimationHarness
        formRef={formRef}
        notifyProgrammaticChange={notifyProgrammaticChange}
        subtype="floatingCrystal"
      />,
    );

    expect(MOVING_OBJECT_ANIMATION_TYPE_IDS).toHaveLength(6);
    for (const label of [
      "Idle-Loop",
      "Bewegung",
      "Rotation",
      "Interaktion",
      "Öffnen / Schließen",
      "Pulsieren",
    ]) {
      expect(screen.getByRole("checkbox", { name: `${label} aktivieren` })).toBeVisible();
    }

    expect(
      screen.getByText("Sequenzen erhalten eigene Frames, ohne Richtungsansichten zu erzeugen."),
    ).toBeVisible();
    expect(screen.queryByRole("radio", { name: /Richtungen/ })).not.toBeInTheDocument();

    const pulse = screen.getByRole("checkbox", {
      name: "Pulsieren aktivieren",
    });
    pulse.focus();
    await user.keyboard(" ");

    expect(pulse).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Frames für Pulsieren" })).toHaveValue(4);
    expect(formRef.current?.getValues("movingObjectAnimationFrames")).toEqual({
      pulse: 4,
    });
    expect(notifyProgrammaticChange).toHaveBeenCalledTimes(1);

    await user.keyboard(" ");
    expect(pulse).not.toBeChecked();
    expect(formRef.current?.getValues("movingObjectAnimationFrames")).toBeUndefined();
    expect(notifyProgrammaticChange).toHaveBeenCalledTimes(2);
  });

  it("edits directional sequence frames up to sixteen and exposes consistency rules", async () => {
    const user = userEvent.setup();
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = {
      current: null,
    };
    render(
      <MovingObjectAnimationHarness
        defaultAnimationFrames={{ move: 4 }}
        directionCount={8}
        formRef={formRef}
        notifyProgrammaticChange={() => undefined}
      />,
    );

    const frames = screen.getByRole("spinbutton", {
      name: "Frames für Bewegung",
    });
    expect(frames).toHaveAttribute("min", "1");
    expect(frames).toHaveAttribute("max", "16");
    await user.clear(frames);
    await user.type(frames, "16");

    expect(formRef.current?.getValues("movingObjectAnimationFrames.move")).toBe(16);
    expect(
      screen.getByText("Jede Sequenz verwendet ihre Frames in allen 8 gewählten Richtungen."),
    ).toBeVisible();
    expect(screen.getByText(/Kamera und die Weltlichtseite bleiben/)).toBeVisible();
    expect(screen.getByText(/Anker, Footprint und Objektproportionen/)).toBeVisible();
    expect(screen.getByText(/nicht blind/)).toBeVisible();
  });
});
