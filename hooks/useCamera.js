import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * A custom hook to manage camera stream and permissions.
 * @returns {object} An object containing the stream, camera status, error, and control functions.
 */
export const useCamera = () => {
    const [stream, setStream] = useState(null);
    const [error, setError] = useState(null);
    // Use a ref to hold the stream to avoid stale closures in cleanup and ensure the latest stream is stopped.
    const streamRef = useRef(null);

    const startCamera = useCallback(async () => {
        setError(null);
        try {
            // Stop any existing stream before starting a new one
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            
            const streamInstance = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
            setStream(streamInstance);
            streamRef.current = streamInstance;
        } catch (err) {
            console.error("Camera Error:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Camera access denied. Please allow camera permissions in your browser settings.');
            } else {
                setError('Could not start camera. Please ensure it is not in use by another application.');
            }
            setStream(null);
            streamRef.current = null;
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            setStream(null);
            streamRef.current = null;
            setError(null); // Clear error when manually stopping
        }
    }, []);

    // Cleanup on unmount to ensure camera is released
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return {
        stream,
        isCameraActive: !!stream,
        error,
        startCamera,
        stopCamera,
    };
};
