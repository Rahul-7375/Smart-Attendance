

import React, { useState, useEffect, useRef } from 'react';
import { logout, onStudentHistorySnapshot, verifyAndMarkAttendance, getLatestActiveQR, getStudentAttendanceSummary } from '../../services/api';
import { Spinner } from '../../components/Spinner';
import { ProgressBar } from '../../components/ProgressBar';
// FIX: Imported CheckCircleIcon to resolve missing component error.
import { CameraIcon, ClockIcon, LogOutIcon, MapPinIcon, QrCodeIcon, XIcon, CheckCircleIcon, UsersIcon } from '../../components/icons';

const DashboardHeader = ({ user }) => (
    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-white">Student Dashboard</h1>
            <p className="text-slate-400">{user.name} &bull; {user.email}</p>
        </div>
        <button onClick={() => logout()} className="flex items-center space-x-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/40 border border-red-600/30 transition-colors">
            <LogOutIcon className="w-5 h-5" />
            <span>Logout</span>
        </button>
    </div>
);

const AttendanceHistory = ({ records }) => (
    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
        <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-500/20 rounded-lg text-green-400"><ClockIcon className="w-6 h-6"/></div>
            <h2 className="text-xl font-semibold text-white">Attendance History</h2>
        </div>
        <div className="space-y-3 max-h-[40rem] overflow-y-auto pr-2">
            {records.length > 0 ? records.map(record => (
                <div key={record.id} className="flex justify-between items-center bg-slate-700/50 p-3 rounded-lg">
                    <div>
                        <p className="font-medium text-slate-200">{record.subject || 'General'}</p>
                        <p className="text-xs text-slate-400">{record.time}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        {record.distance && record.distance !== 'N/A' && <span className="text-xs text-slate-400 flex items-center"><MapPinIcon className="w-3 h-3 mr-1" />{record.distance}</span>}
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${record.status === 'present' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                            {record.status === 'present' ? 'Present' : 'Failed'}
                        </span>
                    </div>
                </div>
            )) : <p className="text-slate-500 text-center py-8">No attendance records found.</p>}
        </div>
    </div>
);

const AttendanceSummary = ({ summary, isLoading }) => {
    const overall = summary.reduce(
        (acc, item) => {
            acc.attended += item.attended;
            acc.total += item.total;
            return acc;
        },
        { attended: 0, total: 0 }
    );
    const overallPercentage = overall.total > 0 ? Math.round((overall.attended / overall.total) * 100) : 0;

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400"><UsersIcon className="w-6 h-6"/></div>
                <h2 className="text-xl font-semibold text-white">Attendance Summary</h2>
            </div>
            <div className="space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Spinner />
                    </div>
                ) : summary.length > 0 ? (
                    <>
                        <div className="border-b border-slate-700 pb-4">
                            <div className="flex justify-between items-baseline mb-1">
                                <span className="font-bold text-lg text-white">Overall Attendance</span>
                                <span className="text-sm text-slate-400">{overall.attended}/{overall.total} classes</span>
                            </div>
                            <ProgressBar percentage={overallPercentage} />
                        </div>
                        {summary.map(item => (
                            <div key={`${item.subject}|${item.class}`} className="pt-2">
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="font-semibold text-slate-200">{item.subject}</span>
                                    <span className="text-sm text-slate-400">{item.attended}/{item.total} classes</span>
                                </div>
                                <ProgressBar percentage={item.percentage} />
                            </div>
                        ))}
                    </>
                ) : (
                    <p className="text-slate-500 text-center py-8">No summary data available.</p>
                )}
            </div>
        </div>
    );
};


