
import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type AuthContextType = {
    apiKey: string | null;
    login: (key: string) => void;
    logout: () => void;
};

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem("apiKey"));

    const login = (key: string) => {
        localStorage.setItem("apiKey", key);
        setApiKey(key);
    };

    const logout = () => {
        localStorage.removeItem("apiKey");
        setApiKey(null);
    };

    return (
        <AuthContext.Provider value={{ apiKey, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);