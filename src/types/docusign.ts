// DocuSign eSignature API type definitions
// Matches the real DocuSign REST API v2.1 response shapes (camelCase field names)

export interface Tab {
  tabId: string;
  tabLabel: string;
  tabType: string;
  recipientId: string;
  documentId: string;
  pageNumber: string;
  xPosition: string;
  yPosition: string;
  width?: string;
  height?: string;
  required?: string;
  value?: string;
  anchorString?: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
  anchorUnits?: string;
  name?: string;
  optional?: string;
  scaleValue?: string;
  locked?: string;
  bold?: string;
  font?: string;
  fontSize?: string;
  fontColor?: string;
}

export interface Tabs {
  signHereTabs?: Tab[];
  initialHereTabs?: Tab[];
  dateSignedTabs?: Tab[];
  textTabs?: Tab[];
  checkboxTabs?: Tab[];
  radioGroupTabs?: Tab[];
  listTabs?: Tab[];
  noteTabs?: Tab[];
  numberTabs?: Tab[];
  formulaTabs?: Tab[];
  fullNameTabs?: Tab[];
  emailTabs?: Tab[];
  titleTabs?: Tab[];
  companyTabs?: Tab[];
  ssnTabs?: Tab[];
  zipTabs?: Tab[];
  dateTabs?: Tab[];
  declineTabs?: Tab[];
  approveTabs?: Tab[];
  envelopeIdTabs?: Tab[];
}

export type RecipientType =
  | 'signer'
  | 'cc'
  | 'certifiedDelivery'
  | 'inPersonSigner'
  | 'agent'
  | 'editor'
  | 'intermediary'
  | 'witness';

export type RecipientStatus =
  | 'created'
  | 'sent'
  | 'delivered'
  | 'signed'
  | 'completed'
  | 'declined'
  | 'autoresponded';

export interface Recipient {
  recipientId: string;
  recipientIdGuid: string;
  recipientType: RecipientType;
  routingOrder: string;
  roleName?: string;
  name: string;
  email: string;
  status: RecipientStatus;
  signedDateTime?: string;
  deliveredDateTime?: string;
  sentDateTime?: string;
  declinedDateTime?: string;
  declinedReason?: string;
  tabs?: Tabs;
  clientUserId?: string;
  embeddedRecipientStartURL?: string;
  note?: string;
  accessCode?: string;
  requireIdLookup?: string;
  templateLocked?: string;
  templateRequired?: string;
  creationReason?: string;
  isBulkRecipient?: string;
  deliveryMethod?: string;
  totalTabCount?: string;
}

export interface Signer extends Recipient {
  recipientType: 'signer';
}

export interface CarbonCopy extends Recipient {
  recipientType: 'cc';
}

export interface Recipients {
  signers?: Signer[];
  carbonCopies?: CarbonCopy[];
  certifiedDeliveries?: Recipient[];
  inPersonSigners?: Recipient[];
  agents?: Recipient[];
  editors?: Recipient[];
  intermediaries?: Recipient[];
  witnesses?: Recipient[];
  recipientCount?: string;
  currentRoutingOrder?: string;
}

export interface Document {
  documentId: string;
  documentIdGuid: string;
  name: string;
  fileExtension?: string;
  order?: string;
  pages?: string;
  uri?: string;
  type?: string;
  display?: string;
  includeInDownload?: string;
  signerMustAcknowledge?: string;
  templateLocked?: string;
  templateRequired?: string;
  authoritativeCopy?: string;
  documentBase64?: string;
  containsPdfFormFields?: string;
}

export type EnvelopeStatus = 'created' | 'sent' | 'delivered' | 'completed' | 'declined' | 'voided';

export interface CustomField {
  fieldId: string;
  name: string;
  value: string;
  required?: string;
  show?: string;
  configurationType?: string;
}

export interface CustomFields {
  textCustomFields?: CustomField[];
  listCustomFields?: CustomField[];
}

export interface EmailSettings {
  replyEmailAddressOverride?: string;
  replyEmailNameOverride?: string;
  bccEmailAddresses?: { bccEmailAddressId: string; email: string }[];
}

export interface Notification {
  useAccountDefaults?: string;
  reminders?: {
    reminderEnabled: string;
    reminderDelay: string;
    reminderFrequency: string;
  };
  expirations?: {
    expireEnabled: string;
    expireAfter: string;
    expireWarn: string;
  };
}

export interface Envelope {
  envelopeId: string;
  envelopeUri: string;
  status: EnvelopeStatus;
  statusChangedDateTime: string;
  createdDateTime: string;
  sentDateTime?: string;
  deliveredDateTime?: string;
  completedDateTime?: string;
  voidedDateTime?: string;
  voidedReason?: string;
  lastModifiedDateTime: string;
  emailSubject: string;
  emailBlurb?: string;
  brandId?: string;
  brandLock?: string;
  certificateUri?: string;
  templatesUri?: string;
  notificationUri?: string;
  enableWetSign?: string;
  allowMarkup?: string;
  allowReassign?: string;
  signingLocation?: string;
  sender?: {
    userName: string;
    userId: string;
    accountId: string;
    email: string;
  };
  recipients?: Recipients;
  documents?: Document[];
  customFields?: CustomFields;
  notification?: Notification;
  purgeState?: string;
  is21CFRPart11?: string;
  signerCanSignOnMobile?: string;
  autoNavigation?: string;
  isSignatureProviderEnvelope?: string;
  messageLock?: string;
  initialSentDateTime?: string;
  expireEnabled?: string;
  expireDateTime?: string;
  expireAfter?: string;
  useDisclosure?: string;
  allowComments?: string;
  allowViewHistory?: string;
  envelopeIdStamping?: string;
}

