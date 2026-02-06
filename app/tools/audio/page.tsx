'use client';

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Download, Loader2, Music, Scissors, RefreshCw, Play, Square, Package, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import JSZip from 'jszip';
import ErrorDisplay, { formatError } from '@/components/tools/ErrorDisplay';

export default function AudioEditorPage() {
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [outputUrl, setOutputUrl] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");
    const [duration, setDuration] = useState(0);
    const [processingStep, setProcessingStep] = useState("");
    const [processingProgress, setProcessingProgress] = useState(0);

    // Playback
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackTime, setPlaybackTime] = useState(0);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

    // Trim settings
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [outputFormat, setOutputFormat] = useState("mp3");

    // Export options
    const [mp3Bitrate, setMp3Bitrate] = useState(128); // Default to standard compression
    const [wavBitDepth, setWavBitDepth] = useState(16);
    const [normalize, setNormalize] = useState(false);
    const [fadeIn, setFadeIn] = useState(0);
    const [fadeOut, setFadeOut] = useState(0);

    // File management
    const [originalFileName, setOriginalFileName] = useState('');
    const [inputFileSize, setInputFileSize] = useState(0);
    const [outputFileSize, setOutputFileSize] = useState(0);

    // Batch processing
    type ProcessingFile = {
        id: string;
        file: File;
        status: 'pending' | 'processing' | 'complete' | 'error';
        outputUrl?: string;
        outputBlob?: Blob;
        error?: string;
        progress: number;
        inputSize: number;  // Original file size
        outputSize?: number; // Processed file size
    };
    const [batchMode, setBatchMode] = useState(false);
    const [batchFiles, setBatchFiles] = useState<ProcessingFile[]>([]);
    const [isProcessingBatch, setIsProcessingBatch] = useState(false);

    // Waveform data
    const [waveformData, setWaveformData] = useState<number[]>([]);
    const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

    // Zoom state
    const [zoomLevel, setZoomLevel] = useState(1); // 1 = full view, 2 = 2x zoom, etc.
    const [viewStart, setViewStart] = useState(0); // Start time of visible window (in seconds)

    const previewAudioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const waveformRef = useRef<HTMLDivElement>(null);
    const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // If multiple files, use batch upload logic
        if (files.length > 1) {
            handleBatchUpload(e);
        } else {
            // Single file - process normally
            processFile(files[0]);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length === 0) return;

        if (files.length > 1) {
            const newBatchFiles: ProcessingFile[] = files
                .filter(f => f.type.startsWith("audio/"))
                .map(file => ({
                    id: Math.random().toString(36).substring(7),
                    file,
                    status: 'pending' as const,
                    progress: 0,
                    inputSize: file.size,
                }));

            setBatchFiles(prev => [...prev, ...newBatchFiles]);
            setBatchMode(true);
        } else {
            const file = files[0];
            if (file) {
                setBatchMode(false);
                processFile(file);
            }
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    const processFile = async (file: File) => {
        if (!file.type.startsWith("audio/")) {
            setError("Please upload an audio file");
            return;
        }

        setAudioFile(file);
        setOutputUrl(null);
        setError("");
        stopPreview();

        // Store original filename and size
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        setOriginalFileName(fileName);
        setInputFileSize(file.size);
        setOutputFileSize(0);

        const url = URL.createObjectURL(file);
        setAudioUrl(url);

        await generateWaveform(file);
    };

    const handleBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newBatchFiles: ProcessingFile[] = files
            .filter(f => f.type.startsWith("audio/"))
            .map(file => ({
                id: Math.random().toString(36).substring(7),
                file,
                status: 'pending' as const,
                progress: 0,
                inputSize: file.size, // Store original size
            }));

        setBatchFiles(prev => [...prev, ...newBatchFiles]);

        // Auto-detect mode: 1 file = single mode, 2+ files = batch mode
        if (files.length === 1) {
            setBatchMode(false);
            // Process as single file
            processFile(files[0]);
        } else {
            setBatchMode(true);
        }
    };

    const generateWaveform = async (file: File) => {
        try {
            const audioContext = new AudioContext();
            const arrayBuffer = await file.arrayBuffer();
            const buffer = await audioContext.decodeAudioData(arrayBuffer);

            setAudioBuffer(buffer);

            const rawData = buffer.getChannelData(0);
            const samples = 150;
            const blockSize = Math.floor(rawData.length / samples);
            const filteredData: number[] = [];

            for (let i = 0; i < samples; i++) {
                let blockStart = blockSize * i;
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    sum += Math.abs(rawData[blockStart + j]);
                }
                filteredData.push(sum / blockSize);
            }

            const maxVal = Math.max(...filteredData);
            const normalizedData = filteredData.map(n => n / maxVal);

            setWaveformData(normalizedData);
            setDuration(buffer.duration);
            setEndTime(buffer.duration);
            setStartTime(0);

            audioContext.close();
        } catch (err) {
            console.error("Waveform generation error:", err);
            setError("Failed to load audio file. Please try a different file.");
        }
    };

    // Preview playback
    const playPreview = async () => {
        if (!previewAudioRef.current || !audioUrl) {
            console.log('No audio ref or URL');
            return;
        }

        const audio = previewAudioRef.current;
        
        try {
            // Make sure audio is loaded
            if (audio.readyState < 2) {
                // Wait for audio to be ready
                await new Promise<void>((resolve, reject) => {
                    const onCanPlay = () => {
                        audio.removeEventListener('canplaythrough', onCanPlay);
                        audio.removeEventListener('error', onError);
                        resolve();
                    };
                    const onError = (e: Event) => {
                        audio.removeEventListener('canplaythrough', onCanPlay);
                        audio.removeEventListener('error', onError);
                        reject(new Error('Failed to load audio'));
                    };
                    audio.addEventListener('canplaythrough', onCanPlay);
                    audio.addEventListener('error', onError);
                    audio.load();
                });
            }
            
            audio.playbackRate = playbackSpeed;
            audio.currentTime = startTime;
            
            // Play returns a promise
            await audio.play();
            
            setIsPlaying(true);
            setPlaybackTime(startTime);

            playbackIntervalRef.current = setInterval(() => {
                if (audio.currentTime >= endTime) {
                    stopPreview();
                } else {
                    setPlaybackTime(audio.currentTime);
                }
            }, 50);
        } catch (err) {
            console.error('Playback error:', err);
            setError('Failed to play audio preview. Please try again.');
        }
    };

    const stopPreview = () => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
        }
        if (playbackIntervalRef.current) {
            clearInterval(playbackIntervalRef.current);
            playbackIntervalRef.current = null;
        }
        setIsPlaying(false);
        setPlaybackTime(0);
    };

    const togglePreview = () => {
        if (isPlaying) {
            stopPreview();
        } else {
            playPreview();
        }
    };

    useEffect(() => {
        return () => {
            if (playbackIntervalRef.current) {
                clearInterval(playbackIntervalRef.current);
            }
        };
    }, []);

    const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!waveformRef.current || duration === 0 || isDragging) return;

        const rect = waveformRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        const time = percent * duration;

        const startDist = Math.abs(time - startTime);
        const endDist = Math.abs(time - endTime);

        // If clicking near handles (within 1 second), adjust trim points
        if (startDist < 1 || endDist < 1) {
            if (startDist < endDist) {
                if (time < endTime) setStartTime(time);
            } else {
                if (time > startTime) setEndTime(time);
            }
        } else {
            // Otherwise, set playback position (draggable playhead)
            if (previewAudioRef.current) {
                previewAudioRef.current.currentTime = time;
                setPlaybackTime(time);
            }
        }
    };

    const handleWaveformMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle: 'start' | 'end') => {
        e.stopPropagation();
        setIsDragging(handle);
    };

    const handleWaveformMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !waveformRef.current || duration === 0) return;

        const rect = waveformRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = x / rect.width;
        const time = percent * duration;

        if (isDragging === 'start' && time < endTime - 0.1) {
            setStartTime(time);
        } else if (isDragging === 'end' && time > startTime + 0.1) {
            setEndTime(time);
        }
    }, [isDragging, duration, startTime, endTime]);

    const handleWaveformMouseUp = useCallback(() => {
        setIsDragging(null);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleWaveformMouseMove);
            window.addEventListener('mouseup', handleWaveformMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleWaveformMouseMove);
                window.removeEventListener('mouseup', handleWaveformMouseUp);
            };
        }
    }, [isDragging, handleWaveformMouseMove, handleWaveformMouseUp]);

    // Apply audio effects (normalize, fades) - modifies buffer in place
    const applyEffects = (buffer: AudioBuffer): void => {
        const channels = buffer.numberOfChannels;
        const length = buffer.length;
        const sampleRate = buffer.sampleRate;

        for (let channel = 0; channel < channels; channel++) {
            const data = buffer.getChannelData(channel);

            // Apply normalize if enabled
            if (normalize) {
                let maxAmp = 0;
                for (let i = 0; i < length; i++) {
                    maxAmp = Math.max(maxAmp, Math.abs(data[i]));
                }
                if (maxAmp > 0) {
                    const gain = 0.99 / maxAmp; // Normalize to 99% to prevent clipping
                    for (let i = 0; i < length; i++) {
                        data[i] *= gain;
                    }
                }
            }

            // Apply fade in
            if (fadeIn > 0) {
                const fadeInSamples = Math.floor(fadeIn * sampleRate);
                for (let i = 0; i < Math.min(fadeInSamples, length); i++) {
                    data[i] *= i / fadeInSamples;
                }
            }

            // Apply fade out
            if (fadeOut > 0) {
                const fadeOutSamples = Math.floor(fadeOut * sampleRate);
                const fadeStart = Math.max(0, length - fadeOutSamples);
                for (let i = fadeStart; i < length; i++) {
                    data[i] *= (length - i) / fadeOutSamples;
                }
            }
        }
    };

    // Time-stretch audio buffer (change speed/duration)
    const timeStretchBuffer = (sourceBuffer: AudioBuffer, speed: number): AudioBuffer => {
        const audioContext = new AudioContext();
        const channels = sourceBuffer.numberOfChannels;
        const sampleRate = sourceBuffer.sampleRate;

        // Calculate new length based on speed
        const newLength = Math.floor(sourceBuffer.length / speed);

        const stretchedBuffer = audioContext.createBuffer(
            channels,
            newLength,
            sampleRate
        );

        // Resample each channel using linear interpolation
        for (let channel = 0; channel < channels; channel++) {
            const sourceData = sourceBuffer.getChannelData(channel);
            const destData = stretchedBuffer.getChannelData(channel);

            for (let i = 0; i < newLength; i++) {
                const sourceIndex = i * speed;
                const index0 = Math.floor(sourceIndex);
                const index1 = Math.min(index0 + 1, sourceBuffer.length - 1);
                const fraction = sourceIndex - index0;

                // Linear interpolation between samples
                destData[i] = sourceData[index0] * (1 - fraction) +
                    sourceData[index1] * fraction;
            }
        }

        audioContext.close();
        return stretchedBuffer;
    };

    // Process audio
    const processAudio = async () => {
        if (!audioBuffer) {
            setError("No audio loaded. Please upload a file first.");
            return;
        }

        setIsProcessing(true);
        setError("");
        setOutputUrl(null);
        setProcessingProgress(0);
        stopPreview();

        try {
            setProcessingStep("Preparing audio...");
            setProcessingProgress(10);

            const sampleRate = audioBuffer.sampleRate;
            const channels = audioBuffer.numberOfChannels;

            const startSample = Math.floor(startTime * sampleRate);
            const endSample = Math.floor(endTime * sampleRate);
            const trimmedLength = endSample - startSample;

            setProcessingStep("Trimming audio...");
            setProcessingProgress(25);

            const audioContext = new AudioContext();
            let trimmedBuffer = audioContext.createBuffer(
                channels,
                trimmedLength,
                sampleRate
            );

            for (let channel = 0; channel < channels; channel++) {
                const sourceData = audioBuffer.getChannelData(channel);
                const destData = trimmedBuffer.getChannelData(channel);
                for (let i = 0; i < trimmedLength; i++) {
                    destData[i] = sourceData[startSample + i];
                }
            }

            // Apply time-stretching if speed is not 1.0x
            if (playbackSpeed !== 1.0) {
                setProcessingStep(`Adjusting speed (${playbackSpeed}x)...`);
                setProcessingProgress(35);
                trimmedBuffer = timeStretchBuffer(trimmedBuffer, playbackSpeed);
            }

            // Apply effects (normalize, fades) - modifies buffer in place
            setProcessingStep("Applying effects...");
            setProcessingProgress(40);

            applyEffects(trimmedBuffer);

            setProcessingStep(`Converting to ${outputFormat.toUpperCase()}...`);
            setProcessingProgress(60);

            let blob: Blob;

            if (outputFormat === 'mp3') {
                blob = await audioBufferToMp3(trimmedBuffer);
            } else {
                blob = audioBufferToWav(trimmedBuffer);
            }

            setProcessingStep("Finalizing...");
            setProcessingProgress(90);

            const url = URL.createObjectURL(blob);
            setOutputFileSize(blob.size); // Capture output file size

            setProcessingProgress(100);
            setProcessingStep("Complete!");
            setOutputUrl(url);

            audioContext.close();

        } catch (err: unknown) {
            console.error("Processing error:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`Failed to process audio: ${errorMessage}`);
        } finally {
            setIsProcessing(false);
            setProcessingStep("");
            setProcessingProgress(0);
        }
    };

    // Load lamejs via script tag to avoid bundling issues
    const loadLamejs = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if ((window as any).lamejs) {
                resolve();
                return;
            }

            // Try local file first (most reliable), then CDN fallbacks
            const sources = [
                '/lame.min.js', // Local file in public folder
                'https://unpkg.com/lamejs@1.2.1/lame.min.js',
                'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
            ];

            let currentIndex = 0;

            const tryLoadScript = () => {
                if (currentIndex >= sources.length) {
                    reject(new Error('Failed to load lamejs from all sources. Please try refreshing the page.'));
                    return;
                }

                const script = document.createElement('script');
                script.src = sources[currentIndex];
                script.onload = () => {
                    // Verify lamejs actually loaded
                    if ((window as any).lamejs) {
                        console.log(`lamejs loaded successfully from: ${sources[currentIndex]}`);
                        resolve();
                    } else {
                        // Script loaded but lamejs not found, try next source
                        console.warn(`Script loaded from ${sources[currentIndex]} but lamejs not found, trying next...`);
                        currentIndex++;
                        tryLoadScript();
                    }
                };
                script.onerror = () => {
                    // Failed to load, try next source
                    console.warn(`Failed to load lamejs from ${sources[currentIndex]}, trying next...`);
                    currentIndex++;
                    tryLoadScript();
                };
                document.head.appendChild(script);
            };

            tryLoadScript();
        });
    };

    // Convert AudioBuffer to MP3 using lamejs
    const audioBufferToMp3 = async (buffer: AudioBuffer): Promise<Blob> => {
        // Load lamejs via CDN
        await loadLamejs();

        // @ts-ignore - lamejs attaches to window
        const lamejs = (window as any).lamejs;
        if (!lamejs) {
            throw new Error('lamejs failed to initialize');
        }

        const channels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const kbps = mp3Bitrate;

        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
        const mp3Data: Uint8Array[] = [];

        const sampleBlockSize = 1152;

        if (channels === 1) {
            // Mono
            const samples = buffer.getChannelData(0);
            const samples16 = floatTo16BitPCM(samples);

            for (let i = 0; i < samples16.length; i += sampleBlockSize) {
                const sampleChunk = samples16.subarray(i, i + sampleBlockSize);
                const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Uint8Array(mp3buf));
                }
            }
        } else {
            // Stereo
            const left = buffer.getChannelData(0);
            const right = buffer.getChannelData(1);
            const left16 = floatTo16BitPCM(left);
            const right16 = floatTo16BitPCM(right);

            for (let i = 0; i < left16.length; i += sampleBlockSize) {
                const leftChunk = left16.subarray(i, i + sampleBlockSize);
                const rightChunk = right16.subarray(i, i + sampleBlockSize);
                const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Uint8Array(mp3buf));
                }
            }
        }

        const end = mp3encoder.flush();
        if (end.length > 0) {
            mp3Data.push(new Uint8Array(end));
        }

        // Cast to satisfy TypeScript
        return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
    };

    const floatTo16BitPCM = (samples: Float32Array): Int16Array => {
        const buffer = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return buffer;
    };

    // Convert AudioBuffer to WAV Blob with selectable bit depth
    const audioBufferToWav = (buffer: AudioBuffer): Blob => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = wavBitDepth; // Use selected bit depth (16 or 24)

        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;

        const dataLength = buffer.length * blockAlign;
        const bufferLength = 44 + dataLength;

        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);

        // WAV header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // Get channel data
        const channels: Float32Array[] = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        // Write samples
        let offset = 44;
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));

                if (bitDepth === 16) {
                    // 16-bit: -32768 to 32767
                    const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    view.setInt16(offset, value, true);
                    offset += 2;
                } else {
                    // 24-bit: -8388608 to 8388607 (stored as 3 bytes)
                    const value = Math.floor(sample < 0 ? sample * 0x800000 : sample * 0x7FFFFF);
                    view.setUint8(offset, value & 0xFF);
                    view.setUint8(offset + 1, (value >> 8) & 0xFF);
                    view.setUint8(offset + 2, (value >> 16) & 0xFF);
                    offset += 3;
                }
            }
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    };

    const writeString = (view: DataView, offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 10);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const downloadOutput = () => {
        if (!outputUrl) return;
        const link = document.createElement("a");
        link.href = outputUrl;
        link.download = `${originalFileName || 'processed-audio'}.${outputFormat}`;
        link.click();
    };

    const processBatch = async () => {
        setIsProcessingBatch(true);

        for (const batchFile of batchFiles) {
            if (batchFile.status !== 'pending') continue;

            // Update status to processing
            setBatchFiles(prev => prev.map(f =>
                f.id === batchFile.id ? { ...f, status: 'processing' as const, progress: 0 } : f
            ));

            try {
                // Generate waveform and get buffer
                const audioContext = new AudioContext();
                const arrayBuffer = await batchFile.file.arrayBuffer();
                const buffer = await audioContext.decodeAudioData(arrayBuffer);

                // Process the entire file with current settings (no trim for batch)
                setBatchFiles(prev => prev.map(f =>
                    f.id === batchFile.id ? { ...f, progress: 30 } : f
                ));

                let processedBuffer = buffer;

                // Apply speed if not 1.0x
                if (playbackSpeed !== 1.0) {
                    processedBuffer = timeStretchBuffer(processedBuffer, playbackSpeed);
                }

                setBatchFiles(prev => prev.map(f =>
                    f.id === batchFile.id ? { ...f, progress: 50 } : f
                ));

                // Apply effects
                applyEffects(processedBuffer);

                setBatchFiles(prev => prev.map(f =>
                    f.id === batchFile.id ? { ...f, progress: 70 } : f
                ));

                // Convert to output format
                let blob: Blob;
                if (outputFormat === 'mp3') {
                    blob = await audioBufferToMp3(processedBuffer);
                } else {
                    blob = audioBufferToWav(processedBuffer);
                }

                const url = URL.createObjectURL(blob);

                // Update to complete
                setBatchFiles(prev => prev.map(f =>
                    f.id === batchFile.id ? {
                        ...f,
                        status: 'complete' as const,
                        progress: 100,
                        outputUrl: url,
                        outputBlob: blob,
                        outputSize: blob.size // Store output size
                    } : f
                ));

                audioContext.close();
            } catch (error: any) {
                // Update to error
                setBatchFiles(prev => prev.map(f =>
                    f.id === batchFile.id ? {
                        ...f,
                        status: 'error' as const,
                        error: error.message || 'Processing failed'
                    } : f
                ));
            }
        }

        setIsProcessingBatch(false);
    };

    const downloadBatchAsZip = async () => {
        const zip = new JSZip();

        for (const file of batchFiles) {
            if (file.status === 'complete' && file.outputBlob) {
                const fileName = file.file.name.replace(/\.[^/.]+$/, '');
                zip.file(`${fileName}.${outputFormat}`, file.outputBlob);
            }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'processed-audio-batch.zip';
        link.click();
    };

    const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
    const endPercent = duration > 0 ? (endTime / duration) * 100 : 100;
    const playbackPercent = duration > 0 ? (playbackTime / duration) * 100 : 0;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
            <audio ref={previewAudioRef} src={audioUrl || undefined} />

            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-2">
                    <Link href="/tools" className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-700" />
                    </Link>
                    <h1 className="text-2xl font-bold text-orange-600">Audio Editor</h1>
                </div>
                <p className="text-gray-600 text-sm mb-6 ml-12">Convert, optimize, trim and edit audio files between formats.</p>



                {batchMode ? (
                    // Batch Mode UI
                    <div className="space-y-6">
                        {/* Batch Upload */}
                        <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                            <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
                                <Upload className="w-4 h-4 text-gray-600" />
                                <span className="text-sm text-gray-700">Upload Multiple Files</span>
                            </div>
                            <label className="block p-6 min-h-[120px] flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-zinc-50 transition-colors">
                                <input
                                    type="file"
                                    accept="audio/*"
                                    multiple
                                    onChange={handleBatchUpload}
                                    className="hidden"
                                />
                                <Upload className="w-8 h-8 mx-auto text-gray-600 mb-3" />
                                <p className="text-zinc-700 text-sm mb-1">Drop audio files or click to browse</p>
                                <p className="text-gray-500 text-xs">Select multiple files</p>
                            </label>
                        </div>

                        {/* Batch Settings */}
                        {batchFiles.length > 0 && (
                            <div className="bg-gray-100 rounded-lg border border-gray-200 p-4 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <RefreshCw className="w-4 h-4 text-orange-600" />
                                    <span className="font-medium text-gray-800 text-sm">Batch Settings (Applied to All)</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm text-gray-600 block mb-2">Format</label>
                                        <select
                                            value={outputFormat}
                                            onChange={(e) => setOutputFormat(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900"
                                        >
                                            <option value="mp3">MP3</option>
                                            <option value="wav">WAV</option>
                                        </select>
                                    </div>
                                    {outputFormat === 'mp3' && (
                                        <div>
                                            <label className="text-sm text-gray-600 block mb-2">Bitrate</label>
                                            <select
                                                value={mp3Bitrate}
                                                onChange={(e) => setMp3Bitrate(Number(e.target.value))}
                                                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900"
                                            >
                                                <option value={64}>64 kbps</option>
                                                <option value={128}>128 kbps</option>
                                                <option value={192}>192 kbps</option>
                                                <option value={320}>320 kbps</option>
                                            </select>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={processBatch}
                                    disabled={isProcessingBatch || batchFiles.every(f => f.status !== 'pending')}
                                    className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-white disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-white"
                                >
                                    {isProcessingBatch ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4" />
                                            Process {batchFiles.filter(f => f.status === 'pending').length} File(s)
                                        </>
                                    )}
                                </button>

                                {batchFiles.some(f => f.status === 'complete') && (
                                    <button
                                        onClick={downloadBatchAsZip}
                                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-white"
                                    >
                                        <Package className="w-4 h-4" />
                                        Download All as ZIP
                                    </button>
                                )}
                            </div>
                        )}

                        {/* File Queue */}
                        {batchFiles.length > 0 && (
                            <div className="bg-gray-100 rounded-lg border border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-medium text-gray-700">File Queue</h3>
                                    <button
                                        onClick={() => {
                                            setBatchFiles([]);
                                            setBatchMode(false);
                                            // Reset file input if needed
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                        className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                                    >
                                        Clear Queue
                                    </button>
                                </div>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {batchFiles.map(file => (
                                        <div key={file.id} className="p-3 bg-white rounded">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-sm text-gray-800 truncate flex-1">{file.file.name}</span>
                                                <span className={`text-xs ml-2 ${file.status === 'complete' ? 'text-green-400' :
                                                    file.status === 'error' ? 'text-red-400' :
                                                        file.status === 'processing' ? 'text-orange-600' :
                                                            'text-gray-500'
                                                    }`}>
                                                    {file.status}
                                                </span>
                                            </div>
                                            {file.status === 'processing' && (
                                                <div className="w-full bg-gray-50 rounded h-1 mt-2">
                                                    <div
                                                        className="bg-orange-500 h-full rounded transition-all"
                                                        style={{ width: `${file.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                            {file.status === 'complete' && file.outputUrl && (
                                                <>
                                                    {/* File Size Display */}
                                                    {file.outputSize && (
                                                        <div className="p-2 bg-gray-100 rounded text-xs space-y-0.5 mt-2">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500">Original:</span>
                                                                <span className="text-gray-700">{formatFileSize(file.inputSize)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500">Processed:</span>
                                                                <span className={file.outputSize < 300000 ? 'text-green-400' : 'text-orange-600'}>
                                                                    {formatFileSize(file.outputSize)}
                                                                </span>
                                                            </div>
                                                            {file.outputSize >= 300000 && (
                                                                <p className="text-orange-600 text-xs mt-1">⚠️ &gt;300KB</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    <a
                                                        href={file.outputUrl}
                                                        download={`${file.file.name.replace(/\.[^/.]+$/, '')}.${outputFormat}`}
                                                        className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-block"
                                                    >
                                                        Download
                                                    </a>
                                                </>
                                            )}
                                            {file.error && (
                                                <p className="text-xs text-red-400 mt-1">{file.error}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    // Single File Mode UI (existing)
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{/* Continue with existing single-file UI */}
                        {/* Left Column - Input */}
                        <div className="space-y-6">
                            {/* File Upload */}
                            <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden">
                                <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
                                    <Music className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm text-gray-700">Input Audio</span>
                                </div>
                                <label
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    className="block p-6 min-h-[120px] flex flex-col items-center justify-center cursor-pointer bg-white hover:bg-zinc-50 transition-colors"
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="audio/*"
                                        multiple
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    {audioFile ? (
                                        <div className="w-full text-center">
                                            <Music className="w-8 h-8 mx-auto text-orange-500 mb-2" />
                                            <p className="text-zinc-800 font-medium text-sm truncate px-4">{audioFile.name}</p>
                                            <p className="text-gray-500 text-xs mt-1">Duration: {formatTime(duration)}</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <Upload className="w-8 h-8 mx-auto text-gray-600 mb-3" />
                                            <p className="text-zinc-700 text-sm mb-1">Drop Audio File Here</p>
                                            <p className="text-gray-500 text-xs">MP3, WAV, AAC, etc.</p>
                                        </div>
                                    )}
                                </label>
                            </div>



                            {/* Export Options */}
                            {audioFile && (
                                <div className="bg-gray-100 rounded-lg border border-gray-200 p-4 space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <RefreshCw className="w-4 h-4 text-orange-600" />
                                        <span className="font-medium text-gray-800 text-sm">Export Settings</span>
                                    </div>

                                    {/* Format Selection */}
                                    <div>
                                        <label className="text-sm text-gray-600 block mb-2">Output Format</label>
                                        <select
                                            value={outputFormat}
                                            onChange={(e) => setOutputFormat(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                                        >
                                            <option value="mp3">MP3 (Compressed)</option>
                                            <option value="wav">WAV (Lossless)</option>
                                        </select>
                                    </div>

                                    {/* MP3 Bitrate */}
                                    {outputFormat === 'mp3' && (
                                        <div>
                                            <label className="text-sm text-gray-600 block mb-2">MP3 Quality (Bitrate)</label>
                                            <select
                                                value={mp3Bitrate}
                                                onChange={(e) => setMp3Bitrate(Number(e.target.value))}
                                                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                                            >
                                                <option value={64}>64 kbps (Low - ~0.5 MB/min)</option>
                                                <option value={128}>128 kbps (Standard - ~1 MB/min)</option>
                                                <option value={192}>192 kbps (High - ~1.4 MB/min)</option>
                                                <option value={256}>256 kbps (Very High - ~1.9 MB/min)</option>
                                                <option value={320}>320 kbps (Best - ~2.4 MB/min)</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* WAV Bit Depth */}
                                    {outputFormat === 'wav' && (
                                        <div>
                                            <label className="text-sm text-gray-600 block mb-2">WAV Bit Depth</label>
                                            <select
                                                value={wavBitDepth}
                                                onChange={(e) => setWavBitDepth(Number(e.target.value))}
                                                className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                                            >
                                                <option value={16}>16-bit (CD Quality)</option>
                                                <option value={24}>24-bit (Studio Quality)</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Normalize Toggle */}
                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                                        <div>
                                            <label className="text-sm text-gray-700">Normalize Audio</label>
                                            <p className="text-xs text-gray-500">Maximize volume without clipping</p>
                                        </div>
                                        <button
                                            onClick={() => setNormalize(!normalize)}
                                            className={`w-11 h-6 rounded-full transition-colors relative ${normalize ? 'bg-orange-500' : 'bg-gray-50'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${normalize ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    {/* Fade Options */}
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                                        <div>
                                            <label className="text-sm text-gray-600 block mb-1">Fade In</label>
                                            <select
                                                value={fadeIn}
                                                onChange={(e) => setFadeIn(Number(e.target.value))}
                                                className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                                            >
                                                <option value={0}>None</option>
                                                <option value={0.5}>0.5s</option>
                                                <option value={1}>1s</option>
                                                <option value={2}>2s</option>
                                                <option value={3}>3s</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-600 block mb-1">Fade Out</label>
                                            <select
                                                value={fadeOut}
                                                onChange={(e) => setFadeOut(Number(e.target.value))}
                                                className="w-full bg-white border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                                            >
                                                <option value={0}>None</option>
                                                <option value={0.5}>0.5s</option>
                                                <option value={1}>1s</option>
                                                <option value={2}>2s</option>
                                                <option value={3}>3s</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Playback Speed */}
                                    <div className="pt-2 border-t border-zinc-800">
                                        <label className="text-sm text-gray-600 block mb-2">Speed / Duration</label>
                                        <select
                                            value={playbackSpeed}
                                            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                                            className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-orange-500"
                                        >
                                            <option value={0.5}>0.5x (Slower / Longer)</option>
                                            <option value={0.75}>0.75x</option>
                                            <option value={1.0}>1.0x (Normal)</option>
                                            <option value={1.25}>1.25x</option>
                                            <option value={1.5}>1.5x</option>
                                            <option value={2.0}>2.0x (Faster / Shorter)</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">Affects both preview and export</p>
                                    </div>
                                </div>
                            )}

                            {/* Error Display */}
                            {error && (
                                <ErrorDisplay 
                                    error={error}
                                    toolName="Audio Editor"
                                    context={{
                                        fileName: audioFile?.name,
                                        fileSize: audioFile?.size,
                                        outputFormat,
                                        mp3Bitrate,
                                        playbackSpeed,
                                    }}
                                    onDismiss={() => setError("")}
                                />
                            )}

                            {/* Process Button */}
                            <button
                                onClick={processAudio}
                                disabled={!audioBuffer || isProcessing}
                                className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-white disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-white"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4" />
                                        Process & Export
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Right Column - Output */}
                        <div className="space-y-6">
                            {/* Waveform Visualization (Moved from Left) */}
                            {audioFile && waveformData.length > 0 && (() => {
                                // Calculate visible window based on zoom
                                const viewDuration = duration / zoomLevel;
                                const viewEnd = Math.min(viewStart + viewDuration, duration);
                                
                                // Calculate what portion of waveform to show
                                const visibleStartPercent = (viewStart / duration) * 100;
                                const visibleEndPercent = (viewEnd / duration) * 100;
                                
                                // Convert absolute times to zoomed view percentages
                                const zoomedStartPercent = Math.max(0, Math.min(100, ((startTime - viewStart) / viewDuration) * 100));
                                const zoomedEndPercent = Math.max(0, Math.min(100, ((endTime - viewStart) / viewDuration) * 100));
                                const zoomedPlaybackPercent = ((playbackTime - viewStart) / viewDuration) * 100;
                                
                                // Filter waveform data to show only visible portion
                                const startIndex = Math.floor((viewStart / duration) * waveformData.length);
                                const endIndex = Math.ceil((viewEnd / duration) * waveformData.length);
                                const visibleWaveformData = waveformData.slice(startIndex, endIndex);
                                
                                // Handle zoomed waveform click
                                const handleZoomedWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
                                    if (!waveformRef.current || duration === 0 || isDragging) return;
                                    
                                    const rect = waveformRef.current.getBoundingClientRect();
                                    const x = e.clientX - rect.left;
                                    const percent = x / rect.width;
                                    const time = viewStart + (percent * viewDuration); // Convert to absolute time
                                    
                                    const startDist = Math.abs(time - startTime);
                                    const endDist = Math.abs(time - endTime);
                                    
                                    if (startDist < (viewDuration * 0.02) || endDist < (viewDuration * 0.02)) {
                                        if (startDist < endDist) {
                                            if (time < endTime) setStartTime(Math.max(0, time));
                                        } else {
                                            if (time > startTime) setEndTime(Math.min(duration, time));
                                        }
                                    } else {
                                        if (previewAudioRef.current) {
                                            previewAudioRef.current.currentTime = time;
                                            setPlaybackTime(time);
                                        }
                                    }
                                };
                                
                                // Handle zoomed mouse move for drag
                                const handleZoomedMouseMove = (e: MouseEvent) => {
                                    if (!isDragging || !waveformRef.current || duration === 0) return;
                                    
                                    const rect = waveformRef.current.getBoundingClientRect();
                                    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
                                    const percent = x / rect.width;
                                    const time = viewStart + (percent * viewDuration);
                                    
                                    if (isDragging === 'start' && time < endTime - 0.05) {
                                        setStartTime(Math.max(0, time));
                                    } else if (isDragging === 'end' && time > startTime + 0.05) {
                                        setEndTime(Math.min(duration, time));
                                    }
                                };
                                
                                // Zoom functions
                                const zoomIn = () => {
                                    const newZoom = Math.min(zoomLevel * 2, 32); // Max 32x zoom
                                    const currentCenter = viewStart + (viewDuration / 2);
                                    const newDuration = duration / newZoom;
                                    const newStart = Math.max(0, Math.min(currentCenter - newDuration / 2, duration - newDuration));
                                    setZoomLevel(newZoom);
                                    setViewStart(newStart);
                                };
                                
                                const zoomOut = () => {
                                    const newZoom = Math.max(zoomLevel / 2, 1); // Min 1x zoom
                                    const currentCenter = viewStart + (viewDuration / 2);
                                    const newDuration = duration / newZoom;
                                    const newStart = Math.max(0, Math.min(currentCenter - newDuration / 2, duration - newDuration));
                                    setZoomLevel(newZoom);
                                    setViewStart(Math.max(0, newStart));
                                };
                                
                                const resetZoom = () => {
                                    setZoomLevel(1);
                                    setViewStart(0);
                                };
                                
                                const scrollView = (direction: 'left' | 'right') => {
                                    const scrollAmount = viewDuration * 0.25; // Scroll by 25% of view
                                    if (direction === 'left') {
                                        setViewStart(Math.max(0, viewStart - scrollAmount));
                                    } else {
                                        setViewStart(Math.min(duration - viewDuration, viewStart + scrollAmount));
                                    }
                                };
                                
                                return (
                                <div className="bg-gray-100 rounded-lg border border-gray-200 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Scissors className="w-4 h-4 text-orange-600" />
                                        <span className="font-medium text-gray-800 text-sm">Trim Selection</span>
                                        <span className="text-xs text-gray-500 ml-auto">
                                            {formatTime(endTime - startTime)}
                                        </span>
                                    </div>

                                    {/* Play/Stop Button + Zoom Controls */}
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={togglePreview}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-white ${isPlaying
                                                    ? 'bg-red-600 hover:bg-red-500'
                                                    : 'bg-green-600 hover:bg-green-500'
                                                    }`}
                                            >
                                                {isPlaying ? (
                                                    <>
                                                        <Square className="w-4 h-4" />
                                                        Stop
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="w-4 h-4" />
                                                        Preview
                                                    </>
                                                )}
                                            </button>
                                            <span className="text-xs text-gray-600">
                                                {formatTime(startTime)} → {formatTime(endTime)}
                                            </span>
                                        </div>
                                        
                                        {/* Zoom Controls */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={zoomOut}
                                                disabled={zoomLevel <= 1}
                                                className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                title="Zoom Out"
                                            >
                                                <ZoomOut className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <span className="text-xs text-gray-600 min-w-[40px] text-center font-medium">
                                                {zoomLevel}x
                                            </span>
                                            <button
                                                onClick={zoomIn}
                                                disabled={zoomLevel >= 32}
                                                className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                title="Zoom In"
                                            >
                                                <ZoomIn className="w-4 h-4 text-gray-600" />
                                            </button>
                                            {zoomLevel > 1 && (
                                                <button
                                                    onClick={resetZoom}
                                                    className="p-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors ml-1"
                                                    title="Reset Zoom"
                                                >
                                                    <Maximize2 className="w-4 h-4 text-gray-600" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Zoom Navigation (when zoomed) */}
                                    {zoomLevel > 1 && (
                                        <div className="flex items-center gap-2 mb-2">
                                            <button
                                                onClick={() => scrollView('left')}
                                                disabled={viewStart <= 0}
                                                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                            >
                                                ← Scroll
                                            </button>
                                            <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden">
                                                <div 
                                                    className="h-full bg-orange-400 rounded transition-all"
                                                    style={{ 
                                                        marginLeft: `${visibleStartPercent}%`,
                                                        width: `${visibleEndPercent - visibleStartPercent}%`
                                                    }}
                                                />
                                            </div>
                                            <button
                                                onClick={() => scrollView('right')}
                                                disabled={viewEnd >= duration}
                                                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                            >
                                                Scroll →
                                            </button>
                                        </div>
                                    )}

                                    {/* Waveform */}
                                    <div
                                        ref={waveformRef}
                                        className="relative h-24 bg-white rounded cursor-pointer select-none"
                                        onClick={handleZoomedWaveformClick}
                                    >
                                        <div className="absolute inset-0 flex items-center justify-around px-1">
                                            {visibleWaveformData.map((amplitude, i) => {
                                                const barTimePercent = ((startIndex + i) / waveformData.length) * duration;
                                                const isSelected = barTimePercent >= startTime && barTimePercent <= endTime;
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`w-1 rounded-full transition-colors ${isSelected ? 'bg-orange-500' : 'bg-zinc-400'}`}
                                                        style={{ height: `${Math.max(4, amplitude * 80)}%` }}
                                                    />
                                                );
                                            })}
                                        </div>

                                        {/* Selection overlay - only show if selection is visible */}
                                        {zoomedEndPercent > 0 && zoomedStartPercent < 100 && (
                                            <div
                                                className="absolute top-0 bottom-0 bg-orange-500/10 border-l-2 border-r-2 border-orange-500"
                                                style={{
                                                    left: `${Math.max(0, zoomedStartPercent)}%`,
                                                    width: `${Math.min(100, zoomedEndPercent) - Math.max(0, zoomedStartPercent)}%`
                                                }}
                                            />
                                        )}

                                        {/* Playback head */}
                                        {isPlaying && zoomedPlaybackPercent >= 0 && zoomedPlaybackPercent <= 100 && (
                                            <div
                                                className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
                                                style={{ left: `${zoomedPlaybackPercent}%` }}
                                            />
                                        )}

                                        {/* Static playhead cursor (when not playing) */}
                                        {!isPlaying && playbackTime > 0 && zoomedPlaybackPercent >= 0 && zoomedPlaybackPercent <= 100 && (
                                            <div
                                                className="absolute top-0 bottom-0 w-0.5 bg-blue-400 opacity-60 z-10"
                                                style={{ left: `${zoomedPlaybackPercent}%` }}
                                            />
                                        )}

                                        {/* Start handle - only show if visible */}
                                        {zoomedStartPercent >= -5 && zoomedStartPercent <= 105 && (
                                            <div
                                                className="absolute top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group z-20"
                                                style={{ left: `calc(${Math.max(0, Math.min(100, zoomedStartPercent))}% - 8px)` }}
                                                onMouseDown={(e) => handleWaveformMouseDown(e, 'start')}
                                            >
                                                <div className="w-1.5 h-full bg-green-500 group-hover:w-2 transition-all rounded-full" />
                                            </div>
                                        )}

                                        {/* End handle - only show if visible */}
                                        {zoomedEndPercent >= -5 && zoomedEndPercent <= 105 && (
                                            <div
                                                className="absolute top-0 bottom-0 w-4 cursor-ew-resize flex items-center justify-center group z-20"
                                                style={{ left: `calc(${Math.max(0, Math.min(100, zoomedEndPercent))}% - 8px)` }}
                                                onMouseDown={(e) => handleWaveformMouseDown(e, 'end')}
                                            >
                                                <div className="w-1.5 h-full bg-red-500 group-hover:w-2 transition-all rounded-full" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Precision Time Inputs */}
                                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                                        <div className="flex-1">
                                            <label className="text-xs text-gray-500 block mb-1">Start Time</label>
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={endTime - 0.01}
                                                    step={0.01}
                                                    value={parseFloat(startTime.toFixed(2))}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val >= 0 && val < endTime) {
                                                            setStartTime(val);
                                                        }
                                                    }}
                                                    className="w-20 px-2 py-1 text-sm bg-white border border-gray-300 rounded text-green-600 font-mono focus:outline-none focus:border-green-500"
                                                />
                                                <span className="text-xs text-gray-400">sec</span>
                                            </div>
                                        </div>
                                        
                                        <div className="text-center">
                                            <label className="text-xs text-gray-500 block mb-1">Duration</label>
                                            <span className="text-sm font-medium text-orange-600">{formatTime(endTime - startTime)}</span>
                                        </div>
                                        
                                        <div className="flex-1 text-right">
                                            <label className="text-xs text-gray-500 block mb-1">End Time</label>
                                            <div className="flex items-center gap-1 justify-end">
                                                <input
                                                    type="number"
                                                    min={startTime + 0.01}
                                                    max={duration}
                                                    step={0.01}
                                                    value={parseFloat(endTime.toFixed(2))}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val > startTime && val <= duration) {
                                                            setEndTime(val);
                                                        }
                                                    }}
                                                    className="w-20 px-2 py-1 text-sm bg-white border border-gray-300 rounded text-red-600 font-mono focus:outline-none focus:border-red-500"
                                                />
                                                <span className="text-xs text-gray-400">sec</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Zoom hint */}
                                    <div className="text-center text-xs text-gray-400 mt-2">
                                        {zoomLevel > 1 ? `Viewing ${formatTime(viewStart)} - ${formatTime(viewEnd)} (${zoomLevel}x zoom)` : 'Use zoom controls for precise trimming'}
                                    </div>
                                </div>
                                );
                            })()}
                            <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden min-h-[400px]">
                                <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Music className="w-4 h-4 text-gray-600" />
                                        <span className="text-sm text-gray-700">Output</span>
                                    </div>
                                    {outputUrl && (
                                        <button
                                            onClick={downloadOutput}
                                            className="p-1.5 bg-gray-50 hover:bg-zinc-600 rounded transition-colors"
                                            title="Download"
                                        >
                                            <Download className="w-4 h-4 text-gray-700" />
                                        </button>
                                    )}
                                </div>
                                <div className="p-6 flex flex-col items-center justify-center min-h-[350px] bg-white">
                                    {isProcessing ? (
                                        <div className="text-center w-full max-w-xs">
                                            <img src="/frog-rolling.gif" alt="Processing..." className="w-12 h-12 mx-auto mb-4" />
                                            <p className="text-zinc-700 font-medium mb-2">{processingStep}</p>
                                            <div className="w-full bg-zinc-200 rounded-full h-2 mb-2">
                                                <div
                                                    className="bg-orange-500 h-full rounded-full transition-all duration-300"
                                                    style={{ width: `${processingProgress}%` }}
                                                />
                                            </div>
                                            <p className="text-gray-500 text-xs">{processingProgress}%</p>
                                        </div>
                                    ) : outputUrl ? (
                                        <div className="w-full text-center">
                                            <Music className="w-10 h-10 mx-auto text-orange-500 mb-3" />
                                            <p className="text-zinc-800 font-medium mb-4">Audio processed successfully!</p>
                                            <audio src={outputUrl} controls className="w-full mb-4" />

                                            {/* File Size Comparison */}
                                            {outputFileSize > 0 && (
                                                <div className="p-3 bg-zinc-100 rounded text-sm space-y-1 mb-4 text-left">
                                                    <div className="flex justify-between">
                                                        <span className="text-zinc-600">Original:</span>
                                                        <span className="text-zinc-800 font-medium">{formatFileSize(inputFileSize)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-zinc-600">Processed:</span>
                                                        <span className={`font-medium ${outputFileSize < 300000 ? 'text-orange-600' : 'text-orange-800'}`}>
                                                            {formatFileSize(outputFileSize)}
                                                        </span>
                                                    </div>
                                                    {outputFileSize >= 300000 && (
                                                        <p className="text-xs text-orange-600 mt-2 pt-2 border-t border-zinc-200">
                                                            ⚠️ Target: &lt;300KB for Lens Audio
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <button
                                                onClick={downloadOutput}
                                                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors inline-flex items-center gap-2 text-white"
                                            >
                                                <Download className="w-4 h-4" />
                                                Download {outputFormat.toUpperCase()}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <Music className="w-10 h-10 mx-auto text-gray-700 mb-3" />
                                            <p className="text-gray-500 text-sm">Processed audio will appear here</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
