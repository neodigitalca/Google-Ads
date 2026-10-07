import { generateSEOImageFilename } from "@/lib/image-filename-generator";
import { runFeaturedImage } from "@/lib/image-generator/run-featured-image";
import { runImageChecklist } from "@/lib/image-generator/run-image-checklist";
import {
  formatImageRequirementsArtifact,
  IMAGE_REQUIREMENTS_ARTIFACT_FILENAME,
} from "@/lib/image-checklist-builder";
import type {
  ImageGeneratorOptions,
  ImageGeneratorRunContext,
} from "@/lib/image-generator/image-generator-options";
import { getImageModel, getMetaModel, getResearchModel } from "@/lib/optimization-settings-storage";
import { stripHtmlForKeywordContext } from "@/lib/overview/overview-row-helpers";
import { buildFocusedArticlePurpose } from "@/lib/content-generation/article-length-policy";
import { dataUrlToBase64 } from "@/lib/proxy-fetch-text";
import { logFeaturedImagePipeline } from "@/lib/image-generator/featured-image-pipeline-log";

export type OverviewAiseoFeaturedImageArtifact = {
  name: string;
  content: string;
  mimeType: string;
};

export type OverviewAiseoFeaturedImageRunResult = {
  artifacts: OverviewAiseoFeaturedImageArtifact[];
  uploadBase64: string;
  uploadFileName: string;
  mediaTitle: string;
};

export async function runOverviewAiseoFeaturedImageRow(params: {
  apiKey: string;
  siteId?: string;
  title: string;
  contentHtml: string;
  keyword?: string;
  /** Attach pipeline files as each step finishes (requirements, then images). */
  onArtifacts?: (artifacts: OverviewAiseoFeaturedImageArtifact[]) => void;
}): Promise<OverviewAiseoFeaturedImageRunResult> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key is missing");
  }
  const title = params.title.trim();
  if (!title) {
    throw new Error("Missing title for featured image");
  }
  const plainBody = stripHtmlForKeywordContext(params.contentHtml);
  if (!plainBody) {
    throw new Error("Missing post body for featured image");
  }

  const researchModel = getResearchModel(params.siteId);
  const imageModel = getImageModel(params.siteId);
  const flowPurpose = buildFocusedArticlePurpose(params.keyword?.trim() || title);

  logFeaturedImagePipeline("Row run started", {
    title,
    keyword: params.keyword?.trim() || null,
    researchModel,
    imageModel,
    bodyChars: plainBody.length,
  });

  const imageOptions: ImageGeneratorOptions = {
    userPrompt: params.keyword?.trim() || "",
    imageSourceMode: "featured",
    selectedSection: null,
    includeText: false,
    includePeople: false,
    includeAnimals: false,
    includeCars: false,
    isInfographic: false,
    aspectRatio: "16:9",
    style: "professional",
    colorScheme: "vibrant",
    colorForeground: "",
    colorBackground: "",
    imageModel,
  };

  const imageContext: ImageGeneratorRunContext = {
    apiKey,
    flowTitle: title,
    flowPurpose,
    agents: [],
    finalOutput: plainBody,
    selectedModel: researchModel,
    temperature: 1.0,
    maxTokens: 4000,
    topP: 0.9,
    availableSections: [],
  };

  const checklist = await runImageChecklist(imageOptions, imageContext);

  const requirementsArtifact: OverviewAiseoFeaturedImageArtifact = {
    name: IMAGE_REQUIREMENTS_ARTIFACT_FILENAME,
    content: formatImageRequirementsArtifact(checklist, {
      title,
      purpose: flowPurpose,
      keyword: params.keyword?.trim(),
    }),
    mimeType: "application/json",
  };
  const artifacts: OverviewAiseoFeaturedImageArtifact[] = [requirementsArtifact];
  params.onArtifacts?.([requirementsArtifact]);
  logFeaturedImagePipeline("IMAGE REQUIREMENTS: artifact ready", {
    file: requirementsArtifact.name,
    checklistItems: checklist.length,
  });

  logFeaturedImagePipeline("Google Image + OpenRouter Image: starting generation", {
    imageModel,
  });
  const generation = await runFeaturedImage(imageOptions, imageContext, checklist);
  if (generation.error?.trim()) {
    logFeaturedImagePipeline("OpenRouter Image: model returned error (row may skip upload)", {
      error: generation.error.trim(),
    });
    throw new Error(generation.error.trim());
  }

  const preview =
    generation.previewUrl?.trim() ||
    generation.imageBase64?.trim() ||
    generation.imageUrl?.trim();
  if (!preview) {
    logFeaturedImagePipeline("OpenRouter Image: no image bytes returned");
    throw new Error("Image generation returned no image data");
  }

  const firstRefPreview = generation.referenceResearch?.references?.find(
    (r) => r.previewDataUrl?.trim(),
  )?.previewDataUrl?.trim();
  if (firstRefPreview) {
    const googleArtifact: OverviewAiseoFeaturedImageArtifact = {
      name: "google-image.png",
      content: firstRefPreview.startsWith("data:")
        ? firstRefPreview
        : `data:image/png;base64,${firstRefPreview}`,
      mimeType: "image/png",
    };
    artifacts.push(googleArtifact);
    params.onArtifacts?.([googleArtifact]);
    logFeaturedImagePipeline("Google Image: reference attached", {
      queryCount: generation.referenceResearch?.references?.length ?? 0,
    });
  } else {
    logFeaturedImagePipeline("Google Image: no reference photo selected (continuing)");
  }

  const generatedDataUrl = preview.startsWith("data:") ? preview : `data:image/png;base64,${preview}`;
  const openRouterArtifact: OverviewAiseoFeaturedImageArtifact = {
    name: "openrouter-image.png",
    content: generatedDataUrl,
    mimeType: "image/png",
  };
  artifacts.push(openRouterArtifact);
  params.onArtifacts?.([openRouterArtifact]);
  logFeaturedImagePipeline("OpenRouter Image: artifact ready", {
    file: openRouterArtifact.name,
    groundingMode: generation.referenceResearch?.mode ?? "unknown",
  });

  const uploadFileName = await generateSEOImageFilename(title, apiKey, getMetaModel(params.siteId), "featured");
  const uploadBase64 = preview.startsWith("data:") ? dataUrlToBase64(preview) : preview;

  return {
    artifacts,
    uploadBase64,
    uploadFileName,
    mediaTitle: title,
  };
}
