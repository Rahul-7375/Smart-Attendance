import React, { useState, useRef, useEffect } from 'react';
import { login, signup } from '../../services/api.ts';
import { Spinner } from '../../components/Spinner.tsx';
// FIX: Replaced ChevronDownIcon with UsersIcon to support the new role selector UI.
import { CameraIcon, CheckCircleIcon, UserSquareIcon, UsersIcon, LogInIcon, UserPlusIcon, EyeIcon, EyeOffIcon } from '../../components/icons.tsx';
import { useCamera } from '../../hooks/useCamera.js';

export const AuthScreen = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSignup, setIsSignup] = useState(false);
    
    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [rollNo, setRollNo] = useState('');
    const [className, setClassName] = useState('');
    const [selectedRole, setSelectedRole] = useState('student');
    const [faceData, setFaceData] = useState(null);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    // UI state
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('error');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const cardRef = useRef(null);

    const expandCard = () => {
        if (!isExpanded) setIsExpanded(true);
    };

    const handleMouseLeave = (e) => {
        // Check if the mouse is leaving the card and its children
        if (cardRef.current && !cardRef.current.contains(e.relatedTarget)) {
            setIsExpanded(false);
        }
    };

    const handleSwitchView = () => {
        if (isExpanded) {
            setIsSignup(!isSignup);
            setMessage(''); // Clear message on view switch
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsSubmitting(true);

        try {
            if (isSignup) {
                 if (!name || !email || !password || (selectedRole === 'student' && (!rollNo || !className))) {
                    throw new Error("Please fill all required fields.");
                }
                if (selectedRole === 'student' && !faceData) {
                    throw new Error("Face registration is required for students.");
                }
                await signup(name, email, password, selectedRole, rollNo, className, faceData);
                setMessage('Account created successfully! Please sign in.');
                setMessageType('success');
                setIsSignup(false); // Switch to login view
            } else {
                await login(email, password);
                // On successful login, App.tsx will redirect
            }
        } catch (error) {
            let errorMessage = error.message || "An unexpected error occurred.";
            if (error.code) {
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                        errorMessage = 'Invalid email or password.';
                        break;
                    case 'auth/email-already-in-use':
                        errorMessage = 'This email is already registered. Please sign in.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'Password must be at least 6 characters.';
                        break;
                }
            }
            setMessage(errorMessage);
            setMessageType('error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Reset form fields when switching between login and signup
    useEffect(() => {
        setEmail('');
        setPassword('');
        setName('');
        setRollNo('');
        setClassName('');
        setFaceData(null);
        setIsPasswordVisible(false);
    }, [isSignup]);

    const FaceRegistration = () => {
        const [capturing, setCapturing] = useState(false);
        const [isFlashing, setIsFlashing] = useState(false);
        const videoRef = useRef(null);
        const { stream, isCameraActive, error: cameraError, startCamera, stopCamera } = useCamera();

        useEffect(() => {
            if (videoRef.current) {
                if (stream) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(e => console.error("Video play failed:", e));
                } else {
                    videoRef.current.srcObject = null;
                }
            }
        }, [stream]);

        useEffect(() => {
            if (cameraError) {
                setMessage(cameraError);
                setMessageType('error');
            }
        }, [cameraError]);

        const handleCaptureFace = async () => {
            if (!isCameraActive) return;
            setCapturing(true);
            setIsFlashing(true);
            setTimeout(() => setIsFlashing(false), 300);
            await new Promise(resolve => setTimeout(resolve, 1500));
            setFaceData(`face_data_${Date.now()}`);
            setMessage('Face registered successfully!');
            setMessageType('success');
            stopCamera();
            setCapturing(false);
        };

        return (
            <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70">Face Registration</label>
                {faceData ? (
                    <div className="flex items-center justify-between bg-white/10 p-3 rounded-xl">
                        <div className="flex items-center space-x-2 text-green-400">
                           <CheckCircleIcon className="w-5 h-5"/>
                           <span className="text-sm font-medium">Face Registered</span>
                        </div>
                        <button type="button" onClick={() => { setFaceData(null); setMessage(''); }} className="text-xs text-white/70 hover:underline">Retake</button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="relative bg-black/20 rounded-lg aspect-video flex items-center justify-center overflow-hidden border-2 border-white/20">
                            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${!isCameraActive && 'hidden'}`} style={{ transform: 'scaleX(-1)' }} />
                            {!isCameraActive && <CameraIcon className="w-10 h-10 text-white/30" />}
                            <div className={`absolute inset-0 bg-white transition-opacity duration-300 ${isFlashing ? 'opacity-80' : 'opacity-0 pointer-events-none'}`}></div>
                        </div>
                        <div className="flex space-x-2">
                            <button type="button" onClick={isCameraActive ? stopCamera : startCamera} disabled={isSubmitting} className="w-full text-center px-4 py-2 border-2 border-white/20 text-sm font-semibold rounded-xl text-white/80 bg-white/10 hover:bg-white/20 transition duration-150 ease-in-out">
                               {isCameraActive ? 'Stop' : 'Start'} Camera
                            </button>
                            <button type="button" onClick={handleCaptureFace} disabled={!isCameraActive || capturing || isSubmitting} className="w-full flex justify-center items-center px-4 py-2 border-2 border-transparent text-sm font-bold rounded-xl text-white bg-secondary-magenta/80 hover:bg-secondary-magenta transition duration-150 ease-in-out disabled:bg-white/10 disabled:cursor-not-allowed">
                                {capturing ? <Spinner size="sm" /> : 'Capture'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const mainActionText = isSignup ? 'SIGN UP' : 'LOGIN';
    const submitText = isSignup ? 'Sign Up' : 'Login';
    const switchLinkText = isSignup ? 'Sign In' : 'Sign Up';
    const submitIcon = isSignup ? <UserPlusIcon className="w-5 h-5"/> : <LogInIcon className="w-5 h-5"/>;

    return (
        <div className="flex items-center justify-center min-h-screen p-4">
            <div
                ref={cardRef}
                id="auth-card-wrapper"
                className={`relative w-full max-w-sm rounded-3xl shadow-2xl transition-all duration-500 ease-in-out overflow-hidden p-[2px] ${isExpanded ? '' : 'cursor-pointer'}`}
                onMouseEnter={expandCard}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    className="absolute inset-[-200%] animate-spin-slow"
                    style={{ background: 'conic-gradient(from 180deg at 50% 50%, #22d3ee, #d946ef, #6366f1, #22d3ee)' }}
                />
                <div
                    id="auth-card"
                    className="relative w-full h-full bg-slate-900/80 backdrop-blur-lg p-8 sm:p-10 rounded-[1.4rem] text-white flex flex-col items-center"
                >
                    <div className="flex flex-col items-center w-full mb-4">
                        <div className={`p-3 mb-4 rounded-full bg-white/20 shadow-lg transition-transform duration-300 ${isExpanded ? 'animate-pulse-glow' : ''}`}>
                            <UserSquareIcon className="w-8 h-8 text-white"/>
                        </div>
                        <h1 className={`text-2xl font-extrabold tracking-tight text-center transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                            Smart Attendance
                        </h1>
                        <p className={`text-sm text-white/80 font-medium transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                            Welcome {isSignup ? '' : 'back'}
                        </p>
                    </div>
                    
                    <h2 className={`text-4xl font-extrabold tracking-widest uppercase transition-all duration-500 ease-in-out ${isExpanded ? 'opacity-0 scale-90 -mt-8' : ''}`}>
                        {mainActionText}
                    </h2>

                    <div className={`w-full overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="pt-8">
                            <form id="auth-form" className="space-y-4" onSubmit={handleAuth}>
                                {isSignup && (
                                    <>
                                        <div id="role-section">
                                            <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/70">I am a...</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRole('student')}
                                                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ease-in-out space-y-2 transform hover:scale-105 ${selectedRole === 'student' ? 'bg-secondary-magenta/30 border-secondary-magenta scale-105' : 'bg-white/10 border-white/20 hover:border-white/40'}`}
                                                >
                                                    <UserSquareIcon className="w-8 h-8 text-white/90" />
                                                    <span className="font-semibold text-sm">Student</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedRole('faculty')}
                                                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ease-in-out space-y-2 transform hover:scale-105 ${selectedRole === 'faculty' ? 'bg-secondary-magenta/30 border-secondary-magenta scale-105' : 'bg-white/10 border-white/20 hover:border-white/40'}`}
                                                >
                                                    <UsersIcon className="w-8 h-8 text-white/90" />
                                                    <span className="font-semibold text-sm">Faculty</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/70">Full Name</label>
                                            <input type="text" id="name" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required
                                                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 text-white placeholder-white/60 rounded-xl focus:ring-secondary-magenta focus:border-secondary-magenta transition duration-150 ease-in-out outline-none" />
                                        </div>
                                    </>
                                )}
                                
                                <div>
                                    <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/70">Email</label>
                                    <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
                                        className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 text-white placeholder-white/60 rounded-xl focus:ring-secondary-magenta focus:border-secondary-magenta transition duration-150 ease-in-out outline-none" />
                                </div>

                                <div>
                                    <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/70">Password</label>
                                    <div className="relative">
                                        <input 
                                            type={isPasswordVisible ? 'text' : 'password'} 
                                            id="password" 
                                            value={password} 
                                            onChange={e => setPassword(e.target.value)} 
                                            placeholder="••••••••" 
                                            required
                                            className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 text-white placeholder-white/60 rounded-xl focus:ring-secondary-magenta focus:border-secondary-magenta transition duration-150 ease-in-out outline-none pr-12" 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setIsPasswordVisible(prev => !prev)}
                                            className="absolute inset-y-0 right-0 flex items-center px-4 text-white/70 hover:text-white"
                                            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                                        >
                                            {isPasswordVisible ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {isSignup && selectedRole === 'student' && (
                                    <>
                                        <div>
                                            <label htmlFor="roll-number" className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/70">Roll Number</label>
                                            <input type="text" id="roll-number" value={rollNo} onChange={e => setRollNo(e.target.value)} placeholder="e.g. 1011" required
                                                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 text-white placeholder-white/60 rounded-xl focus:ring-secondary-magenta focus:border-secondary-magenta transition duration-150 ease-in-out outline-none" />
                                        </div>
                                        <div>
                                            <label htmlFor="class-name" className="block text-xs font-semibold uppercase tracking-wider mb-2 text-white/70">Class Name</label>
                                            <input type="text" id="class-name" value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. BSc-III" required
                                                className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 text-white placeholder-white/60 rounded-xl focus:ring-secondary-magenta focus:border-secondary-magenta transition duration-150 ease-in-out outline-none" />
                                        </div>
                                        <FaceRegistration />
                                    </>
                                )}
                                
                                <div className={`flex items-center text-xs text-white/80 pt-2 ${isSignup ? 'justify-end' : 'justify-between'}`}>
                                    {!isSignup && <a href="#" className="hover:text-white transition-colors duration-200">Forgot Password</a>}
                                    <button type="button" onClick={handleSwitchView} className="font-bold text-white hover:text-white/80 transition duration-150 ease-in-out">
                                        {switchLinkText}
                                    </button>
                                </div>
                                 
                                {message && <p className={`text-center text-sm font-medium pt-2 ${messageType === 'success' ? 'text-green-300' : 'text-red-300'}`}>{message}</p>}

                                <button id="submit-btn" type="submit" disabled={isSubmitting}
                                    className="w-full flex items-center justify-center space-x-2 py-3 bg-secondary-magenta hover:bg-purple-700 text-white text-lg font-bold rounded-xl shadow-lg shadow-secondary-magenta/50 transition duration-300 ease-in-out transform hover:scale-[1.01] active:scale-[0.99] mt-6 disabled:bg-opacity-50 disabled:cursor-not-allowed">
                                    {isSubmitting ? <Spinner /> : <>{submitIcon}<span>{submitText}</span></>}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};