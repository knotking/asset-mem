/**
 * testID values used in the app UI (debugging / future use).
 * Maestro recording flows use accessibility labels and visible text — see maestro/README.md.
 */
export const RecordingTestIds = {
  landing: {
    screen: 'landing-screen',
    watchDemo: 'watch-demo-button',
    getStarted: 'get-started-button',
    pricingSection: 'landing-pricing-section',
  },
  login: {
    screen: 'login-screen',
    email: 'login-email-input',
    password: 'login-password-input',
    submit: 'login-submit-button',
  },
  dashboard: {
    screen: 'properties-dashboard-screen',
    propertyCard: 'property-card',
    addProperty: 'add-new-property-card',
  },
  propertyTabs: {
    chat: 'chat-tab',
    timeline: 'timeline-tab',
    details: 'details-tab',
  },
  chat: {
    openSettings: 'open-chat-settings',
    settingsModal: 'chat-settings-modal',
    primaryAgent: (id: string) => `primary-agent-${id}`,
    optionalAgent: (id: string) => `optional-agent-${id}`,
    messageInput: 'chat-message-input',
    sendMessage: 'send-message-button',
    stopProcessing: 'stop-processing-button',
    openFullReport: 'open-full-report',
    fullReportSheet: 'full-report-sheet',
    closeFullReport: 'close-full-report',
    saveServiceProvider: 'save-service-provider',
  },
  timeline: {
    subtabCheckpoints: 'timeline-subtab-checkpoints',
    subtabInsights: 'timeline-subtab-insights',
    subtabReports: 'timeline-subtab-reports',
    checkpointList: 'checkpoint-list',
    checkpointCard: 'checkpoint-card',
    createCheckpoint: 'create-checkpoint-button',
    compareEnter: 'compare-checkpoints-enter',
    compareSubmit: 'compare-checkpoints-submit',
    generateReport: 'generate-report-button',
  },
  details: {
    tab: 'property-details-tab',
    myProsCard: 'my-pros-card',
    myProsDrawer: 'my-pros-drawer',
    uploadDocuments: 'upload-documents-button',
    documentList: 'document-list',
  },
  addProperty: {
    modal: 'add-property-modal',
    chooseFiles: 'add-property-choose-files',
    uploadSubmit: 'add-property-upload-submit',
  },
  settings: {
    signOut: 'sign-out-button',
  },
  landingDemo: {
    modal: 'demo-video-modal',
    closeVideo: 'close-demo-video',
  },
} as const;
