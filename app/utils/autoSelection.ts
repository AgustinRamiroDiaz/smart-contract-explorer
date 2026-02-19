/**
 * Auto-selection helpers: when there is exactly one option,
 * return it so the UI can select it automatically.
 */

import type { DeploymentsFile } from '../types';

export function getAutoSelectedNetwork(deploymentsFile: DeploymentsFile): string | null {
  const networks = Object.keys(deploymentsFile);
  return networks.length === 1 ? networks[0] : null;
}

export function getAutoSelectedDeployment(
  deploymentsFile: DeploymentsFile,
  network: string
): string | null {
  if (!network) return null;
  const deployments = Object.keys(deploymentsFile[network] || {});
  return deployments.length === 1 ? deployments[0] : null;
}
