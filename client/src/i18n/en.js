/*
 * English app strings (source of truth). Keys are dotted namespaces mirroring
 * @mero-nepal/ui's own `ui.*` tokens; the i18n index merges these on top of the
 * library's base locale tokens so `useLocale().t(key)` resolves both.
 *
 * When you add a string here, add the same key to ne.js / newari.js / mai.js.
 */

export default {
  // Shared page shell — nav + footer
  'nav.submit': 'Submit',
  'nav.track': 'Track',
  'nav.dashboard': 'Dashboard',
  'nav.controlRoom': 'Control Room',
  'nav.admin': 'Admin',
  'nav.signOut': 'Sign out',
  'footer.credit': 'Made by Nepaliहरु via',

  // Home (landing)
  'home.badge': 'Civic Feedback Platform',
  // Rendered across two lines — the "\n" is turned into a <br /> at render time.
  'home.title': 'Your voice,\ndelivered to your representative.',
  'home.subtitle': "Submit questions and complaints to your representative's team. Track progress. Get answers.",
  'home.ctaSubmit': 'Submit a Gunaso',
  'home.ctaTrack': 'Track my Gunaso',

  // Submit form
  'submit.heading': 'Submit a Gunaso',
  'submit.subheading': "Your representative's team will review and respond to your submission.",
  'submit.title.label': 'Title',
  'submit.title.placeholder': 'Brief summary of your Gunaso',
  'submit.description.label': 'Description',
  'submit.description.placeholder': 'Describe your Gunaso in detail',
  'submit.email.label': 'Email',
  'submit.email.placeholder': 'you@example.com',
  'submit.phone.label': 'Phone',
  'submit.phone.placeholder': '98XXXXXXXX',
  'submit.contactHint': "We'll only use this to follow up on your Gunaso.",
  'submit.attachment.label': 'Attachment (optional)',
  'submit.attachment.hint': 'JPG, PNG, WEBP, PDF, DOC, or DOCX — up to 5MB.',
  'submit.attachment.tooLarge': 'File must be 5MB or smaller.',
  'submit.button': 'Submit Gunaso',
  'submit.submitting': 'Submitting…',

  // Submit — success screen
  'submit.success.heading': 'Gunaso submitted',
  'submit.success.subheading': 'Save your tracking ID to check on progress.',
  'submit.success.trackingId': 'Tracking ID',
  'submit.success.copied': 'Copied',
  'submit.success.copyTitle': 'Copy tracking ID',
  'submit.success.trackThis': 'Track this Gunaso',
  'submit.success.submitAnother': 'Submit another',

  // Public dashboard
  'dashboard.heading': 'Dashboard',
  'dashboard.subheading': "A public overview of citizen submissions and how they're being handled.",
  'dashboard.metric.total': 'Total submissions',
  'dashboard.metric.categories': 'Categories tracked',
  'dashboard.metric.resolved': 'Resolved',
  'dashboard.metric.resolvedRate': 'Resolved rate',
  'dashboard.statusDistribution': 'Status distribution',
  'dashboard.categoryDistribution': 'Category distribution',
  'dashboard.seriesSubmissions': 'Submissions',
  'dashboard.uncategorized': 'Uncategorized',
  'dashboard.weeklyStatus': 'Status activity per week',
  'dashboard.weeklyCategory': 'Category activity per week',

  // Shared status + category labels (charts, and later the tables)
  'status.new': 'New',
  'status.in_review': 'In Review',
  'status.resolved': 'Resolved',
  'category.infrastructure': 'Infrastructure',
  'category.health': 'Health',
  'category.education': 'Education',
  'category.security': 'Security',
  'category.other': 'Other',
};
