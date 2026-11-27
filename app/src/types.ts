export type Fields = Record<string, string>;

export type InviteEvent = {
  title: string;
  date: string;
  time: string;
  venue: string;
  address1: string;
  address2: string;
};

export type Job = {
  id: string;
  template: string;
  fields: Fields;
  events?: InviteEvent[];
  card_image_url?: string;
};

export type JobResult = {
  status: 'done' | 'failed';
  video_url?: string;
  error?: string;
  extracted_from_card?: { fields?: Fields; events?: InviteEvent[] };
  fields?: Fields;
  events?: InviteEvent[];
};

export type Settings = {
  cloudName: string;
  uploadPreset: string;
  folder: string;
  template: string;
};

export type TemplateInfo = {
  id: string;
  title: string;
  description?: string;
  preview_url?: string;
  preview_video_url?: string;
};

export type HistoryItem = {
  id: string;
  template?: string;
  title: string;
  videoUrl: string;
  createdAt: number;
  fields: Fields;
  events: InviteEvent[];
};
