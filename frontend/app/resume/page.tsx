"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export default function ResumePage() {
  const [user, setUser] = useState<User | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
      loadResume(data.user.id);
    }
    loadUser();
  }, [router]);

  async function loadResume(userId: string) {
    const { data } = await supabase
      .from("resumes")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data && data.content) {
      setResumeText(data.content.text || "");
    }
  }

  function handleGenerate() {
    // Placeholder: pretend this pulled from completed tasks/portfolio.
    // Once the real AI endpoint exists, replace this with a real call.
    setResumeText(
      "PLACEHOLDER SUMMARY\n\nSkills: (auto-filled from completed tasks later)\n\nExperience:\n- Completed HTML & CSS basics\n- Built first React project",
    );
  }

  async function handleSave() {
    if (!user) return;
    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("resumes").upsert({
      user_id: user.id,
      content: { text: resumeText },
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Resume saved!");
    }
    setLoading(false);
  }

  if (!user) return <p style={{ padding: "40px" }}>Loading...</p>;

  return (
    <div style={{ padding: "40px" }}>
      <h1>Your Resume</h1>
      <p style={{ color: "#666" }}>
        "Generate" is placeholder for now. Saving and editing is fully real.
      </p>

      <button onClick={handleGenerate} style={{ marginTop: "12px" }}>
        Generate from Portfolio
      </button>

      <div style={{ marginTop: "20px" }}>
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          rows={16}
          style={{
            width: "100%",
            maxWidth: "600px",
            padding: "12px",
            fontFamily: "monospace",
          }}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        style={{ marginTop: "12px" }}
      >
        {loading ? "Saving..." : "Save Resume"}
      </button>

      {message && <p style={{ marginTop: "12px" }}>{message}</p>}
    </div>
  );
}
