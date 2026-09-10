import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseWizardDraft } from "../../schemas";
import {
  GuidedWizardEngine,
  type GuidedWizardFlowDefinition,
  type GuidedWizardStepComponentProps,
  type GuidedWizardSummaryComponentProps,
} from "./GuidedWizardEngine";

const INITIAL_DRAFT = parseWizardDraft({
  schemaVersion: 2,
  kind: "wizardDraft",
  draftId: "draft_guided_engine_extension",
  projectName: "Engine-Erweiterung",
  route: "wizard/project",
  currentStep: "project",
  validation: { errors: [], warnings: [] },
  savedAt: "2026-09-04T10:00:00.000Z",
});

const BaseSyntheticSchema = z.strictObject({
  projectName: z.string().min(1),
  craftNote: z.string(),
  craftEnabled: z.boolean(),
});

const CraftStepSchema = z.strictObject({
  projectName: z.string().min(1),
  craftNote: z.string().trim().min(1, "Bitte ergänze die Handwerksnotiz."),
  craftEnabled: z.boolean(),
});

type SyntheticValues = z.infer<typeof BaseSyntheticSchema>;
type SyntheticStepId = "project" | "foundation" | "craft";
interface SyntheticContext {
  readonly fieldLabel: string;
}

type SyntheticStepProps = GuidedWizardStepComponentProps<SyntheticValues, SyntheticContext>;

function ProjectStep() {
  return <p>Projektgrundlage ist vorbereitet.</p>;
}

function FoundationStep() {
  return <p>Technische Grundlage ist vorbereitet.</p>;
}

function CraftStep({ context, form }: SyntheticStepProps) {
  const error = form.formState.errors.craftNote?.message;

  return (
    <div>
      <label htmlFor="synthetic-craft-note">{context.fieldLabel}</label>
      <input
        id="synthetic-craft-note"
        aria-invalid={error ? "true" : "false"}
        {...form.register("craftNote")}
      />
      {typeof error === "string" ? <p>{error}</p> : null}
    </div>
  );
}

function SyntheticSummary({
  values,
}: GuidedWizardSummaryComponentProps<SyntheticValues, SyntheticContext>) {
  return <aside aria-label="Synthetische Zusammenfassung">{values.craftNote}</aside>;
}

const SYNTHETIC_FLOW = Object.freeze({
  steps: Object.freeze([
    Object.freeze({
      id: "project",
      title: "Projekt",
      description: "Erster synthetischer Schritt.",
      fieldPaths: Object.freeze(["projectName"] as const),
      schema: BaseSyntheticSchema,
      Component: ProjectStep,
    }),
    Object.freeze({
      id: "foundation",
      title: "Grundlage",
      description: "Zweiter synthetischer Schritt.",
      fieldPaths: Object.freeze([] as const),
      schema: BaseSyntheticSchema,
      Component: FoundationStep,
    }),
    Object.freeze({
      id: "craft",
      title: "Handwerk",
      description: "Deklarativ ergänzter dritter Schritt.",
      fieldPaths: Object.freeze(["craftNote"] as const),
      schema: CraftStepSchema,
      isApplicable: (values: SyntheticValues) => values.craftEnabled,
      Component: CraftStep,
    }),
  ]),
  updateDraft: ({ draft, values, stepId, savedAt }) =>
    parseWizardDraft({
      ...draft,
      projectName: values.projectName,
      route: stepId === "project" ? "wizard/project" : "wizard/category",
      currentStep: stepId,
      validation: {
        errors: [],
        warnings: values.craftNote ? [values.craftNote] : [],
      },
      ...(savedAt === undefined ? {} : { savedAt }),
    }),
  Summary: SyntheticSummary,
} satisfies GuidedWizardFlowDefinition<SyntheticValues, SyntheticStepId, SyntheticContext>);

