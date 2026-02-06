import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || "" });

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio = "1:1", inputImage } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Build contents array based on whether we have an input image
    let contents: any[];
    
    if (inputImage) {
      // Image editing mode - include the image with the prompt
      contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType: inputImage.mimeType,
            data: inputImage.data,
          },
        },
      ];
    } else {
      // Text-to-image generation mode
      contents = [{ text: prompt }];
    }

    // Use Gemini 2.5 Flash Image for better quality image generation
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: aspectRatio,
        },
      } as any,
    });

    // Extract image and text from response
    let imageData = null;
    let textResponse = "";

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        textResponse += part.text;
      } else if (part.inlineData) {
        imageData = {
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }

    if (!imageData) {
      return NextResponse.json(
        { error: "No image was generated. Try a different prompt." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      image: imageData,
      text: textResponse,
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate image" },
      { status: 500 }
    );
  }
}
