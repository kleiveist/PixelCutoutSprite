import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type DefaultValues, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { getDefaultTextureMaterialType, type TextureSubtype } from "../../domain/textures";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { TextureMaterialEditor } from "./TextureMaterialEditor";

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

function TextureEditorHarness({
  defaultValues,
  formRef,
  onRead,
  subtype = "wood",
}: Readonly<{
  defaultValues?: DefaultValues<WizardCoreFormValues>;
  formRef?: { current: UseFormReturn<WizardCoreFormValues> | null };
  onRead?: (values: WizardCoreFormValues) => void;
  subtype?: TextureSubtype;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Materialstudie",
      category: "texture",
      subtype,
      textureMaterialType: getDefaultTextureMaterialType(subtype),
      ...defaultValues,
    },
  });
  if (formRef) formRef.current = form;

  return (
    <form>
      <TextureMaterialEditor
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

describe("TextureMaterialEditor", () => {
  it("keeps a wood workflow focused on material and texture controls", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    render(<TextureEditorHarness defaultValues={{ tileSize: 32 }} onRead={onRead} />);

    expect(screen.getByRole("heading", { name: "Holztextur" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Holz im Produktionsfokus" })).toBeVisible();
    expect(screen.getByText(/Holzart, Maserung, Plankenbreite/)).toBeVisible();

    for (const group of [
      "Material und Verwendung",
      "Kachel und Raster",
      "Struktur und Oberfläche",
      "Feuchtigkeit, Vereisung und Licht",
      "Weitere Materialdetails",
    ]) {
      expect(screen.getByRole("group", { name: group })).toBeVisible();
    }

    expect(screen.getByRole("status", { name: "Materialtyp" })).toHaveTextContent("Holz");
    expect(screen.getByRole("status", { name: "Wirksame Tilegröße" })).toHaveTextContent(
      "32 × 32 px",
    );

    for (const label of [
      "Einsatzbereich",
      "Unterart und gewünschte Wirkung",
      "Nahtlos kachelbar?",
      "Strukturgrad",
      "Oberflächenaufbau",
      "Oberflächenrichtung",
      "Zustand",
      "Feuchtigkeit",
      "Vereisung",
      "Materialbeleuchtung",
      "Farben, Elemente und Randregeln",
    ]) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }

    expect(
      screen.queryByLabelText(/Richtungsanzahl|Richtungsset|4 Richtungen|8 Richtungen/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Bewegungsart/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Kleidung/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Einsatzbereich"), "floor");
    await user.type(
      await chooseCustomText(user, "Unterart und gewünschte Wirkung"),
      "Verwitterte Eichenplanken",
    );
    await user.selectOptions(screen.getByLabelText("Nahtlos kachelbar?"), "true");
    await user.selectOptions(screen.getByLabelText("Strukturgrad"), "coarse");
    await user.selectOptions(screen.getByLabelText("Oberflächenaufbau"), "planked");
    await user.selectOptions(screen.getByLabelText("Oberflächenrichtung"), "grainAligned");
    await user.selectOptions(screen.getByLabelText("Zustand"), "old");
    await user.selectOptions(screen.getByLabelText("Feuchtigkeit"), "damp");
    await user.selectOptions(screen.getByLabelText("Vereisung"), "none");
    await user.selectOptions(screen.getByLabelText("Materialbeleuchtung"), "neutralEven");
    await user.type(
      await chooseCustomText(user, "Farben, Elemente und Randregeln"),
      "Warme Brauntöne, unauffällige Knoten",
    );
    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));

    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        textureMaterialType: "wood",
        textureUsage: "floor",
        textureDescription: "Verwitterte Eichenplanken",
        seamless: true,
        tileSize: 32,
        textureStructure: "coarse",
        textureSurface: "planked",
        textureOrientation: "grainAligned",
        textureCondition: "old",
        textureMoisture: "damp",
        textureIcing: "none",
        textureLighting: "neutralEven",
        textureExtraDetails: "Warme Brauntöne, unauffällige Knoten",
      }),
    );
  });

  it("offers an explicit three-state seamless choice without a false default", async () => {
    const user = userEvent.setup();
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = {
      current: null,
    };
    render(<TextureEditorHarness formRef={formRef} />);

    const seamless = screen.getByLabelText("Nahtlos kachelbar?");
    expect(seamless).toHaveValue("");
    expect(formRef.current?.getValues("seamless")).toBeUndefined();

    await user.selectOptions(seamless, "false");
    expect(formRef.current?.getValues("seamless")).toBe(false);

    await user.selectOptions(seamless, "");
    expect(formRef.current?.getValues("seamless")).toBeUndefined();

    await user.selectOptions(seamless, "true");
    expect(formRef.current?.getValues("seamless")).toBe(true);
  });

  it("hydrates an explicitly non-seamless texture without changing its meaning", () => {
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = {
      current: null,
    };
    render(<TextureEditorHarness defaultValues={{ seamless: false }} formRef={formRef} />);

    expect(screen.getByLabelText("Nahtlos kachelbar?")).toHaveValue("false");
    expect(formRef.current?.getValues("seamless")).toBe(false);
  });

  it("shows inherited tile size read-only and never invents a missing value", () => {
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = {
      current: null,
    };
    render(
      <TextureEditorHarness defaultValues={{ textureMaterialType: undefined }} formRef={formRef} />,
    );

    expect(screen.getByRole("status", { name: "Wirksame Tilegröße" })).toHaveTextContent(
      "Nicht festgelegt",
    );
    expect(formRef.current?.getValues("tileSize")).toBeUndefined();
    expect(formRef.current?.getValues("textureMaterialType")).toBeUndefined();
    expect(screen.getByRole("status", { name: "Materialtyp" })).toHaveTextContent("Holz");
    expect(screen.queryByRole("spinbutton", { name: /Tilegröße/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Basisprofil-Vererbung/)).toBeVisible();
  });

  it("asks custom material users for an explicit description", () => {
    render(<TextureEditorHarness subtype="customMaterial" />);

    expect(screen.getByRole("heading", { name: "Eigene Materialtextur" })).toBeVisible();
    expect(screen.getByRole("status", { name: "Materialtyp" })).toHaveTextContent(
      "Eigenes Material",
    );
    expect(screen.getByLabelText("Eigenes Material beschreiben")).toBeVisible();
    expect(screen.getByText(/Unterart, Aufbau, typische Oberflächenelemente/)).toBeVisible();
  });
});