describe("GuidedWizardEngine extension contract", () => {
  it("keeps a field registered when typing resumes in the autosave commit window", () => {
    vi.useFakeTimers();
    const writeDraft = vi.fn(() => ({ status: "ok" as const }));
    const values = {
      projectName: INITIAL_DRAFT.projectName,
      craftNote: "Start",
      craftEnabled: true,
    };
    const rendered = render(
      <GuidedWizardEngine
        baselineDraft={INITIAL_DRAFT}
        baselineValues={values}
        context={{ fieldLabel: "Notiz" }}
        draft={INITIAL_DRAFT}
        draftPersisted={false}
        flow={SYNTHETIC_FLOW}
        initialStepId="craft"
        initialValues={values}
        now={() => "2026-09-04T10:05:00.000Z"}
        onDraftEdited={() => undefined}
        onDraftSaved={() => undefined}
        storageAdapter={{ writeDraft }}
      />,
    );
    try {
      const input = screen.getByRole("textbox", { name: "Notiz" });
      fireEvent.change(input, { target: { value: "Erster Stand" } });
      act(() => {
        vi.advanceTimersByTime(300);
        // Native input arrives before React has committed the save-status render.
        fireEvent.change(input, { target: { value: "Weitergetippt" } });
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(writeDraft).toHaveBeenLastCalledWith(
        expect.objectContaining({
          validation: { errors: [], warnings: ["Weitergetippt"] },
        }),
      );
    } finally {
      rendered.unmount();
      vi.useRealTimers();
    }
  });

  it("does not cancel pending autosave when only parent callback identities change", () => {
    vi.useFakeTimers();
    const writeDraft = vi.fn(() => ({ status: "ok" as const }));
    const values = {
      projectName: INITIAL_DRAFT.projectName,
      craftNote: "Start",
      craftEnabled: true,
    };
    const tree = () => (
      <GuidedWizardEngine
        baselineDraft={INITIAL_DRAFT}
        baselineValues={values}
        context={{ fieldLabel: "Notiz" }}
        draft={INITIAL_DRAFT}
        draftPersisted={false}
        flow={SYNTHETIC_FLOW}
        initialStepId="craft"
        initialValues={values}
        now={() => "2026-09-04T10:05:00.000Z"}
        onDraftEdited={() => undefined}
        onDraftSaved={() => undefined}
        storageAdapter={{ writeDraft }}
      />
    );
    const rendered = render(tree());
    try {
      fireEvent.change(screen.getByRole("textbox", { name: "Notiz" }), {
        target: { value: "Erhalten" },
      });
      rendered.rerender(tree());
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(writeDraft).toHaveBeenLastCalledWith(
        expect.objectContaining({
          validation: { errors: [], warnings: ["Erhalten"] },
        }),
      );
    } finally {
      rendered.unmount();
      vi.useRealTimers();
    }
  });

  it("passes the current product context through every Draft projection", async () => {
    const user = userEvent.setup();
    const updateDraft = vi.fn(SYNTHETIC_FLOW.updateDraft);
    const flow = { ...SYNTHETIC_FLOW, updateDraft };
    const context = { fieldLabel: "Kontextgebundene Notiz" };

    render(
      <GuidedWizardEngine
        baselineDraft={INITIAL_DRAFT}
        baselineValues={{
          projectName: INITIAL_DRAFT.projectName,
          craftNote: "",
          craftEnabled: true,
        }}
        context={context}
        draft={INITIAL_DRAFT}
        draftPersisted={false}
        flow={flow}
        initialStepId="project"
        initialValues={{
          projectName: INITIAL_DRAFT.projectName,
          craftNote: "",
          craftEnabled: true,
        }}
        now={() => "2026-09-04T10:05:00.000Z"}
        onDraftEdited={() => undefined}
        onDraftSaved={() => undefined}
        storageAdapter={{ writeDraft: () => ({ status: "ok" }) }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Weiter/ }));

    expect(updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        stepId: "foundation",
      }),
    );
  });

  it("validates, focuses, navigates, and autosaves a declarative third step", async () => {
    const user = userEvent.setup();
    const writeDraft = vi.fn(() => ({ status: "ok" as const }));
    const onDraftEdited = vi.fn();
    const onDraftSaved = vi.fn();

    render(
      <GuidedWizardEngine
        baselineDraft={INITIAL_DRAFT}
        baselineValues={{
          projectName: INITIAL_DRAFT.projectName,
          craftNote: "",
          craftEnabled: true,
        }}
        context={{ fieldLabel: "Handwerksnotiz" }}
        draft={INITIAL_DRAFT}
        draftPersisted={false}
        flow={SYNTHETIC_FLOW}
        initialStepId="project"
        initialValues={{
          projectName: INITIAL_DRAFT.projectName,
          craftNote: "",
          craftEnabled: true,
        }}
        now={() => "2026-09-04T10:05:00.000Z"}
        onDraftEdited={onDraftEdited}
        onDraftSaved={onDraftSaved}
        storageAdapter={{ writeDraft }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { name: "Grundlage" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { name: "Handwerk" })).toBeVisible();
    expect(writeDraft).toHaveBeenCalledTimes(2);

    const craftNote = screen.getByRole("textbox", { name: "Handwerksnotiz" });
    await user.click(screen.getByRole("button", { name: "Schritt prüfen" }));

    expect(screen.getByText("Bitte ergänze die Handwerksnotiz.")).toBeVisible();
    expect(craftNote).toHaveAttribute("aria-invalid", "true");
    expect(craftNote).toHaveFocus();
    expect(writeDraft).toHaveBeenCalledTimes(2);

    await user.clear(craftNote);
    await user.type(craftNote, "  Runenstahl  ");

    await waitFor(() => expect(writeDraft).toHaveBeenCalledTimes(3));
    expect(writeDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentStep: "craft",
        validation: { errors: [], warnings: ["Runenstahl"] },
      }),
    );
    expect(onDraftSaved).toHaveBeenCalledTimes(3);
  });

  it("skips an inapplicable step and recovers an unavailable initial step", async () => {
    const user = userEvent.setup();
    const writeDraft = vi.fn(() => ({ status: "ok" as const }));
    const values = {
      projectName: INITIAL_DRAFT.projectName,
      craftNote: "",
      craftEnabled: false,
    };

    render(
      <GuidedWizardEngine
        baselineDraft={INITIAL_DRAFT}
        baselineValues={values}
        context={{ fieldLabel: "Handwerksnotiz" }}
        draft={INITIAL_DRAFT}
        draftPersisted={true}
        flow={SYNTHETIC_FLOW}
        initialStepId="craft"
        initialValues={values}
        now={() => "2026-09-04T10:05:00.000Z"}
        onDraftEdited={() => undefined}
        onDraftSaved={() => undefined}
        storageAdapter={{ writeDraft }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Grundlage" })).toBeVisible();
    expect(screen.queryByText("Handwerk")).not.toBeInTheDocument();
    expect(screen.getByText("Schritt 2 von 2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Schritt prüfen" }));
    expect(writeDraft).not.toHaveBeenCalled();
  });
});
