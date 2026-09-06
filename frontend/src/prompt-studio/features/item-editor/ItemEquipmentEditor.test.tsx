import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type DefaultValues, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { ItemSubtype } from "../../domain/items";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { ItemEquipmentEditor } from ".";

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

function Harness({
  defaultValues,
  formRef,
  onRead,
  subtype = "armorPiece",
}: Readonly<{
  defaultValues?: DefaultValues<WizardCoreFormValues>;
  formRef?: { current: UseFormReturn<WizardCoreFormValues> | null };
  onRead?: (values: WizardCoreFormValues) => void;
  subtype?: ItemSubtype;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: { projectName: "Wachrüstung", category: "item", subtype, ...defaultValues },
  });
  if (formRef) formRef.current = form;
  return (
    <form>
      <ItemEquipmentEditor
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

describe("ItemEquipmentEditor", () => {
  it("captures material, state, function, meaning, size and readability in RHF", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    render(
      <Harness
        defaultValues={{
          tileSize: 32,
          pixelDensity: "modernHd",
          backgroundMode: "transparent",
          alphaPadding: 8,
        }}
        onRead={onRead}
      />,
    );

    for (const group of [
      "Itemkern und Funktion",
      "Material und Zustand",
      "Bedeutung und Lesbarkeit",
      "Größe und Ausgabe",
    ]) {
      expect(screen.getByRole("group", { name: group })).toBeVisible();
    }
    expect(screen.getByText("Rüstung", { selector: "output" })).toBeVisible();
    expect(screen.getByText("Transparent · 8 px Alpha-Rand")).toBeVisible();
    expect(screen.getByText("32 px Tile · modernHd")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Zweck"), "wearable");
    await user.selectOptions(screen.getByLabelText("Darstellung"), "equipped");
    await user.selectOptions(screen.getByLabelText("Trageposition"), "body");
    await user.type(await chooseCustomText(user, "Motivbeschreibung"), "Gravierte Schulterplatte");
    await user.type(await chooseCustomText(user, "Funktion"), "Schützt Schulter und Oberarm");
    await user.selectOptions(screen.getByLabelText("Hauptmaterial"), "metal");
    await user.selectOptions(screen.getByLabelText("Sekundärmaterial"), "leather");
    await user.selectOptions(screen.getByLabelText("Zustand"), "worn");
    await user.selectOptions(screen.getByLabelText("Bedeutung"), "ceremonial");
    await user.selectOptions(screen.getByLabelText("Detaildichte"), "silhouetteFirst");
    await user.selectOptions(screen.getByLabelText("Relative Größe"), "medium");
    await user.type(screen.getByLabelText("Icongröße (px)"), "48");
    await user.selectOptions(screen.getByLabelText("Schatten"), "contact");
    await user.type(screen.getByLabelText("Varianten"), "3");
    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));

    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        itemPurpose: "wearable",
        itemPresentation: "equipped",
        itemWearPosition: "body",
        itemDescription: "Gravierte Schulterplatte",
        itemFunctionDetails: "Schützt Schulter und Oberarm",
        itemPrimaryMaterial: "metal",
        itemSecondaryMaterial: "leather",
        itemCondition: "worn",
        itemSignificance: "ceremonial",
        itemReadability: "silhouetteFirst",
        itemSize: "medium",
        itemIconSize: 48,
        itemShadowMode: "contact",
        itemVariantCount: 3,
      }),
    );
  });

  it("derives class without writing it and never renders directions or animation", () => {
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = { current: null };
    render(<Harness formRef={formRef} subtype="questItem" />);

    expect(screen.getByText("Questgegenstand", { selector: "output" })).toBeVisible();
    expect(formRef.current?.getValues("itemClass")).toBeUndefined();
    expect(screen.queryByLabelText("Trageposition")).not.toBeInTheDocument();
    expect(screen.queryByText(/4 Richtungen|8 Richtungen/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Animation/i })).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Darstellung")).queryByRole("option", {
        name: "Ausgerüstete Darstellung",
      }),
    ).not.toBeInTheDocument();
  });
});
