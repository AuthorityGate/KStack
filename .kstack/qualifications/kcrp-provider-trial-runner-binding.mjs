import { fileDigest, recordDigest } from './host-implementation-inventory.mjs';

export function qualificationRunnerDigest() {
  return recordDigest({
    preparerDigest: fileDigest('.kstack/qualifications/prepare-kcrp-provider-trial-window.mjs'),
    executorDigest: fileDigest('.kstack/qualifications/run-kcrp-provider-trial-window.mjs'),
    providerRunnerDigest: fileDigest('plugins/kstack/scripts/kstack-provider-runner.mjs'),
    trialContractDigest: fileDigest('plugins/kstack/scripts/kstack-kcrp-provider-trial.mjs')
  });
}
