export interface SendNotificationInput {
  recipient: string;
  from?: string | null;
  subject?: string | null;
  body: string;
  bodyFormat: string;
}

export interface SendNotificationResult {
  providerMessageId?: string;
  responseText?: string;
}

export interface NotificationCarrier {
  type: string;
  send(input: SendNotificationInput): Promise<SendNotificationResult>;
}
