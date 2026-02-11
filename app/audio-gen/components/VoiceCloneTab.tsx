"use client";

import { useState, useRef } from "react";
import { UserPlus, Loader2, Upload, Trash2, Mic } from "lucide-react";
import { addVoice, deleteVoice, getVoices } from "../actions";

interface Voice {
    voice_id: string;
    name: string;
    category?: string;
    description?: string;
}

export function VoiceCloneTab() {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isCloning, setIsCloning] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles((prev) => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleClone = async () => {
        if (!name.trim()) {
            setError("Please enter a voice name");
            return;
        }

        if (files.length === 0) {
            setError("Please upload at least one audio sample");
            return;
        }

        setIsCloning(true);
        setError("");
        setSuccess("");

        const formData = new FormData();
        formData.append("name", name);
        formData.append("description", description);

        files.forEach((file) => {
            formData.append("files", file);
        });

        const result = await addVoice(formData);

        if (result.success) {
            setSuccess("Voice cloned successfully! You can now use it in Text-to-Speech.");
            setName("");
            setDescription("");
            setFiles([]);
        } else {
            setError(result.error || "Failed to clone voice");
        }

        setIsCloning(false);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Create Voice */}
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-gray-900" />
                        Create New Voice
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-600 block mb-1">Voice Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. My Custom Voice"
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-800"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-600 block mb-1">Description (Optional)</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of the voice..."
                                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-800 min-h-[80px] resize-none"
                            />
                        </div>

                        <div>
                            <label className="text-sm text-gray-600 block mb-2">Audio Samples</label>
                            <div
                                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    multiple
                                    accept="audio/*"
                                />
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-600">Click to upload samples</p>
                                <p className="text-xs text-gray-500 mt-1">Upload 1-25 files (min 1 min total)</p>
                            </div>

                            {/* File List */}
                            {files.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {files.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
                                            <span className="text-gray-700 truncate max-w-[200px]">{file.name}</span>
                                            <button
                                                onClick={() => removeFile(index)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleClone}
                            disabled={isCloning || !name.trim() || files.length === 0}
                            className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isCloning ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Cloning Voice...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-4 h-4" />
                                    Clone Voice
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
                                {success}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column - Info & Guidelines */}
            <div className="space-y-6">
                <div className="bg-orange-50 rounded-lg border border-orange-100 p-6">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Mic className="w-4 h-4" />
                        Best Practices
                    </h4>
                    <ul className="space-y-2 text-sm text-gray-900 list-disc pl-4">
                        <li>Use high-quality recordings without background noise</li>
                        <li>Sample length should be at least 1 minute total</li>
                        <li>More varied samples (different emotions/tones) create better models</li>
                        <li>Ensure you have the rights to clone the voice</li>
                    </ul>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                    <h4 className="font-semibold text-gray-800 mb-3">Instant Voice Cloning</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Instant Voice Cloning allows you to clone a voice from a short audio sample.
                        The cloned voice can then be used immediately in the Text-to-Speech tool.
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed mt-3">
                        Once created, navigate back to the Text-to-Speech tab and your new voice
                        will appear in the voice selection dropdown.
                    </p>
                </div>
            </div>
        </div>
    );
}
