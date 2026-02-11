"use client";

import { useState, useRef } from "react";
import { Palette, Loader2, Play, Pause, Save, Check } from "lucide-react";
import { generateVoiceDesign, createVoiceFromDesign } from "../actions";

interface GeneratedVoice {
    audio_base_64: string;
    generated_voice_id: string;
}

export function VoiceDesignTab() {
    // Design Parameters
    const [gender, setGender] = useState("female");
    const [age, setAge] = useState("middle_aged");
    const [accent, setAccent] = useState("american");
    const [accentStrength, setAccentStrength] = useState(1.0);
    const [text, setText] = useState("First we thought the PC was a calculator. Then we found out how to turn numbers into letters and we thought it was a typewriter.");

    // State
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [generatedVoice, setGeneratedVoice] = useState<GeneratedVoice | null>(null);

    // Playback
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Saving
    const [saveName, setSaveName] = useState("");
    const [saveDescription, setSaveDescription] = useState("");

    const handleGenerate = async () => {
        if (!text.trim()) {
            setError("Please enter sample text");
            return;
        }

        setIsGenerating(true);
        setError("");
        setSuccess("");
        setGeneratedVoice(null);

        // According to recent API docs, this might return an array of choices or a single structure
        const result = await generateVoiceDesign(gender, accent, age, accentStrength, text);

        if (result.success && result.previews) {
            // Handle API response variations
            // Sometimes it returns { audio_base_64: ..., ... } directly
            // Sometimes it returns valid audio data in a `previews` array
            // We'll try to detect valid data

            let preview: GeneratedVoice | null = null;

            if (result.previews && Array.isArray(result.previews.previews)) {
                // Structure is { previews: [...] }
                preview = result.previews.previews[0];
            } else if (Array.isArray(result.previews) && result.previews.length > 0) {
                // Structure is [...]
                preview = result.previews[0];
            } else if (result.previews && result.previews.audio_base_64) {
                // Structure is { audio_base_64: ... }
                preview = result.previews;
            }

            if (preview) {
                setGeneratedVoice(preview);
            } else {
                setError("Received invalid data from API. Try different parameters.");
            }
        } else {
            setError(result.error || "Failed to design voice");
        }

        setIsGenerating(false);
    };

    const handleSave = async () => {
        if (!generatedVoice || !saveName.trim()) {
            setError("Please generate a voice and provide a name");
            return;
        }

        setIsSaving(true);
        setError("");
        setSuccess("");

        const result = await createVoiceFromDesign(
            saveName,
            saveDescription || `Generated ${age} ${gender} voice with ${accent} accent`,
            generatedVoice.generated_voice_id
        );

        if (result.success) {
            setSuccess("Voice saved to library successfully!");
            setSaveName("");
            setSaveDescription("");
        } else {
            setError(result.error || "Failed to save voice");
        }

        setIsSaving(false);
    };

    const togglePlayPause = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const accents = [
        { id: "american", label: "American" },
        { id: "british", label: "British" },
        { id: "australian", label: "Australian" },
        { id: "indian", label: "Indian" },
        { id: "accent", label: "African" }, // 'accent' is generic African in some contexts, or specific codes
        { id: "irish", label: "Irish" },
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Design Controls */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Palette className="w-5 h-5 text-gray-900" />
                        Voice Parameters
                    </h3>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-gray-600 block mb-1">Gender</label>
                                <select
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="female">Female</option>
                                    <option value="male">Male</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-gray-600 block mb-1">Age</label>
                                <select
                                    value={age}
                                    onChange={(e) => setAge(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="young">Young</option>
                                    <option value="middle_aged">Middle Aged</option>
                                    <option value="old">Old</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-gray-600 block mb-1">Accent</label>
                            <select
                                value={accent}
                                onChange={(e) => setAccent(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                                {accents.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm text-gray-600 block mb-1">
                                Accent Strength ({accentStrength})
                            </label>
                            <input
                                type="range"
                                min="0.3" max="2.0" step="0.1"
                                value={accentStrength}
                                onChange={(e) => setAccentStrength(parseFloat(e.target.value))}
                                className="w-full accent-gray-900"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-600 block mb-1">Sample Text</label>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                placeholder="Text for the voice to read..."
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px] resize-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !text.trim()}
                        className="w-full mt-4 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Designing Voice...
                            </>
                        ) : (
                            <>
                                <Palette className="w-4 h-4" />
                                Generate Preview
                            </>
                        )}
                    </button>

                    {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
                </div>
            </div>

            {/* Right Column - Preview & Save */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm min-h-[400px] flex flex-col">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Preview & Save</h3>

                    {generatedVoice ? (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                            <div className="relative w-32 h-32">
                                <div className={`absolute inset-0 bg-orange-100 rounded-full ${isPlaying ? 'animate-ping opacity-75' : 'hidden'}`}></div>
                                <button
                                    onClick={togglePlayPause}
                                    className="relative z-10 w-32 h-32 bg-gray-900 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-gray-800 transition-colors"
                                >
                                    {isPlaying ? <Pause className="w-12 h-12" /> : <Play className="w-12 h-12 ml-2" />}
                                </button>
                            </div>

                            <audio
                                ref={audioRef}
                                src={`data:audio/mpeg;base64,${generatedVoice.audio_base_64}`}
                                onEnded={() => setIsPlaying(false)}
                                className="hidden"
                            />

                            <div className="w-full border-t border-gray-200 pt-6">
                                <h4 className="text-sm font-medium text-gray-900 mb-3 block">Save to Library</h4>
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={saveName}
                                        onChange={(e) => setSaveName(e.target.value)}
                                        placeholder="Voice Name (e.g. Wise Old Guy)"
                                        className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm"
                                    />
                                    <input
                                        type="text"
                                        value={saveDescription}
                                        onChange={(e) => setSaveDescription(e.target.value)}
                                        placeholder="Description"
                                        className="w-full bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm"
                                    />
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || !saveName.trim()}
                                        className="w-full py-2 bg-gray-900 hover:bg-gray-800 text-white rounded font-medium text-sm flex items-center justify-center gap-2"
                                    >
                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                        Save Voice
                                    </button>

                                    {success && (
                                        <div className="flex items-center gap-2 text-green-600 text-sm justify-center bg-green-50 py-2 rounded">
                                            <Check className="w-4 h-4" />
                                            {success}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <Palette className="w-16 h-16 mb-4 opacity-50" />
                            <p>Design a voice to see preview</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
