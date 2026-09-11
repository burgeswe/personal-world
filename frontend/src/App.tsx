import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarNav, BottomNav } from "./components/navigation";
import TodayScreen from "./screens/TodayScreen";
import ChatScreen from "./screens/ChatScreen";
import JournalScreen from "./screens/JournalScreen";
import WorldScreen from "./screens/WorldScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SetupWizard from "./screens/SetupWizard";
import { CompanionProvider } from "./lib/companion-context";
import { PrefsProvider } from "./lib/prefs-context";

function App() {
  return (
    <CompanionProvider>
      <PrefsProvider>
        <BrowserRouter basename="/">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>

          <div className="flex h-screen">
            <SidebarNav className="hidden md:flex" />

            <div className="flex-1 overflow-y-auto"><Routes>
              <Route path="/setup" element={<SetupWizard />} />
              <Route path="/" element={<TodayScreen />} />
              <Route path="/chat" element={<ChatScreen />} />
              <Route path="/journal" element={<JournalScreen />} />
              <Route path="/world" element={<WorldScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Routes></div>
          </div>

          <BottomNav className="md:hidden" />
        </BrowserRouter>
      </PrefsProvider>
    </CompanionProvider>
  );
}

export default App;