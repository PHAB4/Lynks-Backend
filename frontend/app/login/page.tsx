"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        setMessage("Account created! Check your email to confirm.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        router.push("/dashboard");
      }
    }
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>{isSignUp ? "Sign up for Lynks" : "Log in to Lynks"}</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div style={{ marginTop: "12px" }}>
          <label>Password</label>
          <br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" style={{ marginTop: "16px" }}>
          {isSignUp ? "Sign up" : "Log in"}
        </button>
      </form>
      {message && <p style={{ marginTop: "16px" }}>{message}</p>}
      <p style={{ marginTop: "16px" }}>
        <button onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp
            ? "Already have an account? Log in"
            : "Need an account? Sign up"}
        </button>
      </p>
    </div>
  );
}
