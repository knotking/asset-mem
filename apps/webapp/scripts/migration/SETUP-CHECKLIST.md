# Firebase Project Setup Checklist

Before running the migration scripts, complete these manual setup steps in the Firebase Console.

## ⚠️ Important: Manual Setup Required

The migration scripts **cannot** automatically configure Firebase services. You must complete these steps manually in the Firebase Console first.

---

## Step 1: Access Firebase Console

Open: [https://console.firebase.google.com/](https://console.firebase.google.com/)

Select project: **homegeek-staging**

---

## Step 2: Enable Firebase Authentication

### 2.1 Initialize Authentication

1. Click **Authentication** in left sidebar
2. Click **Get Started** button
3. Wait for initialization to complete

### 2.2 Enable Email/Password Provider

1. Click **Sign-in method** tab
2. Click **Email/Password** row
3. Toggle **Enable** switch to ON
4. Click **Save**

**Status:** [ ] Completed

### 2.3 Enable Google OAuth Provider

1. Click **Sign-in method** tab
2. Click **Google** row
3. Toggle **Enable** switch to ON
4. Enter your support email
5. Click **Save**
6. **Important:** Copy the **Web client ID** shown (format: `321433914812-xxxxx.apps.googleusercontent.com`)
   - You already have this: `321433914812-898vs8tgasfvko1c9o71cdk0tosph570.apps.googleusercontent.com`

**Status:** [ ] Completed
**Web Client ID:** `321433914812-898vs8tgasfvko1c9o71cdk0tosph570.apps.googleusercontent.com`

### 2.4 Configure Authorized Domains

1. Click **Settings** tab (within Authentication)
2. Scroll to **Authorized domains** section
3. Add these domains:
   - [ ] `localhost`
   - [ ] `homegeek-staging.firebaseapp.com` (should be there by default)
   - [ ] `homegeek-staging.web.app` (should be there by default)
   - [ ] Add any custom domains you use

**Status:** [ ] Completed

---

## Step 3: Create Cloud Firestore Database

### 3.1 Initialize Firestore

1. Click **Firestore Database** in left sidebar
2. Click **Create database** button
3. Select **Production mode** (we'll deploy rules later)
4. Click **Next**

### 3.2 Choose Location

1. Select location: **us-central1** (Iowa)
   - ⚠️ Important: Use the same location as your goggle-gab database
   - Location cannot be changed later!
2. Click **Enable**
3. Wait for database creation (may take 1-2 minutes)

**Status:** [ ] Completed
**Location:** us-central1

---

## Step 4: Create Firebase Storage

### 4.1 Initialize Storage

1. Click **Storage** in left sidebar
2. Click **Get started** button
3. Click **Next** on the security rules screen (we'll deploy rules later)

### 4.2 Choose Location

1. Select location: **us-central1** (Iowa)
   - ⚠️ Use the same location as Firestore
2. Click **Done**
3. Wait for bucket creation

**Status:** [ ] Completed
**Bucket:** `homegeek-staging.firebasestorage.app`

---

## Step 5: Register Web App (if not already done)

### 5.1 Check Existing Apps

1. Click **Project settings** (gear icon) in left sidebar
2. Scroll to **Your apps** section
3. Check if a web app already exists

### 5.2 Register New Web App (if needed)

If no web app exists:

1. Click **Add app** button
2. Click **Web** icon (`</>`)
3. App nickname: `HomeApp Web`
4. Check **"Also set up Firebase Hosting"** (optional)
5. Click **Register app**
6. Copy the Firebase configuration (you already have this)
7. Click **Continue to console**

**Status:** [ ] Completed
**App ID:** `1:321433914812:web:d30bdb093dee72fb2d2fb9`

---

## Step 6: Verify IAM Permissions

### 6.1 Check Your Permissions

Ensure you have these roles on the **homegeek-staging** project:

- [ ] **Firebase Admin** or **Editor** or **Owner**
- [ ] **Cloud Datastore Import Export Admin** (for Firestore migration)
- [ ] **Storage Admin** (for Storage migration)

### 6.2 Grant Permissions (if needed)

If you're missing roles, have a project owner grant them:

```bash
# Replace YOUR_EMAIL with your Google account email
gcloud projects add-iam-policy-binding homegeek-staging \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/firebase.admin"

gcloud projects add-iam-policy-binding homegeek-staging \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/datastore.importExportAdmin"

gcloud projects add-iam-policy-binding homegeek-staging \
  --member="user:YOUR_EMAIL@gmail.com" \
  --role="roles/storage.admin"
```

**Status:** [ ] Completed

---

## Step 7: Verify Setup with Script

Run the verification script to check everything is configured:

```bash
cd scripts/migration
./0-verify-setup.sh
```

This script checks:

- ✅ CLI tools installed
- ✅ Authentication configured
- ✅ Project access
- ✅ Firebase services enabled
- ✅ Dependencies installed

**Status:** [ ] Completed

---

## Verification Checklist

Before running migration scripts, verify:

- [ ] Firebase Authentication is enabled
- [ ] Email/Password provider is enabled
- [ ] Google OAuth provider is enabled and Web client ID is copied
- [ ] Authorized domains include localhost and your production domains
- [ ] Cloud Firestore database exists in us-central1
- [ ] Firebase Storage bucket exists in us-central1
- [ ] Web app is registered (App ID obtained)
- [ ] IAM permissions are granted
- [ ] CLI tools are installed (node, npm, firebase, gcloud, gsutil)
- [ ] You are authenticated (firebase login, gcloud auth login)
- [ ] npm install has been run in scripts/migration/
- [ ] Verification script (0-verify-setup.sh) passes

---

## Quick Links

- [Firebase Console - homegeek-staging](https://console.firebase.google.com/project/homegeek-staging)
- [Authentication Setup](https://console.firebase.google.com/project/homegeek-staging/authentication)
- [Firestore Database](https://console.firebase.google.com/project/homegeek-staging/firestore)
- [Storage](https://console.firebase.google.com/project/homegeek-staging/storage)
- [Project Settings](https://console.firebase.google.com/project/homegeek-staging/settings/general)

---

## What the Scripts Do vs What You Must Do

### ❌ Scripts Cannot Do (Manual Setup Required):

- Enable Firebase Authentication
- Enable auth providers (Email/Password, Google)
- Create Firestore database
- Create Storage bucket
- Register web apps
- Configure OAuth consent screens
- Set authorized domains

### ✅ Scripts Can Do (Automated):

- Export Authentication users
- Import Authentication users with same UIDs
- Export Firestore data with exact document IDs
- Import Firestore data
- Copy Storage files with exact paths
- Deploy security rules
- Verify data integrity

---

## Next Steps

Once all checklist items are complete:

```bash
cd scripts/migration

# 1. Verify setup
./0-verify-setup.sh

# 2. Start migration
npm run export-auth
npm run import-auth
npm run export-firestore
npm run import-firestore
npm run migrate-storage
npm run deploy-rules
```

---

## Need Help?

- Main migration guide: [../../FIREBASE_MIGRATION.md](../../FIREBASE_MIGRATION.md)
- Script documentation: [README.md](README.md)
- Firebase documentation: https://firebase.google.com/docs
