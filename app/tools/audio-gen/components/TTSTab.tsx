"use client";

import { useState, useRef } from "react";
import { Mic, Loader2, Download, Play, Pause } from "lucide-react";
import { generateSpeech } from "../actions";

interface Voice {
    voice_id: string;
    name: string;
}

interface TTSTabProps {
    voices: Voice[];
}

export function TTSTab({ voices }: TTSTabProps) {
    const [text, setText] = useState("");
    const [selectedVoice, setSelectedVoice] = useState("21m00Tcm4TlvDq8ikWAM");
    const [isGenerating, setIsGenerating] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    const handleGenerate = async () => {
        if (!text.trim()) {
            setError("Please enter some text");
            return;
        }

        setIsGenerating(true);
        setError("");
        setAudioUrl(null);

        const result = await generateSpeech(text, selectedVoice);

        if (result.success && result.audio) {
            const audioBlob = `data:${result.mimeType};base64,${result.audio}`;
            setAudioUrl(audioBlob);
        } else {
            setError(result.error || "Failed to generate audio");
        }

        setIsGenerating(false);
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

    const downloadAudio = () => {
        if (!audioUrl) return;
        const link = document.createElement("a");
        link.href = audioUrl;
        link.download = `speech-${Date.now()}.mp3`;
        link.click();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Controls */}
            <div className="space-y-6">
                {/* Voice Selection */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Mic className="w-4 h-4 text-orange-500" />
                        <span className="font-medium text-gray-800 text-sm">Voice Selection</span>
                    </div>
                    <select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500 transition-colors"
                    >
                        {voices.map((voice) => (
                            <option key={voice.voice_id} value={voice.voice_id}>
                                {voice.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Text Input */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <label className="text-sm text-gray-600 block mb-2">Text to Convert</label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Enter the text you want to convert to speech..."
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 min-h-[200px] resize-none"
                        maxLength={5000}
                    />
                    <div className="text-xs text-gray-500 mt-2 text-right">
                        {text.length} / 5000 characters
                    </div>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !text.trim()}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating Speech...
                        </>
                    ) : (
                        <>
                            <Mic className="w-4 h-4" />
                            Generate Speech
                        </>
                    )}
                </button>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Right Column - Output */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm min-h-[400px] flex flex-col">
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Mic className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-700">Generated Audio</span>
                        </div>
                        {audioUrl && (
                            <button
                                onClick={downloadAudio}
                                className="p-1.5 bg-gray-50 hover:bg-gray-200 rounded transition-colors text-xs flex items-center gap-1"
                                title="Download"
                            >
                                <Download className="w-3 h-3 text-gray-700" />
                                <span className="text-gray-700">Download</span>
                            </button>
                        )}
                    </div>

                    <div className="flex-1 bg-gray-100 flex items-center justify-center p-8">
                        {isGenerating ? (
                            <div className="text-center">
                                <Loader2 className="w-12 h-12 mx-auto text-orange-500 animate-spin mb-4" />
                                <p className="text-gray-600 text-sm">Generating audio...</p>
                            </div>
                        ) : audioUrl ? (
                            <div className="w-full max-w-md space-y-4">
                                <audio
                                    ref={audioRef}
                                    src={audioUrl}
                                    onEnded={() => setIsPlaying(false)}
                                    className="hidden"
                                />
                                <div className="bg-white rounded-lg p-6 shadow-md">
                                    <div className="flex items-center justify-center mb-4">
                                        <button
                                            onClick={togglePlayPause}
                                            className="w-16 h-16 bg-orange-600 hover:bg-orange-500 rounded-full flex items-center justify-center transition-colors"
                                        >
                                            {isPlaying ? (
                                                <Pause className="w-8 h-8 text-white" />
                                            ) : (
                                                <Play className="w-8 h-8 text-white ml-1" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-center text-sm text-gray-600">
                                        Click to {isPlaying ? "pause" : "play"} audio
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center opacity-30">
                                <Mic className="w-24 h-24 mx-auto text-gray-400 mb-6" />
                                <p className="text-gray-600 text-lg">Ready to Generate</p>
                                <p className="text-gray-400 text-sm mt-2">Your audio will appear here</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
