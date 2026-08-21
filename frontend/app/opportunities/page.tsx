"use client";

import { useState } from "react";

type Opportunity = {
  id: string;
  title: string;
  company: string;
  location: string;
  pay: string;
  age_requirement: string;
  experience_required: string;
  url: string;
};

const mockOpportunities: Opportunity[] = [
  {
    id: "1",
    title: "Junior Frontend Developer",
    company: "Bright Labs",
    location: "Port of Spain, Trinidad",
    pay: "$4,500/month",
    age_requirement: "18+",
    experience_required: "0-1 years",
    url: "#",
  },
  {
    id: "2",
    title: "Software Engineering Intern",
    company: "Caribbean Tech Co.",
    location: "Remote",
    pay: "$2,000/month",
    age_requirement: "None",
    experience_required: "None",
    url: "#",
  },
  {
    id: "3",
    title: "React Developer",
    company: "Nexus Digital",
    location: "San Fernando, Trinidad",
    pay: "$7,000/month",
    age_requirement: "21+",
    experience_required: "2+ years",
    url: "#",
  },
];

export default function OpportunitiesPage() {
  const [locationFilter, setLocationFilter] = useState("");
  const [payFilter, setPayFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");

  const filtered = mockOpportunities.filter((op) => {
    const matchesLocation = locationFilter
      ? op.location.toLowerCase().includes(locationFilter.toLowerCase())
      : true;
    const matchesPay = payFilter
      ? op.pay.toLowerCase().includes(payFilter.toLowerCase())
      : true;
    const matchesExperience = experienceFilter
      ? op.experience_required
          .toLowerCase()
          .includes(experienceFilter.toLowerCase())
      : true;
    return matchesLocation && matchesPay && matchesExperience;
  });

  return (
    <div style={{ padding: "40px" }}>
      <h1>Opportunities</h1>
      <p style={{ color: "#666" }}>
        Placeholder listings for now, will connect to real job-board data once
        the backend endpoint exists.
      </p>

      <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
        <input
          placeholder="Filter by location"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
        />
        <input
          placeholder="Filter by pay"
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value)}
        />
        <input
          placeholder="Filter by experience"
          value={experienceFilter}
          onChange={(e) => setExperienceFilter(e.target.value)}
        />
      </div>

      <div style={{ marginTop: "24px" }}>
        {filtered.length === 0 ? (
          <p>No opportunities match your filters.</p>
        ) : (
          filtered.map((op) => (
            <div
              key={op.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "12px",
              }}
            >
              <strong>{op.title}</strong>
              <p style={{ margin: "4px 0" }}>
                {op.company} - {op.location}
              </p>
              <p style={{ margin: "4px 0", fontSize: "14px", color: "#555" }}>
                Pay: {op.pay} | Age: {op.age_requirement} | Experience:{" "}
                {op.experience_required}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
