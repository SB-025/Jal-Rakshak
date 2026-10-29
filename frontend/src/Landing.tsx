import { useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BrainCircuit,
  Cable,
  ChartNoAxesCombined,
  ChevronRight,
  CircleCheck,
  Cpu,
  Droplets,
  Eye,
  Gauge,
  Menu,
  Radio,
  ShieldCheck,
  Timer,
  Waves,
  Wrench,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Logo, Preview } from "./components";
export default function Landing() {
  const [menu, setMenu] = useState(false);
  const [year] = useState(() => new Date().getFullYear());
  return (
    <div className="landing">
      <header className="marketing-nav">
        <div className="container nav-inner">
          <Logo />
          <nav className={menu ? "open" : ""} aria-label="Main navigation">
            <a href="#home" onClick={() => setMenu(false)}>
              Home
            </a>
            <a href="#technology" onClick={() => setMenu(false)}>
              Technology
            </a>
            <a href="#how-it-works" onClick={() => setMenu(false)}>
              How it works
            </a>
            <Link to="/dashboard">Dashboard</Link>
            <a href="#about" onClick={() => setMenu(false)}>
              About
            </a>
          </nav>
          <Link className="button button-small nav-cta" to="/dashboard">
            Open dashboard <ArrowUpRight size={14} />
          </Link>
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
            aria-expanded={menu}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>
        <section id="home" className="hero container">
          <div className="hero-copy">
            <div className="flow-emblem" aria-hidden="true">
              <Waves size={48} />
              <Droplets size={32} />
              <Waves size={48} />
            </div>
            <div className="hero-label">
              <span className="live-dot" />
              AI-POWERED WATER INFRASTRUCTURE
            </div>
            <p className="hero-tagline">Paani Chale. Problems Ruke.</p>
            <h1>
              Predict failures.
              <br />
              Protect the <span>flow.</span>
            </h1>
            <p className="hero-subtitle">Predict failures before pumps fail.</p>
            <p className="hero-description">
              An intelligent predictive-maintenance platform that monitors water
              pumps, detects abnormal operating patterns, and helps teams act
              before breakdowns disrupt water supply.
            </p>
            <div className="hero-actions">
              <Link className="button" to="/dashboard">
                Explore dashboard <ArrowUpRight size={17} />
              </Link>
              <a className="button button-outline" href="#how-it-works">
                Discover how it works <ChevronRight size={16} />
              </a>
            </div>
            <Link to="/dashboard?demo=1" className="demo-link">
              Take a look inside <ArrowRight size={14} />
              <span>No sign-in · simulated data</span>
            </Link>
            <div className="hero-note">
              <ShieldCheck size={15} />
              <span>Built for the people who keep water moving.</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="visual-coordinate">
              19.0176° N / 72.8162° E <span>01 — SYSTEM PREVIEW</span>
            </div>
            <Preview />
            <div className="visual-caption">
              <span>
                <span className="dash" /> FROM SIGNAL TO FORESIGHT
              </span>
              <span>Designed in India. Built for resilience.</span>
            </div>
          </div>
        </section>
        <div className="technology-strip">
          <div className="container">
            <span>
              ENGINEERED FOR
              <br />
              <strong>INFRASTRUCTURE THAT MATTERS</strong>
            </span>
            <span>
              <Cpu />
              ESP32-S3 ready
            </span>
            <span>
              <Activity />
              Sensor intelligence
            </span>
            <span>
              <ShieldCheck />
              Early-warning insights
            </span>
            <span>
              <Waves />
              Water resilience
            </span>
          </div>
        </div>
        <section className="section container" id="problem">
          <div className="section-intro">
            <div>
              <p className="eyebrow">01 / THE CHALLENGE</p>
              <h2>
                When pumps fail,
                <br />
                water supply suffers.
              </h2>
            </div>
            <p>
              A small fault can become a much bigger disruption. Better
              visibility helps maintenance teams move from reacting to
              anticipating.
            </p>
          </div>
          <div className="problem-grid">
            {[
              [
                Timer,
                "Breakdowns without warning",
                "Unexpected motor faults can interrupt the water supply communities depend on.",
              ],
              [
                Wrench,
                "Repairs after the damage",
                "Reactive maintenance leaves teams solving problems once service is already affected.",
              ],
              [
                Eye,
                "Equipment without visibility",
                "Without operating context, early signs of stress are easy to miss.",
              ],
            ].map(([Icon, title, copy], i) => {
              const I = Icon as typeof Timer;
              return (
                <article key={String(title)}>
                  <div className="numbered-icon">
                    <I size={23} />
                    <span>0{i + 1}</span>
                  </div>
                  <h3>{String(title)}</h3>
                  <p>{String(copy)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="solution-section" id="how-it-works">
          <div className="container">
            <p className="eyebrow">02 / THE FLOWRAKSH APPROACH</p>
            <div className="section-intro">
              <h2>
                From sensor signals
                <br />
                to smarter decisions.
              </h2>
              <p>
                One connected view of pump behaviour. A clearer path from a
                sensor measurement to a maintenance action.
              </p>
            </div>
            <div className="architecture">
              {[
                [Droplets, "Water pump", "The physical system"],
                [Radio, "Sensors", "Available measurements"],
                [Cpu, "ESP32-S3", "Acquisition · planned"],
                [BrainCircuit, "Analysis", "Rules + demo ML"],
                [ChartNoAxesCombined, "Dashboard", "Evidence in context"],
                [Wrench, "Action", "Inspect and record"],
              ].map(([Icon, title, copy], i) => {
                const I = Icon as typeof Cpu;
                return (
                  <div className="architecture-node" key={String(title)}>
                    <span className="architecture-icon">
                      <I size={23} />
                    </span>
                    <small>0{i + 1}</small>
                    <strong>{String(title)}</strong>
                    <p>{String(copy)}</p>
                    {i < 5 && (
                      <ArrowRight className="architecture-arrow" size={16} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="four-steps">
              {[
                ["Sense", "Collect available sensor measurements."],
                ["Analyze", "Process readings from the controller."],
                ["Detect", "Identify threshold events. Validate ML next."],
                ["Act", "Inspect, acknowledge, and document actions."],
              ].map(([title, copy], i) => (
                <div key={title}>
                  <span>0{i + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="section container" id="features">
          <div className="section-intro">
            <div>
              <p className="eyebrow">03 / BUILT FOR OPERATORS</p>
              <h2>
                Every signal.
                <br />A clearer picture.
              </h2>
            </div>
            <Link to="/dashboard?demo=1" className="text-link">
              Explore the workspace <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="features-grid">
            <article className="feature-primary">
              <Gauge />
              <div>
                <span className="eyebrow">01 / MONITORING</span>
                <h3>Your pumps, in perspective.</h3>
                <p>
                  Temperature, voltage, water flow, density, ambient
                  temperature, and humidity. Missing sensors stay visible as not
                  connected.
                </p>
              </div>
              <div className="mini-sensor">
                <span>MOTOR TEMPERATURE</span>
                <strong>
                  46.2 <small>°C</small>
                </strong>
                <div className="meter">
                  <i />
                </div>
                <span>SIMULATED PREVIEW</span>
              </div>
            </article>
            <article>
              <BrainCircuit />
              <h3>Evidence before assumptions.</h3>
              <p>
                Rule-based diagnostics explain which readings crossed a
                threshold. Demo anomaly and component models are available;
                real-hardware validation remains pending.
              </p>
              <span className="feature-foot">
                02 / DIAGNOSTICS <ArrowUpRight size={15} />
              </span>
            </article>
            <article>
              <BellRing />
              <h3>Know what needs attention.</h3>
              <p>
                Normal, warning, and critical states with supporting sensor
                evidence and recommended inspections.
              </p>
              <span className="feature-foot">
                03 / ALERTS <ArrowUpRight size={15} />
              </span>
            </article>
            <article>
              <Wrench />
              <h3>Close the maintenance loop.</h3>
              <p>
                Record inspection notes, schedule work orders, and track their
                progress in a shared operating history.
              </p>
              <span className="feature-foot">
                04 / MAINTENANCE <ArrowUpRight size={15} />
              </span>
            </article>
            <article>
              <Cable />
              <h3>One view. Multiple stations.</h3>
              <p>
                Manage a fleet of registered pumps, with a clear distinction
                between hardware, manual data, and simulations.
              </p>
              <span className="feature-foot">
                05 / MULTI-PUMP MANAGEMENT <ArrowUpRight size={15} />
              </span>
            </article>
          </div>
        </section>
        <section
          className="section technology-section container"
          id="technology"
        >
          <div>
            <p className="eyebrow">04 / UNDER THE HOOD</p>
            <h2>
              Grounded in engineering.
              <br />
              Designed to evolve.
            </h2>
            <p className="section-copy">
              A modular platform, from embedded sensing to an operator’s next
              decision. Honest about what works today and what comes next.
            </p>
            <Link to="/dashboard/diagnostics?demo=1" className="text-link">
              See the diagnostics approach <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="stack-list">
            {[
              [
                "React + TypeScript",
                "Responsive operator interface",
                "Implemented",
              ],
              ["Python + FastAPI", "Authenticated HTTP APIs", "Implemented"],
              [
                "MongoDB Atlas",
                "Pump records and sensor history",
                "Implemented",
              ],
              ["ESP32-S3 + HTTP", "Embedded sensor acquisition", "Planned"],
              [
                "Python machine learning",
                "Validated anomaly detection model",
                "Planned",
              ],
              ["MQTT transport", "Device message ingestion", "Planned"],
            ].map(([title, copy, status]) => (
              <div key={title}>
                <span className="stack-icon">
                  {status === "Implemented" ? (
                    <CircleCheck size={19} />
                  ) : (
                    <Cpu size={19} />
                  )}
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{copy}</p>
                </div>
                <span
                  className={
                    status === "Implemented" ? "text-teal" : "text-muted"
                  }
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="mission-section" id="about">
          <div className="container mission-inner">
            <div className="mission-symbol">
              <ShieldCheck size={74} />
              <Waves size={90} />
            </div>
            <div>
              <p className="eyebrow">05 / OUR MISSION</p>
              <h2>
                Protecting infrastructure.
                <br />
                Supporting communities.
              </h2>
              <p>
                Our mission is to make predictive maintenance more accessible
                for water utilities by helping teams identify abnormal pump
                behaviour earlier, reduce avoidable downtime, and work towards
                more reliable water-supply operations.
              </p>
              <span className="challenge-label">
                SEVA FIRST INNOVATION CHALLENGE <ArrowUpRight size={14} />
              </span>
              <div className="challenge-brief">
                <Badge tone="demo">
                  PS000128 · reconstructed working brief
                </Badge>
                <p>
                  IoT predictive maintenance for water-supply pumps and motors.
                  The original problem document and its mandatory requirements
                  still need verification.
                </p>
                <Link className="text-link" to="/project">
                  Explore the problem, architecture, and implementation audit{" "}
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="container final-cta">
          <p className="eyebrow">KEEP THE WATER MOVING</p>
          <h2>
            The future of water infrastructure
            <br />
            starts here.
          </h2>
          <p>
            Embedded sensing. Maintenance intelligence. A more resilient water
            supply.
          </p>
          <div className="hero-actions">
            <Link className="button" to="/dashboard">
              Explore the dashboard <ArrowUpRight size={17} />
            </Link>
            <a href="#technology" className="text-link">
              Learn about our technology <ArrowRight size={15} />
            </a>
          </div>
        </section>
      </main>
      <footer>
        <div className="container footer-top">
          <div>
            <Logo />
            <p>Paani Chale. Problems Ruke.</p>
            <small>Intelligence for the infrastructure that sustains us.</small>
          </div>
          <div>
            <a href="#home">Home</a>
            <a href="#technology">Technology</a>
            <Link to="/dashboard">Dashboard</Link>
            <a href="#about">About</a>
            <Link to="/project">Project brief</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {year} FlowRaksh</span>
          <span>Seva First Innovation Challenge 2026</span>
          <a href="#home" aria-label="Back to top">
            Back to top <ArrowDown className="rotate" size={13} />
          </a>
        </div>
      </footer>
    </div>
  );
}
