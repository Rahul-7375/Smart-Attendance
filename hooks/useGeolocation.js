import { useState, useEffect, useRef } from 'react';

/**
 * A custom hook to manage and subscribe to the user's geolocation.
 * @returns {object} An object containing the location data, loading state, and any errors.
 */
export const useGeolocation = () => {
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const watchIdRef = useRef(null);

    useEffect(() => {
        const handleSuccess = (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            setLocation({ lat: latitude, lng: longitude, accuracy });
            setLoading(false);
            setError(null);
        };

        const handleError = (err) => {
            let message = 'An unknown location error occurred.';
            switch (err.code) {
                case 1: // PERMISSION_DENIED
                    message = 'Location access denied. Please enable it in your browser settings.';
                    break;
                case 2: // POSITION_UNAVAILABLE
                    message = 'Location information is unavailable.';
                    break;
                case 3: // TIMEOUT
                    message = 'The request to get user location timed out.';
                    break;
            }
            setError(message);
            setLoading(false);
        };

        const geolocationOptions = {
            enableHighAccuracy: true,
            maximumAge: 0, 
            timeout: 10000, 
        };
        
        // Start watching position
        watchIdRef.current = navigator.geolocation.watchPosition(
            handleSuccess,
            handleError,
            geolocationOptions
        );

        // Cleanup function to clear the watch
        return () => {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    return { location, loading, error };
};
