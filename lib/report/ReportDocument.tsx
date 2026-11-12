import { Document, Line, Page, Rect, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { DURATION_LABELS } from "@/lib/predict/schema";
import type { FollowUpAnswer, PredictResponse, Severity } from "@/lib/predict/types";

/**
 * Printable ClearDx report. A light, print-safe variant of the HUD design:
 * the same structure and semantics (cyan accent, green supports, red
 * contradicts, amber caution) in darker tones that read well on paper.
 * Uses the built-in PDF fonts so no font files are fetched.
 */

const C = {
  ink: "#0b1220",
  text: "#1e293b",
  soft: "#475569",
  line: "#d5dde7",
  faint: "#eef3f8",
  accent: "#0e7490", // print-safe cyan
  accentSoft: "#e0f4f8",
  support: "#15803d",
  contra: "#be123c",
  amber: "#b45309",
  amberSoft: "#fff6e5",
};

const SEVERITY: Record<Severity, { label: string; color: string }> = {
  low: { label: "LOW", color: C.support },
  moderate: { label: "MODERATE", color: C.amber },
  high: { label: "HIGH", color: "#c2410c" },
  emergency: { label: "EMERGENCY", color: C.contra },
};

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: C.text, lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: C.accent, paddingBottom: 10, marginBottom: 14 },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 20, color: C.accent, letterSpacing: 3 },
  title: { fontSize: 10.5, color: C.soft, marginTop: 2 },
  meta: { fontFamily: "Courier", fontSize: 8, color: C.soft, textAlign: "right", lineHeight: 1.5 },
  disclaimer: { flexDirection: "row", backgroundColor: C.amberSoft, borderLeftWidth: 3, borderLeftColor: C.amber, padding: 8, marginBottom: 14 },
  disclaimerTag: { fontFamily: "Helvetica-Bold", fontSize: 8, color: C.amber, letterSpacing: 1, marginRight: 8, marginTop: 1 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 10, color: C.ink, letterSpacing: 1.4, marginTop: 14, marginBottom: 6, textTransform: "uppercase" },
  num: { color: C.accent },
  kvRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 4 },
  kvKey: { width: 110, fontFamily: "Helvetica-Bold", fontSize: 8, color: C.soft, letterSpacing: 0.8, textTransform: "uppercase", paddingTop: 1 },
  kvVal: { flex: 1 },
  hero: { flexDirection: "row", borderWidth: 1, borderColor: C.line, backgroundColor: C.faint, padding: 12, marginTop: 4, alignItems: "center" },
  heroPct: { fontFamily: "Helvetica-Bold", fontSize: 30, color: C.accent, width: 92 },
  heroName: { fontFamily: "Helvetica-Bold", fontSize: 17, color: C.ink },
  tag: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 0.8, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 1.5, marginLeft: 8 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.ink, paddingBottom: 3, marginTop: 2 },
  thText: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: C.soft, letterSpacing: 0.8, textTransform: "uppercase" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 4, alignItems: "center" },
  mono: { fontFamily: "Courier" },
  card: { borderWidth: 1, borderColor: C.line, padding: 10, marginBottom: 8 },
  flag: { flexDirection: "row", borderWidth: 1, borderColor: C.contra, backgroundColor: "#fff1f3", padding: 8, marginTop: 4 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 6, fontSize: 7.5, color: C.soft },
});

export interface ReportData {
  response: PredictResponse;
  /** Shown at the top of the inputs when the analysis belongs to a saved patient. */
  patientName?: string;
  /** Every symptom the user listed, in their ranked order. */
  symptoms: string[];
  excluded: string[];
  noEffect: string[];
  age: number;
  sex: string;
  duration: keyof typeof DURATION_LABELS;
  answers: FollowUpAnswer[];
  generatedAt: Date;
  reportId: string;
}

function Bar({ value, width = 120, color = C.accent }: { value: number; width?: number; color?: string }) {
  return (
    <Svg width={width} height={7}>
      <Rect x={0} y={0} width={width} height={7} fill={C.faint} />
      <Rect x={0} y={0} width={Math.max(1, width * value)} height={7} fill={color} />
    </Svg>
  );
}

