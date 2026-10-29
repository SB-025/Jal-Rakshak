import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Logo } from "./components";

const audit = [
  [
    "Homepage and branding",
    "Implemented",
    "Responsive FlowRaksh marketing site and project brief.",
  ],
  [
    "Login and protected routes",
    "Implemented",
    "Backend-validated predefined account, one-hour bearer tokens, and logout.",
  ],
  [
    "Overview dashboard",
    "Implemented",
    "Registered pumps, latest-reading conditions, trends, and work orders.",
  ],
  [
    "Pump monitoring and charts",
    "Implemented",
    "Stored history, timestamps, search, and per-pump sensor detail.",
  ],
  [
    "AI diagnostics screen",
    "Implemented",
    "Backend condition screening, demo-trained models, short-term trend projections, component hypotheses, and saved reports.",
  ],
  [
    "Alerts and maintenance screens",
    "Implemented",
    "Latest-reading events, operator actions, and work-order progress.",
  ],
  [
    "Reports and settings",
    "Implemented",
    "CSV exports and persistent threshold configuration.",
  ],
  [
    "API server and database",
    "Implemented",
    "Authenticated FastAPI endpoints backed by MongoDB Atlas.",
  ],
  [
    "ESP32-S3 sends real readings",
    "Planned",
    "No physical controller or firmware has been connected in this application.",
  ],
  [
    "Timestamped sensor storage",
    "Implemented",
    "Measured time, server receipt time, and explicit data-source labels.",
  ],
  [
    "Connectivity and missing data",
    "Partial",
    "Reading freshness and missing-sensor labels; no device heartbeat protocol.",
  ],
  [
    "Detection engine",
    "Partial",
    "Browser alerts plus on-demand backend diagnostic screening are implemented. Automatic ingestion-time incident generation remains planned.",
  ],
  [
    "Ollama Cloud integration",
    "Partial",
    "Backend chat, evidence validation, timeouts, and fallback are implemented. Live Ollama chat and follow-up questions have been verified against a simulated report.",
  ],
  [
    "Evidence-linked AI explanations",
    "Partial",
    "Cloud results are validated against report evidence and stored with diagnostic reports. Live generation requires the Ollama key.",
  ],
  [
    "Incident history and resolution",
    "Partial",
    "Actions persist per reading/rule; a complete archived incident lifecycle and notification service are not implemented.",
  ],
  [
    "Persistent maintenance records",
    "Implemented",
    "Inspection notes, scheduled dates, and work-order status are saved in Atlas.",
  ],
  [
    "Report exports",
    "Implemented",
    "Sensor, latest-event, and maintenance CSV downloads.",
  ],
  [
    "End-to-end demonstration",
    "Partial",
    "Software and trained demo models verified with simulated Atlas data. Physical sensing and live Ollama inference remain to be tested.",
  ],
];

