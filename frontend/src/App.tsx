import { useEffect, useState, type FormEvent } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronRight,
  Droplets,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import Landing from "./Landing";
import Project from "./Project";
import Diagnostics from "./Diagnostics";
import { request } from "./api";
import { DataProvider, useData } from "./data";
import { Empty, Logo } from "./components";
import {
  AlertsPage,
  Dashboard,
  MaintenancePage,
  MotorDetail,
  MotorForm,
  PumpsPage,
  Reports,
  SettingsPage,
} from "./pages";

function Login() {
  const navigate = useNavigate(),
    location = useLocation();
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await request<{ access_token: string }>(
        "/auth/login",
        "POST",
        { username: form.get("username"), password: form.get("password") },
      );
      sessionStorage.setItem("flowraksh-token", result.access_token);
      const next = (location.state as { from?: string } | null)?.from;
      navigate(next?.startsWith("/dashboard") ? next : "/dashboard", {
        replace: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Logo />
        <div>
          <span className="eyebrow">INTELLIGENCE THAT PROTECTS THE FLOW</span>
          <h1>
            Good decisions
            <br />
            start with
            <br />
            <span>better signals.</span>
          </h1>
          <p>
            A clearer view of your water infrastructure.
            <br />A head start on what needs attention.
          </p>
          <div className="login-visual">
            <div className="login-rings">
              <Droplets size={62} />
            </div>
            <span>
              <i className="live-dot" /> FLOWRAKSH OPERATIONS PLATFORM
            </span>
          </div>
        </div>
        <p className="login-context">SEVA FIRST INNOVATION CHALLENGE 2026</p>
      </div>
      <div className="login-form-side">
        <Link className="back-link" to="/">
          <ArrowLeft size={15} /> Back to home
        </Link>
        <div className="login-form">
          <span className="form-icon">
            <LockKeyhole size={24} />
          </span>
          <p className="eyebrow">OPERATOR ACCESS</p>
          <h2>Welcome back.</h2>
          <p>Sign in to keep your operations flowing.</p>
          <form onSubmit={submit}>
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                required
                placeholder="Enter your username"
                maxLength={100}
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  maxLength={256}
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <button className="button full" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <>
                  Sign in <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <div className="login-divider">
            <span />
            OR EXPLORE FIRST
            <span />
          </div>
          <Link className="button button-outline full" to="/dashboard?demo=1">
            Open demo workspace <ArrowUpRight size={16} />
          </Link>
          <p className="form-note">
            <ShieldCheck size={14} /> Demo mode uses clearly labelled simulated
            data.
          </p>
        </div>
        <div className="login-bottom">
          FlowRaksh · Paani Chale. Problems Ruke.
        </div>
      </div>
    </div>
  );
}
function Workspace() {
  const [search] = useSearchParams(),
    location = useLocation();
  const demo = search.get("demo") === "1";
  if (!demo && !sessionStorage.getItem("flowraksh-token"))
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return (
    <DataProvider demo={demo} key={demo ? "demo" : "api"}>
      <Shell />
    </DataProvider>
  );
}
const links = [
  ["", LayoutDashboard, "Overview"],
  ["pumps", Droplets, "Pump monitoring"],
  ["diagnostics", BrainCircuit, "AI diagnostics"],
  ["alerts", Bell, "Alerts"],
  ["maintenance", Wrench, "Maintenance"],
  ["reports", FileText, "Reports"],
  ["settings", Settings, "Settings"],
] as const;
function Shell() {
  const { demo, loading, error, refreshing, refresh, alerts, lastSync } =
    useData();
  const navigate = useNavigate(),
    location = useLocation();
  const [today] = useState(() =>
    new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  );
  const [mobile, setMobile] = useState(false);
  const suffix = demo ? "?demo=1" : "";
  const activeAlerts = alerts.filter((a) => a.status !== "resolved").length;
  const current =
    links.find(
      ([path]) => path && location.pathname.includes(`/dashboard/${path}`),
    )?.[2] || "Overview";
  useEffect(() => {
    const expired = () =>
      navigate("/login", { state: { from: location.pathname } });
    window.addEventListener("flowraksh-session-expired", expired);
    return () =>
      window.removeEventListener("flowraksh-session-expired", expired);
  }, [navigate, location.pathname]);
  return (
    <div className="workspace">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <div className="sidebar-logo">
          <Logo />
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobile(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-select">
          <span className="workspace-icon">
            <WavesIcon />
          </span>
          <div>
            <strong>Water operations</strong>
            <small>FlowRaksh workspace</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <span className="sidebar-label">WORKSPACE</span>
        <nav aria-label="Dashboard navigation">
          {links.map(([path, Icon, label]) => (
            <NavLink
              key={path}
              end={!path}
              className={({ isActive }) => (isActive ? "active" : "")}
              to={`/dashboard${path ? `/${path}` : ""}${suffix}`}
              onClick={() => setMobile(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {path === "alerts" && activeAlerts > 0 && <em>{activeAlerts}</em>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-card">
            <span>
              <span className={`live-dot ${demo ? "demo-dot" : ""}`} />
              {demo ? "Demo environment" : "API workspace"}
            </span>
            <p>
              {demo
                ? "Simulated devices. Real possibilities."
                : "HTTP API · refresh every 60 seconds"}
            </p>
            <Link to={`/dashboard/settings${suffix}`}>
              Connection details <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="operator">
            <span className="avatar">{demo ? "D" : "N"}</span>
            <div>
              <strong>{demo ? "Demo operator" : "niox"}</strong>
              <small>
                {demo ? "Preview session" : "Operations administrator"}
              </small>
            </div>
            <button
              className="icon-button"
              title={demo ? "Leave demo" : "Sign out"}
              aria-label={demo ? "Leave demo" : "Sign out"}
              onClick={() => {
                if (!demo) sessionStorage.removeItem("flowraksh-token");
                navigate("/login");
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={19} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{current}</strong>
          </div>
          <div>
            <span className="header-date">{today}</span>
            <button
              className="icon-button"
              aria-label="Refresh data"
              onClick={() => void refresh()}
              disabled={refreshing || demo}
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            </button>
            <Link
              className="icon-button notification-button"
              aria-label="Open alerts"
              to={`/dashboard/alerts${suffix}`}
            >
              <Bell size={18} />
              {activeAlerts > 0 && <i />}
            </Link>
            <span className="avatar small">{demo ? "D" : "N"}</span>
          </div>
        </header>
        <div className={`data-banner ${demo ? "demo-banner" : ""}`}>
          <span>
            <Activity size={14} />
            {demo
              ? "DEMO WORKSPACE · All readings are simulated. Changes stay in this session."
              : "MONGODB WORKSPACE · Source labels distinguish simulated, manual, and hardware data."}
          </span>
          {demo ? (
            <Link to="/login">
              Connect your operations <ArrowUpRight size={12} />
            </Link>
          ) : (
            <small>
              {lastSync
                ? `Synced ${lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                : "Waiting for database"}
            </small>
          )}
        </div>
        <main className="dashboard-content">
          {loading ? (
            <div className="loading-state">
              <LoaderCircle className="spin" />
              <h3>Connecting your operations…</h3>
              <p>Loading pump records and sensor history.</p>
            </div>
          ) : error ? (
            <div className="panel error-state">
              <Empty title="We couldn’t sync your workspace">
                <p role="alert">{error}</p>
                <div className="inline-actions">
                  <button className="button" onClick={() => void refresh()}>
                    Try again <RefreshCw size={15} />
                  </button>
                  <Link
                    className="button button-outline"
                    to="/dashboard?demo=1"
                  >
                    Explore demo mode
                  </Link>
                </div>
              </Empty>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
        <footer className="workspace-footer">
          <span>FLOWRAKSH / OPERATIONS INTELLIGENCE</span>
          <span>Rules explain. Operators decide.</span>
        </footer>
      </div>
    </div>
  );
}
function WavesIcon() {
  return <ChartNoAxesCombined size={18} />;
}
function NotFound() {
  return (
    <div className="not-found">
      <Logo />
      <h1>Page not found.</h1>
      <p>Let’s get you back to the flow.</p>
      <Link className="button" to="/">
        Return home <ArrowRight size={16} />
      </Link>
    </div>
  );
}
function ScrollReset() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, search]);
  return null;
}
export default function App() {
  return (
    <BrowserRouter>
      <ScrollReset />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/project" element={<Project />} />
        <Route path="/dashboard" element={<Workspace />}>
          <Route index element={<Dashboard />} />
          <Route path="pumps" element={<PumpsPage />} />
          <Route path="pumps/new" element={<MotorForm />} />
          <Route path="pumps/:id" element={<MotorDetail />} />
          <Route path="diagnostics" element={<Diagnostics />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