/** Diverging bar centred on zero: right = supports, left = contradicts. */
function WeightBar({ weight, width = 90 }: { weight: number; width?: number }) {
  const half = width / 2;
  const w = Math.abs(weight) * half;
  return (
    <Svg width={width} height={8}>
      <Rect x={0} y={1} width={width} height={6} fill={C.faint} />
      <Rect x={weight >= 0 ? half : half - w} y={1} width={Math.max(1, w)} height={6} fill={weight >= 0 ? C.support : C.contra} />
      <Line x1={half} y1={0} x2={half} y2={8} strokeWidth={0.75} stroke={C.soft} />
    </Svg>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const signed = (w: number) => `${w >= 0 ? "+" : "-"}${Math.abs(w).toFixed(2)}`;

export function ReportDocument(d: ReportData) {
  const r = d.response.result;
  const ranked = [...r.predictions].sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0];
  const answered = new Set(d.answers.map((a) => a.question));
  const openQuestions = r.follow_up_questions.filter((q) => !answered.has(q.question));
  const when = d.generatedAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
  const source = d.response.source === "mock" ? "Mock predictor (demo data)" : "Groq language model";

  return (
    <Document title={`ClearDx report ${d.reportId}`} author="ClearDx" subject="Explainable symptom analysis (educational demo)" creator="ClearDx">
      <Page size="A4" style={s.page}>
        {/* header */}
        <View style={s.header} fixed>
          <View>
            <Text style={s.brand}>CLEARDX</Text>
            <Text style={s.title}>Explainable symptom analysis report</Text>
          </View>
          <Text style={s.meta}>
            REPORT {d.reportId}
            {"\n"}
            {when}
            {"\n"}
            SOURCE: {source.toUpperCase()}
          </Text>
        </View>

        <View style={s.disclaimer}>
          <Text style={s.disclaimerTag}>EDUCATIONAL DEMO</Text>
          <Text style={{ flex: 1 }}>
            This report is not medical advice and is not a diagnosis. Predictions can be wrong. If you feel unwell or something
            seems urgent, contact a clinician or your local emergency number.
          </Text>
        </View>

        {/* 1. inputs */}
        <Text style={s.h2}>
          <Text style={s.num}>01 </Text>Your inputs
        </Text>
        {d.patientName && (
          <View style={s.kvRow}>
            <Text style={s.kvKey}>Patient</Text>
            <Text style={[s.kvVal, { fontFamily: "Helvetica-Bold" }]}>{d.patientName}</Text>
          </View>
        )}
        <View style={s.kvRow}>
          <Text style={s.kvKey}>Age · Sex</Text>
          <Text style={s.kvVal}>
            {d.age} · {d.sex.charAt(0).toUpperCase() + d.sex.slice(1)}
          </Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvKey}>Duration</Text>
          <Text style={s.kvVal}>{DURATION_LABELS[d.duration]}</Text>
        </View>
        <View style={s.kvRow}>
          <Text style={s.kvKey}>Symptoms (ranked)</Text>
          <Text style={s.kvVal}>
            {d.symptoms.map((x, i) => `${i + 1}. ${x}${d.excluded.includes(x) ? " (excluded in what-if)" : d.noEffect.includes(x) ? " (no effect)" : ""}`).join("   ")}
          </Text>
        </View>
        {d.answers.length > 0 && (
          <View style={s.kvRow}>
            <Text style={s.kvKey}>Your answers</Text>
            <View style={s.kvVal}>
              {d.answers.map((a) => (
                <Text key={a.question}>
                  {a.question} <Text style={{ fontFamily: "Helvetica-Bold" }}>{a.answer.toUpperCase()}</Text>
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* red flags */}
        {r.red_flags.length > 0 && (
          <View style={s.flag} wrap={false}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: C.contra, fontSize: 8, letterSpacing: 1, marginRight: 8, marginTop: 1 }}>RED FLAG{r.red_flags.length > 1 ? "S" : ""}</Text>
            <View style={{ flex: 1 }}>
              {r.red_flags.map((f) => (
                <Text key={f}>• {f}</Text>
              ))}
            </View>
          </View>
        )}

        {/* 2. top match + ranking */}
        <Text style={s.h2}>
          <Text style={s.num}>02 </Text>Ranked possibilities
        </Text>
        {top && (
          <View style={s.hero} wrap={false}>
            <Text style={s.heroPct}>{pct(top.confidence)}</Text>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={s.heroName}>{top.condition}</Text>
                <Text style={[s.tag, { color: SEVERITY[top.severity].color, borderColor: SEVERITY[top.severity].color }]}>{SEVERITY[top.severity].label}</Text>
              </View>
              <Text style={{ color: C.soft, marginTop: 3 }}>Top match · confidence reflects how well the symptoms fit, not the chance of having it.</Text>
            </View>
          </View>
        )}
        <View style={s.th}>
          <Text style={[s.thText, { width: 24 }]}>#</Text>
          <Text style={[s.thText, { flex: 1 }]}>Condition</Text>
          <Text style={[s.thText, { width: 80 }]}>Severity</Text>
          <Text style={[s.thText, { width: 130 }]}>Confidence</Text>
          <Text style={[s.thText, { width: 34, textAlign: "right" }]}>%</Text>
        </View>
        {ranked.map((p, i) => (
          <View key={p.condition} style={s.tr} wrap={false}>
            <Text style={[s.mono, { width: 24, color: C.soft }]}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={{ flex: 1, fontFamily: i === 0 ? "Helvetica-Bold" : "Helvetica" }}>{p.condition}</Text>
            <Text style={{ width: 80, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: SEVERITY[p.severity].color, letterSpacing: 0.6 }}>{SEVERITY[p.severity].label}</Text>
            <View style={{ width: 130 }}>
              <Bar value={p.confidence} />
            </View>
            <Text style={[s.mono, { width: 34, textAlign: "right" }]}>{pct(p.confidence)}</Text>
          </View>
        ))}

        {/* 3. why */}
        <Text style={s.h2} break={ranked.length > 3}>
          <Text style={s.num}>03 </Text>Why: symptom contributions
        </Text>
        <Text style={{ color: C.soft, marginBottom: 6 }}>
          Each weight runs from -1 to +1. Positive (green, right of centre) supports the condition; negative (red, left of centre)
          argues against it.
        </Text>
        {ranked.map((p) => (
          <View key={p.condition} style={s.card} wrap={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10.5, color: C.ink }}>{p.condition}</Text>
              <Text style={[s.mono, { color: C.accent }]}>{pct(p.confidence)}</Text>
            </View>
            {[...p.contributions]
              .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
              .map((c) => (
                <View key={c.symptom} style={{ flexDirection: "row", paddingVertical: 2.5, borderTopWidth: 0.5, borderTopColor: C.line }}>
                  <Text style={{ width: 105 }}>{c.symptom}</Text>
                  <View style={{ width: 96, paddingTop: 2 }}>
                    <WeightBar weight={c.weight} />
                  </View>
                  <Text style={[s.mono, { width: 40, color: c.weight >= 0 ? C.support : C.contra }]}>{signed(c.weight)}</Text>
                  <Text style={{ flex: 1, color: C.soft }}>{c.reason}</Text>
                </View>
              ))}
          </View>
        ))}
        {d.noEffect.length > 0 && (
          <Text style={{ color: C.soft }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>No effect: </Text>
            {d.noEffect.join(", ")}. These were included but did not change any of the conditions above.
          </Text>
        )}

        {/* 4. reasoning */}
        <Text style={s.h2}>
          <Text style={s.num}>04 </Text>Reasoning
        </Text>
        {r.reasoning_steps.map((step, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 3 }} wrap={false}>
            <Text style={[s.mono, { width: 22, color: C.accent }]}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={{ flex: 1 }}>{step}</Text>
          </View>
        ))}

        {/* 5. follow-ups */}
        {openQuestions.length > 0 && (
          <>
            <Text style={s.h2}>
              <Text style={s.num}>05 </Text>Questions worth considering
            </Text>
            {openQuestions.map((q) => (
              <View key={q.question} style={{ marginBottom: 5 }} wrap={false}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{q.question}</Text>
                <Text style={{ color: C.soft }}>{q.why_it_matters}</Text>
              </View>
            ))}
          </>
        )}

        <View style={s.footer} fixed>
          <Text>ClearDx · Educational demo, not medical advice · Report {d.reportId}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