export const StudentDashboard = ({ user }) => {
    const [history, setHistory] = useState([]);
    const [summary, setSummary] = useState([]);
    const [isLoadingSummary, setIsLoadingSummary] = useState(true);
    const [secretCode, setSecretCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('error');

    const [isScanningQR, setIsScanningQR] = useState(false);
    const [useManualCode, setUseManualCode] = useState(false);
    
    const qrVideoRef = useRef(null);
    const qrStreamRef = useRef(null);

    useEffect(() => {
        const unsubscribe = onStudentHistorySnapshot(user.uid, setHistory);
        getStudentAttendanceSummary(user.uid)
            .then(setSummary)
            .catch(err => console.error("Failed to load summary:", err))
            .finally(() => setIsLoadingSummary(false));
            
        return () => unsubscribe();
    }, [user.uid]);
    
    const stopQRScanner = () => {
        if(qrStreamRef.current) {
            qrStreamRef.current.getTracks().forEach(track => track.stop());
            qrStreamRef.current = null;
        }
        setIsScanningQR(false);
    }

    const handleMarkAttendance = async (code) => {
        if (!code) {
            setMessage('Please enter a secret code.');
            setMessageType('error');
            return;
        }
    
        setIsSubmitting(true);
        setMessage('Verifying attendance...');
        setMessageType('success');
    
        try {
            const resultMessage = await verifyAndMarkAttendance(user, code);
            setMessage(resultMessage);
            setMessageType('success');
            setSecretCode(''); // Clear the input field
        } catch (error) {
            setMessage(error.message || 'An unknown error occurred.');
            setMessageType('error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const startQRScanner = async () => {
        try {
            setIsScanningQR(true);
            setMessage('Point your camera at the QR code...');
            setMessageType('success');
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (qrVideoRef.current) {
                qrVideoRef.current.srcObject = stream;
                qrStreamRef.current = stream;

                const scannerInterval = setInterval(async () => {
                    if (!qrStreamRef.current) { // Check if scanner was stopped manually
                        clearInterval(scannerInterval);
                        return;
                    }
                    const activeQR = await getLatestActiveQR();
                    if (activeQR) {
                        clearInterval(scannerInterval);
                        stopQRScanner();
                        handleMarkAttendance(activeQR.secret);
                    }
                }, 2000);

                setTimeout(() => {
                    if (qrStreamRef.current) { // Check if still active
                       clearInterval(scannerInterval);
                       stopQRScanner();
                       setMessage('QR scan timeout. Try manual entry.');
                       setMessageType('error');
                    }
                }, 30000);
            }
        } catch (err) {
            setMessage('Could not start camera. Please grant permission.');
            setMessageType('error');
            setIsScanningQR(false);
        }
    };
    
    useEffect(() => {
        // cleanup camera on unmount
        return () => {
            stopQRScanner();
        };
    }, []);

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <DashboardHeader user={user} />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><CameraIcon className="w-6 h-6"/></div>
                            <h2 className="text-xl font-semibold text-white">Mark Attendance</h2>
                        </div>
                        
                        <p className="text-sm text-slate-400">Scan the QR code from your faculty or enter the code manually.</p>
                        
                        {!useManualCode && !isScanningQR && (
                            <button onClick={startQRScanner} className="w-full flex justify-center items-center space-x-2 py-2.5 px-4 bg-slate-700 hover:bg-slate-600 rounded-md font-semibold">
                                <QrCodeIcon className="w-5 h-5"/>
                                <span>Scan QR Code</span>
                            </button>
                        )}

                        {isScanningQR && (
                            <div className="space-y-2">
                                <div className="bg-slate-900 rounded-lg aspect-video flex items-center justify-center overflow-hidden">
                                    <video 
                                        ref={qrVideoRef} 
                                        onLoadedMetadata={() => { qrVideoRef.current?.play().catch(e => console.error("QR Video play failed", e)); }}
                                        autoPlay 
                                        playsInline 
                                        muted 
                                        className="w-full h-full object-cover" 
                                    />
                                </div>
                                <button onClick={stopQRScanner} className="w-full flex justify-center items-center space-x-2 py-2 px-4 bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-md text-sm">
                                    <XIcon className="w-4 h-4" />
                                    <span>Stop Scanner</span>
                                </button>
                            </div>
                        )}
                        
                        <div className="text-sm">
                            <input type="checkbox" id="manualCode" checked={useManualCode} onChange={e => setUseManualCode(e.target.checked)} className="mr-2 accent-indigo-500" />
                            <label htmlFor="manualCode" className="text-slate-400">Enter code manually</label>
                        </div>

                        {useManualCode && !isScanningQR && (
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label htmlFor="secretCode" className="block text-sm font-medium text-slate-300 mb-1">Secret Code</label>
                                    <input
                                        id="secretCode"
                                        type="text"
                                        value={secretCode}
                                        onChange={(e) => setSecretCode(e.target.value.toUpperCase())}
                                        placeholder="e.g., FAC_XYZ789"
                                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:ring-indigo-500 focus:border-indigo-500 tracking-widest font-mono"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <button
                                    onClick={() => handleMarkAttendance(secretCode)}
                                    disabled={isSubmitting || !secretCode}
                                    className="w-full flex justify-center items-center space-x-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-indigo-900/50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Spinner size="sm" />
                                            <span>Verifying...</span>
                                        </>
                                    ) : (
                                       <> <CheckCircleIcon className="w-5 h-5"/> <span>Mark My Attendance</span></>
                                    )}
                                </button>
                            </div>
                        )}
                        
                        {message && <p className={`text-sm text-center pt-2 ${messageType === 'success' ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}
                    </div>

                    <AttendanceSummary summary={summary} isLoading={isLoadingSummary} />

                </div>

                <div className="lg:col-span-3">
                    <AttendanceHistory records={history} />
                </div>
            </div>
        </div>
    );
};
