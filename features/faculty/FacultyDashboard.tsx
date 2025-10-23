

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    logout, 
    generateFacultyQR,
    updateFacultyLocation,
    onRecentActivitySnapshot,
} from '../../services/api';
import { Spinner } from '../../components/Spinner';
import { ProgressBar } from '../../components/ProgressBar';
import { ClockIcon, CopyIcon, LogOutIcon, MapPinIcon, QrCodeIcon, UsersIcon } from '../../components/icons';
import QRCode from 'qrcode';

const DashboardHeader = ({ user }) => (
    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-white">Faculty Dashboard</h1>
            <p className="text-slate-400">{user.name} &bull; {user.email}</p>
        </div>
        <button onClick={() => logout()} className="flex items-center space-x-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 border border-red-600/30 transition-colors">
            <LogOutIcon className="w-5 h-5" />
            <span>Logout</span>
        </button>
    </div>
);

const QRCodeGenerator = ({ user, location, onSessionStart }) => {
    const [subject, setSubject] = useState('');
    const [className, setClassName] = useState('');
    const [totalStudents, setTotalStudents] = useState('');
    const [secret, setSecret] = useState('');
    const [copied, setCopied] = useState(false);
    const canvasRef = useRef(null);
    
    // Allow faculty to select QR code duration.
    const [duration, setDuration] = useState(10); // Default duration
    const [countdown, setCountdown] = useState(duration);
    const timerRef = useRef(null); // Ref to hold the interval ID
    const isGeneratingRef = useRef(false); // Ref to prevent concurrent generation
    
    const handleCopy = () => {
        if (secret) {
            navigator.clipboard.writeText(secret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // This function now handles generating the QR and resetting the timer.
    const generateAndResetTimer = useCallback(async () => {
        // Prevent multiple concurrent executions which cause the timer to speed up.
        if (isGeneratingRef.current) return;

        // Ensure we have all the required information.
        if (!location || !subject || !className) {
            setSecret(''); // Clear secret if inputs are missing
            return;
        }

        isGeneratingRef.current = true; // Acquire lock

        // Clear any existing timer before starting a new one.
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        try {
            setSecret(''); // Indicate loading
            const safeTotalStudents = parseInt(totalStudents) || 0;
            const { secret: newSecret, sessionId } = await generateFacultyQR(user.uid, user.name, subject, className, duration, location, safeTotalStudents);
            
            // Once the new QR is generated, update state and start the countdown.
            setSecret(newSecret);
            setCountdown(duration);
            onSessionStart({ id: sessionId, totalStudents: safeTotalStudents, subject, class: className });

            timerRef.current = setInterval(() => {
                setCountdown(prev => prev - 1);
            }, 1000);

        } catch (error) {
            console.error("Error generating QR:", error);
            setSecret(''); // Clear on error
        } finally {
            isGeneratingRef.current = false; // Release lock
        }

    }, [user, location, subject, className, totalStudents, onSessionStart, duration]);

    // Effect to trigger QR generation when session details change.
    useEffect(() => {
        if (subject && className && location) {
            generateAndResetTimer();
        } else {
            // If details are cleared, stop the timer and clear the QR code.
            if (timerRef.current) clearInterval(timerRef.current);
            setSecret('');
            setCountdown(duration);
        }
        
        // Cleanup: clear interval when component unmounts or deps change.
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [subject, className, location, totalStudents, duration, generateAndResetTimer]);

    // Effect to handle the countdown reaching zero.
    useEffect(() => {
        if (countdown <= 0) {
            generateAndResetTimer(); // Regenerate QR and restart timer.
        }
    }, [countdown, generateAndResetTimer]);

    useEffect(() => {
        if (secret && canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, secret, {
                width: 320,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (error) => {
                if (error) console.error("QR Code Generation Error:", error);
            });
        }
    }, [secret]);

    const renderQrContent = () => {
        const size = 320;
        const placeholderStyle = { width: `${size}px`, height: `${size}px` };

        if (!location) {
            return (
                <div style={placeholderStyle} className="flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
                    <Spinner />
                    <div className="flex items-center space-x-2">
                        <MapPinIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">Acquiring location...</span>
                    </div>
                </div>
            );
        }
        if (!subject || !className) {
             return (
                <div style={placeholderStyle} className="flex flex-col items-center justify-center text-center text-slate-500 p-4">
                    <p className="font-semibold">Session Not Started</p>
                    <p className="text-xs">Enter session details above to generate a QR code.</p>
                </div>
            );
        }
        if (!secret) {
            return (
                <div style={placeholderStyle} className="flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
                    <Spinner />
                    <span className="text-sm font-medium">Generating QR Code...</span>
                </div>
            );
        }
        return <canvas ref={canvasRef} />;
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
             <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-teal-500/20 rounded-lg text-teal-400"><QrCodeIcon className="w-6 h-6"/></div>
                    <h2 className="text-xl font-semibold text-white">Live Session QR</h2>
                </div>
                {secret && <div className="flex items-center space-x-2 text-slate-400 text-sm">
                    <ClockIcon className="w-4 h-4"/>
                    <span>{countdown}s</span>
                </div>}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 <input type="text" placeholder="Subject (e.g., Physics 101)" value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-3 py-2 bg-slate-700/80 border border-slate-600 rounded-md text-white placeholder-slate-400" />
                 <input type="text" placeholder="Class (e.g., BSc-III)" value={className} onChange={e => setClassName(e.target.value)} className="w-full px-3 py-2 bg-slate-700/80 border border-slate-600 rounded-md text-white placeholder-slate-400" />
                 <input type="number" placeholder="Total Students" value={totalStudents} onChange={e => setTotalStudents(e.target.value)} className="w-full px-3 py-2 bg-slate-700/80 border border-slate-600 rounded-md text-white placeholder-slate-400" />
                 <div>
                    <select
                        id="duration"
                        value={duration}
                        onChange={e => setDuration(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-700/80 border border-slate-600 rounded-md text-white placeholder-slate-400 h-full"
                        aria-label="QR Code Lifespan"
                    >
                        <option value="10">10s Lifespan (Default)</option>
                        <option value="15">15s Lifespan</option>
                        <option value="20">20s Lifespan</option>
                        <option value="30">30s Lifespan</option>
                    </select>
                 </div>
            </div>

            <div className="flex flex-col items-center space-y-4">
                <div className="p-4 bg-white/90 rounded-lg">
                   {renderQrContent()}
                </div>

                {secret && <div className="w-full p-4 bg-slate-900/70 rounded-lg text-center relative">
                    <p className="text-sm text-slate-400">Secret Code</p>
                    <p className="font-mono text-2xl font-bold tracking-widest text-white h-8">
                        {secret}
                    </p>
                    <button 
                        onClick={handleCopy} 
                        disabled={!secret}
                        className="absolute top-3 right-3 p-2 bg-slate-700/50 rounded-lg text-slate-400 hover:text-white hover:bg-slate-600 transition-colors disabled:opacity-50"
                        title="Copy Code"
                    >
                       <CopyIcon className="w-5 h-5" />
                    </button>
                     <p className={`text-xs transition-opacity duration-300 h-4 mt-1 ${copied ? 'opacity-100 text-teal-400' : 'opacity-0'}`}>
                        Copied to clipboard!
                    </p>
                </div>}
            </div>
        </div>
    );
};


export const FacultyDashboard = ({ user }) => {
    const [allActivity, setAllActivity] = useState([]);
    const [sessionActivity, setSessionActivity] = useState([]);
    const [location, setLocation] = useState(null);
    const [currentSession, setCurrentSession] = useState(null);

    useEffect(() => {
        const unsubActivity = onRecentActivitySnapshot(user.uid, setAllActivity);
        
        const handleSuccess = (position) => {
            const newLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            setLocation(newLocation);
            updateFacultyLocation(user.uid, newLocation);
        };
        const handleError = (error) => console.error(error.message);

        navigator.geolocation.getCurrentPosition(handleSuccess, handleError, { enableHighAccuracy: true });
        const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, { enableHighAccuracy: true });

        return () => {
            unsubActivity();
            navigator.geolocation.clearWatch(watchId);
        };
    }, [user.uid]);
    
    useEffect(() => {
        if (currentSession) {
            setSessionActivity(allActivity.filter(rec => rec.sessionId === currentSession.id));
        }
    }, [allActivity, currentSession]);

    const percentage = currentSession && currentSession.totalStudents > 0 
        ? Math.round((sessionActivity.length / currentSession.totalStudents) * 100) 
        : 0;

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6">
            <DashboardHeader user={user} />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <QRCodeGenerator user={user} location={location} onSessionStart={setCurrentSession} />
                </div>
                <div className="space-y-6">
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                        <div className="flex justify-between items-center mb-4">
                             <div className="flex items-center space-x-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><UsersIcon className="w-6 h-6"/></div>
                                <h2 className="text-xl font-semibold text-white">Live Session Activity</h2>
                            </div>
                            {currentSession && <span className="px-3 py-1 text-sm font-semibold text-blue-300 bg-blue-500/20 rounded-full">
                                {sessionActivity.length} / {currentSession.totalStudents} Present
                            </span>}
                        </div>
                        
                        {currentSession ? (
                            <>
                                <div className="mb-4">
                                    <p className="text-center font-bold text-lg text-slate-200">{currentSession.subject} - {currentSession.class}</p>
                                    <div className="flex justify-between items-baseline mt-2">
                                        <span className="text-sm font-medium text-slate-400">Attendance: {percentage}%</span>
                                    </div>
                                    <ProgressBar percentage={percentage} />
                                </div>
                                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                                    {sessionActivity.length > 0 ? sessionActivity.map(record => (
                                        <div key={record.id} className="flex justify-between items-center bg-slate-700/50 p-3 rounded-lg">
                                            <div>
                                                <p className="font-medium text-slate-200">{record.studentName}</p>
                                                <p className="text-xs text-slate-400">{record.time}</p>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <span className="text-xs text-slate-400">{record.distance}</span>
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-300">Present</span>
                                            </div>
                                        </div>
                                    )) : <p className="text-slate-500 text-center py-8">Waiting for students to check in...</p>}
                                </div>
                            </>
                        ) : (
                            <p className="text-slate-500 text-center py-8">Start a session to see live activity.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};