"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { Dialog } from "@/components/Dialog";
import { removeMembersAction } from "../../actions";
import { plural } from "@/lib/format";
import { problemsToCsv } from "@/lib/roster/normalise";
import type { CommitResponse, PreviewResponse } from "@/lib/roster/schemas";

type Mapping = NonNullable<PreviewResponse["mapping"]>;
const NONE = -1;

export function RosterImport({ clubId }: { clubId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ email: 0, fullName: null, firstName: null, lastName: null });
  const [nameMode, setNameMode] = useState<"full" | "split">("full");
  const [summary, setSummary] = useState<CommitResponse | null>(null);
  const [done, setDone] = useState<CommitResponse | null>(null);
  const [removeMissing, setRemoveMissing] = useState(false);
  const [removedCount, setRemovedCount] = useState(0);

  async function upload(body: FormData) {
    setBusy(true);
    setError("");
    setSummary(null);
    setDone(null);
    body.set("clubId", clubId);
    const res = await fetch("/api/roster/preview", { method: "POST", body });
    const json: PreviewResponse & { error?: string } = await res.json().catch(() => ({ error: "Upload failed" }));
    setBusy(false);
    if (!res.ok || json.error) {
      setError(json.error ?? "Upload failed");
      return;
    }
    const m = json.mapping ?? { email: 0, fullName: json.columns.length > 1 ? 1 : null, firstName: null, lastName: null };
    setMapping(m);
    setNameMode(m.fullName === null && m.firstName !== null ? "split" : "full");
    setPasteOpen(false);
    setPreview(json);
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    void upload(body);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    onFiles(e.dataTransfer.files);
  }

  async function commit(dryRun: boolean) {
    if (!preview) return;
    setBusy(true);
    setError("");
    const effective: Mapping =
      nameMode === "full"
        ? { ...mapping, firstName: null, lastName: null }
        : { ...mapping, fullName: null };
    const res = await fetch("/api/roster/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ importId: preview.importId, mapping: effective, dryRun }),
    });
    const json: CommitResponse & { error?: string } = await res.json().catch(() => ({ error: "Import failed" }));
    setBusy(false);
    if (!res.ok || json.error) {
      setError(json.error ?? "Import failed");
      return;
    }
    if (dryRun) setSummary(json);
    else {
      if (removeMissing && json.missing?.length) {
        const removal = await removeMembersAction(clubId, json.missing.map((m) => m.id));
        setRemovedCount(removal.ok ? json.missing.length : 0);
      }
      setDone(json);
      setPreview(null);
      setSummary(null);
      router.refresh();
    }
  }

  function downloadProblems() {
    if (!summary) return;
    const blob = new Blob([problemsToCsv(summary.problems)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "roster-problems.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const setColumn = (key: keyof Mapping, value: number) => {
    setSummary(null);
    setMapping((m) => ({ ...m, [key]: value === NONE ? null : value }));
  };

  const columnSelect = (key: keyof Mapping, label: string, optional = false) => (
    <label className="field">
      {label}
      <select
        className="input"
        value={mapping[key] ?? NONE}
        onChange={(e) => setColumn(key, Number(e.target.value))}
      >
        {optional ? <option value={NONE}>—</option> : null}
        {preview?.columns.map((c, i) => (
          <option key={`${c}-${i}`} value={i}>
            {c}
          </option>
        ))}
      </select>
    </label>
  );

  const mappingComplete = nameMode === "full" ? mapping.fullName !== null : mapping.firstName !== null && mapping.lastName !== null;

  return (
    <>
      <div
        className="dropzone px-4 py-6"
        data-active={dragging}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <span className="soft-display text-[16px]">{busy && !preview ? "Reading the file…" : "Drop members.csv"}</span>
        <span className="text-[14px] text-[color:var(--ink-70)]">CSV or Excel. Any columns, any order.</span>
        <button
          type="button"
          className="btn btn-ghost text-[14px]"
          onClick={(e) => {
            e.stopPropagation();
            setPasteOpen(true);
          }}
        >
          Paste a list instead
        </button>
        {error && !preview ? <span className="notice mt-2 text-left">{error}</span> : null}
        {done ? (
          <span className="mt-2 text-[14px] font-semibold">
            Added {done.added + done.restored}. {done.alreadyPresent} were already on the list.
            {removedCount ? ` ${removedCount} removed.` : ""}
          </span>
        ) : null}
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <Dialog open={pasteOpen} onClose={() => setPasteOpen(false)} title="Paste members">
        <p className="text-[14px] text-[color:var(--ink-70)]">One person per line: name and email, in any format.</p>
        <textarea
          className="input font-mono text-[14px]"
          rows={10}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={"Mara Lindqvist, mara@uni.edu\nJonas Weber <j.weber@uni.edu>"}
        />
        {error ? <div className="notice">{error}</div> : null}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setPasteOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !pasted.trim()}
            onClick={() => {
              const body = new FormData();
              body.set("text", pasted);
              void upload(body);
            }}
          >
            {busy ? "Reading…" : "Continue"}
          </button>
        </div>
      </Dialog>

      <Dialog open={preview !== null} onClose={() => setPreview(null)} title="Check the columns" wide>
        {preview ? (
          <>
            <p className="text-[14px] text-[color:var(--ink-70)]">
              {preview.filename} · {preview.rowCount.toLocaleString("en-AU")} rows
              {preview.headerRowNumber ? ` · headers found on row ${preview.headerRowNumber}` : " · no header row found"}
              {preview.usedSavedMapping ? " · using your last mapping" : ""}
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[14px] font-semibold">Names are in</span>
                <div className="flex soft-card">
                  {(["full", "split"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className="flex-1 px-3 py-2 text-left text-[14px] font-semibold"
                      style={{
                        background: nameMode === mode ? "var(--color-accent)" : "transparent",
                        color: nameMode === mode ? "#fff" : "var(--color-neutral-800)",
                      }}
                      aria-pressed={nameMode === mode}
                      onClick={() => {
                        setSummary(null);
                        setNameMode(mode);
                      }}
                    >
                      {mode === "full" ? "One column" : "Two columns (first + last)"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {nameMode === "full" ? (
                  columnSelect("fullName", "Name column", true)
                ) : (
                  <>
                    {columnSelect("firstName", "First name column", true)}
                    {columnSelect("lastName", "Last name column", true)}
                  </>
                )}
              </div>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {columnSelect("email", "Email column")}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table min-w-[520px] text-[14px]">
                <thead>
                  <tr>
                    {preview.columns.map((c, i) => (
                      <th
                        key={`${c}-${i}`}
                        style={
                          i === mapping.email ||
                          (nameMode === "full" ? i === mapping.fullName : i === mapping.firstName || i === mapping.lastName)
                            ? { color: "var(--color-accent-700)" }
                            : undefined
                        }
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} className="max-w-[200px] truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary ? (
              <div className="flex flex-col gap-3 border-2 border-ink p-4">
                <div className="grid gap-2 text-[14px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                  <div>
                    <div className="display text-[32px]">{summary.added}</div>new members
                  </div>
                  <div>
                    <div className="display text-[32px]">{summary.alreadyPresent}</div>already on the list
                  </div>
                  {summary.restored ? (
                    <div>
                      <div className="display text-[32px]">{summary.restored}</div>coming back
                    </div>
                  ) : null}
                  <div>
                    <div className="display text-[32px]" style={{ color: summary.problemCount ? "var(--color-accent)" : undefined }}>
                      {summary.problemCount}
                    </div>
                    rows with problems
                  </div>
                </div>
                {summary.missing?.length ? (
                  <div className="border-t border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] pt-3">
                    <span className="text-[14px]">
                      <strong>
                        {summary.missing.length} current {summary.missing.length === 1 ? "member isn't" : "members aren't"} on this list.
                      </strong>{" "}
                      If this file is your full current membership, you can remove them. They keep access to earlier
                      albums for 30 days.
                    </span>
                    <ul className="mt-2 max-h-28 overflow-auto text-[14px] text-[color:var(--ink-70)]">
                      {summary.missing.slice(0, 50).map((m) => (
                        <li key={m.id}>
                          {m.name} · {m.email}
                        </li>
                      ))}
                    </ul>
                    <label className="mt-2 flex items-center gap-2 text-[14px]">
                      <input
                        type="checkbox"
                        checked={removeMissing}
                        onChange={(e) => setRemoveMissing(e.target.checked)}
                      />
                      Remove these {summary.missing.length} after importing
                    </label>
                  </div>
                ) : null}
                {summary.problemCount ? (
                  <>
                    <ul className="max-h-40 overflow-auto text-[14px] text-[color:var(--ink-70)]">
                      {summary.problems.slice(0, 50).map((p) => (
                        <li key={`${p.row}-${p.email}`}>
                          Row {p.row}: {p.name || "(no name)"} {p.email ? `· ${p.email}` : ""} — {p.reason}
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="btn btn-ghost self-start text-[14px]" onClick={downloadProblems}>
                      Download problem rows
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            {error ? <div className="notice">{error}</div> : null}

            <div className="dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
                Cancel
              </button>
              {summary ? (
                <button type="button" className="btn btn-primary" disabled={busy || summary.added + summary.restored === 0} onClick={() => commit(false)}>
                  {busy ? "Importing…" : `Add ${plural(summary.added + summary.restored, "member")}`}
                </button>
              ) : (
                <button type="button" className="btn btn-primary" disabled={busy || !mappingComplete} onClick={() => commit(true)}>
                  {busy ? "Checking…" : "Preview import"}
                </button>
              )}
            </div>
          </>
        ) : null}
      </Dialog>
    </>
  );
}
