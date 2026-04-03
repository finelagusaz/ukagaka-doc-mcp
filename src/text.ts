import { SUMMARY_MAX_LENGTH } from './constants.js';

export function buildSummary(content: string, maxLength = SUMMARY_MAX_LENGTH): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}...`;
}
