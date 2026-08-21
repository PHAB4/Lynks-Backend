"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function OnboardingPage() {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [careerPath, setCareerPath] = useState("");
  const [interests, setInterests] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("users").upsert({
      id: userData.user.id,
      email: userData.user.email,
      username,
      name,
      age: Number(age),
      country,
      education_level: educationLevel,
      career_path: careerPath,
      interests: interests
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean),
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>Tell us about yourself</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Username</label>
          <br />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label>Full name</label>
          <br />
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label>Age</label>
          <br />
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label>Country</label>
          <br />
          <input value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label>Education level</label>
          <br />
          <input
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label>Career path</label>
          <br />
          <input
            value={careerPath}
            onChange={(e) => setCareerPath(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label>Interests (comma-separated)</label>
          <br />
          <input
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </div>
        <button type="submit" style={{ marginTop: "16px" }}>
          Continue
        </button>
      </form>
      {message && <p style={{ marginTop: "16px" }}>{message}</p>}
    </div>
  );
}
