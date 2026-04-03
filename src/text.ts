import { CONTENT_MAX_LENGTH } from './constants.js';

export function truncateContent(content: string, maxLength = CONTENT_MAX_LENGTH): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}...`;
}
