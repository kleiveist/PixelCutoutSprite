import { buildAnimationModule } from "./modules/animation";
import { buildBaseProfileModule } from "./modules/baseProfile";
import { buildCategoryModule } from "./modules/category";
import { buildCompositionModule } from "./modules/composition";
import { buildLightingModule } from "./modules/lighting";
import { buildMaterialsModule } from "./modules/materials";
import { buildMotionModule } from "./modules/motion";
import { buildNegativeRulesModule } from "./modules/negativeRules";
import { buildSettingModule } from "./modules/setting";
import { buildStyleProfileModule } from "./modules/styleProfile";
import { buildSubjectModule } from "./modules/subject";
import { buildTechnicalSpecModule } from "./modules/technicalSpec";
import type {
  PromptBuildContext,
  PromptModuleBuilder,
  PromptModuleResult,
} from "./promptEngine.types";

export const PROMPT_MODULE_BUILDERS = Object.freeze([
  buildBaseProfileModule,
  buildStyleProfileModule,
  buildCategoryModule,
  buildSubjectModule,
  buildMaterialsModule,
  buildSettingModule,
  buildLightingModule,
  buildMotionModule,
  buildAnimationModule,
  buildCompositionModule,
  buildNegativeRulesModule,
  buildTechnicalSpecModule,
] as const satisfies readonly PromptModuleBuilder[]);

export function buildPromptModules(context: PromptBuildContext): readonly PromptModuleResult[] {
  return Object.freeze(PROMPT_MODULE_BUILDERS.map((buildModule) => buildModule(context)));
}
