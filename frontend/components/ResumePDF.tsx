'use client'

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Font } from '@react-pdf/renderer'
import type { ResumeData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'Helvetica' },
    { src: 'Helvetica-Bold', fontWeight: 'bold' },
  ],
})

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { marginBottom: 20, paddingBottom: 15, borderBottomWidth: 2, borderBottomColor: '#6B26EA' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#6B26EA' },
  email: { fontSize: 10, color: '#666', marginTop: 4 },
  objective: { fontSize: 10, color: '#444', marginTop: 10, lineHeight: 1.5 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#6B26EA', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: '#EDE3FF' },
  itemTitle: { fontSize: 10, fontWeight: 'bold', color: '#1a1a1a' },
  itemSubtitle: { fontSize: 9, color: '#6B26EA', marginTop: 2 },
  itemDescription: { fontSize: 9, color: '#555', marginTop: 3, lineHeight: 1.4 },
  skillsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  skill: { fontSize: 9, color: '#6B26EA', backgroundColor: '#F5F0FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  listItem: { fontSize: 9, color: '#444', marginBottom: 3, marginLeft: 10 },
  projectSkill: { fontSize: 8, color: '#666', backgroundColor: '#f5f5f5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
})

function ResumePDFContent({ data }: { data: ResumeData }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.name}>{data.name}</Text>
        <Text style={styles.email}>{data.email}</Text>
        {data.objective && <Text style={styles.objective}>{data.objective}</Text>}
      </View>

      {data.skills?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.skillsContainer}>
            {data.skills.map((skill, i) => (
              <Text key={i} style={styles.skill}>{skill}</Text>
            ))}
          </View>
        </View>
      )}

      {data.education?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Education</Text>
          {data.education.map((edu, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={styles.itemTitle}>{edu.institution}</Text>
              <Text style={styles.itemSubtitle}>{edu.level}</Text>
              {edu.details && <Text style={styles.itemDescription}>{edu.details}</Text>}
            </View>
          ))}
        </View>
      )}

      {data.experience?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {data.experience.map((exp, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={styles.itemTitle}>{exp.title}</Text>
              <Text style={styles.itemSubtitle}>{exp.organization}</Text>
              {exp.description && <Text style={styles.itemDescription}>{exp.description}</Text>}
            </View>
          ))}
        </View>
      )}

      {data.projects?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projects</Text>
          {data.projects.map((proj, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text style={styles.itemTitle}>{proj.title}</Text>
              {proj.description && <Text style={styles.itemDescription}>{proj.description}</Text>}
              {proj.skills_used?.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {proj.skills_used.map((s, j) => (
                    <Text key={j} style={styles.projectSkill}>{s}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {data.certifications?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Certifications</Text>
          {data.certifications.map((cert, i) => (
            <Text key={i} style={styles.listItem}>• {cert}</Text>
          ))}
        </View>
      )}

      {data.interests?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.skillsContainer}>
            {data.interests.map((interest, i) => (
              <Text key={i} style={{ ...styles.skill, color: '#555', backgroundColor: '#f5f5f5' }}>{interest}</Text>
            ))}
          </View>
        </View>
      )}
    </Page>
  )
}

export function ResumePDFDownload({ data }: { data: ResumeData }) {
  const fileName = `lynks-resume-${new Date().toISOString().split('T')[0]}.pdf`

  return (
    <PDFDownloadLink
      document={<ResumePDFContent data={data} />}
      fileName={fileName}
    >
      {({ loading }) => (
        <Button variant="outline" className="border-[#EDE3FF] text-[#6B26EA] hover:bg-[#F5F0FF]" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Download PDF
        </Button>
      )}
    </PDFDownloadLink>
  )
}
