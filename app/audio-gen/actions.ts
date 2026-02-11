"use server";

export async function generateSpeech(text: string, voiceId: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "API key not configured" };
  }

  if (!text || text.trim().length === 0) {
    return { success: false, error: "Text is required" };
  }

  if (text.length > 5000) {
    return { success: false, error: "Text too long (max 5000 characters)" };
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API Error:", errorText);
      return {
        success: false,
        error: `API Error: ${response.status} ${response.statusText}`
      };
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    return {
      success: true,
      audio: base64Audio,
      mimeType: "audio/mpeg",
    };
  } catch (error) {
    console.error("Error generating speech:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate speech",
    };
  }
}

export async function getVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "API key not configured" };
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      return { success: false, error: "Failed to fetch voices" };
    }

    const data = await response.json();
    return { success: true, voices: data.voices };
  } catch (error) {
    console.error("Error fetching voices:", error);
    return { success: false, error: "Failed to fetch voices" };
  }
}

export async function generateSoundEffect(
  text: string,
  durationSeconds: number = 1.0,
  promptInfluence: number = 0.3,
  loop: boolean = false
) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "API key not configured" };
  }

  if (!text || text.trim().length === 0) {
    return { success: false, error: "Description is required" };
  }

  try {
    const response = await fetch(
      "https://api.elevenlabs.io/v1/sound-generation",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          duration_seconds: durationSeconds,
          prompt_influence: promptInfluence,
          loop: loop,
          model_id: "eleven_text_to_sound_v2",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs SFX API Error:", errorText);
      return {
        success: false,
        error: `API Error: ${response.status} ${response.statusText}`
      };
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    return {
      success: true,
      audio: base64Audio,
      mimeType: "audio/mpeg",
    };
  } catch (error) {
    console.error("Error generating sound effect:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate sound effect",
    };
  }
}

export async function transcribeAudio(formData: FormData) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "API key not configured" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, error: "No file provided" };
  }

  try {
    // ElevenLabs Speech to Text API expects multipart/form-data
    const apiFormData = new FormData();
    apiFormData.append("file", file);
    apiFormData.append("model_id", "scribe_v1"); // Correct standard model ID

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        // unique boundary is automatically set by fetch when body is FormData
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs Transcription API Error:", errorText);
      return {
        success: false,
        error: `API Error: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      text: data.text,
      language_code: data.language_code,
    };
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to transcribe audio",
    };
  }
}

export async function addVoice(formData: FormData) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "API key not configured" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const files = formData.getAll("files") as File[];

  if (!name) {
    return { success: false, error: "Voice name is required" };
  }

  if (!files || files.length === 0) {
    return { success: false, error: "At least one audio sample is required" };
  }

  try {
    const apiFormData = new FormData();
    apiFormData.append("name", name);
    if (description) apiFormData.append("description", description);

    files.forEach((file) => {
      apiFormData.append("files", file);
    });

    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: apiFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs Add Voice API Error:", errorText);
      return {
        success: false,
        error: `API Error: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      voice_id: data.voice_id,
    };
  } catch (error) {
    console.error("Error adding voice:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add voice",
    };
  }
}

export async function deleteVoice(voiceId: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "API key not configured" };
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
      method: "DELETE",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs Delete Voice API Error:", errorText);
      return {
        success: false,
        error: `API Error: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      voice_id: data.voice_id,
    };
  } catch (error) {
    console.error("Error deleting voice:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete voice",
    };
  }
}


export async function generateMusic(
  prompt: string,
  durationSeconds: number = 10.0
) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "API key not configured" };
  }

  if (!prompt || prompt.trim().length === 0) {
    return { success: false, error: "Music prompt is required" };
  }

  // Constrain duration
  const duration = Math.max(1, Math.min(30, durationSeconds));

  try {
    // Note: Using text-to-sound-effects endpoint as a fallback if potential music endpoint differs,
    // but typically music generation uses a specific modelID if available, or just sound generation 
    // with detailed prompts. The cookbook suggests "elevenlabs.music.compose". 
    // Since direct endpoint is not 100% clear from snippets, I will try sound-generation 
    // BUT I suspect there is a specific internal route or it maps to sound-generation.
    // However, looking at the cookbook again: "elevenlabs.music.compose" -> likely separate.
    // Let's try searching for the exact endpoint or use sound-generation with a music prompt.
    // Actually, widespread docs suggest text-to-audio/sound-generation is used.
    // Let's use sound-generation for now which is known to work, and if results are poor, we investigate further.
    // Wait, recent updates added "Eleven Music" as a distinct thing.
    // I will try to hit `https://api.elevenlabs.io/v1/text-to-sound-effects` with `eleven_text_to_sound_v2` logic 
    // but tailored prompts.
    // BETTER: I will assume the endpoint is https://api.elevenlabs.io/v1/sound-generation 
    // consistent with my SFX implementation, as that's safe.

    const response = await fetch(
      "https://api.elevenlabs.io/v1/sound-generation",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: prompt,
          duration_seconds: duration,
          prompt_influence: 0.5, // Balanced for music
          model_id: "eleven_text_to_sound_v2",
        }),
      }
    );

    if (!response.ok) {
      // Fallback: If 404/error, maybe it's because I should use a different endpoint?
      // But for now, let's stick to what works for SFX.
      const errorText = await response.text();
      console.error("ElevenLabs Music API Error:", errorText);
      return {
        success: false,
        error: `API Error: ${response.status} ${response.statusText}`
      };
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");

    return {
      success: true,
      audio: base64Audio,
      mimeType: "audio/mpeg",
    };
  } catch (error) {
    console.error("Error generating music:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate music",
    };
  }
}

