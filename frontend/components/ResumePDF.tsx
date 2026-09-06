'use client'

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'
import type { ResumeData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

const styles = StyleSheet.create({
  page: {
    padding: '36pt',
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
    lineHeight: 1.4,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#000',
  },
  contact: {
    fontSize: 8.5,
    color: '#444',
    textAlign: 'center',
    marginTop: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    marginTop: 6,
    marginBottom: 10,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    paddingBottom: 2,
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#000',
  },
  itemSubtitle: {
    fontSize: 8,
    color: '#555',
    fontStyle: 'italic',
    marginTop: 1,
  },
  itemRight: {
    fontSize: 8,
    color: '#666',
    fontStyle: 'italic',
  },
  body: {
    fontSize: 8.5,
    color: '#333',
    marginTop: 1.5,
    lineHeight: 1.4,
  },
  bulletItem: {
    fontSize: 8.5,
    color: '#333',
    marginBottom: 1.5,
    paddingLeft: 10,
    position: 'relative',
  },
  inlineList: {
    fontSize: 8.5,
    color: '#333',
    lineHeight: 1.4,
  },
  objective: {
    fontSize: 8.5,
    color: '#333',
    lineHeight: 1.5,
  },
})

function ResumePDFContent({ data }: { data: ResumeData }) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <Text style={styles.name}>{data.name || 'Your Name'}</Text>
      <Text style={styles.contact}>
        {[data.address, data.phone, data.email].filter(Boolean).join('  |  ')}
      </Text>
      <View style={styles.divider} />

      {/* Objective */}
      {data.objective && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Objective</Text>
          <Text style={styles.objective}>{data.objective}</Text>
        </View>
      )}

      {/* Education */}
      {data.education?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Education</Text>
          {data.education.map((edu, i) => (
            <View key={i} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.itemTitle}>{edu.institution}</Text>
                {edu.details && <Text style={styles.itemRight}>{edu.details}</Text>}
              </View>
              <Text style={styles.itemSubtitle}>{edu.level}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Experience */}
      {data.experience?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {data.experience.map((exp, i) => (
            <View key={i} style={{ marginBottom: 5 }}>
              <Text style={styles.itemTitle}>{exp.title}</Text>
              <Text style={styles.itemSubtitle}>{exp.organization}</Text>
              {exp.description && <Text style={styles.body}>{exp.description}</Text>}
            </View>
          ))}
        </View>
      )}

      {/* Projects */}
      {data.projects?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projects</Text>
          {data.projects.map((proj, i) => (
            <View key={i} style={{ marginBottom: 4 }}>
              <Text style={styles.itemTitle}>{proj.title}</Text>
              {proj.description && <Text style={styles.body}>{proj.description}</Text>}
              {proj.skills_used?.length > 0 && (
                <Text style={{ ...styles.itemSubtitle, fontStyle: 'normal' }}>
                  Technologies: {Array.isArray(proj.skills_used) ? proj.skills_used.join(', ') : String(proj.skills_used)}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Skills */}
      {data.skills?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <Text style={styles.inlineList}>
            {Array.isArray(data.skills) ? data.skills.join(' · ') : String(data.skills)}
          </Text>
        </View>
      )}

      {/* Certifications */}
      {data.certifications?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Certifications</Text>
          {data.certifications.map((cert, i) => (
            <Text key={i} style={styles.bulletItem}>•  {cert}</Text>
          ))}
        </View>
      )}

      {/* Interests */}
      {data.interests?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <Text style={styles.inlineList}>{data.interests.join(' · ')}</Text>
        </View>
      )}

      {/* Custom Sections */}
      {data.custom_sections?.filter(s => s.title.trim() || s.content.trim()).map((section, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title || 'Untitled Section'}</Text>
          <Text style={styles.body}>{section.content}</Text>
        </View>
      ))}
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
