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

## Step 1: Add Custom Domain in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (e.g., `homegeekdemo`)
3. Navigate to **App Hosting** in the left sidebar
4. Click on your backend (e.g., `prod` or `staging`)
5. Go to the **Custom domains** tab
6. Click **Add custom domain**
7. Enter your domain name (e.g., `yourdomain.com` or `www.yourdomain.com`)
8. Click **Continue**

## Step 2: Verify Domain Ownership

Firebase will provide a TXT record for domain verification:

1. **Copy the TXT record value** from Firebase Console (it will look like: `firebase=abc123xyz...`)

2. **Log in to GoDaddy:**
   - Go to [GoDaddy.com](https://www.godaddy.com) and sign in
   - Navigate to **My Products** → **Domains**
   - Click on your domain name
   - Click **DNS** or **Manage DNS**

3. **Add the TXT record:**
   - Click **Add** to create a new record
   - **Type:** Select `TXT`
   - **Name:** Enter `@` (for root domain) or leave blank
   - **Value:** Paste the verification code from Firebase (e.g., `firebase=abc123xyz...`)
   - **TTL:** Leave as default (usually 1 hour) or set to 600 seconds
   - Click **Save**

4. **Wait for DNS propagation** (can take 5 minutes to 24 hours, usually 10-30 minutes)

5. **Return to Firebase Console** and click **Verify** or **Continue**

## Step 3: Configure DNS Records

After verification, Firebase will provide DNS records to point your domain to App Hosting.

### Option A: Using A Records (Recommended for root domain)

Firebase will provide A record IP addresses. Add them in GoDaddy:

1. **Remove existing A records** for `@` (root domain) if any exist

2. **Add new A records:**
   - Click **Add** to create a new record
   - **Type:** Select `A`
   - **Name:** Enter `@` (for root domain)
   - **Value:** Enter the IP address provided by Firebase (e.g., `199.36.158.100`)
   - **TTL:** Leave as default
   - Click **Save**
   - **Repeat** for each A record IP address provided by Firebase (usually 2-4 IPs)

### Option B: Using CNAME (For subdomains like www)

If you want to use `www.yourdomain.com`:

1. **Add CNAME record:**
   - Click **Add** to create a new record
   - **Type:** Select `CNAME`
   - **Name:** Enter `www`
   - **Value:** Enter the Firebase Hosting domain provided (e.g., `your-project-id.firebaseapp.com` or the App Hosting domain)
   - **TTL:** Leave as default
   - Click **Save**

### Option C: Firebase App Hosting Specific

For Firebase App Hosting, you may need to use a CNAME that points to the App Hosting domain:

1. **Add CNAME record:**
   - **Type:** `CNAME`
   - **Name:** `@` (for root) or `www` (for subdomain)
   - **Value:** Your App Hosting domain (e.g., `prod--homegeek-prod.us-central1.hosted.app`)
   - **TTL:** Default

**Note:** Some DNS providers (including GoDaddy) don't allow CNAME on root domain (`@`). In that case:

- Use A records for root domain (`@`)
- Use CNAME for subdomains (`www`)

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

## DNS Record Summary

Here's what your GoDaddy DNS records should look like:

### For Root Domain (yourdomain.com):

```
Type    Name    Value                           TTL
TXT     @       firebase=abc123xyz...           1 hour
A       @       199.36.158.100                  1 hour
A       @       199.36.158.101                  1 hour
```

### For WWW Subdomain (www.yourdomain.com):

```
Type    Name    Value                           TTL
CNAME   www     prod--homegeek-prod.us-central1.hosted.app    1 hour
```

## Important Notes

1. **DNS Propagation:** Changes can take 5 minutes to 48 hours to propagate globally
2. **SSL Certificate:** Firebase automatically provisions SSL certificates, which can take 15 minutes to 24 hours
3. **Both www and non-www:** You can configure both `yourdomain.com` and `www.yourdomain.com` in Firebase
4. **HTTPS Redirect:** Firebase automatically redirects HTTP to HTTPS
5. **Testing:** Use `curl` or browser to test: `curl -I https://yourdomain.com`

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
