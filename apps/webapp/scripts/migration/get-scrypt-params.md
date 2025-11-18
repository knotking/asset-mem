# How to Get SCRYPT Parameters for Password Migration

Firebase SCRYPT parameters are project-specific and cannot be programmatically exported for security reasons. You MUST get them from the Firebase Console.

## ✅ Official Method: Firebase Console (RECOMMENDED)

This is the ONLY official way to get the SCRYPT parameters.

### Step 1: Open Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **source project**: `goggle-gab`
3. Navigate to **Authentication** → **Users** tab

### Step 2: Access Password Hash Parameters

1. In the Users table, look at the **upper-right corner**
2. Click the **three dots menu (⋮)** or dropdown menu
3. Select **"Password Hash Parameters"**

   **Important**: You need **Owner** or **Editor** privileges to see this option. If you only have Viewer access, the menu won't appear.

### Step 3: Copy the Parameters

You'll see something like:

```
hash_config {
  algorithm: SCRYPT,
  base64_signer_key: xxxxxxpS0LhqAuxFoHE5Q_z_yKnZVJ8TUEQyo7vR_xqy5HbTqq6iiTOhHgb6p4NK2GFa8mu2G9Oj8p6gFNSg==,
  base64_salt_separator: Bw==,
  rounds: 8,
  mem_cost: 14,
}
```

**Important**: You only need the `base64_signer_key` value (the long string after the colon).

### Step 4: Set Environment Variable

```bash
# Copy ONLY the base64_signer_key value (without "base64_signer_key:" label)
# Example:
export FIREBASE_SCRYPT_KEY="xxxxxxpS0LhqAuxFoHE5Q_z_yKnZVJ8TUEQyo7vR_xqy5HbTqq6iiTOhHgb6p4NK2GFa8mu2G9Oj8p6gFNSg=="

# ❌ WRONG - Don't include the entire hash_config block:
# export FIREBASE_SCRYPT_KEY="hash_config { ... }"

# ✅ CORRECT - Only the base64 value:
# export FIREBASE_SCRYPT_KEY="E99Khcfcp..."
```

### Step 5: Run Import

```bash
./2-import-auth-firebase-cli.sh
```

The script will use the SCRYPT key from the environment variable, along with the standard Firebase SCRYPT parameters (salt separator: `Bw==`, rounds: `8`, mem_cost: `14`).

---

## ⚠️ Important Notes

- **Project-Specific**: Each Firebase project has a unique signer key
- **Cannot be Retrieved via CLI**: The GUI is the only way to access these parameters
- **Required for Password Migration**: Without the correct signer key, password authentication will fail
- **Keep it Secret**: Treat the signer key like a password - don't commit it to git

---

## 🔄 Alternative: Migration Without Passwords

If you cannot access the Password Hash Parameters (due to permissions or other reasons), you have two options:

### Option 1: Import Without Passwords (Users Reset)

The import script will offer this option if `FIREBASE_SCRYPT_KEY` is not set:

```bash
./2-import-auth-firebase-cli.sh
# Select 'y' when asked to import without passwords
```

**What happens:**

- User accounts are created with correct UIDs
- OAuth users (Google Sign-In) work immediately
- Password users must use "Forgot Password" to set new passwords
- All Firestore data remains linked to correct user IDs

**Next step:**

- Send password reset emails to all users via Firebase Console

### Option 2: Transparent Password Migration

Keep both Firebase projects active temporarily:

1. Import users without passwords to `homegeekdemo`
2. Configure your app to try authentication on `homegeekdemo` first
3. On failure, try `goggle-gab`
4. On `goggle-gab` success, update password in `homegeekdemo` using:
   ```javascript
   await updatePassword(auth.currentUser, password);
   ```
5. Gradually migrate passwords as users login
6. After 30-60 days, disable `goggle-gab` and force remaining users to reset

---

## 🎯 Recommended Approach

1. **Get the SCRYPT parameters from Firebase Console** (takes 2 minutes)
2. **Set `FIREBASE_SCRYPT_KEY` environment variable**
3. **Run `./2-import-auth-firebase-cli.sh`**
4. **Done!** Users can login immediately with existing passwords

This is much simpler than implementing transparent migration or forcing password resets.

---

## 📝 Example: Complete Import Command

If you prefer to run the Firebase CLI command directly:

```bash
export SIGNER_KEY="<base64_signer_key_from_console>"

firebase auth:import auth-users-export.json \
  --project homegeekdemo \
  --hash-algo SCRYPT \
  --hash-key "$SIGNER_KEY" \
  --salt-separator "Bw==" \
  --rounds 8 \
  --mem-cost 14
```
