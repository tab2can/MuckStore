import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Shell } from "./Shell";
import { useApp } from "../stores/useApp";
import { Home } from "../routes/Home";
import { Discover } from "../routes/Discover";
import { Library } from "../routes/Library";
import { Installed } from "../routes/Installed";
import { ProgramDetail } from "../routes/ProgramDetail";
import { Updates } from "../routes/Updates";
import { Themes } from "../routes/Themes";
import { SettingsPage } from "../routes/Settings";

export default function App() {
  const { t } = useTranslation();
  const hydrate = useApp((s) => s.hydrate);
  const ready = useApp((s) => s.ready);
  const error = useApp((s) => s.error);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot-card">
          <p className="page-kicker">MUCK STORE</p>
          <h1 className="page-title">{t("common.loading")}</h1>
          <p className="page-sub">{t("boot.hint")}</p>
          <div className="progress">
            <i style={{ ["--w" as string]: "42%" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Shell>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/library" element={<Library />} />
          <Route path="/installed" element={<Installed />} />
          <Route path="/program/:id" element={<ProgramDetail />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/themes" element={<Themes />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
