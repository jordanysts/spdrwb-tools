"use client";

import { useState, useRef } from "react";
import { FileAudio, Loader2, Upload, Copy, Download, Check } from "lucide-react";
import { transcribeAudio } from "../actions";

export function TranscribeTab() {
    const [file, setFile] = useState<File | null>(null);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcription, setTranscription] = useState("");
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            // Check file size (max 25MB standard for many APIs, ElevenLabs allows more but good to be safe)
            if (selectedFile.size > 25 * 1024 * 1024) {
                setError("File too large (max 25MB)");
                return;
            }
            setFile(selectedFile);
            setError("");
            setTranscription("");
        }
    };

    const handleTranscribe = async () => {
        if (!file) {
            setError("Please upload an audio file");
            return;
        }

        setIsTranscribing(true);
        setError("");

        const formData = new FormData();
        formData.append("file", file);

        const result = await transcribeAudio(formData);

        if (result.success && result.text) {
            setTranscription(result.text);
        } else {
            setError(result.error || "Failed to transcribe audio");
        }

        setIsTranscribing(false);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(transcription);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadText = () => {
        const blob = new Blob([transcription], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `transcription-${Date.now()}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Upload */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <label className="text-sm text-gray-600 block mb-4 font-medium">Upload Audio File</label>

                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${file ? "border-orange-500 bg-orange-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                            }`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                            accept="audio/*,video/*"
                        />

                        {file ? (
                            <div className="flex flex-col items-center">
                                <FileAudio className="w-12 h-12 text-orange-600 mb-3" />
                                <p className="font-medium text-gray-900 break-all">{file.name}</p>
                                <p className="text-sm text-gray-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                <audio
                                    controls
                                    src={URL.createObjectURL(file)}
                                    className="mt-4 w-full max-w-[200px] h-8"
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                    }}
                                    className="mt-4 text-xs text-red-500 hover:text-red-700 underline"
                                >
                                    Remove file
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <Upload className="w-10 h-10 text-gray-400 mb-3" />
                                <p className="font-medium text-gray-700">Click to upload audio</p>
                                <p className="text-xs text-gray-500 mt-2">MP3, WAV, M4A, MP4 (max 25MB)</p>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleTranscribe}
                    disabled={isTranscribing || !file}
                    className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    {isTranscribing ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Transcribing...
                        </>
                    ) : (
                        <>
                            <FileAudio className="w-4 h-4" />
                            Start Transcription
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
                            <FileAudio className="w-4 h-4 text-gray-600" />
                            <span className="text-sm text-gray-700">Transcription Result</span>
                        </div>

                        {transcription && (
                            <div className="flex gap-2">
                                <button
                                    onClick={copyToClipboard}
                                    className="p-1.5 bg-gray-50 hover:bg-gray-200 rounded transition-colors text-xs flex items-center gap-1"
                                    title="Copy to clipboard"
                                >
                                    {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-700" />}
                                    <span className={copied ? "text-green-600" : "text-gray-700"}>{copied ? "Copied" : "Copy"}</span>
                                </button>
                                <button
                                    onClick={downloadText}
                                    className="p-1.5 bg-gray-50 hover:bg-gray-200 rounded transition-colors text-xs flex items-center gap-1"
                                    title="Download"
                                >
                                    <Download className="w-3 h-3 text-gray-700" />
                                    <span className="text-gray-700">Download</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 bg-gray-50 p-0 relative">
                        {isTranscribing ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/80 z-10">
                                <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
                                <p className="text-gray-600 text-sm">Transcribing audio...</p>
                            </div>
                        ) : null}

                        <textarea
                            value={transcription}
                            readOnly
                            placeholder="Transcription will appear here..."
                            className="w-full h-full min-h-[400px] p-6 bg-transparent border-none resize-none focus:outline-none text-gray-800 leading-relaxed"
                        />

                        {!transcription && !isTranscribing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-40">
                                <FileAudio className="w-16 h-16 text-gray-400 mb-4" />
                                <p className="text-gray-500">Upload audio to see text</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
