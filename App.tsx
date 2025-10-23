
import React, { useState, useEffect } from 'react';
import { AuthScreen } from './features/auth/AuthScreen.tsx';
import { StudentDashboard } from './features/student/StudentDashboard.tsx';
import { FacultyDashboard } from './features/faculty/FacultyDashboard.tsx';
import { Spinner } from './components/Spinner.tsx';
import { onAuthStateChanged } from './services/api.ts';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // This now uses the real Firebase onAuthStateChanged listener from our API service
    const unsubscribe = onAuthStateChanged((authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    // Clean up the subscription
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="mt-4 text-white/80">Initializing Attendance System...</p>
      </div>
    );
  }

  const renderDashboard = () => {
    if (!user) return <AuthScreen />;
    
    switch (user.role) {
      case 'student':
        return <StudentDashboard user={user} />;
      case 'faculty':
        return <FacultyDashboard user={user} />;
      default:
        // If user is authenticated but has no role, show auth screen
        return <AuthScreen />;
    }
  };

  return (
    <main className="min-h-screen w-full font-sans">
      {renderDashboard()}
    </main>
  );
}