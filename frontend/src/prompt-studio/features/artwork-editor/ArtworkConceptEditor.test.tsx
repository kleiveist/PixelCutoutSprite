import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { ArtworkSubtype } from "../../domain/artworks";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import { ArtworkConceptEditor } from ".";

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
  formRef,
  onRead,
  subtype = "environmentConcept",
}: Readonly<{
  formRef?: { current: UseFormReturn<WizardCoreFormValues> | null };
  onRead?: (values: WizardCoreFormValues) => void;
  subtype?: ArtworkSubtype;
}>) {
  const form = useForm<WizardCoreFormValues>({
    defaultValues: {
      projectName: "Sturmobservatorium",
      category: "artwork",
      subtype,
      pixelDensity: "modernHd",
      styleProfile: "both",
      outlineStyle: "softSelective",
    },
  });
  if (formRef) formRef.current = form;
  return (
    <form>
      <ArtworkConceptEditor
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

describe("ArtworkConceptEditor", () => {
  it("captures purpose, motif, scene, composition, format, background, focus, light and detail in RHF", async () => {
    const user = userEvent.setup();
    const onRead = vi.fn();
    render(<Harness onRead={onRead} />);

    for (const group of [
      "Artwork-Ziel und Motiv",
      "Szene und Komposition",
      "Format und Hintergrund",
      "Lichtdramaturgie und Detailgrad",
    ]) {
      expect(screen.getByRole("group", { name: group })).toBeVisible();
    }
    expect(screen.getAllByText("Umgebungskonzept", { selector: "output" })).toHaveLength(1);
    expect(screen.getByText("Modern-HD · Stil A + B · selektive Outline")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Zweck"), "productionReference");
    await user.selectOptions(screen.getByLabelText("Motivart"), "environment");
    await user.type(await chooseCustomText(user, "Motivbeschreibung"), "Altes Observatorium");
    await user.type(await chooseCustomText(user, "Szene"), "Forscherin im Sturm");
    await user.selectOptions(screen.getByLabelText("Komposition"), "scene");
    await user.selectOptions(screen.getByLabelText("Format"), "landscape");
    await user.selectOptions(screen.getByLabelText("Artwork-Hintergrund"), "complete");
    await user.selectOptions(screen.getByLabelText("Fokus"), "scale");
    await user.selectOptions(screen.getByLabelText("Lichtdramaturgie"), "gloomy");
    await user.selectOptions(screen.getByLabelText("Detailgrad"), "productionConcept");
    await user.click(screen.getByRole("button", { name: "Formularwerte lesen" }));

    expect(onRead).toHaveBeenCalledWith(
      expect.objectContaining({
        artworkPurpose: "productionReference",
        artworkMotif: "environment",
        artworkDescription: "Altes Observatorium",
        artworkSceneDescription: "Forscherin im Sturm",
        artworkComposition: "scene",
        artworkFormat: "landscape",
        artworkBackground: "complete",
        artworkFocus: "scale",
        artworkLightingDrama: "gloomy",
        artworkDetailLevel: "productionConcept",
      }),
    );
  });

  it("derives the Artwork type without writing it and renders no game-asset controls", () => {
    const formRef: { current: UseFormReturn<WizardCoreFormValues> | null } = {
      current: null,
    };
    render(<Harness formRef={formRef} subtype="moodPainting" />);

    expect(screen.getByText("Stimmungsbild", { selector: "output" })).toBeVisible();
    expect(formRef.current?.getValues()).not.toHaveProperty("artworkType");
    expect(screen.queryByLabelText(/Tilegröße/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/4 Richtungen|8 Richtungen/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Animation/i })).not.toBeInTheDocument();
  });
});
