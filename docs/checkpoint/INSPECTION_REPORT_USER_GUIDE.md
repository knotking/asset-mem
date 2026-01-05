# Inspection Report Checkpoints - User Guide

## Overview

Inspection Report Checkpoints allow you to upload professional inspection documents (PDFs, images, Word docs) alongside your regular photo and video checkpoints. The AI automatically extracts findings, issues, and recommendations from these reports, making them searchable and queryable through the checkpoint chat.

## What Are Inspection Reports?

Inspection reports are professional assessments of your property or assets. Examples include:

### Real Estate
- **Home Inspection Reports**: Pre-purchase or annual home inspections
- **Contractor Assessments**: Evaluations from contractors for repairs or renovations
- **Pest Inspections**: Termite or pest control inspection reports
- **Roof Certifications**: Professional roof condition assessments
- **Energy Audits**: Home energy efficiency reports
- **Appraisals**: Property valuation reports

### Vehicle
- **Pre-Purchase Inspections**: Mechanic's assessment before buying a used car
- **Emissions Test Reports**: State-required emissions testing results
- **Maintenance Records**: Service history and maintenance logs
- **Diagnostic Reports**: Computer diagnostic results
- **Accident Assessments**: Post-accident damage evaluations

### Appliance
- **Warranty Inspections**: Manufacturer warranty inspection reports
- **Repair Assessments**: Technician evaluation reports
- **Maintenance Logs**: Regular service and maintenance records
- **Safety Certifications**: Safety inspection certificates

## How to Upload an Inspection Report

### Mobile App (iOS/Android)

1. **Open Your Property**
   - Navigate to the property where you want to add the report

2. **Go to Checkpoints Tab**
   - Tap the "Checkpoints" tab at the bottom

3. **Create New Checkpoint**
   - Tap the "+" or "Create Checkpoint" button
   - A selection modal will appear

4. **Choose "Inspection Report"**
   - Tap "Inspection Report" (shows document icon)
   - The inspection report upload screen will open

5. **Upload Your Document**
   - Tap "Select Document" button
   - Choose your file (PDF, image, or Word doc)
   - File preview will show name and size

6. **Fill in Details**
   - **Name**: Give your checkpoint a descriptive name (e.g., "Annual Home Inspection 2025")
   - **Asset Type**: Select Real Estate, Vehicle, Appliance, or Other
   - **Report Type**: Choose the specific type (e.g., "Home Inspection")
   - **Location**: Select location or enter custom (e.g., "Whole Property", "Kitchen")
   - **Inspector Name** (Optional): Enter inspector's name if known

7. **Create Checkpoint**
   - Tap "Create Checkpoint" button
   - Processing modal shows AI analysis progress
   - Report appears in your timeline with document icon

### Web App

1. **Open Your Property**
   - Navigate to the property page

2. **Go to Checkpoints Section**
   - Click on the "Checkpoints" tab

3. **Create New Checkpoint**
   - Click "Create Checkpoint" button
   - Dialog opens with two tabs at top

4. **Switch to "Inspection Report"**
   - Click the "Inspection Report" tab (document icon)
   - Form changes to show report upload fields

5. **Upload Your Document**
   - Click "Choose File" or drag document to upload area
   - Select your file (PDF, image, or Word doc)
   - File preview shows name and size

6. **Fill in Details**
   - **Name**: Enter descriptive name
   - **Asset Type**: Select from dropdown
   - **Report Type**: Choose specific type
   - **Location**: Select or leave blank for auto-detect
   - **Inspector Name** (Optional): Enter if known

7. **Create Checkpoint**
   - Click "Create Checkpoint" button
   - Processing dialog shows analysis status
   - Report appears in checkpoint list

## What Happens After Upload?

### 1. AI Analysis (Automatic)

The AI analyzes your inspection report and extracts:

- **Inspector Information**: Name and company (if mentioned)
- **Inspection Date**: When the inspection was performed
- **Overall Condition**: Assessment rating (Excellent/Good/Fair/Poor/Critical)
- **Summary**: Concise overview of key findings
- **Issues Found**: All issues categorized by severity:
  - **Critical**: Immediate safety hazards, structural failures
  - **Major**: Significant defects requiring prompt attention
  - **Moderate**: Issues that should be addressed soon
  - **Minor**: Small defects, cosmetic issues
- **Recommendations**: Inspector's suggested actions
- **Cost Estimates**: Repair costs (if mentioned in report)

### 2. Integration with Property Insights

Report findings automatically contribute to:

- **Overall Condition Score**: Affects your property's 0-100 score
- **Issue Tracking**: Issues counted by severity
- **Trend Analysis**: Changes tracked over time
- **Timeline View**: Report appears alongside photo checkpoints

### 3. Searchable via Chat

You can ask questions about your reports:

**Example Questions:**
- "What critical issues were found in my home inspection?"
- "Show me all the major issues from my last vehicle inspection"
- "What did the inspector recommend for the roof?"
- "How much will it cost to fix the plumbing issues?"
- "What issues were found in the kitchen?"
- "Compare my last two inspection reports"

## Viewing Inspection Reports

### In Timeline View

- Reports appear with a **document icon** instead of photo thumbnail
- Shows checkpoint name and date
- Displays "Report" badge
- Click/tap to view full details

### In Detail View

When you open a report checkpoint, you'll see:

- **Report Information**:
  - Inspector name (if extracted)
  - Inspection date (if extracted)
  - Report type
  - Document download link

- **AI Analysis**:
  - Overall condition assessment
  - Summary of findings
  - List of detected items
  - Issues grouped by severity
  - Recommendations
  - Cost estimates (if available)