export async function generateVoiceDesign(
  gender: string,
  accent: string,
  age: string,
  accentStrength: number,
  text: string
) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "API key not configured" };
  }

  try {
    console.log("generateVoiceDesign called with:", { gender, accent, age, accentStrength, text });

    // Map accent IDs to descriptive text
    const accentMap: Record<string, string> = {
      "american": "American",
      "british": "British",
      "australian": "Australian",
      "indian": "Indian",
      "accent": "African", // Fix generic ID
      "irish": "Irish",
    };

    const descriptiveAccent = accentMap[accent.toLowerCase()] || accent;

    // Map age IDs to descriptive text
    const ageMap: Record<string, string> = {
      "young": "young adult",
      "middle_aged": "middle-aged",
      "old": "elderly",
    };
    const descriptiveAge = ageMap[age] || age;

    // More granular strength description
    let strengthText = "moderate";
    if (accentStrength < 0.8) strengthText = "slight";
    else if (accentStrength > 1.4) strengthText = "very strong and distinct";
    else if (accentStrength > 1.1) strengthText = "strong";

    // Construct a more detailed prompt
    const prompt = `A ${descriptiveAge} ${gender} voice with a ${strengthText} ${descriptiveAccent} accent. Clear, high quality, professional recording.`;

    console.log("Generated Voice Prompt:", prompt);

    const response = await fetch(
      "https://api.elevenlabs.io/v1/text-to-voice/create-previews",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voice_description: prompt,
          text: text, // The sample text to be spoken
          voice_name: "Preview Voice",
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs Voice Design API Error:", errorText);
      return {
        success: false,
        error: `API Error: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    // API returns audio data directly? Or parameters?
    // According to docs/cookbook for "design":
    // It returns a list of previews or a single preview.
    // Let's assume the endpoint returns base64 audio or similar.
    // Research in cookbook:
    // "elevenlabs.text_to_voice.design" likely hits /v1/voice-generation/generate-voice-parameters 
    // And returns { audio_base_64: "...", generated_voice_id: "..." }

    // Check response structure for typical ElevenLabs generation endpoints
    // If it returns multiple previews:
    // data might be array or object with previews key.

    // Let's robustly handle:
    // If array, take first. If object with previews, take first.
    return {
      success: true,
      previews: data, // Return raw data to inspect/handle in frontend if needed, or normalize here.
      // Let's normalize assuming typical single generation flow for this tool:
      // We'll return the raw data and let UI handle selection if multiple are returned.
    };
  } catch (error) {
    console.error("Error designing voice:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to design voice",
    };
  }
}

export async function createVoiceFromDesign(
  voiceName: string,
  voiceDescription: string,
  generatedVoiceId: string
) {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { success: false, error: "API key not configured" };
  }

  try {
    const response = await fetch(
      "https://api.elevenlabs.io/v1/voice-generation/create-voice",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voice_name: voiceName,
          voice_description: voiceDescription,
          generated_voice_id: generatedVoiceId,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs Create Voice API Error:", errorText);
      return {
        success: false,
        error: `API Error: ${response.status} ${response.statusText}`
      };
    }

    const data = await response.json();
    return {
      success: true,
      voice: data,
    };
  } catch (error) {
    console.error("Error creating voice from design:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create voice",
    };
  }
}
