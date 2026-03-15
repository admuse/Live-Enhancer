import { GoogleGenAI, Modality, Type, FunctionDeclaration, ThinkingLevel } from "@google/genai";

const getApiKey = () => {
  return (window as any).process?.env?.API_KEY || process.env.GEMINI_API_KEY || "";
};

export const ai = new GoogleGenAI({ 
  get apiKey() {
    return getApiKey();
  }
});

export const EDIT_IMAGE_TOOL: FunctionDeclaration = {
  name: "edit_image",
  description: "Edit the current image based on the user's verbal instruction. Use this when the user asks to change the image (e.g., 'colorize it', 'make it sharper', 'remove the background').",
  parameters: {
    type: Type.OBJECT,
    properties: {
      instruction: {
        type: Type.STRING,
        description: "The specific instruction for the image edit (e.g., 'colorize the photo', 'increase sharpness', 'remove the person on the left').",
      },
    },
    required: ["instruction"],
  },
};

export async function performImageEdit(base64Image: string, instruction: string, mimeType: string, imageSize: "512px" | "1K" | "2K" | "4K" = "1K") {
  console.log('Starting performImageEdit with instruction:', instruction, 'size:', imageSize);
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('No API key available for image editing');
    throw new Error('API_KEY_MISSING');
  }

  if (!base64Image) {
    console.error('No image data provided to performImageEdit');
    return null;
  }

  const imageSizeKB = Math.round(base64Image.length * 0.75 / 1024);
  console.log(`Image size: ~${imageSizeKB} KB`);

  try {
    // Ensure we only have the base64 part
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    
    // Validate and fallback mimeType
    const supportedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'];
    const finalMimeType = supportedMimeTypes.includes(mimeType) ? mimeType : 'image/png';
    
    console.log(`Using mimeType: ${finalMimeType} (original: ${mimeType})`);
    console.log(`Calling Gemini API (3.1 Flash Image) for image editing at ${imageSize}...`);
    
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Gemini API request timed out after 45s')), 45000)
    );

    // Create a fresh instance to ensure latest API key
    const currentAi = new GoogleGenAI({ apiKey });

    // Simple aspect ratio detection
    let aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "1:1";
    const img = new Image();
    img.src = base64Image;
    await new Promise((resolve) => {
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio > 1.5) aspectRatio = "16:9";
        else if (ratio > 1.2) aspectRatio = "4:3";
        else if (ratio < 0.6) aspectRatio = "9:16";
        else if (ratio < 0.8) aspectRatio = "3:4";
        resolve(null);
      };
      img.onerror = () => resolve(null);
    });

    const apiCallPromise = currentAi.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: `TASK: Image Editing\nINSTRUCTION: ${instruction}\n\nIMPORTANT: You are an image editing model. You MUST return the modified image as an image part. Do not just describe the changes. If you are asked to colorize, you MUST return a colorized version of the provided image.`,
          },
          {
            inlineData: {
              data: base64Data,
              mimeType: finalMimeType,
            },
          },
        ],
      },
      config: {
        imageConfig: {
          imageSize,
          aspectRatio
        }
      }
    });

    // Race the API call against the timeout
    const response = await Promise.race([apiCallPromise, timeoutPromise]) as any;

    console.log('Gemini API response received. Parts count:', response.candidates?.[0]?.content?.parts?.length || 0);

    if (!response.candidates || response.candidates.length === 0) {
      console.warn('No candidates returned from Gemini API');
      if (response.promptFeedback?.blockReason) {
        throw new Error(`Content blocked: ${response.promptFeedback.blockReason}`);
      }
      return null;
    }

    const candidate = response.candidates[0];
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('Content blocked by safety filters. Please try a different image or instruction.');
    }
    
    // Log all parts for debugging
    candidate.content?.parts?.forEach((part: any, index: number) => {
      if (part.text) console.log(`Part ${index}: Text content found`);
      if (part.inlineData) console.log(`Part ${index}: Image data found (${part.inlineData.mimeType})`);
    });

    for (const part of candidate.content?.parts || []) {
      if (part.inlineData) {
        console.log('Success: Image part found in response');
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    if (candidate.content?.parts?.some((p: any) => p.text)) {
      const text = candidate.content.parts.find((p: any) => p.text).text;
      console.warn('Gemini returned text but no image. Text:', text);
      if (text.toLowerCase().includes("quota") || text.toLowerCase().includes("limit")) {
        throw new Error('QUOTA_EXCEEDED');
      }
    }

    console.warn('No image part found in Gemini API response');
    return null;
  } catch (error: any) {
    console.error('Error in performImageEdit:', error);
    if (error.message?.includes("entity was not found") || error.message?.includes("API_KEY_INVALID")) {
      throw new Error('API_KEY_INVALID');
    }
    throw error;
  }
}
