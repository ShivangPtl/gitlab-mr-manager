interface PipelineRow {
  project_name: string;
  status: string;
  user: string;
  deployed_at: string;
  full_pipeline: PipelineDetails | null;
  link: string;
  matchedSchedule: {
    id: string;
    name: string;
  } | null;

  openMRs: number;
  changesSinceDeploy: number;
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