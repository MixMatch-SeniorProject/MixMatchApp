import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../services/firebaseConfig";
import { authService } from "../services/authService";
import { userService, UserProfile } from "../services/userService"; 

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null; 
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, age: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>; 
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);


  const fetchProfile = async (uid: string) => {
    try {
      const data = await userService.getUserProfile(uid);
      setProfile(data);
    } catch (error) {
      console.error("AuthContext: Error fetching profile:", error);
      setProfile(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  const login = async (email: string, password: string) => {
    await authService.login(email, password);

  };

  const register = async (email: string, password: string, name: string, age: string) => {
    const firebaseUser = await authService.register(email, password, name);

    const initialData = {
      uid: firebaseUser.uid,
      name,
      email,
      age: parseInt(age, 10) || 0,
      onboardingComplete: false,
    };

    await userService.createUserProfile(firebaseUser.uid, initialData);

    // Refresh to get the fully sanitized profile back from the DB
    await fetchProfile(firebaseUser.uid);
  };


  const resetPassword = async (email: string) => {
    await authService.sendPasswordReset(email);
  };

  const logout = async () => {
    try {
      setLoading(true);
      await authService.logout();
    } catch (e) {
      console.error("AuthContext: Logout error", e);
    } finally {
      setLoading(false);
    }
  };

  return (

    <AuthContext.Provider value={{ user, profile, loading, login, register, logout, refreshProfile, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};