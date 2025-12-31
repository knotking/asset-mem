# Property Document Image Testing Guide

## Overview
This document provides a comprehensive testing guide for the property document image capture and analysis feature. The infrastructure is already in place and supports camera-captured images for property documents.

## Test Scenarios

### 1. Mobile App Testing (React Native)

#### Test Case 1.1: Camera Capture - Property Deed
**Steps:**
1. Open the mobile app
2. Tap "Add Property" button
3. In the Add Property Modal, tap "Take Photo"
4. Grant camera permissions if prompted
5. Take a photo of a property deed document
6. Verify the image appears in the selected files list
7. Tap "Upload X documents" button
8. Navigate to the property details page

**Expected Results:**
- ✅ Image captured successfully with MIME type `image/jpeg`
- ✅ Image appears in selected files list with file name
- ✅ Property created in Firestore
- ✅ Image uploaded to Firebase Storage at `documents/{userId}/{timestamp}_{filename}`
- ✅ Document record created in Firestore `docs` collection
- ✅ AI analysis extracts:
  - Document Type: `DEED`
  - Property Address: Full normalized address
  - Key Entities: 2-3 relevant entities (e.g., parcel number, deed date)
  - Summary: One-sentence description
- ✅ Property address auto-updated from "Processing..." to extracted address

#### Test Case 1.2: Camera Capture - Insurance Policy
**Steps:**
1. Navigate to existing property
2. Go to Documents tab
3. Tap "Upload Documents"
4. Tap "Take Photo"
5. Capture insurance policy document
6. Upload the document

**Expected Results:**
- ✅ Document Type: `INSURANCE_POLICY`
- ✅ Key Entities: Policy number, provider, coverage amount
- ✅ Property address extracted and matched

#### Test Case 1.3: Camera Capture - Utility Bill
**Steps:**
1. Create new property via camera capture
2. Take photo of utility bill (electric, gas, water)
3. Upload and analyze

**Expected Results:**
- ✅ Document Type: `UTILITY_BILL`
- ✅ Property address extracted from bill
- ✅ Key Entities: Account number, billing period, amount due

#### Test Case 1.4: Multiple Images
**Steps:**
1. Open Add Property Modal
2. Take photo of first document
3. Take photo of second document
4. Take photo of third document
5. Verify all 3 images in selected files list
6. Upload all documents

**Expected Results:**
- ✅ All 3 images uploaded successfully
- ✅ Each analyzed independently
- ✅ Property address updated from first valid address found

### 2. Web App Testing (Next.js)

#### Test Case 2.1: Webcam Capture - Property Document
**Steps:**
1. Navigate to `/home/properties/new-property/details`
2. Upload dialog opens automatically
3. Click "Take Photo" button
4. Grant camera permissions if prompted
5. Position document in front of webcam
6. Click "Take photo" button
7. Verify image added to upload queue
8. Click "Upload X Documents"

**Expected Results:**
- ✅ Camera dialog opens with video preview
- ✅ Photo captured as `image/jpeg` with quality 0.92
- ✅ File created with name `homeapp-photo-{timestamp}.jpg`
- ✅ Image uploaded to Firebase Storage
- ✅ AI analysis completes successfully
- ✅ Property created with extracted address

#### Test Case 2.2: Camera Switch
**Steps:**
1. Open camera capture dialog
2. Click "Switch camera" button
3. Verify camera switches between front and rear (if available)
4. Capture photo with rear camera
5. Upload and analyze

**Expected Results:**
- ✅ Camera switches successfully
- ✅ Photo captured from selected camera
- ✅ Analysis works regardless of camera used

#### Test Case 2.3: Existing Property - Add Document
**Steps:**
1. Navigate to existing property
2. Go to Documents tab
3. Click "Upload Documents"
4. Click "Take Photo"
5. Capture property document
6. Upload

**Expected Results:**
- ✅ Document uploaded to existing property
- ✅ Address confirmation dialog appears if address differs
- ✅ User can accept or reject address update

### 3. Image Quality Testing

#### Test Case 3.1: High Quality Image (> 2MB)
**Test:** Capture high-resolution document image
**Expected:** Upload succeeds, analysis accurate

#### Test Case 3.2: Low Quality Image (< 100KB)
**Test:** Capture low-resolution or compressed image
**Expected:** Upload succeeds, analysis may be less accurate but doesn't fail

#### Test Case 3.3: Blurry Image
**Test:** Capture intentionally blurry document
**Expected:** Upload succeeds, analysis returns "N/A" for unreadable fields

#### Test Case 3.4: Partial Document
**Test:** Capture only part of document (e.g., top half)
**Expected:** Analysis extracts available information, marks missing fields as "N/A"

#### Test Case 3.5: Poor Lighting
**Test:** Capture document in dim lighting
**Expected:** Upload succeeds, Gemini AI attempts extraction with available quality

### 4. Document Type Testing

#### Test Case 4.1: Property Deed
**Expected Document Type:** `DEED`
**Key Entities:** Parcel number, deed date, grantor/grantee

#### Test Case 4.2: Insurance Policy
**Expected Document Type:** `INSURANCE_POLICY`
**Key Entities:** Policy number, provider, coverage amount

#### Test Case 4.3: Utility Bill
**Expected Document Type:** `UTILITY_BILL`
**Key Entities:** Account number, billing period, amount

