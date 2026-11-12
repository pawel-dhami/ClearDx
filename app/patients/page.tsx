"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnalysisCard } from "@/components/app/AnalysisCard";
import { PatientForm } from "@/components/app/PatientPicker";
import { Disclaimer } from "@/components/Disclaimer";
import { PanelTitle } from "@/components/site/Hud";
import { Nav } from "@/components/site/Nav";
import { deleteAnalysis, listAnalyses, type SavedAnalysis } from "@/lib/history";
import { ageFrom, createPatient, deletePatient, updatePatient, usePatients, type Patient } from "@/lib/patients";
import { authEnabled } from "@/lib/supabase/config";
import { useSession } from "@/lib/useSession";

const SEX_LABEL = { male: "Male", female: "Female", other: "Other" } as const;

export default function PatientsPage() {
  const { user, ready } = useSession();
  const { patients, setPatients, error } = usePatients(!!user);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "add" | "edit">("view");
  const selected = patients?.find((p) => p.id === selectedId) ?? patients?.[0] ?? null;

  const sorted = (list: Patient[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Nav
        right={
          <Link href="/app" className="btn btn-primary">
            Launch app
          </Link>
        }
      />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-10 sm:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label mb-2">Account</p>
            <h1 className="font-display text-4xl font-semibold">Patients</h1>
          </div>
          {user && (
            <div className="flex gap-2">
              <Link href="/history" className="btn btn-ghost">
                All history
              </Link>
              <button type="button" onClick={() => setMode("add")} className="btn btn-primary">
                + New patient
              </button>
            </div>
          )}
        </div>

        {!authEnabled ? (
          <p className="text-soft">Sign-in isn&apos;t set up on this deployment, so patients can&apos;t be saved.</p>
        ) : !ready ? (
          <div className="skeleton h-24" aria-hidden />
        ) : !user ? (
          <p className="text-soft">
            <Link href="/sign-in?next=/patients" className="text-cyan underline">
              Sign in
            </Link>{" "}
            to add patients and keep their reports.
          </p>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-contra/10 px-3 py-2 text-sm text-contra">
            {error}
          </p>
        ) : patients === null ? (
          <div className="grid gap-4 lg:grid-cols-[300px_1fr]" aria-hidden>
            <div className="skeleton h-64" />
            <div className="skeleton h-64" />
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
            {/* ---------- list ---------- */}
            <section aria-labelledby="pl-title" className="hud flex flex-col gap-3 p-4">
              <PanelTitle id="pl-title">
                Patients <span className="font-mono text-[13px] font-medium text-muted">{patients.length}</span>
              </PanelTitle>
              {patients.length === 0 ? (
                <p className="rounded-xl bg-fill p-3.5 text-[13px] text-soft">No patients yet. Add one to start keeping their reports together.</p>
              ) : (
                <ul className="flex flex-col gap-1" aria-label="Patients">
                  {patients.map((p) => {
                    const on = selected?.id === p.id && mode !== "add";
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          aria-current={on ? "true" : undefined}
                          onClick={() => {
                            setSelectedId(p.id);
                            setMode("view");
                          }}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${on ? "bg-cyan/12" : "hover:bg-fill"}`}
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent-fill)] text-xs font-semibold text-white">{initials(p.name)}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{p.name}</span>
                            <span className="block truncate text-xs text-muted">{describe(p) || "No details"}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ---------- detail ---------- */}
            {mode === "add" ? (
              <section aria-labelledby="np-title" className="hud flex flex-col gap-3 p-4">
                <PanelTitle id="np-title">New patient</PanelTitle>
                <div className="max-w-md">
                  <PatientForm
                    onCancel={() => setMode("view")}
                    onSubmit={async (input) => {
                      const p = await createPatient(input);
                      setPatients((all) => sorted([...(all ?? []), p]));
                      setSelectedId(p.id);
                      setMode("view");
                    }}
                  />
                </div>
              </section>
            ) : selected ? (
              <PatientDetail
                key={selected.id}
                patient={selected}
                editing={mode === "edit"}
                onEdit={() => setMode("edit")}
                onCancelEdit={() => setMode("view")}
                onSaved={(p) => {
                  setPatients((all) => sorted((all ?? []).map((x) => (x.id === p.id ? p : x))));
                  setMode("view");
                }}
                onDeleted={(id) => {
                  setPatients((all) => (all ?? []).filter((x) => x.id !== id));
                  setSelectedId(null);
                }}
              />
            ) : (
              <section className="hud p-8 text-center">
                <p className="font-display text-2xl font-semibold">Add your first patient</p>
                <p className="mt-2 text-soft">Then pick them in the app before analysing; their reports collect here.</p>
                <button type="button" onClick={() => setMode("add")} className="btn btn-primary mt-6">
                  + New patient
                </button>
              </section>
            )}
          </div>
        )}
      </main>
      <Disclaimer className="mx-4 mb-4 sm:mx-8" />
    </div>
  );
}

function PatientDetail({
  patient: p,
  editing,
  onEdit,
  onCancelEdit,
  onSaved,
  onDeleted,
}: {
  patient: Patient;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: (p: Patient) => void;
  onDeleted: (id: string) => void;
}) {
  const [reports, setReports] = useState<SavedAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAnalyses(100, p.id)
      .then((rows) => alive && setReports(rows))
      .catch((e) => alive && setError(e.message ?? "Couldn't load reports."));
    return () => {
      alive = false;
    };
  }, [p.id]);

  const removePatient = async () => {
    if (!window.confirm(`Delete ${p.name}? Their saved reports stay in your history, without a patient. This can't be undone.`)) return;
    try {
      await deletePatient(p.id);
      onDeleted(p.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const removeReport = async (id: string) => {
    if (!window.confirm("Delete this saved analysis? This can't be undone.")) return;
    try {
      await deleteAnalysis(id);
      setReports((xs) => xs?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section aria-labelledby="pd-title" className="hud flex flex-col gap-3 p-4">
        {editing ? (
          <>
            <PanelTitle id="pd-title">Edit patient</PanelTitle>
            <div className="max-w-md">
              <PatientForm
                initial={p}
                submitLabel="Save changes"
                onCancel={onCancelEdit}
                onSubmit={async (input) => onSaved(await updatePatient(p.id, input))}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--accent-fill)] text-sm font-semibold text-white">{initials(p.name)}</span>
                <div className="min-w-0">
                  <h2 id="pd-title" className="truncate font-display text-2xl font-semibold">
                    {p.name}
                  </h2>
                  <p className="text-sm text-muted">{describe(p) || "No details yet"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/app?patient=${p.id}`} className="btn btn-primary !min-h-8 !px-3.5 !text-[13px]">
                  New analysis
                </Link>
                <button type="button" onClick={onEdit} className="btn btn-ghost !min-h-8 !px-3.5 !text-[13px]">
                  Edit
                </button>
                <button type="button" onClick={removePatient} className="btn btn-ghost !min-h-8 !px-3.5 !text-[13px] hover:!bg-contra/12 hover:!text-contra">
                  Delete
                </button>
              </div>
            </div>
            {p.notes && <p className="rounded-xl bg-fill px-3.5 py-2.5 text-sm text-soft">{p.notes}</p>}
          </>
        )}
      </section>

      <section aria-labelledby="pr-title" className="flex flex-col gap-3">
        <PanelTitle id="pr-title" className="px-1">
          Reports {reports && <span className="font-mono text-[13px] font-medium text-muted">{reports.length}</span>}
        </PanelTitle>
        {error ? (
          <p role="alert" className="rounded-xl bg-contra/10 px-3 py-2 text-sm text-contra">
            {error}
          </p>
        ) : reports === null ? (
          <div className="space-y-3" aria-hidden>
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
          </div>
        ) : reports.length === 0 ? (
          <p className="hud p-4 text-sm text-soft">No reports yet. Choose {p.name} in the app and run an analysis; it&apos;s saved here and can be downloaded as a PDF any time.</p>
        ) : (
          <ul className="space-y-3" aria-label={`Reports for ${p.name}, newest first`}>
            {reports.map((a) => (
              <AnalysisCard key={a.id} analysis={a} patientName={p.name} onDelete={removeReport} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function describe(p: Patient) {
  const age = ageFrom(p.birth_year);
  return [age !== null && `${age} yrs`, p.birth_year && `born ${p.birth_year}`, p.sex && SEX_LABEL[p.sex]].filter(Boolean).join(" · ");
}
