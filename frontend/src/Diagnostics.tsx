import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronDown,
  LoaderCircle,
  MessageSquare,
  Play,
  Send,
  Sparkles,
} from "lucide-react";
import { request } from "./api";
import { useData } from "./data";
import { Badge, formatDate, PageHeading } from "./components";

interface Evidence {
  id: string;
  value: number;
  severity: string;
  description: string;
}
interface Report {
  id: string;
  motor_id: string;
  reading_id: string;
  motor_name: string;
  created_at: string;
  reading_time: string;
  data_source: string;
  condition: string;
  condition_index: number;
  evidence: Evidence[];
  component_hypotheses: { label: string; recommended_inspection: string }[];
  missing_sensors: string[];
  forecasts: {
    metric: string;
    status: string;
    projected_value?: number;
    unit?: string;
    horizon_minutes?: number;
    reason?: string;
  }[];
  model_assessment: {
    component_prediction?: { component_id: string; label: string } | null;
    component_unavailable_reason?: string;
    reason?: string;
  };
}
interface ChatTurn {
  id: string;
  report_id: string;
  question: string;
  answer: string;
  evidence_ids: string[];
  provider: "local_evidence" | "ollama_cloud";
  notice: string;
  cloud_status: string;
  created_at: string;
}
const suggestions = [
  "What happened to this motor?",
  "Which part should I inspect?",
  "What should I do next?",
  "Is the temperature getting worse?",
];
const units: Record<string, string> = {
  temperature: "°C",
  voltage: "V",
  waterflow: "L/min",
  vibration_rms: "mm/s",
  current: "A",
  pressure: "bar",
};
const names: Record<string, string> = {
  temperature: "Motor temperature",
  voltage: "Voltage",
  waterflow: "Water flow",
  vibration_rms: "Vibration",
  current: "Current",
  pressure: "Pressure",
};