export default function Project() {
  return (
    <div className="project-page">
      <header className="container project-header">
        <Logo />
        <Link className="text-link" to="/">
          <ArrowLeft size={14} /> Back to home
        </Link>
        <Link className="button button-small" to="/dashboard">
          Open dashboard <ArrowUpRight size={14} />
        </Link>
      </header>
      <main className="container project-main">
        <p className="eyebrow">FLOWRAKSH / JAL RAKSHAK AI · PROJECT BRIEF</p>
        <h1>
          Protect the water supply.
          <br />
          Start with the evidence.
        </h1>
        <p className="project-lead">
          An IoT predictive-maintenance prototype for water-supply pumps and
          motors. A transparent view of the problem, the proposed architecture,
          and what the software actually does today.
        </p>
        <div className="project-grid">
          <section className="project-block">
            <Badge tone="demo">PS000128 · reconstructed</Badge>
            <h2>The working problem</h2>
            <p>
              Unexpected pump and motor failures can interrupt water delivery,
              increase repair costs, and force emergency maintenance. Periodic
              inspection may miss developing faults.
            </p>
            <p>
              Our working challenge is to build an affordable system that
              collects available sensor measurements, identifies abnormal
              behaviour, and gives maintenance teams evidence for earlier
              intervention.
            </p>
            <p>
              <strong>Working title:</strong> IoT Predictive Maintenance for
              Water Supply Pumps and Motors. The PS000128 identifier, exact
              title, and attribution to the Gujarat Water Supply &amp; Sewerage
              Board are user-supplied and have not been independently verified
              from an original problem document.
            </p>
          </section>
          <section className="project-block">
            <Badge tone="success">Official portal context</Badge>
            <h2>What is verified</h2>
            <p>
              The official challenge portal includes water within its
              sustainability theme. For undergraduate students and above, it
              describes a demonstrated prototype or pilot with a credible
              deployment pathway, supported by cost, beneficiaries, timeline,
              impact, and scalability.
            </p>
            <p>
              <a
                href="https://sevafirst.mic.gov.in/"
                target="_blank"
                rel="noreferrer"
              >
                Read the official challenge portal <ArrowUpRight size={12} />
              </a>
            </p>
            <p>
              This confirms general challenge context, not the exact wording or
              mandatory requirements of PS000128. Obtain the original problem
              document before final submission. This page is a project working
              brief, not organizer-issued text.
            </p>
          </section>
          <section className="project-block project-wide">
            <p className="eyebrow">PROPOSED COMPLETE SYSTEM</p>
            <h2>Sense. Detect. Explain. Act.</h2>
            <div className="project-flow">
              {[
                "Water pump + installed sensors",
                "ESP32-S3",
                "HTTP / MQTT",
                "FastAPI + MongoDB",
                "Detection engine",
                "Ollama explanation",
                "Operator action",
              ].map((label, i) => (
                <span key={label}>
                  {label}
                  {i < 6 && (
                    <ArrowRight
                      size={12}
                      style={{ marginLeft: 12, verticalAlign: "middle" }}
                    />
                  )}
                </span>
              ))}
            </div>
            <p>
              The controller collects calibrated measurements. A proposed
              backend detection engine evaluates thresholds and, after
              validation, an anomaly model. Ollama Cloud would receive the
              detection evidence and explain it; the LLM must not independently
              invent a fault or override a measured rule. Operators review
              recommendations and record maintenance actions.
            </p>
            <p>
              <strong>Working now:</strong> authenticated HTTP storage, MongoDB
              history, browser and backend threshold evaluation, demo model
              predictions, saved diagnostic reports and alert actions,
              maintenance records, and CSV reports. <strong>Planned:</strong>{" "}
              physical ESP32-S3 ingestion, MQTT, automatic incident generation,
              real-data model validation, and live Ollama verification.
            </p>
          </section>
          <section className="project-block">
            <Badge tone="demo">Ollama Cloud · chat implemented</Badge>
            <h2>
              An explanation layer,
              <br />
              grounded in detection.
            </h2>
            <p>
              A future backend request should include the incident, available
              measurements, established baseline, duration, rule or model
              result, and missing-sensor context. The response should explain
              what happened, cite the evidence, label possible causes as
              hypotheses, and recommend inspection.
            </p>
            <p>
              Save the explanation against its incident. Apply a timeout, handle
              service errors, and fall back to the original rule evidence if the
              LLM is unavailable. Basic monitoring must continue independently.
            </p>
          </section>
          <section className="project-block">
            <Badge tone="demo">
              Demo ML trained · hardware validation pending
            </Badge>
            <h2>
              Three distinct layers
              <br />
              of intelligence.
            </h2>
            <ul>
              <li>
                <strong>Threshold rules:</strong> compare measurements with
                configured limits. These are working in the current browser
                interface.
              </li>
              <li>
                <strong>Anomaly detection:</strong> train and evaluate a model
                such as Isolation Forest on representative operating data. No
                trained model is currently deployed.
              </li>
              <li>
                <strong>AI explanation:</strong> use Ollama to explain
                established detection evidence. An LLM is not a substitute for
                the detection model.
              </li>
            </ul>
          </section>
          <section className="project-block project-wide">
            <p className="eyebrow">IMPLEMENTATION AUDIT</p>
            <h2>Built, partial, and planned.</h2>
            <p>
              Software verification includes clearly labelled simulated pumps,
              including a rich-sensor bearing scenario stored in Atlas. It does
              not establish that physical hardware or machine learning is
              operational.
            </p>
            <div className="table-scroll" style={{ marginTop: 24 }}>
              <table>
                <thead>
                  <tr>
                    <th>Capability</th>
                    <th>Status</th>
                    <th>Evidence / boundary</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map(([name, status, detail]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>
                        <Badge
                          tone={
                            status === "Implemented"
                              ? "success"
                              : status === "Partial"
                                ? "warning"
                                : "muted"
                          }
                        >
                          {status}
                        </Badge>
                      </td>
                      <td
                        style={{
                          whiteSpace: "normal",
                          minWidth: 260,
                          lineHeight: 1.8,
                        }}
                      >
                        {detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="project-block project-wide">
            <p className="eyebrow">PATH TO A CREDIBLE PILOT</p>
            <h2>Prove each link before scaling.</h2>
            <ul>
              <li>
                Obtain the original PS000128 document and check its mandatory
                technical requirements and evaluation criteria.
              </li>
              <li>
                Inventory and calibrate the installed sensors. Support missing
                fields before connecting a partial sensor set; never fill gaps
                with invented readings.
              </li>
              <li>
                Connect one ESP32-S3 through authenticated ingestion. Validate
                measured timestamps, receipt times, missing-data handling, and
                offline detection against reference readings.
              </li>
              <li>
                Move detection to a persistent backend incident workflow.
                Evaluate repeat-event suppression and false alarms with an
                operator.
              </li>
              <li>
                Train and validate an anomaly model on labelled operating data.
                Integrate Ollama only after evidence-linked explanations and
                fallback behaviour can be tested.
              </li>
              <li>
                Document the bill of materials, installation and operating
                costs, pilot site and beneficiaries, timeline, maintenance
                procedure, measured outcomes, and expansion plan. These values
                remain to be established.
              </li>
            </ul>
            <Link className="button button-small" to="/dashboard?demo=1">
              Explore the software demonstration <ArrowUpRight size={14} />
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
