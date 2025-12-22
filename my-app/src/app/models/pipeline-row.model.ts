interface PipelineRow {
  project_name: string;
  type: string;
  status: string;
  user: string;
  created_at: string;
  full_pipeline: PipelineDetails;
  link: string;
}

interface PipelineDetails {
  id: string;
  source: string;
  status: string;
  ref: string;
  createdAt: string;
  startedAt: string;
  finishedAt: string;
  totalDuration: string;
  runDuration: string;
  name: string;
}