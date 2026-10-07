import {
  buildImageChecklistSystemPrompt,
  buildImageChecklistUserPrompt,
  parseImageChecklist,
  type ImageChecklistItem,
} from '../image-checklist-builder';
import { buildImagePrompt } from '../image-prompt-builder';
import { generateImage } from '../image-api';
import { streamChatCompletion } from '../api';
import { getImageModel, getResearchModel } from '../optimization-settings-storage';
import {
  buildGroundedImagePromptSuffix,
  collectReferenceDataUrls,
  researchGoogleImageReferences,
} from '../image-reference-research';
import { IMAGE_SCENE_PLAUSIBILITY_PROMPT } from '../image-scene-plausibility';
import { windowTreatmentImagePromptSuffix } from '../image-window-treatment-prompt-rules';
import { fetchImageDataUrlViaApi } from '../proxy-fetch-text';

export { parseImageChecklist };

/**
 * Generate image checklist from content used for featured-image prompts.
 * @param contentForImagePrompt Full article markdown **or** a blog checklist outline (bulk parallel path); both are analyzed the same way by the checklist model.
 */
export async function generateImageChecklist(
  flowTitle: string,
  flowPurpose: string,
  contentForImagePrompt: string,
  options: {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }
): Promise<ImageChecklistItem[]> {
  const systemPrompt = buildImageChecklistSystemPrompt(
    flowTitle,
    flowPurpose,
    contentForImagePrompt
  );

  const userPrompt = buildImageChecklistUserPrompt({
    flowTitle,
    flowPurpose,
    finalOutput: contentForImagePrompt,
    includeText: false,
    includePeople: false,
    includeAnimals: false,
    includeCars: false,
    isInfographic: false,
    aspectRatio: '16:9',
    style: 'professional',
    colorScheme: 'vibrant',
  });

  let checklistContent = '';
  await streamChatCompletion({
    apiKey: options.apiKey,
    model: options.model || getResearchModel(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature || 1.0,
    maxTokens: options.maxTokens || 4000,
    topP: options.topP || 0.9,
    onContentChunk: (chunk) => {
      checklistContent += chunk;
    },
  });

  return parseImageChecklist(checklistContent, { strictFeatured: true });
}

/**
 * Generate featured image for blog content.
 * @param contentForImagePrompt Full markdown **or** checklist outline text; drives `buildImagePrompt` alongside `imageChecklist`.
 */
export async function generateFeaturedImage(
  flowTitle: string,
  flowPurpose: string,
  contentForImagePrompt: string,
  imageChecklist: ImageChecklistItem[],
  options: {
    apiKey: string;
    /** @deprecated Use researchModel */
    model?: string;
    researchModel?: string;
    imageModel?: string;
  }
): Promise<{ imageBase64: string }> {
  const basePrompt = buildImagePrompt(
    {
      flowTitle,
      flowPurpose,
      finalOutput: contentForImagePrompt,
    },
    {
      includeText: false,
      includePeople: false,
      includeAnimals: false,
      includeCars: false,
      isInfographic: false,
      aspectRatio: '16:9',
      style: 'professional',
      colorScheme: 'vibrant',
    }
  );

  const checklistText = imageChecklist.length > 0
    ? `\n\nImage Generation Checklist:\n${imageChecklist.map((item, idx) => `${idx + 1}. ${item.title}\n   ${item.description}`).join('\n')}`
    : '';

  const prompt =
    basePrompt +
    checklistText +
    `\n\nFollow the checklist above EXACTLY. Ensure all requirements are met, especially regarding what should and should NOT be included. This is a WordPress featured image - no text, words, or labels should be included. ${IMAGE_SCENE_PLAUSIBILITY_PROMPT}${windowTreatmentImagePromptSuffix(flowTitle, contentForImagePrompt)}`;

  const researchModel =
    options.researchModel?.trim()
    || options.model?.trim()
    || getResearchModel();
  const imageModel = options.imageModel?.trim() || getImageModel();

  const research = await researchGoogleImageReferences({
    apiKey: options.apiKey,
    model: researchModel,
    context: {
      title: flowTitle,
      purpose: flowPurpose,
      body: contentForImagePrompt,
    },
    groundingProfile: 'featured',
  });
  const groundedPrompt = prompt + buildGroundedImagePromptSuffix(research.references);

  const result = await generateImage({
    apiKey: options.apiKey,
    model: imageModel,
    prompt: groundedPrompt,
    aspectRatio: '16:9',
    referenceImageDataUrls: collectReferenceDataUrls(research.references),
  });

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.imageBase64 && !result.imageUrl) {
    throw new Error('No image data returned from image generation API');
  }

  if (result.imageUrl && !result.imageBase64) {
    const dataUrl = await fetchImageDataUrlViaApi(result.imageUrl);
    return { imageBase64: dataUrl };
  }

  const imageBase64 = result.imageBase64?.startsWith('data:')
    ? result.imageBase64
    : `data:image/png;base64,${result.imageBase64}`;

  return { imageBase64: imageBase64! };
}
