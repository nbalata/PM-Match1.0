
export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SavedResume {
  id: string;
  name: string;
  content: string;
  timestamp: number;
}

export interface SavedJob {
  id: string;
  name: string;
  content: string;
  url: string;
  timestamp: number;
}

export interface AnalysisResult {
  companyName: string;
  score: number;
  missingSkills: string[];
  strengths: string[];
  quickTake: string[];
  pitchHighlights: string[];
  sampleEmail: string;
  groundingSources?: GroundingSource[];
}

export enum LoadingStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}