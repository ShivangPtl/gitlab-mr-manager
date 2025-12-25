export function getProjectType(projectName: string): 'common' | 'ui' | 'api' {
  const name = projectName.toLowerCase();

  if (name.includes('common')) {
    return 'common';
  }

  if (name.includes('.ui') || name.includes('ui')) {
    return 'ui';
  }

  return 'api';
}
