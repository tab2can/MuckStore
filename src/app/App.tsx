import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Shell } from "./Shell";
import { useApp, type OverlayId } from "../stores/useApp";
import { Home } from "../routes/Home";
import { Discover } from "../routes/Discover";
import { Library } from "../routes/Library";
import { ProgramDetail } from "../routes/ProgramDetail";

function OverlayRoute({ id }: { id: OverlayId }) {
  const setOverlay = useApp((s) => s.setOverlay);
  const navigate = useNavigate();
  useEffect(() => {
    setOverlay(id);
    navigate("/", { replace: true });
  }, [id, navigate, setOverlay]);
  return null;
}

function UpdatesRoute() {
  const openUpdates = useApp((s) => s.openUpdates);
  const navigate = useNavigate();
  useEffect(() => {
    openUpdates();
    navigate("/", { replace: true });
  }, [navigate, openUpdates]);
  return null;
}

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
          <Route path="/installed" element={<Navigate to="/library" replace />} />
          <Route path="/program/:id" element={<ProgramDetail />} />
          <Route path="/updates" element={<UpdatesRoute />} />
          <Route path="/themes" element={<OverlayRoute id="themes" />} />
          <Route path="/settings" element={<OverlayRoute id="settings" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
