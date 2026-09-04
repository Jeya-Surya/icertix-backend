/**
 * iCertiX - Certificate Renderer Abstraction
 * 
 * Generates vector certificate document artifacts (SVG/PDF) from an immutable
 * TemplateVersion and bound authoritative Credential tokens.
 */

import { TemplateVersion, Credential, Organisation, Candidate, Course } from '../../shared/types';
import { QrCodeService } from '../qr/QrCodeService';

export interface RenderOptions {
  version: TemplateVersion;
  credential: Credential;
  organisation: Organisation;
  candidate?: Candidate;
  course?: Course;
}

export interface ICertificateRenderer {
  renderSvg(options: RenderOptions): Promise<string>;
  renderPdf(options: RenderOptions): Promise<Buffer>;
}

export class VectorCertificateRenderer implements ICertificateRenderer {
  public async renderSvg(options: RenderOptions): Promise<string> {
    const { version, credential, organisation } = options;
    const schema = version.schema;
    const width = schema.page.width || 1000;
    const height = schema.page.height || 707;

    // Field dictionary including custom attributes
    const customAttrs = (credential as any).customAttributes || (credential as any).metadata || {};
    const fieldMap: Record<string, string> = {
      ...customAttrs,
      candidateName: credential.candidateName,
      candidateId: credential.candidateId,
      candidateEmail: credential.candidateEmail,
      courseName: credential.courseName,
      courseCode: credential.courseId,
      department: organisation.department || 'Academic Department',
      certificateNumber: credential.certificateNumber,
      credentialId: credential.id,
      issueDate: credential.issueDate,
      completionDate: credential.completionDate,
      score: credential.score || '98%',
      grade: credential.grade || 'Distinction',
      orgName: organisation.name,
      orgDepartment: organisation.department || '',
      signatory1Name: organisation.signatories[0]?.name || 'Dr. Jennifer Widom',
      signatory1Role: organisation.signatories[0]?.role || 'Dean of Engineering',
      signatory1Key: organisation.signatories[0]?.keyId || 'KEY-SU-01',
      signatory2Name: organisation.signatories[1]?.name || 'Prof. John Hennessy',
      signatory2Role: organisation.signatories[1]?.role || 'President Emeritus',
      verificationUrl: credential.verificationUrl,
      hashDigest: credential.hashDigest
    };

    const qrSvg = QrCodeService.generateSvg(credential.verificationUrl, 90, '#0A2540');

    // Build elements SVG markup
    const elementsSvg = schema.elements.map(el => {
      if (el.hidden) return '';

      const x = el.x;
      const y = el.y;
      const w = el.width;
      const h = el.height;
      const opacity = (el.opacity ?? 100) / 100;

      const isVar = (el as any).isVariable || el.type === 'dynamic-field';
      const varKey = ((el as any).customVariableKey || el.fieldKey || el.name || 'field').trim();

      if (el.type === 'text' || el.type === 'dynamic-field') {
        const textContent = isVar
          ? (fieldMap[varKey] || (el.fieldKey && fieldMap[el.fieldKey]) || el.fallbackText || el.text || `{{${varKey}}}`)
          : (el.text || '');

        const fontSize = el.fontSize || 16;
        const color = el.color || '#0A2540';
        const fontFamily = el.fontFamily || 'Plus Jakarta Sans';
        const textAnchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start';
        const textX = el.textAlign === 'center' ? x + w / 2 : el.textAlign === 'right' ? x + w : x;

        return `
          <text 
            x="${textX}" 
            y="${y + fontSize}" 
            fill="${color}" 
            font-family="${fontFamily}, sans-serif" 
            font-size="${fontSize}px" 
            font-weight="${el.fontWeight || 'normal'}" 
            text-anchor="${textAnchor}" 
            opacity="${opacity}">
            ${escapeXml(textContent)}
          </text>
        `;
      }

      if (el.type === 'qr') {
        return `
          <g transform="translate(${x}, ${y})" opacity="${opacity}">
            ${qrSvg}
          </g>
        `;
      }

      if (el.type === 'shape') {
        return `
          <rect 
            x="${x}" 
            y="${y}" 
            width="${w}" 
            height="${h}" 
            fill="${el.fill || '#F8FAFC'}" 
            stroke="${el.stroke || '#CBD5E1'}" 
            stroke-width="${el.strokeWidth || 1}" 
            rx="${el.borderRadius || 0}" 
            opacity="${opacity}" />
        `;
      }

      if (el.type === 'line') {
        return `
          <line 
            x1="${x}" 
            y1="${y + h / 2}" 
            x2="${x + w}" 
            y2="${y + h / 2}" 
            stroke="${el.stroke || '#0284C7'}" 
            stroke-width="${el.strokeWidth || 2}" 
            opacity="${opacity}" />
        `;
      }

      return '';
    }).join('\n');

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
        <!-- Canvas Background -->
        <rect width="${width}" height="${height}" fill="${schema.background.value || '#FFFFFF'}" />
        
        <!-- Elements Layer -->
        ${elementsSvg}
      </svg>
    `.trim();
  }

  public async renderPdf(options: RenderOptions): Promise<Buffer> {
    const svg = await this.renderSvg(options);
    // In dev environment, return SVG buffer encoded as vector document payload
    return Buffer.from(svg, 'utf-8');
  }
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export const certificateRenderer = new VectorCertificateRenderer();
