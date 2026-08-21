"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

type MockTask = {
  id: string;
  title: string;
};

const mockTasks: MockTask[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Complete HTML & CSS basics",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Build your first React project",
  },
];

type EvidenceItem = {
  id: string;
  task_id: string;
  file_url: string;
  file_type: string;
  verification_status: string;
  uploaded_at: string;
};

export default function PortfolioPage() {
  const [user, setUser] = useState<User | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
      } else {
        setUser(data.user);
        loadEvidence(data.user.id);
      }
    }
    loadUser();
  }, [router]);

  async function loadEvidence(userId: string) {
    const { data, error } = await supabase
      .from("evidence")
      .select("*")
      .eq("user_id", userId);

    if (!error && data) {
      setEvidenceList(data as EvidenceItem[]);
    }
  }

  async function handleFileUpload(taskId: string, file: File) {
    if (!user) return;
    setUploadingTaskId(taskId);
    setMessage("");

    const filePath = `${user.id}/${taskId}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("evidence")
      .upload(filePath, file);

    if (uploadError) {
      setMessage(`Upload error: ${uploadError.message}`);
      setUploadingTaskId(null);
      return;
    }

    const { error: insertError } = await supabase.from("evidence").insert({
      task_id: taskId,
      user_id: user.id,
      file_url: filePath,
      file_type: file.type,
      verification_status: "pending",
    });

    if (insertError) {
      setMessage(`Database error: ${insertError.message}`);
    } else {
      setMessage("Evidence uploaded!");
      loadEvidence(user.id);
    }

    setUploadingTaskId(null);
  }

  function evidenceForTask(taskId: string) {
    return evidenceList.filter((e) => e.task_id === taskId);
  }

  if (!user) {
    return <p style={{ padding: "40px" }}>Loading...</p>;
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>Your Portfolio</h1>
      <p style={{ color: "#666" }}>
        Task list below is placeholder data until real roadmap tasks exist.
        Evidence upload is fully real — files go to Supabase Storage.
      </p>

      {message && <p style={{ marginTop: "12px" }}>{message}</p>}

      <div style={{ marginTop: "24px" }}>
        {mockTasks.map((task) => {
          const taskEvidence = evidenceForTask(task.id);

          return (
            <div
              key={task.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <strong>{task.title}</strong>

              <div style={{ marginTop: "12px" }}>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(task.id, file);
                  }}
                  disabled={uploadingTaskId === task.id}
                />
                {uploadingTaskId === task.id && <p>Uploading...</p>}
              </div>

              <div style={{ marginTop: "12px" }}>
                {taskEvidence.length === 0 ? (
                  <p style={{ color: "#999", fontSize: "14px" }}>
                    No evidence uploaded yet.
                  </p>
                ) : (
                  taskEvidence.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        fontSize: "14px",
                        padding: "8px",
                        background: "#f5f5f5",
                        marginTop: "6px",
                        borderRadius: "4px",
                      }}
                    >
                      {ev.file_type} — status:{" "}
                      <strong>{ev.verification_status}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
