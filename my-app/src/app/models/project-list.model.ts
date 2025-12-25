export interface ProjectListModel {
    project_id: number;
    project_name: string;
    local_repo_path: string;
    is_selected: boolean;
    current_branch: string;
    target_branch: string;
    commits_ahead: number;
    mr_status?: 'Created' | 'Merged' | 'Rejected' | 'No MR' | 'Error';
    sourceBranchExists: boolean;
    targetBranchExists: boolean;
}
