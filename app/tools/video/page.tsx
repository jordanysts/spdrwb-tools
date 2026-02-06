'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Video, Loader2, Download, Play, Image as ImageIcon, Sparkles } from 'lucide-react';

type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'THROTTLED';

interface RunwayTask {
  id: string;
  status: TaskStatus;
  progress?: number;
  output?: string[];
  failure?: string;
  failureCode?: string;
}

export default function VideoGeneratorPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  
  // Generation settings
  const [model, setModel] = useState('veo3');
  const [duration, setDuration] = useState('5');
  const [ratio, setRatio] = useState('16:9');
  
  // Veo specific settings
  const [quality, setQuality] = useState<'fast' | 'quality'>('quality');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
      setVideoUrl(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
      setVideoUrl(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Convert image to base64 data URI
  const imageToDataUri = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Poll for task status (Runway)
  const pollRunwayStatus = async (taskId: string) => {
    try {
      const response = await fetch('/api/tools/runway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', taskId }),
      });

      const data: RunwayTask = await response.json();
      
      if (data.status === 'SUCCEEDED' && data.output && data.output.length > 0) {
        setVideoUrl(data.output[0]);
        setTaskStatus('Complete!');
        setProgress(100);
        setIsGenerating(false);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else if (data.status === 'FAILED' || data.status === 'THROTTLED') {
        setError(data.failure || 'Video generation failed');
        setIsGenerating(false);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else {
        setTaskStatus(data.status === 'PENDING' ? 'Queued...' : 'Generating...');
        if (data.progress) {
          setProgress(Math.round(data.progress * 100));
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  // Poll for Veo status
  const pollVeoStatus = async (operationName: string) => {
    try {
      const response = await fetch('/api/tools/veo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', operationName }),
      });

      const data = await response.json();
      
      if (data.done && data.videoUrl) {
        setVideoUrl(data.videoUrl);
        setTaskStatus('Complete!');
        setProgress(100);
        setIsGenerating(false);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else if (data.error) {
        setError(data.error);
        setIsGenerating(false);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else {
        setTaskStatus('Generating video...');
        // Veo doesn't provide progress, so we estimate
        setProgress(prev => Math.min(prev + 5, 90));
      }
    } catch (err) {
      console.error('Veo polling error:', err);
    }
  };

  const generateVideo = async () => {
    // Veo models only need prompt (text-to-video)
    const isVeoModel = model === 'veo3' || model === 'veo2';
    
    if (!isVeoModel && !imageFile && !prompt.trim()) {
      setError('Please upload an image or enter a prompt');
      return;
    }
    
    if (isVeoModel && !prompt.trim()) {
      setError('Please enter a prompt for Veo video generation');
      return;
    }

    setIsGenerating(true);
    setError('');
    setVideoUrl(null);
    setTaskStatus('Starting...');
    setProgress(0);

    try {
      if (isVeoModel) {
        // Veo generation
        const response = await fetch('/api/tools/veo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate',
            prompt: prompt.trim(),
            model: model === 'veo3' ? 'veo-3.1-generate-preview' : 'veo-2.0-generate-001',
            aspectRatio: ratio,
            resolution,
          }),
        });

        const data = await response.json();

        if (data.error) {
          setError(data.error);
          setIsGenerating(false);
          return;
        }

        if (data.operationName) {
          setTaskStatus('Video generation started...');
          // Start polling for status
          pollingRef.current = setInterval(() => {
            pollVeoStatus(data.operationName);
          }, 5000); // Poll every 5 seconds for Veo
        } else {
          setError('Failed to start video generation');
          setIsGenerating(false);
        }
      } else {
        // Runway generation
        let promptImage: string | undefined;
        
        if (imageFile) {
          promptImage = await imageToDataUri(imageFile);
        }

        const response = await fetch('/api/tools/runway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate',
            promptImage,
            promptText: prompt.trim() || undefined,
            model,
            duration,
            ratio,
          }),
        });

        const data = await response.json();

        if (data.error) {
          setError(data.error);
          setIsGenerating(false);
          return;
        }

        if (data.id) {
          setTaskStatus('Generation started...');
          // Start polling for status
          pollingRef.current = setInterval(() => {
            pollRunwayStatus(data.id);
          }, 3000);
        } else {
          setError('Failed to start video generation');
          setIsGenerating(false);
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate video');
      setIsGenerating(false);
    }
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const downloadVideo = () => {
    if (!videoUrl) return;
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = 'runway-video.mp4';
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/tools" className="p-2 hover:bg-white rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-orange-600">Video Generator</h1>
        </div>
        <p className="text-gray-600 text-sm mb-6 ml-12">Generate AI videos with Google Veo 3 or Runway</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* Image Upload */}
            <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">Source Image</span>
              </div>
              <label
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="block p-6 min-h-[200px] flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-zinc-50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {imagePreview ? (
                  <div className="w-full">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-[250px] mx-auto rounded-lg object-contain"
                    />
                    <p className="text-gray-500 text-xs text-center mt-2">Click to change image</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-10 h-10 mx-auto text-gray-600 mb-3" />
                    <p className="text-zinc-700 text-sm mb-1">Drop Image Here</p>
                    <p className="text-gray-500 text-xs">or click to upload</p>
                  </div>
                )}
              </label>
            </div>

            {/* Prompt */}
            <div className="bg-gray-100 rounded-lg border border-gray-200 p-4">
              <label className="text-sm text-gray-600 block mb-2">Motion Prompt (optional)</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the motion you want... e.g., 'Camera slowly zooms in, subject smiles'"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-zinc-500 focus:outline-none focus:border-orange-500 min-h-[80px] resize-none"
              />
            </div>

            {/* Settings */}
            <div className="bg-gray-100 rounded-lg border border-gray-200 p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-orange-600" />
                <span className="font-medium text-gray-800 text-sm">Generation Settings</span>
              </div>

              {/* Model */}
              <div>
                <label className="text-sm text-gray-600 block mb-2">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                >
                  <optgroup label="Google (Recommended)">
                    <option value="veo3">Veo 3.1 - Best Quality</option>
                    <option value="veo2">Veo 2 - Fast & Good</option>
                  </optgroup>
                  <optgroup label="Runway">
                    <option value="gen3a_turbo">Gen-3 Alpha Turbo (Fast)</option>
                    <option value="gen4_turbo">Gen-4 Turbo (Fast)</option>
                    <option value="gen4">Gen-4 (Quality)</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {model === 'veo3' ? 'Google Veo 3.1 - highest quality video generation' :
                   model === 'veo2' ? 'Google Veo 2 - fast video generation' :
                   'Runway models - image-to-video focused'}
                </p>
              </div>

              {/* Resolution (Veo only) */}
              {(model === 'veo3' || model === 'veo2') && (
                <div>
                  <label className="text-sm text-gray-600 block mb-2">Resolution</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as '720p' | '1080p' | '4k')}
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                  >
                    <option value="720p">720p (HD)</option>
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="4k">4K (Ultra HD)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Higher resolution takes longer to generate</p>
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="text-sm text-gray-600 block mb-2">Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                >
                  <option value="5">5 seconds</option>
                  <option value="10">10 seconds</option>
                </select>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="text-sm text-gray-600 block mb-2">Aspect Ratio</label>
                <select
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                >
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Portrait)</option>
                  <option value="1280:768">1280:768 (Wide)</option>
                  <option value="768:1280">768:1280 (Tall)</option>
                </select>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 rounded bg-red-900/30 border border-red-700 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={generateVideo}
              disabled={(!imageFile && !prompt.trim()) || isGenerating}
              className="w-full py-3 bg-orange-600 hover:bg-orange-500 disabled:bg-white disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {taskStatus}
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  Generate Video
                </>
              )}
            </button>
          </div>

          {/* Right Column - Output */}
          <div className="space-y-6">
            <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden min-h-[400px]">
              <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Output</span>
                </div>
                {videoUrl && (
                  <button
                    onClick={downloadVideo}
                    className="p-1.5 bg-gray-50 hover:bg-zinc-600 rounded transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4 text-gray-700" />
                  </button>
                )}
              </div>
              <div className="p-6 flex flex-col items-center justify-center min-h-[350px] bg-white">
                {isGenerating ? (
                  <div className="text-center w-full max-w-xs">
                    <img src="/frog-rolling.gif" alt="Generating..." className="w-16 h-16 mx-auto mb-4" />
                    <p className="text-zinc-700 font-medium mb-2">{taskStatus}</p>
                    <div className="w-full bg-zinc-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-orange-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-gray-500 text-xs">{progress}%</p>
                    <p className="text-gray-600 text-xs mt-4">
                      Video generation typically takes 1-3 minutes
                    </p>
                  </div>
                ) : videoUrl ? (
                  <div className="w-full text-center">
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      loop
                      className="max-h-[300px] mx-auto rounded-lg"
                    />
                    <button
                      onClick={downloadVideo}
                      className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg font-medium transition-colors inline-flex items-center gap-2 text-gray-900"
                    >
                      <Download className="w-4 h-4" />
                      Download MP4
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Play className="w-12 h-12 mx-auto text-gray-700 mb-3" />
                    <p className="text-gray-500 text-sm">Generated video will appear here</p>
                    <p className="text-gray-600 text-xs mt-2">Upload an image to get started</p>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="bg-gray-100/50 rounded-lg border border-zinc-800 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">💡 Tips</h3>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Upload a high-quality image for best results</li>
                <li>• Use descriptive motion prompts (zoom, pan, subject movement)</li>
                <li>• Gen-3 Alpha Turbo is faster, Gen-3 Alpha has better quality</li>
                <li>• Generation typically takes 1-3 minutes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