export interface EnvelopeSummary {
  envelopeId: string;
  uri: string;
  statusDateTime: string;
  status: EnvelopeStatus;
}

export interface EnvelopeUpdateSummary {
  envelopeId: string;
  envelopeUri?: string;
  status?: EnvelopeStatus;
  statusDateTime?: string;
  recipientUpdateResults?: {
    recipientId: string;
    errorDetails?: { errorCode: string; message: string };
  }[];
}

export interface EnvelopesListResult {
  resultSetSize: string;
  startPosition: string;
  endPosition: string;
  totalSetSize: string;
  nextUri?: string;
  previousUri?: string;
  envelopes?: Envelope[];
}

export interface ViewUrl {
  url: string;
}

export interface RecipientViewRequest {
  returnUrl: string;
  authenticationMethod: string;
  email: string;
  userName: string;
  clientUserId?: string;
  recipientId?: string;
  pingUrl?: string;
  pingFrequency?: string;
  securityDomain?: string;
  assertionId?: string;
  authenticationInstant?: string;
}

export interface SenderViewRequest {
  returnUrl: string;
}

export interface EnvelopeAuditEvent {
  eventFields: { name: string; value: string }[];
}

export interface EnvelopeAuditEventsResult {
  auditEvents: EnvelopeAuditEvent[];
}

export interface Template {
  templateId: string;
  uri: string;
  name: string;
  description?: string;
  created: string;
  lastModified: string;
  shared?: string;
  folderId?: string;
  folderName?: string;
  folderUri?: string;
  owner?: {
    userName: string;
    userId: string;
    email: string;
  };
  emailSubject?: string;
  emailBlurb?: string;
  recipients?: Recipients;
  documents?: Document[];
  customFields?: CustomFields;
  notification?: Notification;
  status?: string;
  pageCount?: number;
}

export interface TemplateSummary {
  templateId: string;
  uri: string;
  name: string;
}

export interface TemplateListResult {
  resultSetSize: string;
  startPosition: string;
  endPosition: string;
  totalSetSize: string;
  nextUri?: string;
  previousUri?: string;
  envelopeTemplates?: Template[];
}

export interface AccountInfo {
  accountId: string;
  accountName: string;
  accountIdGuid: string;
  baseUri: string;
  isDefault: string;
  planId?: string;
  billingPeriodStartDate?: string;
  billingPeriodEndDate?: string;
  billingPeriodEnvelopesAllowed?: string;
  billingPeriodEnvelopesSent?: string;
  billingPeriodDaysRemaining?: string;
  currentPlanId?: string;
  planName?: string;
  planStartDate?: string;
  planEndDate?: string;
  canUpgrade?: string;
}

export interface LoginAccount {
  accountId: string;
  accountIdGuid: string;
  name: string;
  baseUrl: string;
  isDefault: string;
  userName: string;
  userId: string;
  email: string;
  siteDescription: string;
  loginAccountSettings?: { name: string; value: string }[];
}

export interface LoginInformation {
  loginAccounts: LoginAccount[];
  apiPassword?: string;
}

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface UserInfo {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  email: string;
  created: string;
  accounts: {
    account_id: string;
    account_name: string;
    base_uri: string;
    is_default: boolean;
  }[];
}

export interface EnvelopeEvent {
  envelopeEventStatusCode: string;
  includeDocuments?: string;
}

export interface RecipientEvent {
  recipientEventStatusCode: string;
  includeDocuments?: string;
}

export interface EventNotification {
  url: string;
  loggingEnabled?: string;
  requireAcknowledgment?: string;
  useSoapInterface?: string;
  includeCertificateWithSoap?: string;
  signMessageWithX509Cert?: string;
  includeDocuments?: string;
  includeEnvelopeVoidReason?: string;
  includeTimeZone?: string;
  includeSenderAccountAsCustomField?: string;
  includeDocumentFields?: string;
  includeCertificateOfCompletion?: string;
  envelopeEvents?: EnvelopeEvent[];
  recipientEvents?: RecipientEvent[];
}

export interface ErrorDetails {
  errorCode: string;
  message: string;
}

// Request body for creating envelopes
export interface EnvelopeDefinition {
  emailSubject?: string;
  emailBlurb?: string;
  status?: EnvelopeStatus;
  recipients?: Recipients;
  documents?: Partial<Document>[];
  templateId?: string;
  templateRoles?: {
    roleName: string;
    name: string;
    email: string;
    clientUserId?: string;
    tabs?: Tabs;
  }[];
  customFields?: CustomFields;
  notification?: Notification;
  eventNotification?: EventNotification;
  brandId?: string;
  enableWetSign?: string;
  allowMarkup?: string;
  allowReassign?: string;
  allowComments?: string;
  envelopeIdStamping?: string;
}

// Request body for creating/updating templates
export interface TemplateDefinition {
  name?: string;
  description?: string;
  emailSubject?: string;
  emailBlurb?: string;
  recipients?: Recipients;
  documents?: Partial<Document>[];
  shared?: string;
  customFields?: CustomFields;
  notification?: Notification;
}