function saveReport(report: Report) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  link.download = `motor-diagnosis-${report.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export default function Diagnostics() {
  const { pumps, demo, createWork } = useData(),
    [params] = useSearchParams();
  const [selected, setSelected] = useState(params.get("motor") || ""),
    [reports, setReports] = useState<Report[]>([]),
    [report, setReport] = useState<Report | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]),
    [draft, setDraft] = useState(""),
    [pendingQuestion, setPendingQuestion] = useState(""),
    [cloudReady, setCloudReady] = useState(false);
  const [loading, setLoading] = useState(false),
    [chatLoading, setChatLoading] = useState(false),
    [running, setRunning] = useState(false),
    [sending, setSending] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const chatLog = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null);
  const motor = pumps.find((p) => p.id === selected) || pumps[0],
    motorId = motor?.id;
  const busy = running || sending;
  const loadReports = useCallback(async () => {
    if (demo || !motorId) return;
    const result = await request<{ items: Report[] }>(
      `/motors/${motorId}/diagnoses`,
    );
    return result.items;
  }, [demo, motorId]);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setError("");
      setNotice("");
      setReport(null);
      setReports([]);
      setTurns([]);
      setDraft("");
      if (demo || !motorId) return;
      setLoading(true);
      void Promise.all([
        loadReports(),
        request<{ cloud: { configured: boolean } }>("/diagnostics/status"),
      ])
        .then(([items, status]) => {
          if (!cancelled) {
            setReports(items || []);
            setReport(items?.[0] || null);
            setCloudReady(status.cloud.configured);
          }
        })
        .catch((err) => {
          if (!cancelled)
            setError(
              err instanceof Error ? err.message : "Could not load diagnosis",
            );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [demo, motorId, loadReports]);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setTurns([]);
      setDraft("");
      setPendingQuestion("");
      setNotice("");
      if (demo || !motorId || !report?.id) return;
      setChatLoading(true);
      void request<{ items: ChatTurn[] }>(
        `/motors/${motorId}/chat?report_id=${report.id}`,
      )
        .then((result) => {
          if (!cancelled) setTurns(result.items);
        })
        .catch((err) => {
          if (!cancelled)
            setError(
              err instanceof Error
                ? err.message
                : "Could not load conversation",
            );
        })
        .finally(() => {
          if (!cancelled) setChatLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [demo, motorId, report?.id]);
  useEffect(() => {
    if (chatLog.current)
      chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [turns, pendingQuestion, chatLoading]);
  async function diagnose() {
    if (!motorId || busy) return;
    setRunning(true);
    setError("");
    setNotice("");
    try {
      const result = await request<Report>(
        `/motors/${motorId}/diagnose`,
        "POST",
        { use_cloud: false, horizon_minutes: 60 },
      );
      setReports((old) => [result, ...old].slice(0, 20));
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run diagnosis");
    } finally {
      setRunning(false);
    }
  }
  async function send(message = draft) {
    const question = message.trim();
    if (!question || !motorId || !report || sending || demo || chatLoading)
      return;
    setDraft("");
    setSending(true);
    setPendingQuestion(question);
    setError("");
    try {
      const result = await request<ChatTurn>(
        `/motors/${motorId}/chat`,
        "POST",
        { message: question, report_id: report.id },
      );
      setTurns((old) => [...old, result]);
      if (result.provider === "ollama_cloud") setCloudReady(true);
    } catch (err) {
      setDraft(question);
      setError(
        err instanceof Error ? err.message : "Message could not be sent",
      );
    } finally {
      setPendingQuestion("");
      setSending(false);
      composer.current?.focus();
    }
  }
  async function inspect() {
    if (!report || saving) return;
    setSaving(true);
    setError("");
    try {
      await createWork({
        motor_id: report.motor_id,
        title:
          `${report.data_source === "demo" ? "[DEMO] " : ""}Inspect: ${report.model_assessment.component_prediction?.label || report.component_hypotheses[0]?.label || "motor condition"}`.slice(
            0,
            200,
          ),
        notes:
          `${report.data_source === "demo" ? "SIMULATED EVIDENCE. " : ""}Report ${report.id}. Component suggestions are unconfirmed. ${report.component_hypotheses.map((item) => item.recommended_inspection).join(" ")}`.slice(
            0,
            3000,
          ),
        scheduled_date: new Date().toLocaleDateString("en-CA"),
        status: "scheduled",
      });
      setNotice("Inspection saved. You can track it in Maintenance.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save inspection",
      );
    } finally {
      setSaving(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void send();
  }
  const prediction = report?.model_assessment.component_prediction;
  const issue =
    prediction && prediction.component_id !== "normal"
      ? prediction.label
      : report?.component_hypotheses[0]?.label;
  return (
    <>
      <PageHeading
        title="AI diagnosis"
        description="Understand the readings. Ask questions. Decide the next inspection."
        action={
          <button
            className="button button-small"
            disabled={demo || busy || loading || !motor?.latest_reading}
            onClick={() => void diagnose()}
          >
            {running ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Play size={14} />
            )}{" "}
            {running
              ? "Analysing…"
              : report
                ? "Refresh diagnosis"
                : "Run diagnosis"}
          </button>
        }
      />
      <div className="diagnosis-controls">
        <label>
          Selected motor
          <select
            aria-label="Motor to diagnose"
            value={motorId || ""}
            disabled={busy || loading}
            onChange={(e) => setSelected(e.target.value)}
          >
            {pumps.map((p) => (
              <option value={p.id} key={p.id}>
                {p.motor_name}
              </option>
            ))}
          </select>
        </label>
        <span className="chat-connection">
          <i className={cloudReady ? "connected" : ""} />
          {cloudReady ? "Ollama Cloud" : "Local evidence mode"}
        </span>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="success-box" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
      {demo && (
        <div className="notice">
          Sign in to diagnose motors and chat about their stored readings.{" "}
          <Link to="/login">
            Sign in <ArrowRight size={13} />
          </Link>
        </div>
      )}
      <div className="diagnosis-workspace">
        <aside
          className="diagnosis-summary panel"
          aria-label="Motor diagnosis summary"
        >
          <div className="diagnosis-summary-heading">
            <span className="tiny-label">MOTOR SNAPSHOT</span>
            {report && (
              <Badge tone={report.data_source === "demo" ? "demo" : "muted"}>
                {report.data_source === "demo"
                  ? "Simulated"
                  : report.data_source}
              </Badge>
            )}
          </div>
          {loading ? (
            <div className="diagnosis-wait">
              <LoaderCircle className="spin" size={22} />
              <p>Loading diagnosis…</p>
            </div>
          ) : report ? (
            <>
              <h2>{motor?.motor_name}</h2>
              <div className="diagnosis-condition">
                <Badge
                  tone={
                    report.condition === "critical"
                      ? "critical"
                      : report.condition === "warning"
                        ? "warning"
                        : "success"
                  }
                >
                  {report.condition.replaceAll("_", " ")}
                </Badge>
                <span>
                  {report.condition_index}
                  <small>/100</small>
                </span>
              </div>
              <p className="diagnosis-score-note">
                Screening index · not a failure probability
              </p>
              <div className="diagnosis-priority">
                <span>Suggested inspection</span>
                <strong>{issue || "No specific part identified"}</strong>
                <p>Component damage is not confirmed.</p>
              </div>
              <h3>Supporting readings</h3>
              <div className="diagnosis-evidence">
                {report.evidence.length ? (
                  report.evidence.map((item) => (
                    <div key={item.id}>
                      <span>
                        {names[item.id] || item.id.replaceAll("_", " ")}
                      </span>
                      <strong>
                        {item.value} <small>{units[item.id] || ""}</small>
                      </strong>
                    </div>
                  ))
                ) : (
                  <p>
                    No configured rule was triggered. This does not establish
                    that all components are healthy.
                  </p>
                )}
              </div>
              <div className="diagnosis-reading-time">
                <span>Last measured</span>
                <strong>{formatDate(report.reading_time)}</strong>
              </div>
              {motor?.latest_reading?.id !== report.reading_id && (
                <p className="diagnosis-updated">
                  New readings are available. Refresh the diagnosis to use them.
                </p>
              )}
              <button
                className="button button-outline full"
                disabled={saving || demo || !report.component_hypotheses.length}
                onClick={() => void inspect()}
              >
                {saving ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <Check size={14} />
                )}{" "}
                Create inspection
              </button>
              <details className="diagnosis-details">
                <summary>
                  Report details <ChevronDown size={13} />
                </summary>
                <p>
                  {report.data_source === "demo"
                    ? "Demo models use simulated data and are not validated for actual hardware."
                    : "Model suggestions require inspection and field validation."}
                </p>
                {report.missing_sensors.length > 0 && (
                  <p>
                    Missing inputs: {report.missing_sensors.join(", ")}.
                    Component classification is withheld when required sensors
                    are unavailable.
                  </p>
                )}
                {report.forecasts.map((item) => (
                  <p key={item.metric}>
                    <strong>
                      {item.metric === "temperature" ? "Temperature" : "Flow"}
                      :{" "}
                    </strong>
                    {item.status === "available"
                      ? `${item.projected_value} ${item.unit} projected ${item.horizon_minutes} minutes after the last measurement, if the recent trend continues.`
                      : item.reason}
                  </p>
                ))}
                <p>
                  Assessed {formatDate(report.created_at)}. These are saved
                  measurements, not a live device inspection.
                </p>
                <button
                  className="text-link"
                  onClick={() => saveReport(report)}
                >
                  <ArrowDownToLine size={13} /> Download report
                </button>
              </details>
            </>
          ) : (
            <div className="diagnosis-wait">
              <MessageSquare size={27} />
              <h3>No diagnosis yet</h3>
              <p>
                {demo
                  ? "Sign in to start a connected diagnosis."
                  : "Run a diagnosis to summarise this motor and start a conversation."}
              </p>
              {!demo && (
                <button
                  className="button button-small"
                  disabled={running || !motor?.latest_reading}
                  onClick={() => void diagnose()}
                >
                  Run diagnosis <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
        </aside>
        <section
          className="diagnosis-chat panel"
          aria-label="Motor diagnostic chat"
        >
          <header className="diagnosis-chat-header">
            <span className="chat-avatar">
              <Sparkles size={18} />
            </span>
            <div>
              <h2>Ask FlowRaksh</h2>
              <p>Answers grounded in this motor’s diagnosis</p>
            </div>
            <span className="chat-context-label">
              {report ? "REPORT CONNECTED" : "SELECT A DIAGNOSIS"}
            </span>
          </header>
          <div
            className="diagnosis-messages"
            ref={chatLog}
            role="log"
            aria-label="Diagnosis conversation"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {chatLoading ? (
              <div className="chat-loading">
                <LoaderCircle className="spin" size={19} />
                <span>Loading conversation…</span>
              </div>
            ) : turns.length === 0 && !pendingQuestion ? (
              <div className="chat-welcome">
                <span className="chat-welcome-icon">
                  <MessageSquare size={28} />
                </span>
                <h3>Let’s understand what happened.</h3>
                <p>
                  Ask about unusual readings, possible causes, and what to
                  inspect next.
                </p>
                <div className="chat-suggestions">
                  {suggestions.map((question) => (
                    <button
                      key={question}
                      disabled={!report || demo || busy}
                      onClick={() => void send(question)}
                    >
                      {question}
                      <ArrowRight size={13} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {turns.map((turn) => (
                  <div className="chat-exchange" key={turn.id}>
                    <div className="chat-message user">
                      <span className="chat-author">You</span>
                      <p>{turn.question}</p>
                    </div>
                    <div className="chat-message assistant">
                      <span className="chat-author">
                        <Sparkles size={12} />
                        {turn.provider === "ollama_cloud"
                          ? "FlowRaksh · Ollama"
                          : "FlowRaksh · Report-based reply"}
                      </span>
                      <p>{turn.answer}</p>
                      {turn.evidence_ids.length > 0 && (
                        <div className="chat-evidence-tags">
                          {turn.evidence_ids.map((id) => (
                            <span key={id}>
                              {names[id] || id.replaceAll("_", " ")}
                            </span>
                          ))}
                        </div>
                      )}
                      <small>{turn.notice}</small>
                    </div>
                  </div>
                ))}
                {pendingQuestion && (
                  <div className="chat-exchange">
                    <div className="chat-message user">
                      <span className="chat-author">You</span>
                      <p>{pendingQuestion}</p>
                    </div>
                    <div className="chat-typing">
                      <LoaderCircle className="spin" size={15} />
                      {cloudReady
                        ? "Reviewing the motor evidence…"
                        : "Reading the saved report…"}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <form className="chat-composer" onSubmit={submit}>
            <div>
              <textarea
                ref={composer}
                aria-label="Ask about this motor"
                placeholder={
                  report
                    ? "Ask what happened, why a reading changed, or what to inspect…"
                    : "Run a diagnosis to start chatting…"
                }
                value={draft}
                maxLength={2000}
                rows={2}
                disabled={!report || demo || sending || running || chatLoading}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                aria-label="Send message"
                type="submit"
                disabled={
                  !draft.trim() || !report || demo || busy || chatLoading
                }
              >
                {sending ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <p>
              {cloudReady
                ? "AI can be wrong. Confirm suggested faults through inspection."
                : "Local replies explain stored evidence. Add the Ollama key on the backend for cloud conversations."}
            </p>
          </form>
        </section>
      </div>
      {reports.length > 1 && (
        <details className="diagnosis-history panel">
          <summary>
            Previous reports <span>{reports.length} saved</span>
            <ChevronDown size={14} />
          </summary>
          <label>
            Open a saved diagnosis
            <select
              aria-label="Saved diagnostic report"
              disabled={busy}
              value={report?.id || ""}
              onChange={(e) =>
                setReport(
                  reports.find((item) => item.id === e.target.value) || null,
                )
              }
            >
              {reports.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDate(item.created_at)} ·{" "}
                  {item.condition.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <p>
            Each report keeps its own conversation. Latest 30 exchanges are
            shown.
          </p>
        </details>
      )}
    </>
  );
}
