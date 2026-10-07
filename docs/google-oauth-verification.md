# Google OAuth verification requirements

Checked against official Google documentation and the public website on 2026-10-06. These notes explain the reported rejection; they do not certify compliance or establish what Google's reviewer saw.

## Live website observations

Requests to `https://tick.mehedismathacademy.com/` and `/privacy` with a `Mozilla/5.0` user agent returned HTTP 200 without credentials or a login redirect. The homepage displayed `TickNTaka`, explained the planner and money tracker, explained Google sign-in, and linked the privacy policy. The policy described collection, usage, sharing, protection, retention, and deletion.

Requests to those same URLs with a `Python-urllib/3.12` user agent returned HTTP 403 from Cloudflare, with body `error code: 1010`. Cloudflare documents this as blocking based on the browser signature and lists turning off Browser Integrity Check as a resolution. Check Cloudflare security events and the relevant setting before retrying verification. This is a possible reviewer access problem, not proof that Google's review requests were blocked. [Cloudflare error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/)

The feedback may refer to an earlier website version or a different submitted homepage URL. Confirm the configured homepage, privacy URL, and app name in the correct Google Cloud project.

## Public homepage

The submitted homepage must be visible before login, identify the app, explain its functionality and why it requests Google user data, and link to the same privacy policy URL configured on the consent screen. Google explicitly flags pages that require login or fail to explain the app's purpose. Publish an accessible app information page at the submitted URL, or change the submitted homepage to an existing public information page. A login button can lead into the authenticated app. [Google's app homepage guidance](https://support.google.com/cloud/answer/13807376?hl=en)

## Consistent app name

Google requires the consent screen name to match the name in the verification submission and on the homepage. Choose one displayed spelling, such as `TickNTaka` or `Tick & Taka`, and use it consistently. Edit the consent screen name in Google Auth Platform's Branding page if the website's existing name is the intended brand. [Google's app identity guidance](https://support.google.com/cloud/answer/13804963?hl=en), [branding settings](https://support.google.com/cloud/answer/15549049?hl=en)

## App-specific privacy policy

Publish the policy as readable HTML on a dedicated page, associate it clearly with the app, and describe the app's actual practices. Google requires disclosures about which Google user data the app accesses, how it uses it, who receives it, how it protects it, and retention and deletion. Explain account deletion or how users request deletion. Avoid generic template claims or promises the implementation cannot support. [Google's privacy policy guidance](https://support.google.com/cloud/answer/13806988?hl=en)

For this app, confirm the sign-in scopes and stored fields before writing the policy. If Google sign-in supplies an account identifier, email, name, or profile picture, name the fields actually accessed and explain their use. Also describe the app's other collected information and any service providers that process it. This paragraph is implementation advice, not a claim that this app collects those fields.

## Resubmission

Google requires a public production homepage on a verified domain. Verify authorized domains through Search Console with a Google account that owns or edits the Cloud project. Authentication-only Google sign-in still needs brand verification to display the app's branding. [Google's authentication production guidance](https://developers.google.com/identity/verification/authentication-policy-compliance)

After deploying the changes, check the submitted homepage and policy while signed out, then submit again after resolving all findings. If the URLs remain unchanged and the verification team contacted you by email, Google's remediation instructions also permit replying to confirm the updates. [Homepage remediation instructions](https://support.google.com/cloud/answer/13807376?hl=en), [privacy policy remediation instructions](https://support.google.com/cloud/answer/13806988?hl=en)