- **Actions**:
  - Download original report
  - Share with others
  - Ask questions via chat
  - Compare with other checkpoints

## Best Practices

### 1. Naming Convention

Use descriptive names that include:
- Type of inspection
- Date or frequency
- Specific focus area (if applicable)

**Good Examples:**
- "Annual Home Inspection - Jan 2025"
- "Pre-Purchase Vehicle Inspection"
- "HVAC Maintenance Report - Winter 2025"
- "Roof Certification - Storm Damage Assessment"

**Avoid:**
- "Report 1"
- "Inspection"
- "Document"

### 2. Upload Timing

Upload reports as soon as you receive them:
- Captures condition at specific point in time
- Enables trend tracking
- Provides context for future issues
- Creates complete property history

### 3. Combine with Photos

For best results, combine reports with photos:
1. Upload inspection report
2. Take photos of specific issues mentioned
3. Link them by using same location/date
4. Ask chat to correlate findings

### 4. Regular Updates

Create a schedule:
- **Annual**: Home inspections, vehicle inspections
- **Seasonal**: HVAC maintenance, roof checks
- **As Needed**: Contractor assessments, repair reports
- **Pre-Sale**: Pre-listing inspections, appraisals

## Supported File Formats

### PDF Documents
- Most common format for professional reports
- Best for multi-page documents
- Preserves formatting and images
- **Recommended format**

### Images (JPG, PNG)
- Good for scanned paper reports
- Photos of report pages
- Single-page documents
- Quick mobile uploads

### Word Documents (.doc, .docx)
- Editable inspection reports
- Contractor assessments
- Custom reports

### File Size Limits
- Maximum file size: 50 MB
- Larger files may take longer to analyze
- Consider splitting very large reports

## Privacy & Security

### Data Storage
- Reports stored securely in Firebase Storage
- Encrypted at rest and in transit
- Only accessible by property owner
- Can be deleted at any time

### AI Analysis
- Processed using Google Gemini AI
- No data shared with third parties
- Analysis results stored in your account
- Original document always preserved

### Sharing
- Reports can be shared with specific users
- Time-limited access for contractors
- Revoke access at any time
- Audit trail of who accessed what

## Troubleshooting

### Report Not Uploading

**Problem**: File won't upload or upload fails

**Solutions**:
1. Check file size (must be under 50 MB)
2. Verify file format (PDF, image, or Word doc)
3. Check internet connection
4. Try a different browser/device
5. Compress large PDF files

### AI Analysis Failed

**Problem**: Report uploaded but analysis shows "Failed"

**Solutions**:
1. Verify document is readable (not corrupted)
2. Ensure text is not too small or blurry
3. Check if document is password-protected (remove protection)
4. Try re-uploading the document
5. Contact support if issue persists

### Missing Information

**Problem**: AI didn't extract all information

**Solutions**:
1. Manually enter inspector name if not detected
2. Check if information is actually in the report
3. Ensure text is clear and readable
4. Some handwritten reports may not extract well
5. You can still view the original document

### Can't Find Report in Chat

**Problem**: Chat doesn't return report findings

**Solutions**:
1. Wait for analysis to complete (check status)
2. Use specific keywords from the report
3. Try rephrasing your question
4. Verify report analysis succeeded
5. Check you're in the correct property

## Tips for Better Results

### 1. High-Quality Documents
- Use clear, readable PDFs
- Avoid heavily compressed images
- Ensure text is not too small
- Remove password protection

### 2. Complete Reports
- Upload full reports, not excerpts
- Include all pages
- Keep attachments with main report
- Don't crop important sections

### 3. Descriptive Metadata
- Fill in inspector name if known
- Select accurate report type
- Specify location when relevant
- Add context in checkpoint name

### 4. Regular Maintenance
- Review reports periodically
- Update status of fixed issues
- Add follow-up photos
- Track repair completion

## Frequently Asked Questions

**Q: Can I upload multiple reports at once?**
A: Currently, upload one report per checkpoint. You can create multiple checkpoints quickly.

**Q: What if my report is handwritten?**
A: AI works best with typed text. Handwritten reports may have lower extraction accuracy, but you can still view the original document.

**Q: Can I edit the extracted information?**
A: The AI analysis is read-only, but you can add notes and descriptions to the checkpoint.

**Q: How long does analysis take?**
A: Usually 30-60 seconds. Complex or large reports may take up to 2-3 minutes.

**Q: Can I delete a report after uploading?**
A: Yes, delete the checkpoint to remove the report and all associated data.

**Q: Will reports show up in property insights?**
A: Yes! Report findings contribute to overall condition scores and issue tracking.

**Q: Can I share reports with contractors?**
A: Yes, use the share feature to give time-limited access to specific users.

**Q: What happens to old reports?**
A: They remain in your timeline indefinitely unless you delete them. Great for historical tracking!

**Q: Can I download the original report later?**
A: Yes, the original document is always available for download from the checkpoint detail view.

**Q: Does this work offline?**
A: Upload requires internet connection. Once uploaded, you can view reports offline (mobile app).

## Getting Help

If you encounter issues or have questions:

1. **In-App Help**: Tap the help icon in the app
2. **Documentation**: Visit our help center
3. **Support**: Contact support@homeapp.com
4. **Community**: Join our user forum

## Summary

Inspection Report Checkpoints transform professional inspection documents into actionable insights. By uploading reports alongside photos, you create a comprehensive property history that's searchable, analyzable, and always accessible. The AI does the heavy lifting of extracting findings, while you maintain complete control over your property data.

Start uploading your inspection reports today to unlock the full power of AI-driven property management!

