export interface ProjectListModel {
    project_id: number;
    project_name: string;
    local_repo_path: string;
    is_selected: boolean;
    current_branch: string;
    target_branch: string;
    commits_ahead: number;
    commits_behind: number;
    ai_commit_messages: string[];
    ai_changed_files: string[];
    ai_diff: string;
    mr_status?: 'Created' | 'Merged' | 'Rejected' | 'No MR' | 'Error';
    sourceBranchExists: boolean;
    targetBranchExists: boolean;
    ai_generated_description?: string;
    aiReviewComments?: {
        file: string;
        line: string;
        comment: string;
        risk: 'Low' | 'Medium' | 'High'
    }[];
}
