
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  onSnapshot,
  collectionGroup,
} from 'firebase/firestore';
import { auth, db } from './firebase.ts';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged as onFirebaseAuthStateChanged,
} from 'firebase/auth';

// --- AUTHENTICATION ---

export const login = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
  const userData = userDoc.data();
  if (!userData) {
    throw new Error("No user profile found for this account.");
  }
  return { uid: userCredential.user.uid, ...userData };
};

export const signup = async (name, email, password, role, rollNo, className, faceData) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  const newUser: any = {
    email,
    name,
    role,
  };

  if (role === 'student') {
    newUser.rollNo = rollNo || '';
    newUser.class = className || '';
    newUser.faceData = faceData || '';
  }

  await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
};

export const logout = () => {
  return signOut(auth);
};

export const onAuthStateChanged = (callback) => {
  return onFirebaseAuthStateChanged(auth, async (firebaseUser) => {
    try {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = userDoc.data();
        if (userData) {
          callback({ uid: firebaseUser.uid, ...userData });
        } else {
          callback(null); // User exists in Auth but not Firestore, treat as logged out
        }
      } else {
        callback(null);
      }
    } catch (error) {
        console.error("Error fetching user data:", error);
        callback(null); // On error, treat as logged out to prevent app stall
    }
  });
};


// --- STUDENT DATA ---

export const onStudentHistorySnapshot = (userId, callback) => {
    // Query the user's dedicated attendance history subcollection.
    // This avoids the need for a collectionGroup query and its associated index.
    const q = query(
        collection(db, 'users', userId, 'attendanceHistory'),
        orderBy('timestamp', 'desc'),
        limit(20)
    );
    return onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sorting is now handled by the Firestore query's orderBy clause.
        callback(records);
    }, (error) => {
        console.error("Error listening to student history:", error);
        // Pass an empty array or handle error in the UI
        callback([]);
    });
};

export const getLatestActiveQR = async () => {
    const q = query(collection(db, 'activeQRs'), orderBy('timestamp', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const qrDoc = snapshot.docs[0];
    const qrData = qrDoc.data();
    
    // Check if it's expired
    if (Date.now() - qrData.timestamp > qrData.duration * 1000) {
        return null;
    }
    return qrData;
}


export const getQrData = async (secretCode) => {
    const qrQuery = query(collection(db, 'activeQRs'), where('secret', '==', secretCode), limit(1));
    const qrSnapshot = await getDocs(qrQuery);
    if (qrSnapshot.empty) {
        throw new Error("Invalid or expired secret code.");
    }

    const qrDoc = qrSnapshot.docs[0];
    const qrData = qrDoc.data();
    
    if (Date.now() - qrData.timestamp > qrData.duration * 1000) {
         throw new Error("Secret code has expired.");
    }
    return qrData;
};

// Simplified attendance marking process: verifies the code and marks attendance directly.
export const verifyAndMarkAttendance = async (user, secretCode) => {
    // 1. Verify and get QR data. This also checks for expiry.
    const qrData = await getQrData(secretCode);

    // 2. If QR is valid, mark attendance. Location and face verification are removed.
    return markAttendance(user, qrData);
};

export const markAttendance = async (user, qrData) => {
    const newRecord = {
        studentId: user.rollNo,
        studentName: user.name,
        userId: user.uid,
        timestamp: Date.now(),
        time: new Date().toLocaleString(),
        status: 'present',
        distance: 'N/A', // Verification removed
        subject: qrData.subject,
        class: qrData.class,
        sessionId: qrData.sessionId, // Link to the session
        facultyId: qrData.facultyId,
        facultyName: qrData.facultyName
    };
    // Write to faculty's records for their dashboard view
    await addDoc(collection(db, 'faculty', qrData.facultyId, 'attendanceRecords'), newRecord);
    
    // Denormalize: Write a copy to a subcollection under the user for efficient student-side queries.
    // This resolves the Firestore error requiring a composite index for collectionGroup queries.
    await addDoc(collection(db, 'users', user.uid, 'attendanceHistory'), newRecord);

    return "Attendance marked successfully!";
};


// --- FACULTY DATA ---

export const generateFacultyQR = async (facultyId, facultyName, subject, className, duration, location, totalStudents) => {
    // Create a session document for attendance tracking
    const sessionRef = await addDoc(collection(db, 'sessions'), {
        facultyId,
        facultyName,
        subject,
        class: className,
        totalStudents: totalStudents || 0,
        timestamp: Date.now()
    });
    
    const secret = 'FAC_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const token = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit token
    const qrData: any = {
        secret,
        token, // Add token to QR data
        sessionId: sessionRef.id, // Include session ID in QR data
        facultyId,
        facultyName,
        subject,
        class: className,
        duration,
        timestamp: Date.now()
    };
    // Embed location if available
    if (location) {
        qrData.location = location;
    }
    await setDoc(doc(db, 'activeQRs', facultyId), qrData, { merge: true });
    return { secret, token, sessionId: sessionRef.id };
};

export const updateFacultyLocation = (facultyId, location) => {
    return setDoc(doc(db, 'faculty', facultyId), { location }, { merge: true });
};

export const onRecentActivitySnapshot = (facultyId, callback) => {
    const q = query(
        collection(db, 'faculty', facultyId, 'attendanceRecords'),
        orderBy('timestamp', 'desc'),
        limit(50) // Increased limit to better support session view
    );
    return onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Client-side sort removed, handled by Firestore query.
        callback(records);
    }, (error) => {
        console.error("Error listening to recent activity:", error);
        callback([]);
    });
};

// --- ATTENDANCE SUMMARY ---
export const getStudentAttendanceSummary = async (userId) => {
    // 1. Get all student's attendance records from their dedicated subcollection.
    // This avoids the need for a collectionGroup query and its associated index.
    const attendanceQuery = query(collection(db, 'users', userId, 'attendanceHistory'));
    const attendanceSnapshot = await getDocs(attendanceQuery);
    const records = attendanceSnapshot.docs.map(doc => doc.data());

    if (records.length === 0) return [];

    // 2. Group records by subject and class
    const attendedCounts = records.reduce((acc, record) => {
        if (!record.subject || !record.class) return acc; // Skip records without subject/class
        const key = `${record.subject}|${record.class}`;
        if (!acc[key]) {
            acc[key] = { subject: record.subject, class: record.class, attended: 0 };
        }
        acc[key].attended++;
        return acc;
    }, {});

    // 3. For each subject/class combo, get the total number of sessions
    const summaryPromises = Object.values(attendedCounts).map(async (group: any) => {
        const sessionsQuery = query(
            collection(db, 'sessions'),
            where('subject', '==', group.subject),
            where('class', '==', group.class)
        );
        const sessionsSnapshot = await getDocs(sessionsQuery);
        const total = sessionsSnapshot.size;
        const percentage = total > 0 ? Math.round((group.attended / total) * 100) : 0;
        return { ...group, total, percentage };
    });

    return Promise.all(summaryPromises);
};