#### Test Case 4.4: Inspection Report
**Expected Document Type:** `INSPECTION_REPORT`
**Key Entities:** Inspector name, inspection date, major findings

#### Test Case 4.5: Mortgage Statement
**Expected Document Type:** `MORTGAGE_STATEMENT`
**Key Entities:** Loan number, lender, payment amount

#### Test Case 4.6: Unrecognized Document
**Expected Document Type:** `OTHER`
**Key Entities:** Any identifiable information

### 5. Error Handling Testing

#### Test Case 5.1: Camera Permission Denied
**Steps:**
1. Deny camera permissions
2. Attempt to take photo

**Expected Results:**
- ✅ Error message displayed: "Unable to access camera"
- ✅ User can still choose files from device
- ✅ No app crash

#### Test Case 5.2: Network Failure During Upload
**Steps:**
1. Capture image
2. Disable network
3. Attempt upload

**Expected Results:**
- ✅ Upload fails gracefully
- ✅ Error message displayed
- ✅ Document status set to "failed"
- ✅ User can retry

#### Test Case 5.3: AI Analysis Failure
**Steps:**
1. Upload image successfully
2. Simulate AI service failure

**Expected Results:**
- ✅ Document uploaded to storage
- ✅ Document record created with status "failed"
- ✅ Summary shows "Analysis failed"
- ✅ Property address not updated

### 6. Performance Testing

#### Test Case 6.1: Upload Speed
**Metric:** Time from capture to storage upload complete
**Target:** < 5 seconds for typical image (1-2MB)

#### Test Case 6.2: Analysis Speed
**Metric:** Time from upload complete to analysis results
**Target:** < 10 seconds for typical document image

#### Test Case 6.3: Multiple Concurrent Uploads
**Test:** Upload 5 images simultaneously
**Expected:** All uploads process in parallel without blocking

### 7. Cross-Platform Testing

#### Test Case 7.1: iOS Mobile
- Test on iPhone (iOS 15+)
- Verify camera capture works
- Verify image quality settings (0.8 quality)
- Verify upload to Firebase Storage

#### Test Case 7.2: Android Mobile
- Test on Android device (Android 10+)
- Verify camera capture works
- Verify MIME type handling
- Verify upload pipeline

#### Test Case 7.3: Desktop Web (Chrome)
- Test webcam capture
- Verify canvas-based image capture
- Verify JPEG quality (0.92)

#### Test Case 7.4: Desktop Web (Safari)
- Test webcam capture
- Verify compatibility
- Test camera switching

#### Test Case 7.5: Desktop Web (Firefox)
- Test webcam capture
- Verify MediaRecorder API compatibility

## Verification Checklist

### Mobile App (React Native)
- [ ] Camera permissions requested and handled
- [ ] Image captured with correct MIME type (`image/jpeg`)
- [ ] Image quality set to 0.8
- [ ] Image added to selected files list
- [ ] Image uploaded to Firebase Storage
- [ ] Document record created in Firestore
- [ ] AI analysis triggered with gsURI
- [ ] Analysis results saved to Firestore
- [ ] Property address auto-updated
- [ ] Error handling works correctly

### Web App (Next.js)
- [ ] Camera dialog opens correctly
- [ ] Video preview displays
- [ ] Camera switching works (if multiple cameras)
- [ ] Photo captured as JPEG with 0.92 quality
- [ ] File object created correctly
- [ ] Image uploaded to Firebase Storage
- [ ] AI analysis via Genkit works
- [ ] Address confirmation dialog works
- [ ] Error handling works correctly

### Backend (GCP)
- [ ] Document service accepts image MIME types
- [ ] Gemini 2.5 Flash processes images
- [ ] Response schema validation works
- [ ] Fallback handling on analysis failure
- [ ] Logging captures relevant information

## Known Limitations

1. **Image Quality:** Very low quality or extremely blurry images may result in incomplete extraction
2. **Handwritten Documents:** AI may struggle with handwritten text
3. **Multi-Page Documents:** Single image capture only captures one page
4. **File Size:** Large images (> 10MB) may take longer to upload
5. **Browser Compatibility:** Video recording not supported in all browsers (photos work everywhere)

## Success Metrics

- ✅ **Upload Success Rate:** > 99% for valid images
- ✅ **Analysis Accuracy:** > 90% for clear, well-lit documents
- ✅ **Address Extraction Rate:** > 85% for documents containing addresses
- ✅ **End-to-End Time:** < 15 seconds from capture to analysis complete
- ✅ **Error Recovery:** All errors handled gracefully without app crashes

## Testing Tools

### Manual Testing
- Use real property documents (deeds, insurance policies, bills)
- Test with various lighting conditions
- Test with different camera qualities

### Automated Testing (Future)
- Unit tests for file conversion logic
- Integration tests for upload pipeline
- E2E tests for complete flow

## Conclusion

The property document image capture and analysis feature is **fully implemented** and ready for testing. The infrastructure supports:
- Camera capture on both mobile and web
- Image upload to Firebase Storage
- AI-powered document analysis via Gemini
- Automatic property address extraction and updates
- Comprehensive error handling

All code paths have been verified to handle image files correctly, with proper MIME type handling throughout the stack.

