import React from 'react';
import { LoginPage } from './components/LoginPage';
import { useAuthSession } from './hooks/use-auth-session';
import AppShell from './components/app/AppShell';

function App() {
    const { session, loading } = useAuthSession();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
            </div>
        );
    }

    if (!session) {
        return <LoginPage />;
    }

    return <AppShell session={session} />;
}

export default App;
