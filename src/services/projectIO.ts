import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { Project } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoadedProject {
  project: Project
  pgmSources: Record<string, string>
  reactionFiles: Record<string, string>
}

// ─── ProjectIO ────────────────────────────────────────────────────────────────

class ProjectIO {
  /**
   * Save project to a .fsim ZIP file and trigger browser download.
   */
  async saveProject(
    project: Project,
    pgmSources: Record<string, string>,
    reactionFiles: Record<string, string>,
  ): Promise<void> {
    const zip = new JSZip()

    // project.json — main project data
    zip.file('project.json', JSON.stringify(project, null, 2))

    // PGM scripts: controls/{filename}
    for (const [filename, source] of Object.entries(pgmSources)) {
      zip.file(`controls/${filename}`, source)
    }

    // Reaction files: reactions/{filename}
    for (const [filename, content] of Object.entries(reactionFiles)) {
      zip.file(`reactions/${filename}`, content)
    }

    // config/species.json — selected species ID list
    zip.file('config/species.json', JSON.stringify(project.selectedSpecies, null, 2))

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    const filename = `${project.name.replace(/[^a-zA-Z0-9_\- ]/g, '_')}.fsim`
    saveAs(blob, filename)
  }

  /**
   * Load a project from a .fsim ZIP file.
   */
  async loadProject(file: File): Promise<LoadedProject> {
    const zip = await JSZip.loadAsync(file)

    // Parse project.json
    const projectJson = await zip.file('project.json')?.async('string')
    if (!projectJson) throw new Error('Invalid .fsim file: missing project.json')
    const project = JSON.parse(projectJson) as Project

    // Load PGM scripts from controls/
    const pgmSources: Record<string, string> = {}
    for (const [path, entry] of Object.entries(zip.files)) {
      if (path.startsWith('controls/') && !entry.dir) {
        const name = path.replace('controls/', '')
        if (name) pgmSources[name] = await entry.async('string')
      }
    }

    // Load reaction files from reactions/
    const reactionFiles: Record<string, string> = {}
    for (const [path, entry] of Object.entries(zip.files)) {
      if (path.startsWith('reactions/') && !entry.dir) {
        const name = path.replace('reactions/', '')
        if (name) reactionFiles[name] = await entry.async('string')
      }
    }

    return { project, pgmSources, reactionFiles }
  }
}

export const projectIO = new ProjectIO()
