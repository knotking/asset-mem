# GoDaddy DNS Setup for Firebase App Hosting

This guide explains how to connect your GoDaddy domain to Firebase App Hosting so your custom domain (e.g., `yourdomain.com`) points to your Firebase App Hosting deployment.

## Prerequisites

- A GoDaddy domain account
- Firebase project with App Hosting backend deployed
- Access to Firebase Console
- Your Firebase App Hosting URL (e.g., `https://prod--homegeek-prod.us-central1.hosted.app`)

## Important: If Your Domain is Connected to GoDaddy Website Builder

If your domain is currently connected to **GoDaddy Website Builder**, you'll need to disconnect it first before pointing it to Firebase. Here's how:

### Step 0: Disconnect from GoDaddy Website Builder

1. **Log in to GoDaddy:**
   - Go to [GoDaddy.com](https://www.godaddy.com) and sign in
   - Navigate to **My Products** → **Domains**
   - Click on your domain name

2. **Check Current Connection:**
   - Look for a section showing "Website Builder" or "Connected to Website Builder"
   - You may see options like "Manage Website" or "Edit Website"

3. **Disconnect Website Builder:**
   - **Option A: Via Domain Settings**
     - Click on **DNS** or **Manage DNS**
     - Look for any records pointing to GoDaddy Website Builder
     - These might be A records pointing to GoDaddy IPs or CNAME records
   - **Option B: Via Website Builder Settings**
     - Go to **My Products** → **Websites**
     - Find your website and click **Manage**
     - Look for **Domain Settings** or **Domain Connection**
     - Click **Disconnect Domain** or **Change Domain**
     - Follow the prompts to disconnect

4. **Remove Website Builder DNS Records:**
   - In **DNS Management**, look for records like:
     - A records pointing to GoDaddy IPs (e.g., `50.63.202.1`, `50.63.202.2`)
     - CNAME records pointing to `@` or GoDaddy domains
   - **Delete or remove** these records (you'll add Firebase records in Step 3)

5. **Important Considerations:**
   - ⚠️ **Your Website Builder site will stop working** once you disconnect
   - ✅ **Email will continue working** (if you have GoDaddy email, it uses separate MX records)
   - ✅ **Other services** (like email forwarding) will continue working
   - 📝 **Backup your content** from Website Builder if you need it later

6. **Wait for DNS Changes:**
   - After removing Website Builder records, wait 5-10 minutes
   - This ensures old DNS records are cleared before adding Firebase records

## Step 1: Add Custom Domains in Firebase Console

You can add multiple custom domains to Firebase App Hosting. For this setup, we'll add both:

- `homegeek.ai` (root domain - production)
- `staging.homegeek.ai` (subdomain - staging)

### Adding Root Domain (homegeek.ai)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (e.g., `homegeek-staging`)
3. Navigate to **App Hosting** in the left sidebar
4. Click on your **production backend** (e.g., `prod`)
5. Go to the **Custom domains** tab
6. Click **Add custom domain**
7. Enter `homegeek.ai`
8. Click **Continue**

### Adding Staging Subdomain (staging.homegeek.ai)

1. In Firebase Console, navigate to **App Hosting**
2. Click on your **staging backend** (e.g., `staging`)
3. Go to the **Custom domains** tab
4. Click **Add custom domain**
5. Enter `staging.homegeek.ai`
6. Click **Continue**

**Note:** You can add both domains to the same backend if you want, or assign them to different backends (prod vs staging). The DNS configuration will be the same regardless.

## Step 2: Verify Domain Ownership

Firebase will provide TXT records for domain verification. You'll need to verify each domain separately.

### Verify Root Domain (homegeek.ai)

1. **In Firebase Console** (for the backend where you added `homegeek.ai`):
   - Copy the TXT record value (it will look like: `firebase=abc123xyz...`)

2. **Log in to GoDaddy:**
   - Go to [GoDaddy.com](https://www.godaddy.com) and sign in
   - Navigate to **My Products** → **Domains**
   - Click on your domain name
   - Click **DNS** or **Manage DNS**

3. **Add the TXT record:**
   - Click **Add** to create a new record
   - **Type:** Select `TXT`
   - **Name:** Enter `@` (for root domain)
   - **Value:** Paste the verification code from Firebase (e.g., `firebase=abc123xyz...`)
   - **TTL:** Leave as default (usually 1 hour) or set to 600 seconds
   - Click **Save**

4. **Wait for DNS propagation** (can take 5 minutes to 24 hours, usually 10-30 minutes)

5. **Return to Firebase Console** and click **Verify** or **Continue**

### Verify Staging Subdomain (staging.homegeek.ai)

1. **In Firebase Console** (for the backend where you added `staging.homegeek.ai`):
   - Copy the TXT record value (it will look like: `firebase=xyz789abc...`)

2. **In GoDaddy DNS Management:**
   - Click **Add** to create a new record
   - **Type:** Select `TXT`
   - **Name:** Enter `staging` (for staging subdomain)
   - **Value:** Paste the verification code from Firebase
   - **TTL:** Leave as default (usually 1 hour)
   - Click **Save**

3. **Wait for DNS propagation** (can take 5 minutes to 24 hours, usually 10-30 minutes)

4. **Return to Firebase Console** and click **Verify** or **Continue**

**Note:** Firebase may use the same verification TXT record for both domains if they're in the same project. Check the Firebase Console to see if separate verification is needed.

## Step 3: Configure DNS Records

After verification, Firebase will provide DNS records to point your domains to App Hosting. Configure each domain separately.

### Configure Root Domain (homegeek.ai) - Using A Records

Firebase will provide A record IP addresses for the root domain. GoDaddy doesn't allow CNAME on root domain, so A records are required.

1. **Remove existing A records** for `@` (root domain) if any exist (like the WebsiteBuilder Site record)

2. **Add new A records:**
   - Click **Add** to create a new record
   - **Type:** Select `A`
   - **Name:** Enter `@` (for root domain)
   - **Value:** Enter the IP address provided by Firebase (e.g., `199.36.158.100`)
   - **TTL:** Leave as default
   - Click **Save**
   - **Repeat** for each A record IP address provided by Firebase (usually 2-4 IPs)

### Configure Staging Subdomain (staging.homegeek.ai) - Using CNAME

For subdomains, Firebase typically provides a CNAME record pointing to the App Hosting domain.

1. **Add CNAME record:**
   - Click **Add** to create a new record
   - **Type:** Select `CNAME`
   - **Name:** Enter `staging`
   - **Value:** Enter the Firebase App Hosting domain provided (e.g., `staging--homegeek-prod.us-central1.hosted.app`)
   - **TTL:** Leave as default
   - Click **Save**

**Note:** Firebase will show you the exact DNS records needed in the Console. Always use the values provided by Firebase for your specific setup.

## Step 4: Complete Setup in Firebase

1. Return to Firebase Console
2. Click **Finish** or **Complete setup**
3. Firebase will automatically provision an SSL certificate (can take 15 minutes to 24 hours)

## Step 5: Verify Configuration

### Check DNS Propagation

Use these tools to verify DNS records are propagating:

- [DNS Checker](https://dnschecker.org/) - Check A records globally
- [MXToolbox](https://mxtoolbox.com/DNSLookup.aspx) - DNS lookup tool

### Test Your Domain

Once DNS has propagated and SSL is provisioned:

1. Visit `http://yourdomain.com` (should redirect to HTTPS)
2. Visit `https://yourdomain.com` (should show your landing page)

## Common Issues & Solutions

### Issue: "Domain verification failed"

**Solution:**

- Double-check the TXT record value matches exactly (no extra spaces)
- Wait longer for DNS propagation (up to 24 hours)
- Ensure the TXT record name is `@` or blank for root domain

### Issue: "DNS records not found"

**Solution:**

- Verify A records are added correctly in GoDaddy
- Check that old A records are removed
- Wait for DNS propagation (can take up to 48 hours)

### Issue: "SSL certificate provisioning failed"

**Solution:**

- Ensure DNS records are correctly configured
- Wait up to 24 hours for SSL provisioning
- Check Firebase Console for specific error messages

### Issue: "CNAME not allowed on root domain"

**Solution:**

- Use A records for root domain (`@`) instead of CNAME
- Use CNAME only for subdomains like `www`

### Issue: "Domain still pointing to Website Builder after DNS changes"

**Solution:**

- Clear your browser cache and DNS cache (`ipconfig /flushdns` on Windows, `sudo dscacheutil -flushcache` on Mac)
- Wait longer for DNS propagation (can take up to 48 hours)
- Use DNS checker tools to verify records globally
- Ensure you removed ALL Website Builder DNS records
- Check if GoDaddy has a "DNS Forwarding" or "Domain Forwarding" setting that needs to be disabled

## Migrating from GoDaddy Website Builder - Complete Checklist

If you're migrating from GoDaddy Website Builder to Firebase App Hosting:

- [ ] **Backup your Website Builder content** (download files, export content if possible)
- [ ] **Disconnect Website Builder** from your domain in GoDaddy
- [ ] **Remove Website Builder DNS records** (A records, CNAME records pointing to GoDaddy)
- [ ] **Disable Domain Forwarding** (if enabled in GoDaddy)
- [ ] **Wait 5-10 minutes** for DNS changes to propagate
- [ ] **Verify email still works** (check MX records are intact)
- [ ] **Add custom domain in Firebase Console**
- [ ] **Add verification TXT record** in GoDaddy DNS
- [ ] **Verify domain ownership** in Firebase
- [ ] **Add Firebase DNS records** (A records or CNAME)
- [ ] **Wait for DNS propagation** (5 min - 48 hours)
- [ ] **Wait for SSL certificate** (15 min - 24 hours)
- [ ] **Test your new Firebase site**

### Preserving Email and Other Services

When disconnecting from Website Builder, **your email will continue working** because:

- **Email uses MX records** (separate from A/CNAME records)
- **MX records are not affected** by Website Builder disconnection
- **GoDaddy Email** will continue working normally

**To verify email is still configured:**

1. Go to GoDaddy DNS Management
2. Look for **MX records** (they should still be there)
3. They typically point to `smtp.secureserver.net` or similar GoDaddy email servers
4. **Don't delete MX records** unless you're also migrating email

**Other services that continue working:**

- Email forwarding
- Email accounts (if using GoDaddy email)
- Subdomain configurations (unless they point to Website Builder)
- Any other DNS records (TXT, SRV, etc.) that aren't related to Website Builder

**What will stop working:**

- Your Website Builder website (expected - you're replacing it)
- Any subdomains pointing to Website Builder
- Domain forwarding to Website Builder

## Current DNS Records (homegeek.ai)

Based on your GoDaddy DNS configuration, here are your current records:

### Current Records:

| Type  | Name            | Data                                        | TTL    | Action Required                                       |
| ----- | --------------- | ------------------------------------------- | ------ | ----------------------------------------------------- |
| A     | @               | WebsiteBuilder Site                         | 1 Hour | ⚠️ **DELETE** - Replace with Firebase A records       |
| A     | demo            | 34.72.193.80                                | 1 Hour | ✅ Keep (subdomain for demo)                          |
| NS    | @               | ns17.domaincontrol.com.                     | 1 Hour | ✅ Keep (can't delete/edit)                           |
| NS    | @               | ns18.domaincontrol.com.                     | 1 Hour | ✅ Keep (can't delete/edit)                           |
| CNAME | www             | homegeek.ai.                                | 1 Hour | ⚠️ **UPDATE** - Change to Firebase App Hosting domain |
| CNAME | \_domainconnect | \_domainconnect.gd.domaincontrol.com.       | 1 Hour | ✅ Keep (GoDaddy internal)                            |
| SOA   | @               | Primary nameserver: ns17.domaincontrol.com. | 1 Hour | ✅ Keep (can edit if needed)                          |
| MX    | @               | aspmx.l.google.com. (Priority: 1)           | 1 Hour | ✅ Keep (Google Workspace email)                      |
| MX    | @               | alt3.aspmx.l.google.com. (Priority: 10)     | 1 Hour | ✅ Keep (Google Workspace email)                      |
| MX    | @               | alt4.aspmx.l.google.com. (Priority: 10)     | 1 Hour | ✅ Keep (Google Workspace email)                      |

### Records to Modify for Firebase App Hosting:

1. **A Record (@) - WebsiteBuilder Site**
   - **Action:** DELETE this record
   - **Reason:** Currently pointing to GoDaddy Website Builder
   - **Replace with:** Firebase A records (provided by Firebase Console)

2. **CNAME Record (www) - homegeek.ai.**
   - **Action:** EDIT this record
   - **Current Value:** `homegeek.ai.`
   - **New Value:** Firebase App Hosting domain (e.g., `prod--homegeek-prod.us-central1.hosted.app`)
   - **Note:** This creates a redirect loop. Change to point directly to Firebase.

### Records to Keep (Don't Modify):

- ✅ **NS Records** - Required for DNS management (can't delete)
- ✅ **MX Records** - Required for Google Workspace email (keep all 3)
- ✅ **CNAME \_domainconnect** - GoDaddy internal record (keep)
- ✅ **SOA Record** - DNS zone authority (keep)
- ✅ **A Record (demo)** - Subdomain for demo site (keep if still needed)

### Records to Add:

1. **TXT Record (@)** - For Firebase root domain verification
   - **Type:** TXT
   - **Name:** @
   - **Value:** `firebase=abc123xyz...` (provided by Firebase Console)
   - **TTL:** 1 Hour

2. **TXT Record (staging)** - For Firebase staging subdomain verification (if separate verification needed)
   - **Type:** TXT
   - **Name:** staging
   - **Value:** `firebase=xyz789abc...` (provided by Firebase Console)
   - **TTL:** 1 Hour
   - **Note:** Firebase may use the same verification for both domains - check Firebase Console

3. **A Records (@)** - For root domain pointing to Firebase
   - **Type:** A
   - **Name:** @
   - **Value:** IP addresses provided by Firebase (usually 2-4 IPs)
   - **TTL:** 1 Hour
   - **Note:** Add multiple A records, one for each IP provided by Firebase

4. **CNAME Record (staging)** - For staging subdomain pointing to Firebase
   - **Type:** CNAME
   - **Name:** staging
   - **Value:** Firebase App Hosting domain (e.g., `staging--homegeek-prod.us-central1.hosted.app`)
   - **TTL:** 1 Hour

## DNS Record Summary

Here's what your GoDaddy DNS records should look like after Firebase setup:

### For Root Domain (homegeek.ai):

```
Type    Name    Value                           TTL
TXT     @       firebase=abc123xyz...           1 hour
A       @       199.36.158.100                  1 hour
A       @       199.36.158.101                  1 hour
MX      @       aspmx.l.google.com. (Priority: 1)  1 hour
MX      @       alt3.aspmx.l.google.com. (Priority: 10)  1 hour
MX      @       alt4.aspmx.l.google.com. (Priority: 10)  1 hour
NS      @       ns17.domaincontrol.com.         1 hour
NS      @       ns18.domaincontrol.com.         1 hour
SOA     @       Primary nameserver: ns17.domaincontrol.com.  1 hour
```

### For WWW Subdomain (www.homegeek.ai):

```
Type    Name    Value                           TTL
CNAME   www     prod--homegeek-prod.us-central1.hosted.app    1 hour
```

### For Staging Subdomain (staging.homegeek.ai):

```
Type    Name    Value                           TTL
CNAME   staging staging--homegeek-prod.us-central1.hosted.app  1 hour
```

### For Demo Subdomain (demo.homegeek.ai):

```
Type    Name    Value                           TTL
A       demo    34.72.193.80                   1 hour
```

### GoDaddy Internal Records (Keep):

```
Type    Name    Value                           TTL
CNAME   _domainconnect   _domainconnect.gd.domaincontrol.com.  1 hour
```

## Step-by-Step Action Plan for homegeek.ai

Based on your current DNS records, follow these steps in order:

### Step 1: Delete Website Builder A Record

1. Go to GoDaddy DNS Management
2. Find the A record with:
   - **Type:** A
   - **Name:** @
   - **Data:** WebsiteBuilder Site
3. Click the **Delete** (trash icon) button
4. Confirm deletion

### Step 2: Add Firebase Verification TXT Records

#### For Root Domain (homegeek.ai):

1. In Firebase Console (for the backend where you added `homegeek.ai`), get the verification TXT record value
2. In GoDaddy DNS Management, click **Add**
3. Create new record:
   - **Type:** TXT
   - **Name:** @
   - **Value:** Paste the Firebase verification code (e.g., `firebase=abc123xyz...`)
   - **TTL:** 1 Hour
4. Click **Save**
5. Wait 5-10 minutes, then verify in Firebase Console

#### For Staging Subdomain (staging.homegeek.ai):

1. In Firebase Console (for the backend where you added `staging.homegeek.ai`), get the verification TXT record value
2. In GoDaddy DNS Management, click **Add**
3. Create new record:
   - **Type:** TXT
   - **Name:** staging
   - **Value:** Paste the Firebase verification code (e.g., `firebase=xyz789abc...`)
   - **TTL:** 1 Hour
4. Click **Save**
5. Wait 5-10 minutes, then verify in Firebase Console

**Note:** Firebase may use the same verification TXT record for both domains. Check Firebase Console to see if separate verification is needed.

### Step 3: Add Firebase A Records for Root Domain

1. In Firebase Console, get the A record IP addresses (usually 2-4 IPs)
2. For each IP address provided by Firebase:
   - Click **Add** in GoDaddy DNS Management
   - **Type:** A
   - **Name:** @
   - **Value:** Enter one of the Firebase IP addresses
   - **TTL:** 1 Hour
   - Click **Save**
   - Repeat for each IP address

### Step 4: Update WWW CNAME Record

1. Find the existing CNAME record:
   - **Type:** CNAME
   - **Name:** www
   - **Data:** homegeek.ai.
2. Click the **Edit** (pencil icon) button
3. Change the **Value** from `homegeek.ai.` to your Firebase App Hosting domain:
   - Example: `prod--homegeek-prod.us-central1.hosted.app`
4. Click **Save**

### Step 5: Add Staging CNAME Record

1. In Firebase Console (for the backend where you added `staging.homegeek.ai`), get the CNAME record value
2. In GoDaddy DNS Management, click **Add**
3. Create new record:
   - **Type:** CNAME
   - **Name:** staging
   - **Value:** Enter the Firebase App Hosting domain (e.g., `staging--homegeek-prod.us-central1.hosted.app`)
   - **TTL:** 1 Hour
4. Click **Save**

### Step 6: Verify All Records

After making changes, your DNS records should look like:

✅ **Keep these unchanged:**

- NS records (ns17.domaincontrol.com., ns18.domaincontrol.com.)
- MX records (all 3 Google Workspace records)
- SOA record
- CNAME \_domainconnect
- A record for demo subdomain

✅ **New/Updated records:**

- TXT record (@) for Firebase root domain verification
- TXT record (staging) for Firebase staging subdomain verification (if separate)
- A records (@) pointing to Firebase IPs
- CNAME (www) pointing to Firebase App Hosting domain
- CNAME (staging) pointing to Firebase App Hosting domain

### Step 7: Wait for Propagation

- DNS changes: 5 minutes to 48 hours (usually 10-30 minutes)
- SSL certificate: 15 minutes to 24 hours
- Check status in Firebase Console

## Important Notes

1. **DNS Propagation:** Changes can take 5 minutes to 48 hours to propagate globally
2. **SSL Certificate:** Firebase automatically provisions SSL certificates, which can take 15 minutes to 24 hours
3. **Multiple Domains:** You can configure multiple domains/subdomains in Firebase:
   - Root domain: `homegeek.ai` (uses A records)
   - Staging subdomain: `staging.homegeek.ai` (uses CNAME record)
   - WWW subdomain: `www.homegeek.ai` (uses CNAME record)
4. **HTTPS Redirect:** Firebase automatically redirects HTTP to HTTPS
5. **Testing:** Use `curl` or browser to test:
   - `curl -I https://homegeek.ai`
   - `curl -I https://staging.homegeek.ai`
   - `curl -I https://www.homegeek.ai`

## Firebase App Hosting vs Firebase Hosting

**Firebase App Hosting** (what you're using):

- Supports custom domains
- Uses similar DNS configuration as Firebase Hosting
- Provides dynamic Next.js SSR capabilities
- URL format: `https://backend--project.region.hosted.app`

**Firebase Hosting** (traditional static hosting):

- Also supports custom domains
- Uses A records or CNAME records
- URL format: `https://project-id.web.app`

The DNS setup process is similar for both, but App Hosting may have specific requirements. Always follow the exact DNS records provided by Firebase Console for your App Hosting backend.

## Next Steps

After DNS is configured:

1. ✅ Wait for DNS propagation (check with DNS checker tools)
2. ✅ Wait for SSL certificate provisioning (check Firebase Console)
3. ✅ Test your domain in a browser
4. ✅ Update any hardcoded URLs in your app to use the custom domain

## Support Resources

- [Firebase App Hosting Custom Domain Docs](https://firebase.google.com/docs/app-hosting/custom-domain)
- [GoDaddy DNS Management Help](https://www.godaddy.com/help/manage-dns-zone-files-680)
- [Firebase Support](https://firebase.google.com/support)
